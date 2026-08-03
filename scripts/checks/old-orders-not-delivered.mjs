/**
 * Detecta pedidos viejos que deberían estar entregados pero siguen sin serlo.
 *
 * Criterios para "debería estar entregado":
 * - Enviado a fábrica hace 60+ días, O
 * - Creado hace 90+ días
 * - Y labStatus NO es DELIVERED
 * - Y tiene cliente de verdad (no es una ficha vacía)
 * - Y la venta tiene ítems
 *
 * Envía email de reporte a atelier.optica.cerro@gmail.com
 */

import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';

config();

const prisma = new PrismaClient();

const DAYS_SENT = 60;  // días desde que fue enviado a fábrica
const DAYS_CREATED = 90; // días desde que se creó

async function main() {
  const cutoffSent = new Date(Date.now() - DAYS_SENT * 86400000);
  const cutoffCreated = new Date(Date.now() - DAYS_CREATED * 86400000);

  console.log(`Buscando pedidos viejos sin entregar...`);
  console.log(`  - Enviados a fábrica hace ${DAYS_SENT}+ días (antes de ${cutoffSent.toLocaleDateString('es-AR')})`);
  console.log(`  - O creados hace ${DAYS_CREATED}+ días (antes de ${cutoffCreated.toLocaleDateString('es-AR')})`);
  console.log(`  - Y labStatus != DELIVERED\n`);

  const oldOrders = await prisma.order.findMany({
    where: {
      isDeleted: false,
      labStatus: { not: 'DELIVERED' },
      OR: [
        { labSentAt: { lte: cutoffSent } },
        { createdAt: { lte: cutoffCreated } },
      ],
      clientId: { not: '' },
      items: { some: {} }, // tiene ítems
    },
    include: {
      client: { select: { id: true, name: true, phone: true, email: true } },
      items: { select: { id: true, productNameSnapshot: true, quantity: true } },
      user: { select: { name: true } },
    },
    orderBy: [{ labSentAt: 'asc' }, { createdAt: 'asc' }],
  });

  if (oldOrders.length === 0) {
    console.log('✓ No hay pedidos viejos sin entregar.');
    return;
  }

  console.log(`Found ${oldOrders.length} pedidos:\n`);

  // Agrupar por estado
  const byStatus = new Map();
  for (const order of oldOrders) {
    const status = order.labStatus || 'NONE';
    if (!byStatus.has(status)) byStatus.set(status, []);
    byStatus.get(status).push(order);
  }

  for (const [status, orders] of byStatus) {
    console.log(`\n${status} (${orders.length} pedidos)`);
    console.log('='.repeat(60));
    for (const order of orders.slice(0, 5)) {
      const daysAgo = Math.floor((Date.now() - (order.labSentAt || order.createdAt).getTime()) / 86400000);
      console.log(`  #${order.id.slice(0, 8)} | ${order.client?.name || '?'} | creado ${daysAgo}d atrás | ${order.items.length} ítems`);
    }
    if (orders.length > 5) {
      console.log(`  ... y ${orders.length - 5} más`);
    }
  }

  // Preparar email
  const emailBody = prepareEmail(oldOrders);

  // Guardar en archivo para revisar
  const fs = await import('fs').then(m => m.promises);
  await fs.writeFile('/tmp/old-orders-report.html', emailBody);
  console.log(`\n✓ Email guardado en /tmp/old-orders-report.html`);
  console.log(`Enviar a: atelier.optica.cerro@gmail.com`);
}

function prepareEmail(orders) {
  const byStatus = new Map();
  for (const order of orders) {
    const status = order.labStatus || 'NONE';
    if (!byStatus.has(status)) byStatus.set(status, []);
    byStatus.get(status).push(order);
  }

  const statusLabels = {
    'NONE': 'Sin enviar a fábrica',
    'SENT': 'Enviado a fábrica',
    'IN_PROGRESS': 'En proceso',
    'FINISHED': 'Terminado',
    'READY': 'Listo para retirar',
  };

  const rows = Array.from(byStatus.entries())
    .flatMap(([status, orderList]) => {
      return orderList.map((order, idx) => {
        const daysAgo = Math.floor((Date.now() - (order.labSentAt || order.createdAt).getTime()) / 86400000);
        const createdDate = new Date(order.createdAt).toLocaleDateString('es-AR');
        const sentDate = order.labSentAt ? new Date(order.labSentAt).toLocaleDateString('es-AR') : '—';

        return `
          <tr style="border-bottom: 1px solid #e5e7eb;">
            <td style="padding: 12px; text-align: left;">
              <strong>${order.id.slice(0, 8)}</strong>
            </td>
            <td style="padding: 12px; text-align: left;">
              <strong>${order.client?.name || '?'}</strong><br/>
              <span style="font-size: 12px; color: #6b7280;">${order.client?.phone || '—'}</span>
            </td>
            <td style="padding: 12px; text-align: center;">
              <span style="background: #f3f4f6; padding: 4px 8px; border-radius: 4px; font-size: 12px;">
                ${statusLabels[status] || status}
              </span>
            </td>
            <td style="padding: 12px; text-align: center; font-size: 12px; color: #6b7280;">
              Creado: ${createdDate}<br/>
              Enviado: ${sentDate}<br/>
              <strong style="color: #dc2626;">${daysAgo} días</strong>
            </td>
            <td style="padding: 12px; text-align: left; font-size: 12px;">
              ${order.items.map(i => `${i.productNameSnapshot || '?'} (${i.quantity})`).join('<br/>')}
            </td>
          </tr>
        `;
      });
    })
    .join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width">
      <style>
        body {
          font-family: Arial, sans-serif;
          color: #1f2937;
          background: #f9fafb;
        }
        .container {
          max-width: 1200px;
          margin: 0 auto;
          background: white;
          padding: 24px;
          border-radius: 8px;
        }
        h1 { margin-top: 0; color: #111827; }
        h2 { margin-top: 24px; color: #374151; font-size: 16px; }
        table {
          width: 100%;
          border-collapse: collapse;
          margin: 16px 0;
          font-size: 13px;
        }
        th {
          background: #f3f4f6;
          padding: 12px;
          text-align: left;
          font-weight: 600;
          color: #1f2937;
          border-bottom: 2px solid #e5e7eb;
        }
        .summary {
          background: #fef3c7;
          border-left: 4px solid #f59e0b;
          padding: 12px;
          margin: 16px 0;
          border-radius: 4px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>📋 Pedidos viejos sin entregar</h1>

        <div class="summary">
          <strong>${orders.length} pedidos</strong> que deberían estar entregados pero siguen en el sistema sin marca de entrega.
          Revisar con urgencia — algunos están esperando hace más de 60 días.
        </div>

        <table>
          <thead>
            <tr>
              <th>Nº Pedido</th>
              <th>Cliente</th>
              <th>Estado</th>
              <th>Antigüedad</th>
              <th>Ítems</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>

        <p style="color: #6b7280; font-size: 12px; margin-top: 32px;">
          Generado automáticamente • <a href="https://atelieroptica.com.ar/admin/ventas">Ver en el CRM</a>
        </p>
      </div>
    </body>
    </html>
  `;
}

main()
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
