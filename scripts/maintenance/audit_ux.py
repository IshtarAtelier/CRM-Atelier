import os
import glob
import re

blog_dir = "/Users/ishtarpissano/proyectos/atelier/src/app/blog/"
cta_block = """
          {/* CTA WHATSAPP AUTOMÁTICO */}
          <div className="mt-16 bg-black/5 p-8 md:p-12 rounded-2xl text-center border border-black/10">
            <h3 className="text-2xl font-bold mb-4">¿Necesitás asesoramiento personalizado?</h3>
            <p className="text-black/70 mb-8 max-w-xl mx-auto">
              Comunicate directamente con nuestro equipo de ópticos por WhatsApp. Estamos para ayudarte a encontrar el cristal y armazón perfecto según tu receta oftalmológica.
            </p>
            <a 
              href={`https://wa.me/${WHATSAPP_PHONE}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center bg-[#25D366] text-white px-8 py-4 rounded-full font-bold uppercase tracking-widest hover:bg-[#1ebe57] transition-all hover:scale-105"
            >
              Consultar por WhatsApp
            </a>
          </div>
"""

def process_file(filepath):
    if filepath.endswith("blog/page.tsx"):
        return
        
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()

    # Check for WHATSAPP_PHONE import
    if "WHATSAPP_PHONE" not in content:
        # Add import after the last import
        import_match = list(re.finditer(r"^import .+$", content, re.MULTILINE))
        if import_match:
            last_import = import_match[-1]
            insert_pos = last_import.end()
            content = content[:insert_pos] + "\nimport { WHATSAPP_PHONE } from '@/lib/constants';" + content[insert_pos:]
        else:
            content = "import { WHATSAPP_PHONE } from '@/lib/constants';\n" + content

    # Check if a wa.me link exists
    if "wa.me" not in content:
        print(f"Adding CTA to {filepath}")
        if "</article>" in content:
            content = content.replace("</article>", cta_block + "\n        </article>")
        elif "</main>" in content:
            content = content.replace("</main>", cta_block + "\n      </main>")
            
    # Save modified content
    with open(filepath, "w", encoding="utf-8") as f:
        f.write(content)

for root, dirs, files in os.walk(blog_dir):
    for file in files:
        if file == "page.tsx":
            process_file(os.path.join(root, file))

print("Done auditing UX CTAs!")
