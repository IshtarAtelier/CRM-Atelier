import { prisma } from '@/lib/db';
import { diaArt, inicioDelDiaArt } from './registro';
import { HORA_DESDE, HORA_HASTA } from '@/lib/constants/seguimientos';
import { EmbudoService } from '@/services/embudo.service';

/**
 * La salud del embudo, de un vistazo: qué pasó cada uno de los últimos días
 * y qué está mal HOY. La leen la vista `/admin/leads/salud` (vía
 * `/api/embudo/salud`) y la alerta diaria (`/api/cron/embudo-salud`).
 *
 * Qué es "mal" (pedido de Ishtar, 12/9/2026: "debería ser imposible que un
 * día pase sin seguimientos y que un contacto quede olvidado"):
 *  - el motor NO corrió en una hora hábil (falta la corrida de esa hora);
 *  - corrió, tenía a quién mandarle (elegidos + en espera > 0) y no mandó nada;
 *  - hubo fallas; se frenó;
 *  - hay leads con un toque vencido hace más de 24 h a los que NADIE les
 *    escribió (ni el motor ni una persona): "olvidados".
 */

export interface DiaDeSalud {
    dia: string;
    corridas: number;
    horasSinCorrida: number[];
    candidatosMax: number;
    enviados: number;
    fallidos: number;
    enEsperaUltimo: number;
    frenos: number;
    errores: string[];
    vetosPrincipales: { motivo: string; cantidad: number }[];
    respuestas: number;
}

export interface SaludDelEmbudo {
    generadoEn: string;
    hoy: string;
    dias: DiaDeSalud[];
    olvidados: { nombre: string; paso: string; vencidoHace: string; leadId: string }[];
    problemasHoy: string[];
}

const HORA_MS = 3_600_000;

/** Horas hábiles ya pasadas de un día (todas si es un día anterior). */
function horasQueDebieronCorrer(dia: string, now: number): number[] {
    const hoy = diaArt(now);
    const horaAhora = new Date(now - 3 * HORA_MS).getUTCHours();
    const horas: number[] = [];
    for (let h = HORA_DESDE; h < HORA_HASTA; h++) {
        if (dia < hoy || (dia === hoy && h < horaAhora)) horas.push(h);
    }
    return horas;
}

export async function saludDelEmbudo(diasAtras = 7, now = Date.now()): Promise<SaludDelEmbudo> {
    const dias: string[] = [];
    for (let i = diasAtras - 1; i >= 0; i--) dias.push(diaArt(now - i * 24 * HORA_MS));
    const desde = inicioDelDiaArt(now - (diasAtras - 1) * 24 * HORA_MS);

    const [corridas, respuestas] = await Promise.all([
        prisma.seguimientoCorrida.findMany({
            where: { diaArt: { in: dias } },
            select: { diaArt: true, horaArt: true, candidatos: true, elegidos: true, enviados: true, fallidos: true, enEspera: true, error: true, vetados: true, createdAt: true },
            orderBy: { createdAt: 'asc' },
        }),
        prisma.clientTask.findMany({
            where: { createdAt: { gte: desde }, description: { startsWith: '💬 Respondió al seguimiento' } },
            select: { createdAt: true },
        }),
    ]);

    const porDia: DiaDeSalud[] = dias.map(dia => {
        const c = corridas.filter(x => x.diaArt === dia);
        const horasCorridas = new Set(c.map(x => x.horaArt));
        const vetos = new Map<string, number>();
        for (const x of c) for (const v of (x.vetados as { motivo: string; cantidad: number }[] | null) ?? []) vetos.set(v.motivo, Math.max(vetos.get(v.motivo) ?? 0, v.cantidad));
        return {
            dia,
            corridas: c.length,
            horasSinCorrida: horasQueDebieronCorrer(dia, now).filter(h => !horasCorridas.has(h)),
            candidatosMax: Math.max(0, ...c.map(x => x.candidatos)),
            enviados: c.reduce((a, x) => a + x.enviados, 0),
            fallidos: c.reduce((a, x) => a + x.fallidos, 0),
            enEsperaUltimo: c.length ? c[c.length - 1].enEspera : 0,
            frenos: c.filter(x => (x.error || '').startsWith('freno')).length,
            errores: c.map(x => x.error).filter((e): e is string => !!e && !e.startsWith('freno')),
            vetosPrincipales: [...vetos.entries()].map(([motivo, cantidad]) => ({ motivo, cantidad })).sort((a, b) => b.cantidad - a.cantidad).slice(0, 5),
            respuestas: respuestas.filter(r => diaArt(r.createdAt) === dia).length,
        };
    });

    // Olvidados: toque vencido hace más de 24 h y nadie le escribió desde entonces.
    const { paraHoy } = await EmbudoService.tablero(now);
    const olvidados = paraHoy
        .filter(l => l.proximaAccion.tipo === 'plantilla' && l.proximaAccion.venceEn && now - new Date(l.proximaAccion.venceEn).getTime() > 24 * HORA_MS && !l.contactado)
        .map(l => ({ nombre: l.name, paso: l.proximaAccion.etiqueta.replace(/^Hoy: /, ''), vencidoHace: `${Math.floor((now - new Date(l.proximaAccion.venceEn!).getTime()) / (24 * HORA_MS))} días`, leadId: l.id }));

    const hoy = porDia[porDia.length - 1];
    const problemasHoy: string[] = [];
    if (hoy.horasSinCorrida.length) problemasHoy.push(`El motor no corrió a las ${hoy.horasSinCorrida.join(', ')} hs.`);
    if (hoy.corridas > 0 && hoy.enviados === 0 && (hoy.enEsperaUltimo > 0 || corridas.some(c => c.diaArt === hoy.dia && c.elegidos > 0))) problemasHoy.push('Corrió, tenía a quién escribirle y no mandó nada.');
    if (hoy.fallidos) problemasHoy.push(`${hoy.fallidos} envío(s) fallaron.`);
    if (hoy.frenos) problemasHoy.push(`El motor se frenó ${hoy.frenos} vez/veces (3 fallas seguidas).`);
    if (hoy.errores.length) problemasHoy.push(`Corridas con error: ${hoy.errores.slice(0, 3).join(' | ')}`);
    if (olvidados.length) problemasHoy.push(`${olvidados.length} lead(s) con un toque vencido hace más de un día y nadie les escribió.`);

    return { generadoEn: new Date(now).toISOString(), hoy: diaArt(now), dias: porDia, olvidados: olvidados.slice(0, 50), problemasHoy };
}
