import imaps from 'imap-simple';
const conn = await imaps.connect({ imap: { user: process.env.IMAP_USER, password: process.env.IMAP_PASSWORD,
    host: 'imap.gmail.com', port: 993, tls: true, tlsOptions: { servername:'imap.gmail.com', rejectUnauthorized: false }, authTimeout: 20000 } });
const boxes = await conn.getBoxes();
function walk(o, prefix=''){ for (const k of Object.keys(o)){ const b=o[k]; const name=prefix?prefix+(b.delimiter||'/')+k:k; console.log(name); if(b.children) walk(b.children, name); } }
walk(boxes);
conn.end();
