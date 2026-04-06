import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import {
  SMARTLAB_CONFIG,
  LENS_TYPE_MAP,
  MATERIAL_MAP,
  type SmartLabPayload,
  validateSmartLabPayload,
  formatDiopter,
} from '@/lib/smartlab-config';

/**
 * POST /api/smartlab-submit
 * 
 * Builds the SmartLab payload from a CRM order and either:
 * - Validates only (action=validate)
 * - Prepares payload for browser automation (action=prepare)
 * - Triggers Puppeteer automation (action=submit) — future
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { orderId, action = 'validate' } = body;

    if (!orderId) {
      return NextResponse.json({ error: 'orderId es requerido' }, { status: 400 });
    }

    // Fetch order with all related data
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        client: true,
        user: true,
        items: { include: { product: true } },
        prescription: true,
      },
    });

    if (!order) {
      return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 });
    }

    // Build SmartLab payload from CRM data
    const lensItems = order.items.filter((i: any) => 
      i.product?.category === 'LENS' || (i.product?.type || '').includes('Cristal')
    );
    const odItem = lensItems.find((i: any) => i.eye === 'OD');
    const oiItem = lensItems.find((i: any) => i.eye === 'OI');
    const lensProduct = lensItems[0]?.product;

    const rawLensType = lensProduct?.type || 'MONOFOCAL';
    const lensType = LENS_TYPE_MAP[rawLensType] || rawLensType;
    const lensIndex = (lensProduct as any)?.lensIndex || '';
    const material = MATERIAL_MAP[lensIndex] || lensIndex;

    const payload: SmartLabPayload = {
      patientName: order.client.name,
      sellerName: (order as any).user?.name || '',
      internalCode: `ATL-${order.id.slice(-4).toUpperCase()}`,
      
      lensType,
      
      // Rx from OrderItems
      sphereOD: odItem?.sphereVal ?? null,
      cylinderOD: odItem?.cylinderVal ?? null,
      axisOD: odItem?.axisVal ?? null,
      additionOD: odItem?.additionVal ?? null,
      
      sphereOI: oiItem?.sphereVal ?? null,
      cylinderOI: oiItem?.cylinderVal ?? null,
      axisOI: oiItem?.axisVal ?? null,
      additionOI: oiItem?.additionVal ?? null,
      
      // PD & Heights from order or prescription
      pdOD: (order as any).labPdOd || (order.prescription?.distanceOD ? String(order.prescription.distanceOD) : ''),
      pdOI: (order as any).labPdOi || (order.prescription?.distanceOI ? String(order.prescription.distanceOI) : ''),
      heightOD: order.prescription?.heightOD ? String(order.prescription.heightOD) : '',
      heightOI: order.prescription?.heightOI ? String(order.prescription.heightOI) : '',
      
      // Lens specs
      material,
      color: (order as any).labColor || 'Blanco',
      treatment: (order as any).labTreatment || '',
      diameter: (order as any).labDiameter || '',
      
      // Frame measurements
      frameA: (order as any).frameA || '',
      frameB: (order as any).frameB || '',
      frameDbl: (order as any).frameDbl || '',
      frameEdc: (order as any).frameEdc || '',
      
      orderId: order.id,
      autoSubmit: false,
    };

    // Validate
    const validation = validateSmartLabPayload(payload);

    if (action === 'validate') {
      return NextResponse.json({
        payload,
        validation,
        formattedFields: {
          sphereOD: formatDiopter(payload.sphereOD),
          cylinderOD: formatDiopter(payload.cylinderOD),
          sphereOI: formatDiopter(payload.sphereOI),
          cylinderOI: formatDiopter(payload.cylinderOI),
          additionOD: payload.additionOD != null ? formatDiopter(payload.additionOD) : null,
          additionOI: payload.additionOI != null ? formatDiopter(payload.additionOI) : null,
        },
      });
    }

    if (action === 'prepare') {
      // Return payload ready for browser automation
      if (!validation.isValid) {
        return NextResponse.json({
          error: 'Faltan campos obligatorios',
          validation,
          payload,
        }, { status: 400 });
      }

      return NextResponse.json({
        payload,
        validation,
        smartLabConfig: {
          loginUrl: SMARTLAB_CONFIG.loginUrl,
          newOrderUrl: SMARTLAB_CONFIG.newOrderUrl,
          hasCredentials: !!(SMARTLAB_CONFIG.email && SMARTLAB_CONFIG.password),
        },
      });
    }

    if (action === 'submit') {
      // Future: Puppeteer automation
      // For now, validate and prepare the data
      if (!validation.isValid) {
        return NextResponse.json({
          error: 'Faltan campos obligatorios para enviar',
          validation,
          payload,
        }, { status: 400 });
      }

      // Check SmartLab credentials
      if (!SMARTLAB_CONFIG.email || !SMARTLAB_CONFIG.password) {
        return NextResponse.json({
          error: 'Credenciales de SmartLab no configuradas. Agregá SMARTLAB_EMAIL y SMARTLAB_PASSWORD en las variables de entorno.',
        }, { status: 500 });
      }

      // TODO: When SmartLab account is active, implement Puppeteer automation here
      // For now, return the prepared data
      return NextResponse.json({
        message: 'Automatización de SmartLab pendiente — cuenta bloqueada. Datos preparados exitosamente.',
        payload,
        validation,
        status: 'PENDING_AUTOMATION',
      });
    }

    return NextResponse.json({ error: 'Acción no válida. Usar: validate, prepare, submit' }, { status: 400 });

  } catch (error: any) {
    console.error('SmartLab submit error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
