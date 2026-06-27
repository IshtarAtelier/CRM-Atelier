const fs = require('fs');
const path = require('path');

const dir = '/Users/ishtarpissano/proyectos/atelier/contenidos-essilor';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.md'));

files.forEach(file => {
    const filePath = path.join(dir, file);
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Replace "especialistas" with "ópticos contactólogos" when followed by the names
    content = content.replace(/nuestros especialistas Ishtar Pissano y Matías Turchi/g, 'nuestros ópticos contactólogos Ishtar Pissano y Matías Turchi');
    content = content.replace(/los especialistas Ishtar Pissano y Matías Turchi/g, 'los ópticos contactólogos Ishtar Pissano y Matías Turchi');
    
    // Update the JSON-LD schema jobTitle
    content = content.replace(/"jobTitle": "Especialistas Essilor Expert"/g, '"jobTitle": "Ópticos Contactólogos | Especialistas Essilor Expert"');
    
    // Also catch the (Essilor Experts) tag we added at the end of some paragraphs and add the Contactólogo part if it sounds good, 
    // but the schema and the main intro are the most important.
    
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated titles in ${file}`);
});
