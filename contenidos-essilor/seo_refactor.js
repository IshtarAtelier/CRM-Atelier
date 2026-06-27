const fs = require('fs');
const path = require('path');

const dir = '/Users/ishtarpissano/proyectos/atelier/contenidos-essilor';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.md'));

const schemaLocalBusiness = `
    {
      "@type": "OpticalStore",
      "@id": "https://atelieroptica.com.ar/#localbusiness",
      "name": "Atelier Óptica",
      "image": "https://atelieroptica.com.ar/logo.png",
      "address": {
        "@type": "PostalAddress",
        "streetAddress": "José Luis de Tejeda 4380",
        "addressLocality": "Cerro de las Rosas, Córdoba",
        "addressRegion": "CBA",
        "postalCode": "X5009",
        "addressCountry": "AR"
      },
      "geo": {
        "@type": "GeoCoordinates",
        "latitude": -31.368798,
        "longitude": -64.234154
      },
      "url": "https://atelieroptica.com.ar",
      "telephone": "+5493513447219",
      "priceRange": "$$"
    },`;

files.forEach(file => {
    const filePath = path.join(dir, file);
    let content = fs.readFileSync(filePath, 'utf8');
    
    // 1. Refactor Title (Inject "en Córdoba")
    content = content.replace(/title: "(.*?)"/, (match, p1) => {
        if (!p1.includes("Córdoba")) {
            return `title: "${p1} en Córdoba | Atelier Óptica"`;
        }
        return match;
    });

    // 2. Refactor Meta Description
    content = content.replace(/meta_description: "(.*?)"/, (match, p1) => {
        if (!p1.includes("Atelier Óptica")) {
            return `meta_description: "${p1} Conseguilos en Atelier Óptica, especialistas Essilor en Cerro de las Rosas, Córdoba."`;
        }
        return match;
    });

    // 3. Replace GEO section with hardcore Local SEO Copy
    const localSEOCopy = `## ¿Dónde hacer estos lentes en Córdoba? (Especialistas Essilor Expert)

Si buscas la máxima precisión óptica en la provincia de Córdoba, **Atelier Óptica** (ubicada en pleno Cerro de las Rosas, Córdoba Capital) es tu centro **Essilor Expert** de referencia. 

Para lograr el éxito con esta tecnología, no basta con comprar el cristal original; se requiere de **toma de medidas digitales y un centrado milimétrico**. Es por eso que recibimos a diario pacientes no solo de Capital, sino que somos la óptica de derivación principal para usuarios de **Villa Carlos Paz, Río Ceballos, Alta Gracia, Villa Allende, La Calera y Jesús María**.

### Palabras Claves y Consultas Frecuentes de nuestros pacientes locales:
*   **"Dónde comprar lentes Essilor originales en Córdoba":** Garantizamos autenticidad con certificado de laboratorio.
*   **"Precio de cristales oftálmicos en Córdoba Capital":** Ofrecemos presupuestos exactos, promociones 2x1 en multifocales y opciones de pago con tarjeta.
*   **"Óptica de confianza en Cerro de las Rosas":** Nuestra reputación en Google Maps y el asesoramiento personalizado por la óptica contactóloga **Ishtar Pissano** avalan nuestra calidad.

Ven a visitarnos a José Luis de Tejeda 4380 y experimenta el verdadero cuidado visual.

`;

    // Regex to match from "## Disponibilidad..." up to "## FAQ: Preguntas Frecuentes"
    const geoRegex = /## Disponibilidad y Terminología Local \(GEO\)[\s\S]*?(?=## FAQ: Preguntas Frecuentes)/;
    
    if (geoRegex.test(content)) {
        content = content.replace(geoRegex, localSEOCopy);
    } else {
        // Fallback if the previous script modified it
        const fallbackRegex = /## ¿Dónde conseguir estos lentes en Córdoba\? \(Garantía Essilor Expert\)[\s\S]*?(?=## FAQ: Preguntas Frecuentes)/;
        if (fallbackRegex.test(content)) {
            content = content.replace(fallbackRegex, localSEOCopy);
        }
    }

    // 4. Inject LocalBusiness Schema
    // Find "author": { ... } } and inject right after it inside the Article graph
    if (!content.includes('"@type": "OpticalStore"')) {
        content = content.replace(/"@type": "Article",[\s\S]*?"author": \{[\s\S]*?\}\s*\}/, (match) => {
            return match + ',\n      "publisher": {"@id": "https://atelieroptica.com.ar/#localbusiness"}';
        });
        
        // Inject LocalBusiness into the @graph array
        content = content.replace(/"@graph": \[/, '"@graph": [\n' + schemaLocalBusiness);
    }

    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Deep SEO applied to ${file}`);
});
