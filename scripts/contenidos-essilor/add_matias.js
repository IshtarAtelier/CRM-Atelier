const fs = require('fs');
const path = require('path');

const dir = '/Users/ishtarpissano/proyectos/atelier/contenidos-essilor';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.md'));

files.forEach(file => {
    const filePath = path.join(dir, file);
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Replace specific phrases for plural/grammar correctness
    content = content.replace(/nuestra óptica contactóloga, Ishtar Pissano/g, 'nuestros especialistas Ishtar Pissano y Matías Turchi');
    content = content.replace(/nuestra óptica contactóloga Ishtar Pissano/g, 'nuestros especialistas Ishtar Pissano y Matías Turchi');
    content = content.replace(/nuestra contactóloga Ishtar Pissano/g, 'nuestros especialistas Ishtar Pissano y Matías Turchi');
    content = content.replace(/la óptica contactóloga Ishtar Pissano/g, 'los especialistas Ishtar Pissano y Matías Turchi');
    content = content.replace(/nuestra especialista Ishtar Pissano/g, 'nuestros especialistas Ishtar Pissano y Matías Turchi');
    
    // Verbs
    content = content.replace(/Ishtar Pissano te guiará/g, 'Ishtar Pissano y Matías Turchi te guiarán');
    content = content.replace(/Ishtar y nuestro equipo te recomendarán/g, 'Ishtar, Matías y nuestro equipo te recomendarán');
    content = content.replace(/Ishtar Pissano recomienda/g, 'Ishtar Pissano y Matías Turchi recomiendan');
    content = content.replace(/Ishtar Pissano prescribe/g, 'Ishtar Pissano y Matías Turchi prescriben');
    content = content.replace(/Ishtar Pissano se encarga/g, 'Ishtar Pissano y Matías Turchi se encargan');
    content = content.replace(/Ishtar Pissano toma personalmente/g, 'Ishtar Pissano y Matías Turchi toman personalmente');
    content = content.replace(/Ishtar Pissano acompañará/g, 'Ishtar Pissano y Matías Turchi acompañarán');
    content = content.replace(/Ishtar Pissano se niega/g, 'Ishtar Pissano y Matías Turchi se niegan');

    // Generic replacements for what's left (except in the author JSON or frontmatter if any)
    content = content.replace(/por Ishtar Pissano\./g, 'por Ishtar Pissano y Matías Turchi (Essilor Experts).');
    content = content.replace(/por Ishtar Pissano y avalan/g, 'por Ishtar Pissano y Matías Turchi avalan');
    
    // Replace schema author if needed
    content = content.replace(/"name": "Ishtar Pissano",\n\s*"jobTitle": "Óptica Contactóloga"/g, '"name": "Ishtar Pissano & Matías Turchi",\n        "jobTitle": "Especialistas Essilor Expert"');

    // In the local SEO generic block that we injected in all files:
    content = content.replace(/calibrados milimétricamente por Ishtar Pissano\./g, 'calibrados milimétricamente por Ishtar Pissano y Matías Turchi.');
    content = content.replace(/por la óptica contactóloga \*\*Ishtar Pissano\*\* avalan/g, 'por nuestros especialistas **Ishtar Pissano y Matías Turchi** avalan');

    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated ${file}`);
});
