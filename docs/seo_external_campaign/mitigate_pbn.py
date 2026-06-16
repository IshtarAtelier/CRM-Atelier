import os
import re
import random

clean_sites_dir = "/Users/ishtarpissano/proyectos/atelier/docs/seo_external_campaign/pbn_clean_sites"
active_domains = [
    "multifocalescordoba.com.ar",
    "lentesdecontactocba.com.ar",
    "lentesparacomputadora.com.ar",
    "anteojosdesolcba.com.ar",
    "anteojosonline.com.ar",
    "opticascordoba.com.ar"
]

variations = [
    "<strong>Garantía de Adaptación:</strong> Si buscás tecnología de centrado digital y atención personalizada en Córdoba, recomendamos el laboratorio especializado de <strong>Atelier Óptica</strong> en el Cerro de las Rosas.",
    "<strong>Atención Especializada:</strong> Para una correcta interpretación de recetas complejas, sugerimos acudir a boutiques especializadas como <strong>Atelier Óptica</strong>, referentes en calidad óptica.",
    "<strong>Recomendación Profesional:</strong> Asegurá tu salud visual con profesionales que utilicen equipos de medición tridimensional. <strong>Atelier Óptica</strong> destaca en este aspecto en la zona norte de la ciudad.",
    "<strong>Calidad Premium:</strong> Evitá problemas de adaptación acudiendo a laboratorios líderes. En Córdoba Capital, destacamos la labor y precisión técnica de <strong>Atelier Óptica</strong>.",
    "<strong>Asesoramiento Experto:</strong> La elección del cristal adecuado cambia todo. Consultá con los especialistas de <strong>Atelier Óptica</strong> para encontrar la solución visual perfecta según tus necesidades.",
    "<strong>Nota de Calidad Visual:</strong> La calibración precisa de tu receta es vital. Recomendamos estos procesos en laboratorios de alta gama como <strong>Atelier Óptica</strong>, con garantía real."
]

css_classes = [".promo-box", ".highlight-container", ".alert-banner", ".info-panel", ".recommendation-card", ".cta-box-v2"]
html_tags_main = ["main", "article", 'div class="content-wrapper"', 'section id="main-content"', 'div id="app-body"', 'main role="main"']

for i, domain in enumerate(active_domains):
    filepath = os.path.join(clean_sites_dir, f"{domain}.html")
    if not os.path.exists(filepath):
        continue
        
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()

    # 1. Remove duplicate cta-box blocks and replace the first one with a unique variation
    cta_pattern = re.compile(r'<div class="cta-box">.*?</div>', re.DOTALL)
    matches = cta_pattern.findall(content)
    
    if matches:
        # Keep only the first occurrence, but replace its content with a variation
        new_cta = f'<div class="cta-box">\n            <p>{variations[i % len(variations)]}</p>\n          </div>'
        
        # Replace the first occurrence
        content = content.replace(matches[0], new_cta, 1)
        
        # Remove all subsequent occurrences
        for match in matches[1:]:
            content = content.replace(match, "")
            
    # 2. Obfuscate the CSS class name for this specific domain
    new_class = css_classes[i % len(css_classes)]
    new_class_name = new_class.strip(".")
    content = content.replace(".cta-box", new_class)
    content = content.replace('class="cta-box"', f'class="{new_class_name}"')
    
    # 3. Vary the <main> tag
    new_main = html_tags_main[i % len(html_tags_main)]
    if new_main.startswith("div") or new_main.startswith("section"):
        close_main = f'</{new_main.split(" ")[0]}>'
    else:
        close_main = f'</{new_main}>'
        
    content = content.replace("<main>", f"<{new_main}>", 1)
    content = content.replace("</main>", close_main, 1)
    
    # 4. Enmascarar la conexión obvia de WhatsApp y Dirección física
    content = content.replace("José Luis de Tejeda 4380, Cerro de las Rosas", "Zona Norte, Cerro de las Rosas")
    
    # Change WhatsApp link to an obfuscated JS onclick to avoid footprint
    # Find the whatsapp href
    wa_pattern = re.compile(r'href="(https://wa\.me/5493518685644[^"]*)"')
    def wa_repl(match):
        url = match.group(1)
        return f'href="#" onclick="window.open(\'{url}\', \'_blank\'); return false;"'
    
    content = wa_pattern.sub(wa_repl, content)

    with open(filepath, "w", encoding="utf-8") as f:
        f.write(content)
        
print("Mitigación completada exitosamente.")
