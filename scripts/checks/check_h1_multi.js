const fs = require('fs');
const path = require('path');

const blogDir = '/Users/ishtarpissano/proyectos/atelier/src/app/blog';
const dirs = fs.readdirSync(blogDir).filter(f => fs.statSync(path.join(blogDir, f)).isDirectory());

dirs.forEach(dir => {
  const pagePath = path.join(blogDir, dir, 'page.tsx');
  if (fs.existsSync(pagePath)) {
    const content = fs.readFileSync(pagePath, 'utf8');
    const matches = content.match(/<h1/gi);
    if (matches && matches.length > 1) {
      console.log(`Multiple H1 in ${dir}: ${matches.length}`);
    }
  }
});
