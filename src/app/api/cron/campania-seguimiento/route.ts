import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { sendWhatsApp, esFalloTransitorio } from '@/lib/whatsapp/send';
import { formatPhoneForWhatsApp } from '@/lib/phone-utils';
import { WHATSAPP_TEMPLATES, templateSpec } from '@/lib/whatsapp/templates';
import { STORE_ORIGIN } from '@/lib/constants';
import { BUSINESS_INFO } from '@/lib/business-info';
import { fetchWa } from '@/lib/wa-config';
import audienciaNovedades from '@/data/campanias/novedades-sep2026.json';
import type { Prisma } from '@prisma/client';

/**
 * Dos campañas puntuales de reactivación (30/8/26, pedidas por Ishtar), con el
 * mismo motor por tandas del cron de 12 cuotas (campania-mp-12-cuotas):
 *
 * - `?campana=soycliente`: clientes VIEJOS (venta real anterior a junio 2026,
 *   o del sistema anterior vía Client.contactSource='Importado') que no
 *   compraron ni escribieron en jun-ago — avisar que hay tienda online, con
 *   el cupón SOYCLIENTE (15% OFF, sin mínimo).
 * - `?campana=armazones`: quien YA recibió la campaña de 12 cuotas (tiene el
 *   tag "Campaña MP 12 Cuotas") y sigue sin comprar — sumarle lo que a ese
 *   mensaje le faltaba: tienda, cupón QUIEROMISLENTES e Instagram.
 *
 * - `?campana=novedades` (25/9/26): clientes que compraron hace más de 3
 *   meses y no volvieron — Instagram, agendarnos, cuotas y Cápsula Escarlata.
 *   La audiencia sale de CRUZAR las planillas del sistema anterior
 *   (prisma/legacy_data/ATELIER 1 y 2, las únicas con la fecha de esas
 *   compras) con el CRM: es una lista de ids en
 *   src/data/campanias/novedades-sep2026.json, que acá se vuelve a filtrar en
 *   vivo (compra reciente, exclusiones, ya enviado). Dos frenos propios: no
 *   manda nada mientras la plantilla no esté APPROVED en Meta, y corta en
 *   LIMITE_DIARIO_NOVEDADES por día (el cupo de la línea es 250 conversaciones
 *   diarias, compartido con los seguimientos automáticos).
 *
 * Mismo diseño anti-ban que el cron hermano: tandas chicas (`batch`, default
 * 5) con pausas de 20-40 s adentro, tag propio por campaña para dedup
 * atómico, respeta followups_enabled y horario comercial ART (10-19).
 * `?dryRun=1` lista sin enviar.
 */

type Campana = 'soycliente' | 'armazones' | 'novedades';
type Plantilla = 'tienda_online_soycliente_v2' | 'tienda_online_quieromislentes' | 'novedades_clientes_escarlata' | 'novedades_clientes_soycliente';

/**
 * Tope de envíos por día de la campaña novedades, en rampa: 40 el primer día,
 * 80 el segundo y 120 desde el tercero (decidido con Ishtar el 25/9/26). Así,
 * si el primer día la gente bloquea más de lo esperado, se nota con 40
 * mensajes y no con 120.
 */
const RAMPA_NOVEDADES = [40, 80, 120];
/** Si más de este porcentaje de los que recibieron pide la baja, la campaña se frena sola. */
const TASA_MAXIMA_BAJAS = 0.05;
/** Etiquetas que sacan a alguien de la campaña novedades aunque esté en la lista. */
const EXCLUIR_NOVEDADES = ['Campaña Tienda SoyCliente', 'Sin Seguimiento', 'Reclamo y post venta', 'Cancelar Bot'];

// v2 (30/8/26): ambas plantillas suman "contanos qué modelito te gustó" y
// llevan tienda + Instagram sí o sí (texto y botones). El TAG no cambia:
// quien ya recibió la v1 esta tarde no vuelve a recibir la v2.
const CONFIG: Record<Campana, { tag: string; plantilla: Plantilla }> = {
    soycliente: { tag: 'Campaña Tienda SoyCliente', plantilla: 'tienda_online_soycliente_v2' },
    armazones: { tag: 'Campaña Seguimiento Armazones', plantilla: 'tienda_online_quieromislentes' },
    // v2 con cupón SOYCLIENTE (25/9/26). La v1 (sin cupón) quedó creada en Meta sin usar.
    novedades: { tag: 'Campaña Novedades Sep26', plantilla: 'novedades_clientes_soycliente' },
};

const dormir = (ms: number) => new Promise(r => setTimeout(r, ms));

function horaArgentina(): number {
    return (new Date().getUTCHours() + 24 - 3) % 24;
}

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
    if (searchParams.get('secret') !== cronSecret && token !== cronSecret) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const campanaParam = searchParams.get('campana') as Campana | null;
    if (!campanaParam || !CONFIG[campanaParam]) {
        return NextResponse.json({ error: `?campana debe ser 'soycliente', 'armazones' o 'novedades'` }, { status: 400 });
    }
    const { tag: nombreTag, plantilla } = CONFIG[campanaParam];

    const dryRun = searchParams.get('dryRun') === '1';
    const batch = Math.min(Math.max(parseInt(searchParams.get('batch') || '5', 10) || 5, 1), 10);

    const setting = await prisma.systemSetting.findUnique({ where: { key: 'followups_enabled' } });
    if (setting && setting.value !== 'true') {
        return NextResponse.json({ ok: false, motivo: 'followups_enabled=false — campaña pausada' });
    }

    // Horario real del local (BUSINESS_INFO.hours): 9 a 20 en semana. La
    // campaña hermana (12 cuotas) usa 10-19 por conservadora, pero acá se
    // sigue el horario comercial real para no quedar mandando de más afuera.
    const hora = horaArgentina();
    if (!dryRun && (hora < 9 || hora >= 20)) {
        return NextResponse.json({ ok: false, motivo: `fuera de horario comercial (hora ART ${hora})` });
    }

    const tag = await prisma.tag.upsert({
        where: { name: nombreTag },
        update: {},
        create: { name: nombreTag, color: '#0ea5e9' },
    });

    const NUCLEO_TEL_OPTICA = BUSINESS_INFO.phoneE164.replace(/\D/g, '').slice(-10);
    const CORTE_RECIENTE = new Date('2026-06-01T00:00:00-03:00');

    // Novedades: no se manda nada con la plantilla PENDING en Meta (el envío se
    // rechaza y quema un turno de la tanda). El espejo local se actualiza con el
    // mismo sync que usa el cron de calidad; si falla, se espera al próximo run.
    if (campanaParam === 'novedades' && !dryRun) {
        let estado = (await prisma.whatsAppTemplate.findFirst({ where: { name: plantilla }, select: { status: true } }))?.status;
        if (estado !== 'APPROVED') {
            await fetchWa('/api/templates/sync', { method: 'POST' }).catch(() => null);
            estado = (await prisma.whatsAppTemplate.findFirst({ where: { name: plantilla }, select: { status: true } }))?.status;
        }
        if (estado !== 'APPROVED') {
            return NextResponse.json({ ok: true, campana: campanaParam, enviados: 0, esperando: `plantilla ${plantilla} en estado ${estado ?? 'inexistente'} en Meta` });
        }
    }

    // Novedades: frenos de salud de la línea. Con la API oficial el riesgo no es
    // que "cierren el número" por mandar plantillas aprobadas: es que la gente
    // bloquee o reporte, baje la calidad (GREEN → YELLOW → RED) y Meta recorte el
    // cupo o pause la plantilla. Por eso: solo se manda con la calidad en GREEN,
    // y si la tasa de bajas de esta campaña pasa el 5% se frena sola.
    if (campanaParam === 'novedades' && !dryRun) {
        const st = await fetchWa('/api/status', { cache: 'no-store' }).then(r => r.json()).catch(() => null) as { qualityRating?: string; isReady?: boolean } | null;
        if (!st?.isReady || st.qualityRating !== 'GREEN') {
            return NextResponse.json({ ok: true, campana: campanaParam, enviados: 0, esperando: `calidad de la línea ${st?.qualityRating ?? 'desconocida'} (se manda solo con GREEN)` });
        }
        const recibieron = await prisma.client.count({ where: { tags: { some: { id: tag.id } } } });
        if (recibieron >= 40) {
            const bajas = await prisma.client.count({
                where: { tags: { some: { id: tag.id } }, whatsappChats: { some: { chatLabels: { has: 'SIN_SEGUIMIENTO' } } } },
            });
            if (bajas / recibieron > TASA_MAXIMA_BAJAS) {
                return NextResponse.json({ ok: true, campana: campanaParam, enviados: 0, frenada: `tasa de bajas ${bajas}/${recibieron} supera el ${TASA_MAXIMA_BAJAS * 100}%: revisar antes de seguir` });
            }
        }
    }

    let whereCandidatos: Prisma.ClientWhereInput;
    if (campanaParam === 'novedades') {
        // Lista cruzada con las planillas del sistema anterior; acá se vuelve a
        // filtrar EN VIVO: quien compró en los últimos 3 meses (pago o fábrica)
        // ya no es "hace más de 3 meses", y quien pidió no recibir mensajes
        // (etiqueta o chat marcado SIN_SEGUIMIENTO por la auto-exclusión) no entra.
        const corte = new Date(Date.now() - 3 * 30.44 * 864e5);
        const excluidas = await prisma.tag.findMany({ where: { name: { in: EXCLUIR_NOVEDADES } }, select: { id: true } });
        whereCandidatos = {
            id: { in: audienciaNovedades.clientIds },
            isDeleted: false,
            phone: { not: null },
            NOT: { phone: { contains: NUCLEO_TEL_OPTICA } },
            tags: { none: { id: { in: [tag.id, ...excluidas.map(t => t.id)] } } },
            whatsappChats: { none: { chatLabels: { has: 'SIN_SEGUIMIENTO' } } },
            orders: {
                none: {
                    isDeleted: false,
                    OR: [
                        { labSentAt: { gte: corte } },
                        { payments: { some: { date: { gte: corte } } } },
                    ],
                },
            },
        };
    } else if (campanaParam === 'soycliente') {
        // Venta real vieja, o del sistema anterior — pero sin nada reciente
        // (jun-ago 2026, ya cubiertos por la campaña de 12 cuotas).
        whereCandidatos = {
            isDeleted: false,
            phone: { not: null },
            NOT: { phone: { contains: NUCLEO_TEL_OPTICA } },
            orders: { none: { isDeleted: false, createdAt: { gte: CORTE_RECIENTE } } },
            tags: { none: { id: tag.id } },
            OR: [
                { orders: { some: { isDeleted: false, orderType: { in: ['SALE', 'MAYORISTA'] } } } },
                { contactSource: 'Importado' },
            ],
        };
    } else {
        // Prospectos jun-ago 2026 sin NINGUNA compra. Cubre tanto a quien ya
        // recibió la campaña de 12 cuotas (le llega como seguimiento) como a
        // quien todavía no recibió nada (le llega como primer contacto — el
        // texto "¿Ya conocés nuestra tienda?" funciona para ambos). Se excluye
        // a los 'Importado': esos son clientes del sistema anterior y les
        // corresponde la campaña soycliente — sin esta exclusión un importado
        // de julio sin ventas recibiría LOS DOS mensajes con DOS cupones.
        whereCandidatos = {
            createdAt: { gte: CORTE_RECIENTE, lt: new Date('2026-09-01T00:00:00-03:00') },
            isDeleted: false,
            phone: { not: null },
            NOT: [
                { phone: { contains: NUCLEO_TEL_OPTICA } },
                { contactSource: 'Importado' },
            ],
            orders: { none: { isDeleted: false } },
            tags: { none: { id: tag.id } },
        };
    }

    // Tope diario de la campaña novedades: se cuentan las notas que deja cada
    // envío en la ficha desde la medianoche de Argentina.
    let cupoHoy = batch;
    if (campanaParam === 'novedades' && !dryRun) {
        const ahoraArt = new Date(Date.now() - 3 * 3600e3);
        const inicioDia = new Date(Date.UTC(ahoraArt.getUTCFullYear(), ahoraArt.getUTCMonth(), ahoraArt.getUTCDate(), 3, 0, 0));
        const prefijo = `📣 [${nombreTag}]`;
        const enviadosHoy = await prisma.interaction.count({
            where: { createdAt: { gte: inicioDia }, content: { startsWith: prefijo } },
        });
        // Día de campaña = días calendario desde el primer envío (0 = hoy es el primero).
        const primero = await prisma.interaction.findFirst({
            where: { content: { startsWith: prefijo } }, orderBy: { createdAt: 'asc' }, select: { createdAt: true },
        });
        const diaDeCampana = primero ? Math.floor((inicioDia.getTime() - primero.createdAt.getTime()) / 864e5) + 1 : 0;
        const limiteHoy = RAMPA_NOVEDADES[Math.min(Math.max(diaDeCampana, 0), RAMPA_NOVEDADES.length - 1)];
        cupoHoy = Math.min(batch, Math.max(0, limiteHoy - enviadosHoy));
        if (cupoHoy === 0) {
            return NextResponse.json({ ok: true, campana: campanaParam, enviados: 0, motivo: `tope del día alcanzado (${enviadosHoy}/${limiteHoy})` });
        }
    }

    // Novedades respeta el orden de la lista (compra más reciente primero).
    const ordenLista = new Map(audienciaNovedades.clientIds.map((id, i) => [id, i]));
    const candidatos = campanaParam === 'novedades'
        ? (await prisma.client.findMany({ where: whereCandidatos, select: { id: true, name: true, phone: true } }))
            .sort((a, b) => (ordenLista.get(a.id) ?? 1e9) - (ordenLista.get(b.id) ?? 1e9))
            .slice(0, dryRun ? 1000 : cupoHoy)
        : await prisma.client.findMany({
            where: whereCandidatos,
            select: { id: true, name: true, phone: true },
            orderBy: { createdAt: 'asc' },
            take: dryRun ? 1000 : cupoHoy,
        });

    if (dryRun) {
        return NextResponse.json({
            ok: true, dryRun: true, campana: campanaParam, plantilla,
            pendientes: candidatos.length,
            muestra: candidatos.slice(0, 5).map(c => ({ nombre: c.name, telefono: (c.phone || '').slice(0, 6) + '…' })),
        });
    }

    const reclamar = (clientId: string) => prisma.$executeRawUnsafe(
        'INSERT INTO "_ClientToTag" ("A", "B") VALUES ($1, $2) ON CONFLICT DO NOTHING',
        clientId, tag.id,
    );
    const liberar = (clientId: string) => prisma.$executeRawUnsafe(
        'DELETE FROM "_ClientToTag" WHERE "A" = $1 AND "B" = $2',
        clientId, tag.id,
    ).catch(() => 0);

    let enviados = 0;
    const errores: string[] = [];
    for (let i = 0; i < candidatos.length; i++) {
        const c = candidatos[i];
        const telefono = formatPhoneForWhatsApp(c.phone || '');
        if (!telefono || telefono.length < 13) {
            await reclamar(c.id);
            errores.push(`${c.name}: teléfono inválido`);
            continue;
        }

        const claimed = await reclamar(c.id);
        if (claimed === 0) continue;

        const pila = (c.name || '').trim().split(/\s+/)[0] || 'Hola';
        const def = WHATSAPP_TEMPLATES[plantilla] as { body: string; header?: string; imagenMuestra?: string };
        const texto = def.body.replace('{{1}}', pila);
        // La v2 lleva IMAGEN de cabecera: sin el link Meta rechaza el envío con
        // 132012 ("Parameter format does not match"). Medido el 15/9/2026: la
        // campaña v2 nunca había mandado NADA por esto (0 envíos, 10 errores
        // por tanda, silenciosos). La imagen es la misma que se aprobó.
        const headerImage = def.header === 'IMAGE' && def.imagenMuestra
            ? { link: `${STORE_ORIGIN}${def.imagenMuestra.replace(/^public/, '')}` }
            : undefined;
        const res = await sendWhatsApp({
            chatId: `${telefono}@c.us`,
            message: texto,
            senderName: nombreTag,
            isProactive: true,
            forceTemplate: true,
            template: templateSpec(plantilla, [pila], headerImage ? { headerImage } : {}),
        });

        if (!res.ok) {
            // Solo se libera (y se reintenta en otra tanda) lo transitorio. Un
            // resultado AMBIGUO pudo haber salido: reintentar se lo manda dos
            // veces. Lo definitivo (número sin WhatsApp, plantilla rechazada,
            // bloqueo anti-spam) no cambia por insistir.
            const permanente = /Destino inválido/i.test(res.error || '') || !esFalloTransitorio(res);
            if (permanente) await reclamar(c.id);
            else await liberar(c.id);
            errores.push(`${c.name}: ${res.error || 'fallo de envío'}`);
            // Meta frenó la plantilla o la línea: no se sigue insistiendo en esta tanda.
            if (res.code === 'BLOCKED' || res.code === 'TEMPLATE_ERROR') break;
            continue;
        }

        enviados++;
        await prisma.interaction.create({
            data: {
                clientId: c.id,
                type: 'NOTE',
                userName: 'Sistema',
                content: `📣 [${nombreTag}] Se envió por WhatsApp:\n"${texto}"`,
            },
        }).catch((e: any) => errores.push(`${c.name}: enviado y reclamado, pero sin nota en ficha (${e?.message})`));

        if (i < candidatos.length - 1) {
            await dormir(20000 + Math.floor(Math.random() * 20000));
        }
    }

    const restantes = await prisma.client.count({ where: whereCandidatos });

    return NextResponse.json({ ok: true, campana: campanaParam, plantilla, enviados, restantes, errores: errores.slice(0, 10) });
}
