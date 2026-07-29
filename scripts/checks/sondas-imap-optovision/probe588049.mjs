import imaps from 'imap-simple';
import { simpleParser } from 'mailparser';
import { OptovisionParserService } from './src/services/optovision-parser.service.ts';

const conn = await imaps.connect({ imap: { user: process.env.IMAP_USER, password: process.env.IMAP_PASSWORD,
    host: 'imap.gmail.com', port: 993, tls: true, tlsOptions: { servername:'imap.gmail.com', rejectUnauthorized: false }, authTimeout: 20000 } });
await conn.openBox('[Gmail]/Todos');

const targets = ['588049','587998','588057'];
const froms = ['procesos@optovisionsa.com.ar','procesos@essilor.com.ar'];
for (const from of froms) {
  let msgs = [];
  try { msgs = await conn.search([['FROM', from]], { bodies:[''], markSeen:false }); } catch(e){ console.log('search err', from, e.message); continue; }
  console.log(`\n===== FROM ${from}: ${msgs.length} msgs =====`);
  for (const m of msgs) {
    const p = m.parts.find(x=>x.which==='');
    const parsed = await simpleParser(p.body);
    for (const att of parsed.attachments||[]) {
      if (att.contentType!=='application/pdf') continue;
      let inv;
      try { inv = await OptovisionParserService.parseInvoice(att.content); } catch(e){ continue; }
      const raw = inv.rawText || '';
      const hit = targets.filter(t => raw.includes(t));
      if (hit.length===0) continue;
      console.log(`--- ${parsed.date?.toISOString?.()||parsed.date} | subj="${(parsed.subject||'').slice(0,60)}" | file=${att.filename}`);
      console.log(`    hits=${hit.join(',')} | orderNums=${JSON.stringify(inv.labOrderNumbers)} | subtotal=${inv.subtotal} total=${inv.total}`);
      // print lines around each hit
      for (const t of hit) {
        const idx = raw.indexOf(t);
        const ctx = raw.slice(Math.max(0,idx-120), idx+120).replace(/\s+/g,' ');
        console.log(`    [${t}] ...${ctx}...`);
      }
    }
  }
}
conn.end();
