import os
import re
import glob

# Rutas
base_dir = '/Users/ishtarpissano/proyectos/atelier/docs/seo_external_campaign/pbn'
files = glob.glob(os.path.join(base_dir, '*.html'))

replacements = [
    # Títulos y palabras fuertes
    (r'(?i)Directorio Médico de Oftalmología', 'Directorio de Salud Visual'),
    (r'(?i)Revista de Oftalmopediatría', 'Revista de Salud Visual Infantil'),
    (r'(?i)Oftalmopediatría', 'Salud Visual Infantil'),
    (r'(?i)Oftalmología', 'Óptica y Salud Visual'),
    (r'(?i)oftalmólogo', 'especialista en salud visual'),
    (r'(?i)oftalmólogos', 'especialistas en salud visual'),
    (r'(?i)oftalmológico', 'visual'),
    (r'(?i)oftalmológica', 'visual'),
    (r'(?i)oftalmológicos', 'visuales'),
    (r'(?i)oftalmológicas', 'visuales'),
    (r'(?i)clínico', 'técnico'),
    (r'(?i)clínicos', 'técnicos'),
    (r'(?i)clínica', 'óptica especializada'),
    (r'(?i)clínicas', 'ópticas especializadas'),
    (r'(?i)Directorio Médico', 'Directorio Óptico'),
    (r'(?i)médico', 'especialista'),
    (r'(?i)médicos', 'especialistas'),
    (r'(?i)medicina', 'salud visual'),
    (r'(?i)patología', 'condición'),
    (r'(?i)patologías', 'condiciones'),
    (r'(?i)fisiopatología', 'condición visual')
]

for filepath in files:
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    new_content = content
    for pattern, repl in replacements:
        # Usar re.sub preservando el case si es posible, o simplemente reemplazar todo a la versión del replacement
        new_content = re.sub(pattern, repl, new_content, flags=re.IGNORECASE)
    
    # Revert some accidental replacements if they break HTML logic (like classes)
    new_content = new_content.replace('óptica especializada="', 'class="') # if we broke class=" something
    
    if new_content != content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f"Updated: {os.path.basename(filepath)}")

print("Done replacing medical terms.")
