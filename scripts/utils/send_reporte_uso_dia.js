// Envía por email el reporte de uso del sistema del día (un cuadro por vendedor).
// Los números salen de scripts/utils/report_uso_sistema_hoy.js
const nodemailer = require('nodemailer');
require('dotenv').config({ path: '/Users/ishtarpissano/proyectos/atelier/.env' });

const TO = process.argv[2] || 'pisano.ishtar@gmail.com';

const NEGRO = '#0d0d0d';
const DORADO = '#c9a227';
const GRIS = '#6b6b6b';
const BORDE = '#e6e2d8';

const fila = (label, valor, destacado) => `
  <tr>
    <td style="padding:9px 0;border-bottom:1px solid ${BORDE};font-family:Helvetica,Arial,sans-serif;font-size:14px;color:${GRIS};">${label}</td>
    <td align="right" style="padding:9px 0;border-bottom:1px solid ${BORDE};font-family:Helvetica,Arial,sans-serif;font-size:${destacado ? '16px' : '14px'};font-weight:${destacado ? '700' : '600'};color:${destacado ? DORADO : NEGRO};white-space:nowrap;">${valor}</td>
  </tr>`;

const cuadro = ({ nombre, horario, filas, detalle }) => `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${BORDE};border-radius:10px;background:#ffffff;margin:0 0 22px 0;">
  <tr>
    <td style="background:${NEGRO};border-radius:9px 9px 0 0;padding:16px 22px;">
      <div style="font-family:Helvetica,Arial,sans-serif;font-size:18px;font-weight:700;color:#ffffff;letter-spacing:.5px;">${nombre}</div>
      <div style="font-family:Helvetica,Arial,sans-serif;font-size:12px;color:${DORADO};padding-top:3px;letter-spacing:1px;">${horario}</div>
    </td>
  </tr>
  <tr>
    <td style="padding:8px 22px 18px 22px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${filas}</table>
      <div style="font-family:Helvetica,Arial,sans-serif;font-size:13px;line-height:20px;color:${GRIS};padding-top:14px;">${detalle}</div>
    </td>
  </tr>
</table>`;

const milena = cuadro({
  nombre: 'Milena Magallanes',
  horario: '08:27 &nbsp;→&nbsp; 16:19',
  filas: [
    fila('Clientes nuevos cargados', '14', true),
    fila('Presupuestos creados', '19 &nbsp;·&nbsp; $5.412.821', true),
    fila('Ventas cerradas', '1 &nbsp;·&nbsp; $16.000'),
    fila('Cobros registrados', '3 &nbsp;·&nbsp; $77.314'),
    fila('Tareas terminadas', '0'),
    fila('Cierres / seguimientos finalizados', '3'),
    fila('Pedidos entregados', '1'),
    fila('Recetas cargadas', '2'),
    fila('Movimientos en fichas', '50'),
  ].join(''),
  detalle: `Abrió el día con la caja: confirmó la rendición de efectivo de Matías por $100.001 (sin diferencia), hizo el arqueo &mdash; contó $1.276.900 sobre $1.277.447 esperados, <strong style="color:${NEGRO};">faltante de $547</strong> &mdash; y registró la salida de $1.160.000 por pago a laboratorio.
  <br><br>El grueso de su día fue el buzón de WhatsApp: <strong style="color:${NEGRO};">11 conversaciones nuevas</strong> atendidas y presupuestadas, casi todas entradas por Meta (clip-on y el 2x1 multifocal). Cerró la venta de Cecilia Damon completa en 4 minutos, de presupuesto a entregado. También es suya la cotización más alta del día: <strong style="color:${NEGRO};">Foray Gabriela por $1.686.011</strong> (Karun + Varilux XR Design), que después cerró Matías.`,
});

const matias = cuadro({
  nombre: 'Matías Turchi',
  horario: '09:02 &nbsp;→&nbsp; 19:28',
  filas: [
    fila('Clientes nuevos cargados', '3'),
    fila('Presupuestos creados', '9 &nbsp;·&nbsp; $2.972.571'),
    fila('Ventas cerradas', '2 &nbsp;·&nbsp; $1.740.785', true),
    fila('Cobros registrados', '3 &nbsp;·&nbsp; $1.166.729', true),
    fila('Tareas terminadas', '25', true),
    fila('Cierres / seguimientos finalizados', '9'),
    fila('Pedidos entregados', '6'),
    fila('Recetas cargadas', '1 (+1 corregida)'),
    fila('Movimientos en fichas', '71'),
  ].join(''),
  detalle: `Las dos ventas del cierre son suyas: <strong style="color:${NEGRO};">Foray Gabriela por $1.686.011</strong> con seña de $1.053.757 en 6 cuotas Payway, y <strong style="color:${NEGRO};">Zulma Moreno Laperyn por $54.774</strong>, esta última de presupuesto a entregado en dos minutos.
  <br><br>Dedicó la tarde a poner al día el pipeline: 6 pedidos entregados en un bloque de 18:12, y dos tandas de limpieza (18:11 y 19:15&mdash;19:28) donde cerró 25 tareas y 9 seguimientos de oportunidad de cierre. También corrigió datos que venían mal: nombre completo de Zulma, DNI de Foray Gabriela y las alturas y distancias de una receta.`,
});

const alerta = (titulo, cuerpo) => `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-left:3px solid ${DORADO};background:#faf8f2;margin:0 0 12px 0;">
  <tr><td style="padding:13px 18px;font-family:Helvetica,Arial,sans-serif;font-size:13px;line-height:20px;color:${GRIS};">
    <strong style="color:${NEGRO};">${titulo}</strong><br>${cuerpo}
  </td></tr>
</table>`;

const html = `
<div style="background:#f4f2ed;padding:28px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;margin:0 auto;">
  <tr><td style="padding:0 0 22px 0;text-align:center;">
    <div style="font-family:Helvetica,Arial,sans-serif;font-size:13px;letter-spacing:4px;color:${DORADO};font-weight:700;">ATELIER ÓPTICA</div>
    <div style="font-family:Georgia,serif;font-size:23px;color:${NEGRO};padding-top:8px;">Uso del sistema</div>
    <div style="font-family:Helvetica,Arial,sans-serif;font-size:13px;color:${GRIS};padding-top:5px;">Miércoles 22 de julio de 2026 &nbsp;·&nbsp; cierre 19:30</div>
  </td></tr>

  <tr><td>${milena}</td></tr>
  <tr><td>${matias}</td></tr>

  <tr><td style="padding:4px 0 20px 0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${NEGRO};border-radius:10px;">
      <tr><td style="padding:18px 22px;">
        <div style="font-family:Helvetica,Arial,sans-serif;font-size:11px;letter-spacing:2.5px;color:${DORADO};font-weight:700;padding-bottom:12px;">TOTAL DEL DÍA</div>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-family:Helvetica,Arial,sans-serif;font-size:14px;color:#ffffff;">
          <tr><td style="padding:5px 0;color:#bdbdbd;">Clientes nuevos</td><td align="right" style="padding:5px 0;font-weight:600;">17</td></tr>
          <tr><td style="padding:5px 0;color:#bdbdbd;">Presupuestos</td><td align="right" style="padding:5px 0;font-weight:600;">28 &nbsp;·&nbsp; $8.385.392</td></tr>
          <tr><td style="padding:5px 0;color:#bdbdbd;">Ventas cerradas</td><td align="right" style="padding:5px 0;font-weight:700;color:${DORADO};">3 &nbsp;·&nbsp; $1.756.785</td></tr>
          <tr><td style="padding:5px 0;color:#bdbdbd;">Cobrado</td><td align="right" style="padding:5px 0;font-weight:700;color:${DORADO};">$1.244.043</td></tr>
          <tr><td style="padding:5px 0;color:#bdbdbd;">Tareas terminadas</td><td align="right" style="padding:5px 0;font-weight:600;">25</td></tr>
          <tr><td style="padding:5px 0;color:#bdbdbd;">Cierres finalizados</td><td align="right" style="padding:5px 0;font-weight:600;">12</td></tr>
          <tr><td style="padding:5px 0;color:#bdbdbd;">Pedidos entregados</td><td align="right" style="padding:5px 0;font-weight:600;">7</td></tr>
        </table>
      </td></tr>
    </table>
  </td></tr>

  <tr><td style="padding:0 0 6px 0;">
    <div style="font-family:Helvetica,Arial,sans-serif;font-size:11px;letter-spacing:2.5px;color:${GRIS};font-weight:700;padding-bottom:12px;">PARA REVISAR</div>
    ${alerta('Un cobro quedó fechado en 2022', `El pago de $1.053.757 de Foray Gabriela (Payway 6 cuotas, cargado por Matías a las 17:02) se guardó con fecha <strong style="color:${NEGRO};">26/07/2022</strong> en lugar de 2026. El monto está bien imputado al pedido, pero cualquier reporte por rango de fechas &mdash; caja, cierre de mes, conciliación &mdash; lo va a dejar afuera. Es el cobro más grande del día; se arregla editando la fecha del pago en la ficha.`)}
    ${alerta('Pago duplicado, ya resuelto', `A las 11:50 Milena cargó $48.000 y a las 12:08 cargó $48.001 con el mismo comprobante sobre el pedido de Zulma. Quedó eliminado a las 17:06 y Matías lo volvió a cargar bien a las 17:28, con otra referencia y en el pedido que correspondía. Lo anoto solo porque el par 48.000 / 48.001 del mismo cliente se presta a confusión al leer el historial.`)}
  </td></tr>

  <tr><td style="padding:16px 0 0 0;text-align:center;font-family:Helvetica,Arial,sans-serif;font-size:11px;color:#9a9a9a;line-height:17px;">
    Reconstruido desde el registro de auditoría del CRM: fichas, pedidos, pagos, tareas y caja.<br>Los movimientos del bot y los automáticos no se cuentan como actividad de vendedor.
  </td></tr>
</table>
</div>`;

const text = `ATELIER ÓPTICA — Uso del sistema — miércoles 22/07/2026 (cierre 19:30)

MILENA MAGALLANES  (08:27 → 16:19)
  Clientes nuevos cargados: 14
  Presupuestos: 19 · $5.412.821
  Ventas cerradas: 1 · $16.000
  Cobros: 3 · $77.314
  Tareas terminadas: 0
  Cierres finalizados: 3
  Pedidos entregados: 1
  Recetas cargadas: 2
  Movimientos en fichas: 50
  Caja: confirmó la rendición de Matías ($100.001, sin diferencia), arqueo con faltante de $547 y salida de $1.160.000 a laboratorio. 11 conversaciones nuevas de WhatsApp atendidas y presupuestadas.

MATÍAS TURCHI  (09:02 → 19:28)
  Clientes nuevos cargados: 3
  Presupuestos: 9 · $2.972.571
  Ventas cerradas: 2 · $1.740.785
  Cobros: 3 · $1.166.729
  Tareas terminadas: 25
  Cierres finalizados: 9
  Pedidos entregados: 6
  Recetas cargadas: 1 (+1 corregida)
  Movimientos en fichas: 71
  Las dos ventas del cierre son suyas (Foray Gabriela $1.686.011 y Zulma Moreno Laperyn $54.774). Dedicó la tarde a poner al día el pipeline.

TOTAL DEL DÍA
  Clientes nuevos: 17
  Presupuestos: 28 · $8.385.392
  Ventas cerradas: 3 · $1.756.785
  Cobrado: $1.244.043
  Tareas terminadas: 25
  Cierres finalizados: 12
  Pedidos entregados: 7

PARA REVISAR
  1) El cobro de $1.053.757 de Foray Gabriela quedó fechado 26/07/2022 en lugar de 2026: se cae de cualquier reporte por fechas.
  2) Pago duplicado de $48.001 sobre el pedido de Zulma, ya eliminado y recargado correctamente.
`;

async function main() {
  if (process.env.DRY) {
    require('fs').writeFileSync(process.env.DRY, html);
    console.log('HTML escrito en', process.env.DRY, '(no se envió nada)');
    return;
  }
  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com', port: 587, secure: false, requireTLS: true,
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
  });
  const info = await transporter.sendMail({
    from: `"Atelier Óptica" <${process.env.EMAIL_USER}>`,
    to: TO,
    subject: 'Uso del sistema — miércoles 22/07: Milena y Matías',
    text,
    html,
  });
  console.log('Enviado a', TO, '| id:', info.messageId);
}

main().catch(e => { console.error('Falló el envío:', e.message); process.exit(1); });
