// ────────────────────────────────────────────────────────────────────────────
// Novedades guiadas del sistema: qué usuario tiene un guiado pendiente y el
// registro de quién ya lo vio.
//
// El guiado es OBLIGATORIO para su audiencia (pedido de Ishtar, 24/8/26: que
// Milena y Matías no puedan decir que no lo quieren ver): el modal del admin
// no se cierra hasta el último paso, y "visto" se guarda ACÁ, en el server —
// no en localStorage, que se pierde cambiando de máquina o de navegador.
//
// El contenido de los pasos vive en el componente (NovedadesGuiadas); este
// endpoint solo decide pendiente/visto. Una novedad nueva es agregar una
// entrada a NOVEDADES con otro id.
// ────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getActor } from '@/lib/actor';
import { logAudit } from '@/lib/audit';

const CLAVE_VISTAS = 'novedades_vistas';

const normalizar = (t: string) =>
    (t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Las novedades activas y a quién le aparecen. */
const NOVEDADES: { id: string; desde?: string; audiencia: (nombre: string, rol: string | null) => boolean }[] = [
    {
        // Solicitud de factura del vendedor (15/10/2026): a todo el equipo de
        // vendedores. Va primero para que se vea antes que cualquier otra.
        id: 'solicitar-factura-2026-10',
        audiencia: (_nombre, rol) => rol === 'STAFF',
    },
    {
        id: 'tenido-una-linea-2026-08',
        // La audiencia se decide por NOMBRE (insensible a mayúsculas y tildes):
        // los ids de usuario difieren entre bases y un id copiado mal deja al
        // guiado sin destinatario y sin error a la vista.
        audiencia: (nombre: string) => {
            const n = normalizar(nombre);
            return n.includes('milena') || n.includes('matias') || n.includes('ishtar');
        },
    },
    {
        // Desafío del día de reseñas contra Lens Cerro (Ishtar, 16/10/2026):
        // a Matías, desde el 17/10.
        id: 'desafio-resenas-lens-cerro-2026-10',
        desde: '2026-10-17',
        audiencia: (nombre: string) => normalizar(nombre).includes('matias'),
    },
];

/** Hoy en Córdoba, AAAA-MM-DD — para comparar con `desde`. */
const hoyCordoba = () =>
    new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Cordoba' });

async function vistasPorNovedad(): Promise<Record<string, string[]>> {
    const fila = await prisma.systemSetting.findUnique({ where: { key: CLAVE_VISTAS } });
    try {
        const datos = fila ? JSON.parse(fila.value) : {};
        return datos && typeof datos === 'object' ? datos : {};
    } catch {
        return {};
    }
}

/** GET → { pendiente: string | null } — el id del guiado que este usuario debe ver. */
export async function GET(request: NextRequest) {
    try {
        const actor = getActor(request);
        if (!actor.id) return NextResponse.json({ pendiente: null });

        const vistas = await vistasPorNovedad();
        const hoy = hoyCordoba();
        const pendiente = NOVEDADES.find(n =>
            (!n.desde || n.desde <= hoy) &&
            n.audiencia(actor.name || '', actor.role) && !(vistas[n.id] || []).includes(actor.id!)
        );
        return NextResponse.json({ pendiente: pendiente?.id || null });
    } catch (error: any) {
        // Un guiado que no se puede resolver no puede trabar el admin entero.
        console.error('[Novedades] Error consultando pendientes:', error.message);
        return NextResponse.json({ pendiente: null });
    }
}

/** POST { id } → marca el guiado como visto por el usuario autenticado. */
export async function POST(request: NextRequest) {
    try {
        const actor = getActor(request);
        if (!actor.id) return NextResponse.json({ error: 'Sin usuario' }, { status: 401 });

        const { id, respuesta } = await request.json();
        if (!NOVEDADES.some(n => n.id === id)) {
            return NextResponse.json({ error: 'Novedad desconocida' }, { status: 400 });
        }

        const vistas = await vistasPorNovedad();
        const lista = new Set(vistas[id] || []);
        lista.add(actor.id);
        vistas[id] = [...lista];

        await prisma.systemSetting.upsert({
            where: { key: CLAVE_VISTAS },
            create: { key: CLAVE_VISTAS, value: JSON.stringify(vistas) },
            update: { value: JSON.stringify(vistas) },
        });

        // Queda firmado QUIÉN lo vio y cuándo: es la respuesta a un futuro
        // "a mí nadie me avisó".
        logAudit({
            userId: actor.id,
            userName: actor.name,
            action: 'UPDATE',
            entityType: 'SETTING',
            entityId: id,
            details: { evento: 'novedad_guiada_vista', novedad: id, ...(typeof respuesta === 'string' ? { respuesta: respuesta.slice(0, 80) } : {}) },
        }).catch(console.error);

        return NextResponse.json({ ok: true });
    } catch (error: any) {
        console.error('[Novedades] Error marcando vista:', error.message);
        return NextResponse.json({ error: 'Error interno' }, { status: 500 });
    }
}
