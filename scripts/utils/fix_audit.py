import os
import re
import glob

DEPLOY_DIR = "/Users/ishtarpissano/proyectos/atelier/docs/seo_external_campaign/deploy_sites"

def fix_html_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Fix CSS main targeting
    # Find which tag is used instead of main, or just fix the CSS
    # It seems the python script mapped <main> to random elements.
    # The CSS has `main { ... }`
    # Let's find what the main wrapper is.
    main_pattern = re.search(r'<([a-z]+)[^>]*id="(?:app-body|main-content)"[^>]*>|<article[^>]*>', content)
    if main_pattern:
        tag_match = main_pattern.group(0)
        # We replace `main {` in the CSS with the actual selector or just change the HTML back to `<main>`
        # Actually, it's safer to change the HTML back to `<main>` and keep the CSS!
        # The obfuscator changed `<main>` to `<div id="app-body">` etc.
        # Let's just fix the CSS to apply to that wrapper to preserve DOM footprint.
        wrapper_selector = ""
        if 'id="app-body"' in tag_match:
            wrapper_selector = '#app-body'
        elif 'id="main-content"' in tag_match:
            wrapper_selector = '#main-content'
        elif '<article' in tag_match:
            wrapper_selector = 'article'
        
        if wrapper_selector:
            content = re.sub(r'\bmain\s*{', f'{wrapper_selector} {{', content)
    
    # Fix WhatsApp link
    # Old: <a href="#" onclick="window.open('https://wa.me/5493518685644?text=Hola...', '_blank'); return false;" class="..." target="_blank" rel="noopener noreferrer">
    # New: <a href="https://wa.me/5493518685644?text=Hola..." class="..." target="_blank" rel="noopener noreferrer">
    wa_match = re.search(r'<a href="#"[^>]*onclick="window\.open\(\'([^\']+)\'[^\)]+\); return false;"([^>]*)>', content)
    if wa_match:
        wa_url = wa_match.group(1)
        rest_attrs = wa_match.group(2)
        # remove any onclick from rest_attrs just in case
        rest_attrs = re.sub(r'onclick="[^"]+"', '', rest_attrs).strip()
        content = content.replace(wa_match.group(0), f'<a href="{wa_url}" {rest_attrs}>')
    
    # Alternatively, if it's slightly different:
    content = re.sub(r'<a href="#"\s+onclick="window\.open\(\'([^\']+)\'(?:,\s*\'[^\']*\')?\);\s*return false;"', r'<a href="\1"', content)

    # Fix Ampersands in Google Fonts
    content = content.replace('&family=', '&amp;family=').replace('&display=', '&amp;display=')

    # Fix Markdown
    content = re.sub(r'\*\*([^*]+)\*\*', r'<strong>\1</strong>', content)

    # Specific Fixes
    if 'multifocalescordoba' in filepath:
        content = content.replace('software avanzados', 'software avanzado')
    
    if 'anteojosdesolcba' in filepath:
        content = content.replace('Armazones de acetato italiano pulidos', 'Ofrecemos armazones de acetato italiano pulidos')
    
    if 'opticascordoba' in filepath:
        content = content.replace('</main role="main">', '</main>')

    if 'variluxargentina' in filepath:
        # Add CTA button if missing. It should be after "te recomendamos asesorarte con los especialistas de Atelier Óptica."
        # Or at the bottom.
        if 'action-v6' not in content and 'class="action-v6"' not in content:
            cta_html = '<br><br><a href="https://wa.me/5493518685644?text=Hola%2C+quiero+cotizar+cristales+Varilux" class="action-v6" target="_blank" rel="noopener noreferrer">Consultar por WhatsApp</a>'
            content = content.replace('buscá directamente Atelier Óptica en Google.', f'buscá directamente Atelier Óptica en Google.{cta_html}')

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)


for root, dirs, files in os.walk(DEPLOY_DIR):
    for file in files:
        if file.endswith('.html'):
            fix_html_file(os.path.join(root, file))

print("Auditor fixes applied.")
