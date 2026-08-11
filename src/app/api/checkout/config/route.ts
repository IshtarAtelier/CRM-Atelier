import { NextResponse } from 'next/server';
import { isMercadoPagoEnabled } from '@/services/mercadopago.service';

export async function GET() {
  return NextResponse.json({
    publicKey: process.env.PAYWAY_PUBLIC_KEY || '',
    environment: process.env.PAYWAY_ENVIRONMENT || 'sandbox',
    // Interruptor del respaldo. Solo dice si mostrar la opción: quien decide de
    // verdad es el servidor, que revalida el flag antes de abrir cualquier pago
    // (un navegador puede mandar MERCADO_PAGO igual, y ahí se rechaza).
    mercadoPagoEnabled: isMercadoPagoEnabled(),
  });
}
