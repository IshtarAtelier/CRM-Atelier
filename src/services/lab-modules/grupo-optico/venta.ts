import { prisma } from '../../../lib/db';

/**
 * La venta con todo lo que el armado del pedido de Grupo Óptico lee
 * (armar-pedido.ts + carga.ts). `select` explícito: contra producción, el
 * schema local va adelantado y devolver la fila entera revienta.
 */
export function leerVentaParaCargaGO(orderId: string) {
    return prisma.order.findUnique({
        where: { id: orderId },
        select: {
            id: true, labStatus: true, labType: true, labOrderNumber: true, appliedPromoName: true,
            labPdOd: true, labPdOi: true, labNearPdOd: true, labNearPdOi: true,
            labHeightOD: true, labHeightOI: true, labHeightOD2: true, labHeightOI2: true,
            labMaterial: true, labTreatment: true, labColor: true, labDiameter: true, labNotes: true, labFrameType: true,
            labFrameShape: true, labFrameShape2: true, labFrameDetails: true, labFrameDetails2: true,
            frameA: true, frameB: true, frameDbl: true, frameEdc: true, frameA2: true, frameB2: true, frameDbl2: true, frameEdc2: true,
            frameImageUrl: true, frameImageUrl2: true,
            frameSource: true, userFrameBrand: true, userFrameModel: true,
            // La receta de una postventa (reproceso) NO pasa por acá: la carga
            // asistida es de la venta. Un reproceso se sigue cargando a mano.
            client: { select: { name: true } },
            prescription: true,
            frames: true,
            items: {
                // Orden fijo: los cristales sin armazón asignado se reparten por orden de aparición.
                orderBy: { id: 'asc' },
                select: {
                    eye: true, quantity: true, framePosition: true, price: true,
                    sphereVal: true, cylinderVal: true, axisVal: true, additionVal: true, pdVal: true, heightVal: true,
                    crystalColor: true, crystalColorType: true, crystalColorNote: true,
                    productNameSnapshot: true, productCategorySnapshot: true, productTypeSnapshot: true, productBrandSnapshot: true,
                    laboratorySnapshot: true,
                    product: { select: { name: true, category: true, type: true, brand: true, lensIndex: true, laboratory: true, price: true } },
                },
            },
        },
    });
}

export type VentaParaCargaGO = NonNullable<Awaited<ReturnType<typeof leerVentaParaCargaGO>>>;
