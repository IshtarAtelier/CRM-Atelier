import { prisma } from '@/lib/db';
import { logAudit } from '@/lib/audit';
import { avisarAlEquipo } from '@/lib/avisos/aviso-al-equipo';
import { dentroDelHorarioComercial } from './horario-comercial';

/**
 * FUERA DE HORARIO, EL BOT SIEMPRE ESTÁ PRENDIDO.
 *
 * Pedido de Ishtar (16/9/2026), después de que Milena apagó el bot el 12/9 a
 * las 10:07 y quedó apagado casi 4 días —828 mensajes entrantes, 0
 * respondidos—, buena parte de noches y fin de semana. `bot_enabled` es un
 * interruptor manual sin memoria: nada lo recordaba encendido.
 *
 * Este vigilante corre en cada tick del reloj interno (cada 10 min,
 * `instrumentation.ts`) y, si el local está CERRADO (`horario-comercial.ts`)
 * y el bot está apagado, lo prende solo — salvo que alguien haya tildado
 * "mantener apagado fuera de horario también"
 * (`SystemSetting.bot_mantener_apagado_fuera_horario`), el escape para un
 * apagado real y deliberado.
 *
 * Durante el horario comercial NO toca nada: apagarlo para atender a mano
 * sigue siendo decisión del equipo, como siempre.
 *
 * Atómico igual que el resto de los robots que escriben (patrón del 8-9/9):
 * de las dos instancias, la que gana el `updateMany` es la única que avisa —
 * nunca dos mensajes por el mismo apagado.
 */
const NOMBRE_SISTEMA = 'Sistema (Horario)';

export interface ResultadoVigilancia {
    accion: 'encendido' | 'nada';
    motivo: string;
}

export async function vigilarBotFueraDeHorario(now: Date = new Date()): Promise<ResultadoVigilancia> {
    if (dentroDelHorarioComercial(now)) return { accion: 'nada', motivo: 'en horario comercial' };

    const override = await prisma.systemSetting.findUnique({ where: { key: 'bot_mantener_apagado_fuera_horario' } });
    if (override?.value === 'true') return { accion: 'nada', motivo: 'mantener apagado fuera de horario está tildado' };

    const actual = await prisma.systemSetting.findUnique({ where: { key: 'bot_enabled' } });
    let gane = false;
    if (!actual) {
        try {
            await prisma.systemSetting.create({ data: { key: 'bot_enabled', value: 'true' } });
            gane = true;
        } catch (e: any) {
            if (e?.code !== 'P2002') throw e; // otra instancia lo creó primero
        }
    } else if (actual.value !== 'true') {
        const tomado = await prisma.systemSetting.updateMany({ where: { key: 'bot_enabled', value: actual.value }, data: { value: 'true' } });
        gane = tomado.count === 1;
    } else {
        return { accion: 'nada', motivo: 'ya estaba prendido' };
    }

    if (!gane) return { accion: 'nada', motivo: 'ya estaba prendido' };

    await logAudit({
        userId: null,
        userName: NOMBRE_SISTEMA,
        action: 'UPDATE',
        entityType: 'SETTING',
        entityId: 'bot_enabled',
        details: { descripcion: 'El bot se prendió solo por estar fuera de horario comercial', botActivo: true },
    });
    await avisarAlEquipo({
        asunto: '🤖 El bot se prendió solo (estaba apagado, fuera de horario)',
        cuerpo: 'Alguien lo había apagado y el local está cerrado ahora: el bot vuelve a contestar para que ningún cliente se quede sin respuesta de noche o fin de semana. Si de verdad querés que quede apagado también fuera de horario, tildá esa opción al lado del interruptor del Asistente en el buzón — así este aviso no se repite.',
        dedupePrefijo: '🤖 El bot se prendió solo',
    });

    return { accion: 'encendido', motivo: 'fuera de horario comercial' };
}
