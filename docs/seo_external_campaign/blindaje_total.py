import os
import re
import random

deploy_dir = "/Users/ishtarpissano/proyectos/atelier/docs/seo_external_campaign/deploy_sites"
active_domains = [
    "multifocalescordoba.com.ar",
    "lentesdecontactocba.com.ar",
    "lentesparacomputadora.com.ar",
    "anteojosdesolcba.com.ar",
    "anteojosonline.com.ar",
    "opticascordoba.com.ar",
    "variluxargentina.com.ar"
]

publishers = [
    "Asociación Visual Cba",
    "Directorio Óptico Argentino",
    "Foro de Salud Ocular",
    "Expertos en Visión Córdoba",
    "Comunidad Optometría AR",
    "Revista Visual Córdoba",
    "Portal Optométrico Nacional"
]

fonts_replacement = """
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600&family=Playfair+Display:wght@400;600;700&family=Outfit:wght@300;400;600;700&display=swap" rel="stylesheet">
    <style>
"""

for i, domain in enumerate(active_domains):
    filepath = os.path.join(deploy_dir, domain, "index.html")
    if not os.path.exists(filepath):
        continue
        
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()

    # 1. Diversificación Schema
    content = content.replace('"Guía Especializada de Salud Visual Córdoba"', f'"{publishers[i]}"')
    content = content.replace('>Guía Especialista de Córdoba<', f'>{publishers[i]}<')

    # 2. Parche Rendimiento (Fuentes)
    content = re.sub(r'<style>\s*@import url\([^)]+\);', fonts_replacement, content)

    # 3. Blindaje de Entidad (Eliminar WA link)
    wa_btn_pattern = re.compile(r'<a[^>]*href="[^"]*wa\.me[^"]*"[^>]*>.*?</a>', re.DOTALL | re.IGNORECASE)
    organic_cta = f'<div style="background: rgba(255,255,255,0.1); padding: 20px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.2);"><p style="font-weight: bold; margin-bottom: 0;">Para atención personalizada, buscá directamente "Atelier Óptica Cerro de las Rosas" en Google o Instagram.</p></div>'
    content = wa_btn_pattern.sub(organic_cta, content)
    
    # 4. Ofuscación de CSS
    class_map = {
        "btn": f"action-v{i}",
        "info-grid": f"grid-layout-x{i}",
        "info-card": f"card-item-v{i}",
        "badge-brand": f"tag-brand-x{i}",
        "footer-cta": f"bottom-promo-z{i}"
    }
    
    for old_cls, new_cls in class_map.items():
        # In css
        content = content.replace(f".{old_cls} {{", f".{new_cls} {{")
        content = content.replace(f".{old_cls}:hover", f".{new_cls}:hover")
        content = content.replace(f".{old_cls} h", f".{new_cls} h")
        content = content.replace(f".{old_cls} p", f".{new_cls} p")
        # In html
        content = content.replace(f'class="{old_cls}"', f'class="{new_cls}"')
        content = content.replace(f'class="{old_cls} ', f'class="{new_cls} ')

    with open(filepath, "w", encoding="utf-8") as f:
        f.write(content)

print("Blindaje Total Completado Exitosamente en deploy_sites.")
