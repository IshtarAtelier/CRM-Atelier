import { SYSTEM_ACTOR } from '@/lib/actor';
import { sendWhatsApp } from '@/lib/whatsapp/send';
import { templateSpec, WHATSAPP_TEMPLATES } from '@/lib/whatsapp/templates';
import { saludoSegunHoraArgentina } from '@/lib/whatsapp/saludo';
import { registrarSeguimientoEnviado } from '@/lib/embudo/registrar-seguimiento';
import { PAUSA_ENTRE_ENVIOS_MS } from '@/lib/constants/seguimientos';
import { nombreDePila, type Candidato } from './politica';
import { reclamarEnvio, cerrarEnvio, diaArt } from './registro';

/**
 * MANDA. Cero lógica de negocio: lo que hay que decidir se decidió arriba
 * (playbook + política + selección). Por cada elegido: arma las variables de
 * la plantilla, envía, y deja el MISMO rastro que deja un envío humano
 * (`registrarSeguimientoEnviado`), así la tarjeta del embudo se mueve igual y
 * la ficha queda firmada igual — solo cambia el actor: 'Sistema'.
 */

export interface ResultadoEnvio {
    leadId: string;
    nombre: string;
    plantilla: string;
    ok: boolean;
    /** true = no se intentó (ya estaba reclamado hoy, o el freno cortó la tanda). No cuenta como falla. */
    salteado?: boolean;
    detalle?: string;
}

/**
 * FRENO: con esta cantidad de fallas SEGUIDAS al mandar, se corta la tanda.
 * Tres rebotes consecutivos no son tres clientes raros: es la cuenta (pago,
 * plantilla pausada, token) o la API caída, y seguir mandando de a 15 por
 * hora contra eso solo suma rechazos y le pega a la calidad del número. El
 * resto queda "salteado" con motivo y vuelve a evaluarse en el tick siguiente.
 */
export const FALLAS_SEGUIDAS_PARA_FRENAR = 3;

/** Puro: ¿hay que frenar? (las últimas N no salteadas fallaron) */
export function debeFrenar(resultados: ResultadoEnvio[], umbral = FALLAS_SEGUIDAS_PARA_FRENAR): boolean {
    const intentados = resultados.filter(r => !r.salteado);
    if (intentados.length < umbral) return false;
    return intentados.slice(-umbral).every(r => !r.ok);
}

const dormir = (ms: number) => new Promise(r => setTimeout(r, ms));

/**
 * Variables de la plantilla a partir de sus etiquetas declaradas en el
 * catálogo. Si una plantilla pide algo que el motor no sabe llenar, se corta
 * acá con error en vez de mandar un mensaje con un hueco.
 */
export function armarParametros(plantilla: keyof typeof WHATSAPP_TEMPLATES, nombre: string, now: Date): string[] {
    const def = WHATSAPP_TEMPLATES[plantilla] as { params?: readonly { label: string }[] };
    return (def.params ?? []).map(p => {
        if (p.label === 'nombre') return nombreDePila(nombre) ?? '';
        if (p.label === 'saludo según la hora') return saludoSegunHoraArgentina(now);
        throw new Error(`La plantilla ${plantilla} pide "${p.label}" y el motor no sabe llenarlo`);
    });
}

export async function ejecutar(elegidos: Candidato[], now = new Date()): Promise<{ resultados: ResultadoEnvio[]; frenado: boolean }> {
    const resultados: ResultadoEnvio[] = [];
    const dia = diaArt(now);
    let frenado = false;

    for (let i = 0; i < elegidos.length; i++) {
        const c = elegidos[i];
        const plantilla = c.plantilla!;
        if (frenado) {
            resultados.push({ leadId: c.leadId, nombre: c.nombre, plantilla, ok: false, salteado: true, detalle: `freno: ${FALLAS_SEGUIDAS_PARA_FRENAR} fallas seguidas; se reintenta en el próximo tick` });
            continue;
        }
        // Clave única (chat + plantilla + día): si ya existe, hoy ya se mandó
        // (o lo está mandando la otra instancia). No se manda dos veces.
        const registroId = await reclamarEnvio({ chatId: c.waChatId!, clientId: c.leadId, plantilla, dia });
        if (!registroId) {
            resultados.push({ leadId: c.leadId, nombre: c.nombre, plantilla, ok: false, salteado: true, detalle: 'ya reclamado hoy (clave única chat+plantilla+día)' });
            continue;
        }
        try {
            const params = armarParametros(plantilla, c.nombre, now);
            const r = await sendWhatsApp({
                chatId: c.waChatId!,
                message: '',
                senderName: SYSTEM_ACTOR.name,
                // Automático: no apaga el bot del chat ni se cuenta como traspaso.
                isProactive: true,
                // Siempre plantilla, aunque la ventana esté abierta: el texto es el
                // aprobado, y así el rastro es el mismo en todos los casos.
                forceTemplate: true,
                template: templateSpec(plantilla, params),
            });
            if (!r.ok) {
                const detalle = r.error || `HTTP ${r.status ?? '?'}`;
                await cerrarEnvio(registroId, 'FALLIDO', detalle);
                resultados.push({ leadId: c.leadId, nombre: c.nombre, plantilla, ok: false, detalle });
            } else {
                await cerrarEnvio(registroId, 'ENVIADO', r.via);
                // Ya SALIÓ: pase lo que pase con el registro, cuenta como enviado.
                // Antes, si el registro fallaba, quedaba "fallido" y sin la etiqueta
                // del escalón, y el tick siguiente se lo volvía a mandar. La
                // compuerta de 48 h (`politica.ts`) es la otra mitad de esa red.
                try {
                    await registrarSeguimientoEnviado({ chatId: c.waChatId!, plantilla, actor: SYSTEM_ACTOR });
                    resultados.push({ leadId: c.leadId, nombre: c.nombre, plantilla, ok: true, detalle: r.via });
                } catch (e: any) {
                    console.error(`[Motor seguimientos] Enviado a ${c.nombre} pero no se pudo registrar:`, e?.message);
                    resultados.push({ leadId: c.leadId, nombre: c.nombre, plantilla, ok: true, detalle: `enviado, pero no se pudo registrar: ${e?.message}` });
                }
            }
        } catch (e: any) {
            await cerrarEnvio(registroId, 'FALLIDO', e?.message);
            resultados.push({ leadId: c.leadId, nombre: c.nombre, plantilla, ok: false, detalle: e?.message });
        }

        if (debeFrenar(resultados)) {
            frenado = true;
            console.error(`[Motor seguimientos] FRENO: ${FALLAS_SEGUIDAS_PARA_FRENAR} fallas seguidas. Se corta la tanda.`);
            continue;
        }

        if (i < elegidos.length - 1) {
            const [min, max] = PAUSA_ENTRE_ENVIOS_MS;
            await dormir(min + Math.random() * (max - min));
        }
    }

    return { resultados, frenado };
}
