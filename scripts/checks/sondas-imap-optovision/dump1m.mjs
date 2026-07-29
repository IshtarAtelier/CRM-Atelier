import imaps from 'imap-simple';
import { simpleParser } from 'mailparser';
import { OptovisionParserService } from './src/services/optovision-parser.service.ts';

const conn = await imaps.connect({ imap: { user: process.env.IMAP_USER, password: process.env.IMAP_PASSWORD,
    host: 'imap.gmail.com', port: 993, tls: true, tlsOptions: { servername:'imap.gmail.com', rejectUnauthorized: false }, authTimeout: 20000 } });
await conn.openBox('[Gmail]/Todos');
const msgs = await conn.search([['FROM','procesos@optovisionsa.com.ar']], { bodies:[''], markSeen:false });
for (const m of msgs) {
  const p = m.parts.find(x=>x.which==='');
  const parsed = await simpleParser(p.body);
  for (const att of parsed.attachments||[]) {
    if (att.contentType!=='application/pdf') continue;
    if (!/62896/.test(att.filename||'')) continue;
    const inv = await OptovisionParserService.parseInvoice(att.content);
    console.log('FILE', att.filename, 'orders', JSON.stringify(inv.labOrderNumbers), 'subtotal', inv.subtotal, 'total', inv.total);
    console.log('===== RAW =====');
    console.log(inv.rawText);
  }
}
conn.end();
