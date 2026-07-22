// Extrae TODO el detalle de las facturas de Optovision de los pedidos huérfanos
// (sin venta en el sistema) y manda el informe por email. Solo lectura de IMAP.
import imaps from 'imap-simple';
import { simpleParser } from 'mailparser';
import nodemailer from 'nodemailer';
import { OptovisionParserService } from './src/services/optovision-parser.service.ts';

const HUERFANOS = ['574011','567417','577396','592957','565423','578085','578082','575971','575961','596755','567420','566048','566040','577397'];
const APP = 'https://atelieroptica.com.ar';
const fmt = (n) => n == null ? '—' : '$' + Math.round(Number(n)).toLocaleString('es-AR');

const conn = await imaps.connect({
    imap: { user: process.env.IMAP_USER, password: process.env.IMAP_PASSWORD, host: 'imap.gmail.com', port: 993, tls: true, tlsOptions: { rejectUnauthorized: false }, authTimeout: 15000 },
});
await conn.openBox('INBOX');
const since = new Date(); since.setDate(since.getDate() - 120);
const messages = await conn.search([['FROM', 'procesos@optovisionsa.com.ar'], ['SINCE', since]], { bodies: [''], markSeen: false });
console.log(`${messages.length} emails a revisar`);

const found = [];
for (const msg of messages) {
    const allPart = msg.parts.find(p => p.which === '');
    if (!allPart) continue;
    const parsed = await simpleParser(allPart.body);
    for (const att of parsed.attachments || []) {
        if (att.contentType !== 'application/pdf') continue;
        let inv;
        try { inv = await OptovisionParserService.parseInvoice(att.content); } catch { continue; }
        const peds = inv.labOrderNumbers || [];
        const hit = peds.filter(p => HUERFANOS.includes(p));
        if (hit.length === 0) continue;

        const txt = inv.rawText || '';
        const L = txt.split('\n').map(s => s.trim()).filter(Boolean);
        // Nº y fecha de la factura
        const nroFac = (txt.match(/FACTURA N°\s*([\d\s\-]+)/) || [])[1]?.replace(/\s+/g, '') || att.filename;
        const fechaFac = (txt.match(/Fecha:\s*(\d{2}\/\d{2}\/\d{4})/) || [])[1] || (parsed.date ? new Date(parsed.date).toLocaleDateString('es-AR') : '—');
        const vto = (txt.match(/VTO:\s*(\d{2}\/\d{2}\/\d{4})/) || [])[1] || null;
        const cae = (txt.match(/CAE:\s*(\d+)/) || [])[1] || null;
        const remito = (txt.match(/\b(E[0-9])\s+(\d{8})\b/) || []).slice(1).join(' ') || null;
        const pedLine = (txt.match(/Ped:\s*(.+)/) || [])[1]?.trim() || null;

        // Líneas de artículo: "CODIGO  Descripción  Cant  Precio  %Desc  Total"
        const items = [];
        for (const l of L) {
            const m = l.match(/^([A-Z0-9_\/]{3,})\s+(.+?)\s{2,}(\d+)\s+.*?([\d.,]+)\s{2,}([\d.,]+)\s{2,}([\d.,]+)\s*$/);
            if (m && !/^Art[ií]culo/i.test(l)) {
                items.push({ cod: m[1], desc: m[2].replace(/\s{2,}/g, ' ').trim(), cant: m[3], unit: m[4], desc_pct: m[5], total: m[6] });
            }
        }
        // Fallback: cualquier línea con 3 números al final y texto descriptivo
        if (items.length === 0) {
            for (const l of L) {
                const m = l.match(/^(\S+)\s+(.{5,60}?)\s+(\d)\s+.*?([\d.]+\.\d{2})\s+([\d.]+)\s+([\d.]+\.\d{2})\s*$/);
                if (m) items.push({ cod: m[1], desc: m[2].trim(), cant: m[3], unit: m[4], desc_pct: m[5], total: m[6] });
            }
        }

        found.push({ pedidos: hit, todosLosPedidos: peds, nroFac, fechaFac, vto, cae, remito, pedLine, subtotal: inv.subtotal, total: inv.total, items, archivo: att.filename, emailDate: parsed.date });
    }
}
conn.end();
console.log(`${found.length} facturas de huérfanos encontradas`);

found.sort((a, b) => (b.total || 0) - (a.total || 0));
const totalGeneral = found.reduce((s, f) => s + (f.total || 0), 0);

const bloques = found.map(f => `
<div style="border:1px solid #e5e7eb;border-radius:10px;padding:14px;margin-bottom:14px;background:#fff">
  <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px;border-bottom:2px solid #b91c1c;padding-bottom:8px;margin-bottom:10px">
    <div>
      <span style="font-size:18px;font-weight:bold;font-family:monospace">Pedido ${f.pedidos.join(' + ')}</span>
      ${f.todosLosPedidos.length > f.pedidos.length ? `<br><span style="font-size:11px;color:#6b7280">La factura agrupa además: ${f.todosLosPedidos.filter(p => !f.pedidos.includes(p)).join(', ')}</span>` : ''}
    </div>
    <div style="text-align:right">
      <span style="font-size:18px;font-weight:bold;color:#b91c1c">${fmt(f.total)}</span>
      <br><span style="font-size:11px;color:#6b7280">neto ${fmt(f.subtotal)}</span>
    </div>
  </div>
  <table style="width:100%;font-size:12px;color:#374151;margin-bottom:10px">
    <tr><td style="padding:2px 6px"><strong>Factura</strong></td><td style="padding:2px 6px;font-family:monospace">${f.nroFac}</td>
        <td style="padding:2px 6px"><strong>Fecha</strong></td><td style="padding:2px 6px">${f.fechaFac}</td></tr>
    <tr><td style="padding:2px 6px"><strong>Vencimiento</strong></td><td style="padding:2px 6px">${f.vto || '—'}</td>
        <td style="padding:2px 6px"><strong>CAE</strong></td><td style="padding:2px 6px;font-family:monospace">${f.cae || '—'}</td></tr>
    <tr><td style="padding:2px 6px"><strong>Remito</strong></td><td style="padding:2px 6px;font-family:monospace">${f.remito || '—'}</td>
        <td style="padding:2px 6px"><strong>Línea "Ped:"</strong></td><td style="padding:2px 6px;font-family:monospace;font-size:11px">${f.pedLine || '—'}</td></tr>
  </table>
  ${f.items.length ? `
  <table style="border-collapse:collapse;width:100%;font-size:12px">
    <tr style="background:#f3f4f6">
      <th style="padding:5px 6px;text-align:left;border:1px solid #e5e7eb">Código</th>
      <th style="padding:5px 6px;text-align:left;border:1px solid #e5e7eb">Cristal / Tratamiento</th>
      <th style="padding:5px 6px;text-align:center;border:1px solid #e5e7eb">Cant</th>
      <th style="padding:5px 6px;text-align:right;border:1px solid #e5e7eb">Unitario</th>
      <th style="padding:5px 6px;text-align:right;border:1px solid #e5e7eb">Desc</th>
      <th style="padding:5px 6px;text-align:right;border:1px solid #e5e7eb">Total</th>
    </tr>
    ${f.items.map(i => `<tr>
      <td style="padding:4px 6px;border:1px solid #e5e7eb;font-family:monospace;font-size:11px">${i.cod}</td>
      <td style="padding:4px 6px;border:1px solid #e5e7eb"><strong>${i.desc}</strong></td>
      <td style="padding:4px 6px;border:1px solid #e5e7eb;text-align:center">${i.cant}</td>
      <td style="padding:4px 6px;border:1px solid #e5e7eb;text-align:right">${i.unit}</td>
      <td style="padding:4px 6px;border:1px solid #e5e7eb;text-align:right">${i.desc_pct}%</td>
      <td style="padding:4px 6px;border:1px solid #e5e7eb;text-align:right;font-weight:bold">${i.total}</td>
    </tr>`).join('')}
  </table>` : '<p style="color:#9ca3af;font-size:12px">(no se pudo desglosar el detalle de artículos de esta factura)</p>'}
  <p style="font-size:11px;color:#9ca3af;margin:8px 0 0">Archivo: ${f.archivo}</p>
</div>`).join('');

const html = `
<div style="font-family:Arial,sans-serif;max-width:900px;margin:0 auto;color:#1f2937;background:#f9fafb;padding:16px">
  <h2 style="color:#b91c1c;margin-top:0">🚨 Optovisión: ${found.length} facturas de pedidos SIN venta en el sistema</h2>
  <p style="font-size:15px">Total facturado por el laboratorio <strong style="color:#b91c1c;font-size:18px">${fmt(totalGeneral)}</strong> en pedidos que no tienen ninguna venta que los respalde (era CRM, desde abril 2026).</p>
  <p style="font-size:13px;color:#6b7280">Detalle completo de cada factura tal como la emitió Essilor/Optovisión: número, fecha, vencimiento, CAE, remito, línea "Ped:" y el desglose de cristales y tratamientos con su precio unitario, descuento y total. Para corroborar uno por uno con el laboratorio.</p>
  ${bloques}
  <p style="margin-top:16px"><a href="${APP}/admin/laboratorio/costos?lab=OPTOVISION&estado=UNMATCHED">Ver estos pedidos en el CRM</a></p>
</div>`;

const t = nodemailer.createTransport({ host: 'smtp.gmail.com', port: 465, secure: true, auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } });
const info = await t.sendMail({
    from: `"Atelier CRM — Conciliación" <${process.env.SMTP_USER}>`,
    to: 'pisano.ishtar@gmail.com',
    subject: `🚨 Optovisión: ${fmt(totalGeneral)} en ${found.length} facturas SIN venta — detalle completo para corroborar`,
    html,
});
console.log('Enviado:', info.messageId, '| total', totalGeneral);
