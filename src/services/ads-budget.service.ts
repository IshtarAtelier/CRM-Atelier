import { prisma } from '@/lib/db';
import { fetchCampaignInsights, metaAdsConfigured } from '@/lib/ads/meta-insights';
import { GoogleAdsService } from '@/services/google-ads.service';
import {
  ADS_MONTHLY_CAP_ARS_DEFAULT,
  ADS_MONTHLY_CAP_SETTING_KEY,
  ADS_CAP_UMBRAL_ATENCION,
} from '@/lib/constants/ads';

/**
 * Vigilancia del techo mensual de inversión publicitaria.
 *
 * Por qué existe: el techo que fijó la dueña (un millón entre Google y Meta) no
 * se puede hacer cumplir con las herramientas de las plataformas. El límite de
 * gasto de Meta es de POR VIDA, no mensual —se acumula contra el gastado
 * histórico y hay que resetearlo a mano cuando se llena— y Google, en cuentas
 * que pagan con tarjeta, no tiene tope de cuenta. O sea que sin esto el techo
 * depende de que los presupuestos diarios estén bien puestos y de que alguien
 * los mire. Que es exactamente de lo que la dueña pidió no depender.
 *
 * Lo que hace: lee lo gastado en el mes en las dos plataformas, proyecta a fin
 * de mes con el ritmo actual, y avisa. **No apaga campañas.** Es la regla del
 * proyecto para los crons: avisan por email, no autocorrigen — apagar sola una
 * campaña que la dueña acaba de prender sería peor que el problema.
 */

export type EstadoTecho = 'ok' | 'atencion' | 'excedido' | 'sin_datos';

export interface TechoPublicitario {
  techoArs: number;
  gastadoArs: number | null;
  meta: number | null;
  google: number | null;
  /** Plataformas que no se pudieron leer (el gasto real es MAYOR al informado). */
  sinLeer: string[];
  diaDelMes: number;
  diasDelMes: number;
  proyeccionArs: number | null;
  porcentajeProyectado: number | null;
  estado: EstadoTecho;
  mensaje: string;
}

export class AdsBudgetService {
  /** Techo vigente: SystemSetting si existe, si no la constante. */
  static async getTechoArs(): Promise<number> {
    try {
      const fila = await prisma.systemSetting.findUnique({
        where: { key: ADS_MONTHLY_CAP_SETTING_KEY },
      });
      const valor = Number(fila?.value);
      if (Number.isFinite(valor) && valor > 0) return valor;
    } catch {
      /* si la consulta falla, vale el default */
    }
    return ADS_MONTHLY_CAP_ARS_DEFAULT;
  }

  /**
   * Estado del mes en curso. Nunca lanza: es un vigilante, no puede ser el
   * motivo de que el reporte diario no salga.
   */
  static async getEstado(): Promise<TechoPublicitario> {
    const techoArs = await this.getTechoArs();

    const hoy = new Date();
    const diaDelMes = hoy.getDate();
    const diasDelMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).getDate();

    const sinLeer: string[] = [];

    // Meta: `fetchCampaignInsights` ya suma las DOS cuentas y convierte lo de la
    // cuenta USD a pesos al blue, que es como se lee el gasto en los reportes.
    let meta: number | null = null;
    if (metaAdsConfigured()) {
      try {
        const filas = await fetchCampaignInsights('this_month');
        meta = filas.reduce((acc, f) => acc + (f.spendArs || 0), 0);
      } catch (err) {
        console.error('[AdsBudgetService] No se pudo leer el gasto de Meta:', err);
        sinLeer.push('Meta');
      }
    } else {
      sinLeer.push('Meta (sin configurar)');
    }

    const google = await GoogleAdsService.getMonthToDateSpendArs();
    if (google === null) sinLeer.push('Google Ads');

    const leidos = [meta, google].filter((v): v is number => v !== null);
    const gastadoArs = leidos.length ? leidos.reduce((a, b) => a + b, 0) : null;

    // Proyección lineal: lo gastado por día, por los días del mes. Es tosca a
    // propósito — sirve para levantar la mano temprano, no para presupuestar.
    const proyeccionArs =
      gastadoArs !== null && diaDelMes > 0 ? (gastadoArs / diaDelMes) * diasDelMes : null;
    const porcentajeProyectado = proyeccionArs !== null ? proyeccionArs / techoArs : null;

    let estado: EstadoTecho = 'ok';
    let mensaje = '';

    if (gastadoArs === null) {
      estado = 'sin_datos';
      mensaje = 'No se pudo leer el gasto de ninguna plataforma.';
    } else if (gastadoArs > techoArs) {
      estado = 'excedido';
      mensaje = `Ya se superó el techo del mes: $${Math.round(gastadoArs).toLocaleString('es-AR')} de $${techoArs.toLocaleString('es-AR')}.`;
    } else if (porcentajeProyectado !== null && porcentajeProyectado > 1) {
      estado = 'excedido';
      mensaje = `Al ritmo actual el mes cierra en $${Math.round(proyeccionArs!).toLocaleString('es-AR')}, por encima del techo de $${techoArs.toLocaleString('es-AR')}.`;
    } else if (porcentajeProyectado !== null && porcentajeProyectado >= ADS_CAP_UMBRAL_ATENCION) {
      estado = 'atencion';
      mensaje = `Al ritmo actual el mes cierra en $${Math.round(proyeccionArs!).toLocaleString('es-AR')} — el ${Math.round(porcentajeProyectado * 100)}% del techo.`;
    } else {
      mensaje = `Dentro del techo: proyección $${Math.round(proyeccionArs ?? 0).toLocaleString('es-AR')} de $${techoArs.toLocaleString('es-AR')}.`;
    }

    // Una plataforma que no se pudo leer significa que el gasto REAL es mayor
    // que el informado. Decirlo explícito evita leer un "ok" que no lo es.
    if (sinLeer.length && estado !== 'sin_datos') {
      mensaje += ` Ojo: no se pudo leer ${sinLeer.join(' ni ')}, así que el gasto real es mayor.`;
      if (estado === 'ok') estado = 'atencion';
    }

    return {
      techoArs,
      gastadoArs,
      meta,
      google,
      sinLeer,
      diaDelMes,
      diasDelMes,
      proyeccionArs,
      porcentajeProyectado,
      estado,
      mensaje,
    };
  }
}
