const fs = require('fs');
const path = require('path');

const blogDir = '/Users/ishtarpissano/proyectos/atelier/src/app/blog';
const dirs = fs.readdirSync(blogDir).filter(f => fs.statSync(path.join(blogDir, f)).isDirectory() && f !== '[slug]');

dirs.forEach(dir => {
  const pagePath = path.join(blogDir, dir, 'page.tsx');
  if (fs.existsSync(pagePath)) {
    const content = fs.readFileSync(pagePath, 'utf8');
    const matches = content.match(/(curar|diagnóstic|diagnostica|curan|cura |PAMI\b|\bpami\b|diagnóstico)/gi);
    if (matches) {
      console.log(`\n--- ${dir} ---`);
      console.log(matches.join(', '));
      // show context
      const lines = content.split('\n');
      lines.forEach((l, i) => {
        if (/(curar|diagnóstic|diagnostica|curan|cura |PAMI\b|\bpami\b|diagnóstico)/gi.test(l)) {
          console.log(`Line ${i+1}: ${l.trim()}`);
        }
      });
    }
  }
});
