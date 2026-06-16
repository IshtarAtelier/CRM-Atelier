const fs = require('fs');
const path = require('path');

const blogDir = '/Users/ishtarpissano/proyectos/atelier/src/app/blog';
const dirs = fs.readdirSync(blogDir).filter(f => fs.statSync(path.join(blogDir, f)).isDirectory() && f !== '[slug]');

dirs.forEach(dir => {
  const pagePath = path.join(blogDir, dir, 'page.tsx');
  if (!fs.existsSync(pagePath)) return;
  
  let content = fs.readFileSync(pagePath, 'utf8');
  let hasChanges = false;
  
  // 1. WhatsApp link replacement
  const linkRegex = /<Link\s+([^>]*?)href="\/contacto"([^>]*?)>([\s\S]*?)<\/Link>/g;
  if (linkRegex.test(content)) {
    content = content.replace(linkRegex, '<a $1href="https://wa.me/5493518685644" target="_blank" rel="noopener noreferrer"$2>$3</a>');
    hasChanges = true;
  }
  
  // 2. Fix 'control-miopia' specifically
  if (dir === 'control-miopia') {
    const oldText = 'La gestión de la miopía requiere de un diagnóstico preciso y seguimiento constante. Agendá una consulta con nuestro equipo para evaluar si la tecnología Essilor es la indicada para vos o para tu hijo.';
    const newText = 'El control de la miopía requiere seguimiento oftalmológico. Acercate con tu receta médica a Atelier Óptica y nuestro equipo evaluará, mediante toma de medidas, si los cristales de control de miopía son la opción indicada que tu médico recetó para vos o para tu hijo.';
    if (content.includes(oldText)) {
      content = content.replace(oldText, newText);
      hasChanges = true;
    }
  }

  // 3. Metadata updates
  const metaRegex = /export\s+const\s+metadata\s*:\s*Metadata\s*=\s*{([\s\S]*?)};/m;
  const match = content.match(metaRegex);
  
  let title = `"${dir.replace(/-/g, ' ')} | Atelier Óptica"`;
  let desc = `"Descubrí todo sobre ${dir.replace(/-/g, ' ')} en Atelier Óptica. Envíos a toda Argentina, cuotas sin interés y atención personalizada."`;
  
  if (match) {
    const metaBody = match[1];
    const titleMatch = metaBody.match(/title\s*:\s*("[^"]+"|'[^']+'|`[^`]+`)/);
    if (titleMatch) title = titleMatch[1];
    
    const descMatch = metaBody.match(/description\s*:\s*("[^"]+"|'[^']+'|`[^`]+`)/);
    if (descMatch) {
      // Modify description to include the required SEO terms if not present
      let d = descMatch[1].slice(1, -1);
      if (!/envíos/i.test(d)) d += " Envíos a toda Argentina.";
      if (!/cuotas/i.test(d)) d += " Cuotas sin interés.";
      if (!/atención personalizada/i.test(d)) d += " Atención personalizada y asesoramiento estético.";
      desc = `"${d}"`;
    }
  }

  const keywords = `["óptica Argentina", "envíos a toda Argentina", "cuotas", "atención personalizada", "anteojos de receta", "${dir.replace(/-/g, ' ')}"]`;

  const newMetadata = `export const metadata: Metadata = {
  title: ${title},
  description: ${desc},
  keywords: ${keywords},
};`;

  if (match) {
    const oldMeta = match[0];
    if (oldMeta !== newMetadata) {
      content = content.replace(metaRegex, newMetadata);
      hasChanges = true;
    }
  } else {
    // Inject at the top after imports
    const importRegex = /(import\s+.*?;\n)+/g;
    let importMatch;
    let lastIndex = 0;
    while ((importMatch = importRegex.exec(content)) !== null) {
      lastIndex = importRegex.lastIndex;
    }
    
    // Check if Metadata is imported, if not, add it
    let finalContent = content;
    if (!/import\s+{.*?\bMetadata\b.*?}\s+from\s+['"]next['"]/.test(content)) {
      finalContent = `import { Metadata } from 'next';\n` + finalContent;
      lastIndex += `import { Metadata } from 'next';\n`.length;
    }

    // Since we don't have a reliable lastIndex if no imports or something, 
    // let's just insert before the first export default
    finalContent = finalContent.replace(/export\s+default\s+function/, `\n${newMetadata}\n\nexport default function`);
    content = finalContent;
    hasChanges = true;
  }
  
  if (hasChanges) {
    fs.writeFileSync(pagePath, content, 'utf8');
    console.log(`Updated ${dir}`);
  }
});
