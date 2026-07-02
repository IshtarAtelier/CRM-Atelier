const fs = require('fs');
const path = require('path');

const dir = '/Users/ishtarpissano/proyectos/atelier/contenidos-essilor';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.md'));

const ctaText = `
## ¿Dónde conseguir estos lentes en Córdoba? (Garantía Essilor Expert)

Si bien la terminología varía en Hispanoamérica, si te encuentras en la provincia de Córdoba (Argentina), el proceso es mucho más simple y seguro. **Atelier Óptica**, ubicada en el corazón de Cerro de las Rosas (Córdoba Capital), es tu Centro Essilor Expert de referencia.

Nos especializamos en el tallado y adaptación clínica de estas tecnologías. Atendemos no solo a pacientes de **Córdoba Capital**, sino que somos el punto de derivación principal para personas de **Villa Carlos Paz, Río Ceballos, Alta Gracia, Villa Allende, La Calera, Jesús María** y el resto del interior provincial que buscan lentes originales, certificados y calibrados milimétricamente por Ishtar Pissano.
`;

files.forEach(file => {
    const filePath = path.join(dir, file);
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Insert the CTA right before the FAQ section
    if (content.includes('## FAQ: Preguntas Frecuentes')) {
        content = content.replace('## FAQ: Preguntas Frecuentes', ctaText + '\n## FAQ: Preguntas Frecuentes');
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`Updated ${file}`);
    } else {
        console.log(`FAQ section not found in ${file}`);
    }
});
