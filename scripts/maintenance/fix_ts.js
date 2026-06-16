const fs = require('fs');
const path = require('path');

const blogDir = '/Users/ishtarpissano/proyectos/atelier/src/app/blog';
const dirs = fs.readdirSync(blogDir).filter(f => fs.statSync(path.join(blogDir, f)).isDirectory() && f !== '[slug]');

dirs.forEach(dir => {
  const pagePath = path.join(blogDir, dir, 'page.tsx');
  if (!fs.existsSync(pagePath)) return;
  
  let content = fs.readFileSync(pagePath, 'utf8');
  let hasChanges = false;
  
  if (content.includes('import StorefrontNavbar')) {
    content = content.replace(/import\s+StorefrontNavbar\s+from/g, 'import { StorefrontNavbar } from');
    hasChanges = true;
  }
  
  if (content.includes('import StorefrontFooter')) {
    content = content.replace(/import\s+StorefrontFooter\s+from/g, 'import { StorefrontFooter } from');
    hasChanges = true;
  }
  
  // check for double metadata
  const metaRegex = /export\s+const\s+metadata\s*:\s*Metadata\s*=\s*{[\s\S]*?};/g;
  const matches = content.match(metaRegex);
  if (matches && matches.length > 1) {
    // Keep only the last one (which we injected)
    const toKeep = matches[matches.length - 1];
    // Remove all others
    for (let i = 0; i < matches.length - 1; i++) {
      content = content.replace(matches[i], '');
    }
    hasChanges = true;
  }
  
  if (hasChanges) {
    fs.writeFileSync(pagePath, content, 'utf8');
    console.log(`Fixed TS in ${dir}`);
  }
});
