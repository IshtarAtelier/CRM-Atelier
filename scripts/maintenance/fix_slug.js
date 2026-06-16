const fs = require('fs');
const path = '/Users/ishtarpissano/proyectos/atelier/src/app/blog/[slug]/page.tsx';

let content = fs.readFileSync(path, 'utf8');

// Replace the return object of generateMetadata
const oldReturn = `return {
    title: cleanTitle,
    description: post.metaDescription,
    openGraph: {`;

const newReturn = `
  let finalDescription = post.metaDescription || '';
  if (!/envíos/i.test(finalDescription)) finalDescription += " Envíos a toda Argentina.";
  if (!/cuotas/i.test(finalDescription)) finalDescription += " Cuotas sin interés.";
  if (!/atención personalizada/i.test(finalDescription)) finalDescription += " Atención personalizada.";

  return {
    title: cleanTitle,
    description: finalDescription,
    keywords: ["óptica Argentina", "envíos a toda Argentina", "cuotas", "atención personalizada", "anteojos de receta", cleanTitle],
    openGraph: {`;

content = content.replace(oldReturn, newReturn);
fs.writeFileSync(path, content, 'utf8');
console.log("Updated [slug]/page.tsx");
