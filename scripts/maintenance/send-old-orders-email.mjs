/**
 * Encuentra pedidos viejos sin entregar y envía un email de reporte
 * a atelier.optica.cerro@gmail.com
 *
 * Criterios para "debería estar entregado":
 * - Enviado a fábrica hace 60+ días, O
 * - Creado hace 90+ días
 * - Y labStatus NO es DELIVERED
 * - Y tiene cliente de verdad
 * - Y la venta tiene ítems
 */

import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import nodemailer from 'nodemailer';

config();

const prisma = new PrismaClient();

const DAYS_SENT = 60;  // días desde que fue enviado a fábrica
const DAYS_CREATED = 90; // días desde que se creó

// Configurar transporter de email (igual que en src/lib/email.ts)
const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    requireTLS: true,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000
});

async function main() {
  const cutoffSent = new Date(Date.now() - DAYS_SENT * 86400000);
  const cutoffCreated = new Date(Date.now() - DAYS_CREATED * 86400000);

  console.log(`Buscando pedidos viejos sin entregar...`);
  console.log(`  - Enviados a fábrica hace ${DAYS_SENT}+ días`);
  console.log(`  - O creados hace ${DAYS_CREATED}+ días`);
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
      items: { some: {} },
    },
    include: {
      client: { select: { id: true, name: true, phone: true, email: true } },
      items: { select: { id: true, productNameSnapshot: true, quantity: true } },
    },
    orderBy: [{ labSentAt: 'asc' }, { createdAt: 'asc' }],
  });

  if (oldOrders.length === 0) {
    console.log('✓ No hay pedidos viejos sin entregar.');
    return;
  }

  console.log(`✓ Encontrados ${oldOrders.length} pedidos sin entregar.\n`);

  // Preparar email
  const htmlBody = prepareEmail(oldOrders);
  const textBody = `${oldOrders.length} pedidos viejos sin entregar. Ver el email en HTML para los detalles completos.`;

  // Enviar
  try {
    const result = await transporter.sendMail({
      from: process.env.EMAIL_FROM || 'Atelier Óptica <pedidos@atelieroptica.com.ar>',
      to: 'atelier.optica.cerro@gmail.com',
      subject: `📋 ${oldOrders.length} pedidos viejos SIN ENTREGAR — revisar urgentemente`,
      text: textBody,
      html: htmlBody,
    });

    console.log(`✓ Email enviado exitosamente a atelier.optica.cerro@gmail.com`);
    console.log(`  Message ID: ${result.messageId}`);
  } catch (err) {
    console.error(`✗ Error enviando email:`, err.message);
    process.exit(1);
  }
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
      return orderList.map((order) => {
        const daysAgo = Math.floor((Date.now() - (order.labSentAt || order.createdAt).getTime()) / 86400000);
        const createdDate = new Date(order.createdAt).toLocaleDateString('es-AR');
        const sentDate = order.labSentAt ? new Date(order.labSentAt).toLocaleDateString('es-AR') : '—';
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://atelieroptica.com.ar';
        const orderUrl = `${appUrl}/admin/ventas?id=${order.id}`;

        return `
          <tr style="border-bottom: 1px solid #e5e7eb;">
            <td style="padding: 12px; text-align: left;">
              <a href="${orderUrl}" style="color: #2563eb; text-decoration: none; font-weight: bold;">
                ${order.id.slice(0, 8)}
              </a>
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
              <strong style="color: #dc2626;">${daysAgo}d</strong>
            </td>
            <td style="padding: 12px; text-align: left; font-size: 12px;">
              ${order.items.map(i => `${i.productNameSnapshot || '?'} (${i.quantity})`).join('<br/>')}
            </td>
          </tr>
        `;
      });
    })
    .join('');

  const summary = Array.from(byStatus.entries())
    .map(([status, list]) => `<strong>${statusLabels[status] || status}:</strong> ${list.length} pedido${list.length === 1 ? '' : 's'}`)
    .join(' • ');

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
          margin: 0;
          padding: 20px;
        }
        .container {
          max-width: 1200px;
          margin: 0 auto;
          background: white;
          padding: 24px;
          border-radius: 8px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        h1 { margin-top: 0; color: #111827; font-size: 24px; }
        p { line-height: 1.6; }
        table {
          width: 100%;
          border-collapse: collapse;
          margin: 20px 0;
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
        .summary strong { color: #92400e; }
        a {
          color: #2563eb;
          text-decoration: none;
        }
        a:hover {
          text-decoration: underline;
          color: #1d4ed8;
        }
        .order-link {
          color: #2563eb;
          font-weight: 600;
          text-decoration: none;
        }
        .order-link:hover {
          text-decoration: underline;
        }
        .footer {
          color: #6b7280;
          font-size: 12px;
          margin-top: 32px;
          padding-top: 16px;
          border-top: 1px solid #e5e7eb;
        }
        .footer a { color: #2563eb; text-decoration: none; font-weight: 500; }
        .footer a:hover { text-decoration: underline; }
        .cta-button {
          display: inline-block;
          background: #2563eb;
          color: white;
          padding: 10px 20px;
          border-radius: 6px;
          text-decoration: none;
          font-weight: 600;
          margin: 16px 0;
        }
        .cta-button:hover {
          background: #1d4ed8;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>📋 Pedidos viejos sin entregar</h1>

        <div class="summary">
          <strong>${orders.length} pedidos</strong> que deberían estar entregados pero aún no están marcados como DELIVERED en el sistema.
          <br/>Resumen por estado: ${summary}
        </div>

        <p>Estos pedidos están esperando hace demasiado tiempo. Revisar con urgencia qué sucedió con cada uno:</p>

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

        <div style="text-align: center; margin-top: 24px;">
          <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://atelieroptica.com.ar'}/admin/ventas" class="cta-button">
            ➜ Abrir todas en el CRM
          </a>
        </div>

        <div class="footer">
          <p><strong>Instrucciones:</strong></p>
          <ul style="margin: 8px 0; padding-left: 20px;">
            <li>Haz clic en cualquier <strong>nº de pedido</strong> para abrirlo directamente</li>
            <li>O usa el botón "Abrir todas en el CRM" para verlas en la página</li>
            <li>Actualiza el estado en la columna de Laboratorio</li>
          </ul>
          <p style="margin-top: 16px; font-size: 11px; color: #9ca3af;">
            Reportes automáticos • Generado: ${new Date().toLocaleString('es-AR')}
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
}

main()
  .catch(err => {
    console.error('Error fatal:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
