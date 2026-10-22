import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getActor } from '@/lib/actor';
import { PostSaleChargeService, CargoError } from '@/services/post-sale-charge.service';

/**
 * CIERRE ECONÓMICO DE UN CASO DE POST VENTA: repartir el costo entre una caja
 * y/o el cliente. Toda la regla vive en PostSaleChargeService; acá solo se
 * valida quién llama y se traduce el body.
 *
 * El circuito, tal como lo definió el administrador (2/8/2026, ampliado el
 * 19/10/2026):
 *   1. El vendedor carga una ESTIMACIÓN del costo al abrir el caso.
 *   2. Cuando el laboratorio facturó TODAS las operaciones del caso, la
 *      conciliación pisa la estimación con el valor real (costSource = 'LAB') y
 *      le manda UN email al administrador. Ver completePostSaleCost en
 *      services/lab-recon.
 *   3. El administrador reparte el costo: a su caja (lo cubre Atelier), a la
 *      caja del vendedor que se equivocó, al cliente como saldo de la venta, o
 *      una parte a cada uno. Y lo puede cambiar después.
 *
 * El disparo vive acá adentro (sesión autenticada, rol ADMIN) y no en un link
 * del email: es un movimiento de plata.
 *
 * Acciones:
 *   repartir        { cajaVendorId?, cajaMonto, clienteMonto }
 *   anular_reparto  deshace todo
 *   impute / charge_client / revert_client_charge  — las formas viejas, traducidas.
 */
export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const actor = getActor(request);
        if (actor.role !== 'ADMIN') {
            return NextResponse.json(
                { error: 'Solo el administrador puede corroborar y repartir el costo de un caso' },
                { status: 403 }
            );
        }

        const { id } = await params;
        const body = await request.json().catch(() => ({}));
        const action = String(body.action || 'impute');

        const costoDelCaso = async () => Math.round((await prisma.postSaleCase.findUnique({ where: { id }, select: { cost: true } }))?.cost ?? 0);

        let reparto: { cajaVendorId: string | null; cajaMonto: number; clienteMonto: number };
        switch (action) {
            case 'repartir':
                reparto = {
                    cajaVendorId: body.cajaVendorId ? String(body.cajaVendorId) : null,
                    cajaMonto: Number(body.cajaMonto) || 0,
                    clienteMonto: Number(body.clienteMonto) || 0,
                };
                break;
            case 'anular_reparto':
            case 'revert_client_charge':
                reparto = { cajaVendorId: null, cajaMonto: 0, clienteMonto: 0 };
                break;
            case 'charge_client':
                reparto = { cajaVendorId: null, cajaMonto: 0, clienteMonto: await costoDelCaso() };
                break;
            case 'impute':
                reparto = { cajaVendorId: body.vendorId ? String(body.vendorId) : null, cajaMonto: await costoDelCaso(), clienteMonto: 0 };
                break;
            default:
                return NextResponse.json({ error: `Acción desconocida: ${action}` }, { status: 400 });
        }

        const r = await PostSaleChargeService.repartir(id, reparto, actor);
        return NextResponse.json({ ok: true, ...r });
    } catch (error: any) {
        if (error instanceof CargoError) return NextResponse.json({ error: error.message }, { status: error.status });
        console.error('Error en el cierre económico del caso de post venta:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
