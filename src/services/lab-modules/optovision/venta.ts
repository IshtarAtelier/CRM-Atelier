import { prisma } from '../../../lib/db';
import type { VentaParaCargaOves } from './carga';

/**
 * La venta con todo lo que el armado del pedido de Optovisión lee (carga.ts).
 * `select` explícito: contra producción, el schema local va adelantado y
 * devolver la fila entera revienta.
 */
export async function leerVentaParaCargaOves(orderId: string): Promise<VentaParaCargaOves | null> {
    const o = await prisma.order.findUnique({
        where: { id: orderId },
        select: {
            id: true, labStatus: true, labSentAt: true, labNotes: true, labCrizal: true, labFrameType: true, labDiameter: true, labEdgeInStore: true,
            labPrismOD: true, labPrismOI: true, appliedPromoName: true,
            userFrameBrand: true, userFrameModel: true, labFrameDetails: true, labFrameDetails2: true, labFrameShape: true, labFrameShape2: true,
            labPdOd: true, labPdOi: true, labHeightOD: true, labHeightOI: true, labHeightOD2: true, labHeightOI2: true,
            frameA: true, frameB: true, frameDbl: true, frameEdc: true, frameA2: true, frameB2: true, frameDbl2: true, frameEdc2: true,
            frames: { select: { position: true, shape: true, a: true, b: true, dbl: true, edc: true, details: true, heightOD: true, heightOI: true } },
            // DNI, nacimiento, teléfono y mail: lo que la web de la promo pide para el cupón (cupon-web.ts).
            client: { select: { name: true, dni: true, birthDate: true, email: true, phone: true } },
            prescription: {
                select: {
                    sphereOD: true, cylinderOD: true, axisOD: true, sphereOI: true, cylinderOI: true, axisOI: true,
                    addition: true, additionOD: true, additionOI: true, pd: true, distanceOD: true, distanceOI: true, heightOD: true, heightOI: true,
                },
            },
            items: {
                // Orden fijo: los cristales sin armazón asignado se reparten por orden de aparición.
                orderBy: { id: 'asc' },
                select: {
                    eye: true, quantity: true, framePosition: true, price: true,
                    productNameSnapshot: true, productTypeSnapshot: true, productCategorySnapshot: true, laboratorySnapshot: true,
                    sphereVal: true, cylinderVal: true, axisVal: true, additionVal: true, pdVal: true, heightVal: true,
                    crystalColor: true, crystalColorType: true, crystalColorNote: true,
                    product: { select: { name: true, category: true, type: true, price: true, laboratory: true } },
                },
            },
        },
    });
    return o as unknown as VentaParaCargaOves | null;
}
