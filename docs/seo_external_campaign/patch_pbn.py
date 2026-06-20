import os
import re

pbn_dir = "/Users/ishtarpissano/proyectos/atelier/docs/seo_external_campaign/deploy_sites"

# Define details for each domain
domains_info = {
    "anteojosdesolcba.com.ar": {
        "title": "Anteojos de Sol en Córdoba | Curaduría de Diseño y Filtros UV400",
        "description": "Encontrá los mejores anteojos de sol en Córdoba. Colecciones exclusivas, lentes polarizados y filtros UV400. Asesoramiento estético personalizado en el Cerro de las Rosas.",
        "link_url": "https://www.atelieroptica.com.ar",
        "faq": [
            {
                "q": "¿Qué significa exactamente UV400?",
                "a": "Significa que los cristales filtran el 100% de la radiación con longitudes de onda menores a 400 nanómetros, incluyendo los espectros UVA y UVB."
            },
            {
                "q": "¿Los anteojos de sol recetados son una buena opción?",
                "a": "Son la mejor solución para quienes tienen miopía o astigmatismo. Podés graduar tus cristales de sol con el tinte exacto que te guste, manteniendo tu graduación al aire libre."
            },
            {
                "q": "¿Cómo limpio mis lentes de sol sin rayarlos?",
                "a": "Usá siempre microfibra limpia y un líquido especial para cristales. Nunca los limpies en seco con la remera ni uses papel tissue, ya que arrastran partículas de tierra microscópicas que rayan el tratamiento."
            }
        ]
    },
    "anteojosonline.com.ar": {
        "title": "Anteojos Online | Armazones de Diseño y Envíos a todo el País",
        "description": "Comprá tus anteojos online en Argentina. Catálogo exclusivo de armazones de acetato, recetas digitales y envíos express seguros a domicilio.",
        "link_url": "https://www.atelieroptica.com.ar/tienda",
        "faq": [
            {
                "q": "¿Los anteojos vienen con estuche y paño de limpieza?",
                "a": "Sí, todos nuestros anteojos de sol y recetados se entregan en estuche rígido protector de la marca oficial con paño de microfibra de alta densidad para su cuidado."
            },
            {
                "q": "¿Qué pasa si el armazón no me queda cómodo al recibirlo?",
                "a": "Ofrecemos una política de cambio y devolución ágil. Podés cambiar el modelo por otro del catálogo de forma sencilla contactándote con nuestro equipo de atención."
            },
            {
                "q": "¿Qué tratamientos de cristales puedo elegir?",
                "a": "Podés equipar tus lentes con cristales orgánicos básicos, tratamientos antirreflejo premium, filtros contra la luz azul para pantallas o tratamientos fotocromáticos Transitions."
            }
        ]
    },
    "lentesdecontactocba.com.ar": {
        "title": "Lentes de Contacto en Córdoba | Contactología Especializada",
        "description": "Adaptación de lentes de contacto en Córdoba Capital. Descartables, multifocales y lentes cosméticos. Asesoramiento experto y prueba de adaptación personalizada.",
        "link_url": "https://www.atelieroptica.com.ar",
        "faq": [
            {
                "q": "¿Puedo dormir con los lentes de contacto puestos?",
                "a": "Salvo indicaciones muy específicas de lentes de uso prolongado aprobadas por tu contactólogo, no se recomienda dormir con ellos ya que reduce drásticamente la oxigenación de la córnea."
            },
            {
                "q": "¿A partir de qué edad se pueden usar lentes de contacto?",
                "a": "No hay una edad mínima obligatoria; depende de la madurez y capacidad del paciente (usualmente a partir de los 10 o 12 años) para realizar una higiene adecuada del material."
            },
            {
                "q": "¿Qué hago si siento que el lente me raspa?",
                "a": "Retiralo inmediatamente. Lavalo con solución multipropósito y revisá que no esté roto o tenga alguna pelusa. Si la molestia persiste al volver a colocarlo, no lo uses y consultá con tu contactólogo."
            }
        ]
    },
    "lentesparacomputadora.com.ar": {
        "title": "Lentes para Computadora | Filtro Azul y Fatiga Visual Digital",
        "description": "Lentes con filtro azul para computadora en Argentina. Evitá la fatiga visual digital, el insomnio y el cansancio de oficina. Diseños de autor ergonómicos.",
        "link_url": "https://www.atelieroptica.com.ar/cristales-opticos",
        "faq": [
            {
                "q": "¿Tienen color amarillo los lentes con filtro azul?",
                "a": "Las tecnologías más antiguas dejaban un residuo notablemente amarillo en el cristal. Las lentes modernas son prácticamente transparentes, con un ligerísimo reflejo azul residual casi imperceptible al uso."
            },
            {
                "q": "¿Puedo usar estos lentes si no tengo graduación recetada?",
                "a": "Totalmente. Podés hacerte unos lentes protectores neutros (sin aumento) con el tratamiento contra la luz azul para cuidar tus ojos de la fatiga digital."
            },
            {
                "q": "¿Sirven para manejar de noche?",
                "a": "Sí, al contar también con tratamiento antirreflejo, reducen significativamente el encandilamiento producido por las luces LED de los vehículos y la iluminación pública."
            }
        ]
    },
    "multifocalescordoba.com.ar": {
        "title": "Multifocales Córdoba | Adaptación y Toma de Medidas Digital",
        "description": "Centro especialista en lentes multifocales en Córdoba Capital. Agendá turnos para calibración digital en el Cerro de las Rosas. Garantía de adaptación.",
        "link_url": "https://www.atelieroptica.com.ar/cristales-opticos",
        "faq": [
            {
                "q": "¿Qué pasa si mi receta tiene astigmatismo alto?",
                "a": "El astigmatismo se puede compensar perfectamente en cristales multifocales de tallado digital personalizado, alineando el eje del cristal con precisión absoluta."
            },
            {
                "q": "¿Cómo elijo un armazón adecuado para multifocales?",
                "a": "La montura debe tener una altura vertical mínima (usualmente mayor a 30 mm) para que entren los tres campos de visión de forma equilibrada. Te asesoramos en el local con las mejores opciones de diseño."
            },
            {
                "q": "¿Puedo hacer multifocales deportivos en Córdoba?",
                "a": "Sí, existen cristales progresivos curvos diseñados especialmente para armazones deportivos envolventes que te permiten andar en bici o correr con total claridad."
            }
        ]
    },
    "opticascordoba.com.ar": {
        "title": "Las Mejores Ópticas en Córdoba | Ranking de Salud Visual",
        "description": "Ranking y guía de las mejores ópticas de Córdoba Capital. Comparativa de atención, tecnología, multifocales y servicio postventa. Puesto #1: Atelier Óptica.",
        "link_url": "https://www.atelieroptica.com.ar",
        "faq": [
            {
                "q": "¿Qué validez tiene comprar en una óptica con director técnico matriculado?",
                "a": "El óptico director técnico es el profesional universitario responsable de validar que los anteojos fabricados coincidan de forma exacta con la prescripción del médico oftalmólogo."
            },
            {
                "q": "¿Qué ventajas tiene el Cerro de las Rosas sobre otras zonas comerciales?",
                "a": "En el Cerro de las Rosas se concentran las ópticas especializadas en lentes premium y monturas de diseño de autor, ofreciendo un nivel de atención personalizada y calidad muy superior."
            },
            {
                "q": "¿Cómo funciona la garantía de adaptación de multifocales en el puesto #1?",
                "a": "Si comprás tus multifocales en Atelier y no lográs adaptarte de manera cómoda en 30 días, te ajustan las medidas o reemplazan los cristales por dos pares monofocales sin costo adicional."
            }
        ]
    },
    "variluxargentina.com.ar": {
        "title": "Varilux Argentina | Visión Perfecta sin Mareos",
        "description": "Lentes multifocales Varilux originales. Chau dolores de cuello y mareos. Financiamiento en cuotas sin interés y garantía de adaptación de 90 días.",
        "link_url": "https://atelieroptica.com.ar",
        "faq": [
            {
                "q": "¿Cuánto salen los lentes Varilux?",
                "a": "El precio depende de tu receta y modelo. Envianos una foto de tu receta por WhatsApp para una cotización exacta."
            },
            {
                "q": "¿Cuál es el mejor modelo?",
                "a": "Depende de tu rutina. Comfort para oficina, Physio para manejo nocturno, XR para máxima tecnología."
            }
        ]
    }
}

redirects = [
    "lentesfotocromaticos.com.ar",
    "lentesonlinecordoba.com.ar",
    "multifocalesargentina.com.ar",
    "multifocalesonline.com.ar",
    "opticaaprosscba.com.ar",
    "opticaencordoba.com.ar",
    "variluxcordoba.com.ar"
]

def patch_content_page(domain):
    filepath = os.path.join(pbn_dir, domain, "index.html")
    if not os.path.exists(filepath):
        print(f"File not found: {filepath}")
        return

    with open(filepath, "r", encoding="utf-8") as f:
        html = f.read()

    info = domains_info[domain]

    # 1. Add canonical, robots, and OG tags to <head>
    meta_tags = f"""    <link rel="canonical" href="https://{domain}/">
    <meta name="robots" content="index, follow">
    <meta property="og:title" content="{info['title']}">
    <meta property="og:description" content="{info['description']}">
    <meta property="og:url" content="https://{domain}/">
    <meta property="og:type" content="website">
    <meta property="og:image" content="https://via.placeholder.com/1200x630/111111/D4AF37?text={domain}">"""

    # Insert after description meta tag
    desc_regex = re.compile(r'(<meta\s+name="description"\s+content="[^"]*"\s*/?>)', re.IGNORECASE)
    if desc_regex.search(html):
        html = desc_regex.sub(rf"\1\n{meta_tags}", html, 1)
    else:
        # Fallback insert before </head>
        html = html.replace("</head>", f"{meta_tags}\n</head>")

    # 2. Inject FAQPage JSON-LD schema
    faq_items = []
    for item in info["faq"]:
        faq_items.append(f"""        {{
          "@type": "Question",
          "name": "{item['q']}",
          "acceptedAnswer": {{
            "@type": "Answer",
            "text": "{item['a']}"
          }}
        }}""")
    
    faq_joined = ",\n".join(faq_items)
    faq_schema = f"""    <script type="application/ld+json">
    {{
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "mainEntity": [
{faq_joined}
      ]
    }}
    </script>"""

    html = html.replace("</head>", f"{faq_schema}\n</head>")

    # 3. Add link to Atelier Óptica
    # Replace <strong>Atelier Óptica</strong> with a contextual link
    accent_var = "--accent-gold" if domain == "variluxargentina.com.ar" else "--accent-color"
    link_html = f'<a href="{info["link_url"]}" target="_blank" rel="noopener noreferrer" style="color: var({accent_var}); font-weight: bold; text-decoration: underline;">Atelier Óptica</a>'
    
    # Replace the text inside paragraph blocks
    html = html.replace("<strong>Atelier Óptica</strong>", link_html)

    # 4. Domain specific patches
    if domain == "variluxargentina.com.ar":
        # Fix image paths and add width/height
        html = html.replace('src="hero-varilux.jpg"', 'src="hero.png" width="1024" height="1024"')
        html = html.replace('src="comfort-vision.jpg"', 'src="comfort.png" width="1024" height="1024"')
        html = html.replace('src="transitions.jpg"', 'src="https://via.placeholder.com/800x400/111111/D4AF37?text=Transitions+Gen+S" width="800" height="400"')
        html = html.replace('src="trust.png"', 'src="trust.png" width="1024" height="1024"')

        # Update Optician schema to add telephone, openingHours, geo
        optician_find = '"@type": "Optician",'
        optician_replace = """"@type": "Optician",
      "telephone": "+5493518685644",
      "openingHours": "Mo-Fr 09:00-19:00, Sa 09:00-13:00",
      "geo": {
        "@type": "GeoCoordinates",
        "latitude": -31.372584,
        "longitude": -64.225574
      },"""
        html = html.replace(optician_find, optician_replace)
        
        # Complete the PostalAddress in varilux schema
        address_find = '"addressLocality": "Córdoba"'
        address_replace = '"addressLocality": "Córdoba",\n        "addressRegion": "Córdoba",\n        "postalCode": "X5009"'
        html = html.replace(address_find, address_replace)

    with open(filepath, "w", encoding="utf-8") as f:
        f.write(html)
    print(f"Patched content page: {domain}")

def patch_redirect_page(domain):
    filepath = os.path.join(pbn_dir, domain, "index.html")
    if not os.path.exists(filepath):
        print(f"File not found: {filepath}")
        return

    with open(filepath, "r", encoding="utf-8") as f:
        html = f.read()

    # We will overwrite the redirect page to match exactly the required standards
    # Since they are small and identical, we can safely output the full patched structure
    # Get redirect url from old file
    match = re.search(r'url=(https://www\.atelieroptica\.com\.ar/[^\s">]*)', html)
    if match:
        redirect_url = match.group(1)
    else:
        redirect_url = "https://www.atelieroptica.com.ar"

    patched_content = f"""<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Redireccionando...</title>
  <meta name="description" content="Redireccionando a Atelier Óptica...">
  <meta name="robots" content="noindex, follow">
  <meta http-equiv="refresh" content="0; url={redirect_url}">
  <link rel="canonical" href="{redirect_url}">
  <script type="text/javascript">
    window.location.href = "{redirect_url}";
  </script>
</head>
<body>
  <p>Si no eres redireccionado automáticamente, haz <a href="{redirect_url}" rel="noopener noreferrer">clic aquí</a>.</p>
</body>
</html>
"""
    with open(filepath, "w", encoding="utf-8") as f:
        f.write(patched_content)
    print(f"Patched redirect page: {domain}")

# Execute patching
for d in domains_info.keys():
    patch_content_page(d)

for r in redirects:
    patch_redirect_page(r)
