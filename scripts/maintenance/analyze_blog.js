const fs = require('fs');
const path = require('path');

const blogDir = '/Users/ishtarpissano/proyectos/atelier/src/app/blog';
const dirs = fs.readdirSync(blogDir).filter(f => fs.statSync(path.join(blogDir, f)).isDirectory() && f !== '[slug]');

dirs.forEach(dir => {
  const pagePath = path.join(blogDir, dir, 'page.tsx');
  if (fs.existsSync(pagePath)) {
    const content = fs.readFileSync(pagePath, 'utf8');
    const hasMetadata = content.includes('export const metadata');
    const hasContacto = content.includes('href="/contacto"');
    const hasWaMe = content.includes('wa.me');
    const hasCurar = content.match(/curar|diagnóstic/i);
    const hasPami = content.match(/pami/i);
    
    console.log(`${dir}: metadata=${hasMetadata}, contacto=${hasContacto}, wame=${hasWaMe}, curar/diag=${!!hasCurar}, pami=${!!hasPami}`);
  }
});
