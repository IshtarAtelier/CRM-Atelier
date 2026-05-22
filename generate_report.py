import psycopg2, psycopg2.extras
from datetime import datetime, date

conn = psycopg2.connect('postgresql://postgres:localpassword@localhost:5432/atelier')
cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

# 1. Obtener nuevos clientes (creados hoy) con etiqueta histórico
cur.execute('''
    SELECT c.name, c.phone, c.\"contactSource\"
    FROM \"Client\" c
    JOIN \"_ClientToTag\" ct ON ct.\"A\" = c.id
    JOIN \"Tag\" t ON t.id = ct.\"B\"
    WHERE t.name = 'Histórico' AND DATE(c.\"createdAt\") = CURRENT_DATE
    ORDER BY c.name
''')
nuevos = cur.fetchall()

# 2. Obtener precios corregidos de ServicePricing (Bot)
cur.execute('''
    SELECT category, name, \"priceCash\", \"priceCredit\"
    FROM \"ServicePricing\"
    ORDER BY category, name
''')
servicios = cur.fetchall()

# 3. Obtener precios de Inventario (Product) 
cur.execute('''
    SELECT category, name, brand, cost, price
    FROM \"Product\"
    ORDER BY category, name
''')
productos = cur.fetchall()

# Generar Markdown
md_path = '/Users/ishtarpissano/proyectos/atelier/Reporte_Final.md'
with open(md_path, 'w', encoding='utf-8') as f:
    f.write('# Reporte de Sistema: Importaciones y Precios\\n\\n')
    f.write('> Este documento sirve como respaldo (backup) imprimible a PDF de las últimas modificaciones inyectadas.\\n\\n')
    
    f.write('## 1. Clientes Históricos Nuevos (Importados)\\n\\n')
    f.write(f'**Total creados:** {len(nuevos)}\\n\\n')
    f.write('| Nombre | Teléfono | Origen (Contact Source) |\\n')
    f.write('|---|---|---|\\n')
    for c in nuevos:
        f.write(f"| {c['name'] or ''} | {c['phone'] or ''} | {c['contactSource'] or ''} |\\n")
        
    f.write('\\n---\\n\\n')
    
    f.write('## 2. Precios de Servicios y Bot (Valor Cliente)\\n\\n')
    f.write('| Categoría | Artículo | Precio Efectivo | Precio Tarjeta |\\n')
    f.write('|---|---|---|---|\\n')
    for s in servicios:
        efectivo = f"${s['priceCash']:,.0f}".replace(',', '.')
        tarjeta = f"${s['priceCredit']:,.0f}".replace(',', '.')
        f.write(f"| {s['category']} | {s['name']} | {efectivo} | {tarjeta} |\\n")
        
    f.write('\\n---\\n\\n')

    f.write('## 3. Precios de Inventario (Costos y Venta)\\n\\n')
    f.write('| Categoría | Marca / Nombre | Costo | Precio Venta |\\n')
    f.write('|---|---|---|---|\\n')
    for p in productos:
        cost = f"${p['cost']:,.0f}".replace(',', '.')
        price = f"${p['price']:,.0f}".replace(',', '.')
        nom = f"{p['brand'] or ''} {p['name'] or ''}".strip()
        if not nom: nom = 'Sin nombre'
        f.write(f"| {p['category']} | {nom} | {cost} | {price} |\\n")

print(f"Reporte generado en {md_path}")
conn.close()
