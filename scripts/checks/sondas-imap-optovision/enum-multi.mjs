import imaps from 'imap-simple';
import { simpleParser } from 'mailparser';
import { OptovisionParserService } from './src/services/optovision-parser.service.ts';

const conn = await imaps.connect({ imap: { user: process.env.IMAP_USER, password: process.env.IMAP_PASSWORD,
    host: 'imap.gmail.com', port: 993, tls: true, tlsOptions: { servername:'imap.gmail.com', rejectUnauthorized: false }, authTimeout: 20000 } });
await conn.openBox('[Gmail]/Todos');
const msgs = await conn.search([['FROM','procesos@optovisionsa.com.ar']], { bodies:[''], markSeen:false });
console.error(`Emails de Optovision: ${msgs.length}`);

const invoices = [];
for (const m of msgs) {
  const p = m.parts.find(x=>x.which==='');
  if (!p) continue;
  const parsed = await simpleParser(p.body);
  for (const att of parsed.attachments||[]) {
    if (att.contentType!=='application/pdf') continue;
    try {
      const inv = await OptovisionParserService.parseInvoice(att.content);
      // extraer nº de factura del rawText
      const nf = (inv.rawText||'').match(/FACTURA N°\s*([\d]{4})\s*-?\s*([\d]{6,})/);
      const nroFactura = nf ? `${nf[1]}-${nf[2]}` : (att.filename||'').replace(/\.pdf$/i,'');
      invoices.push({ file: att.filename, nroFactura, peds: inv.labOrderNumbers, subtotal: inv.subtotal, total: inv.total, date: parsed.date });
    } catch(e) {
      invoices.push({ file: att.filename, error: String(e).slice(0,80) });
    }
  }
}
conn.end();

// Solo las multi-pedido (peds.length > 1)
const multi = invoices.filter(i => (i.peds||[]).length > 1);
console.log('=== FACTURAS MULTI-PEDIDO (peds.length > 1) ===');
console.log('total facturas parseadas:', invoices.length, '| multi-pedido:', multi.length);
for (const i of multi) {
  console.log(JSON.stringify({ nroFactura: i.nroFactura, file: i.file, peds: i.peds, total: i.total, subtotal: i.subtotal, date: i.date }));
}
