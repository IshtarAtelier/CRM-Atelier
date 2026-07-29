# 🚀 Pasos de Sincronización Post-Deploy (Atelier Óptica)

Este documento es el respaldo y guía oficial para sincronizar los datos de la base local (precios y clientes históricos) con la base de datos de producción **después** de hacer un deploy (subir el código).

---

## 🔒 1. Resguardo de Datos (Realizado)
*Los Excels originales (`ATELIER 1.xlsx` y `ATELIER 2.xlsx`) fueron movidos de tu carpeta de Descargas hacia dentro del proyecto, en la carpeta `prisma/legacy_data/`.*
*El script `import-legacy-full.py` fue actualizado para leer siempre desde esta carpeta interna. De esta forma, los datos están a salvo y el script no se va a romper si borrás cosas de tus Descargas.*

---

## 🛠️ 2. Tareas a Ejecutar en Producción

El día que hagas el deploy a producción, tenés que ejecutar estos pasos **en este orden** para inyectar la información en la nube. Todo esto se corre desde tu terminal local.

### Paso A: Preparar la Terminal
Tenés que decirle a tu terminal que se conecte a la base de datos real (no a la local).
```bash
# Reemplazá esto con tu verdadera URL de PostgreSQL de producción
export DATABASE_URL="postgresql://USUARIO:CONTRASEÑA@TU-SERVIDOR.COM:5432/TU_BASE_DE_DATOS"
```

### Paso B: Inyectar Precios y Lentes Nuevos (Catálogo)
Este comando sincroniza las opciones de lentes (ej: Orgánico Blanco Teñido) y los precios actualizados que configuramos en el bot.
```bash
# Estando en la raíz del proyecto (atelier), ejecutá:
npx ts-node prisma/seed-pricing.ts
```

### Paso C: Inyectar Clientes Históricos (ATELIER 1 y 2)
Este comando lee los Excels que guardamos en `prisma/legacy_data/` e inyecta los 871 clientes con la etiqueta "Histórico" y todos sus detalles de ventas.
```bash
# Estando en la raíz del proyecto (atelier), ejecutá:
python3 prisma/import-legacy-full.py --execute
```

---

## ✅ 3. Verificación
Una vez corridos esos comandos, entrá a tu panel de administrador web de producción (`tudominio.com/admin`) y revisá:
- **Cotizador:** Deberían figurar los precios nuevos y el lente teñido.
- **Contactos:** Al filtrar por la etiqueta "Histórico", deberían aparecer los clientes antiguos con sus notas completas.

> **Importante:** No borres la carpeta `prisma/legacy_data/` hasta que no hayas confirmado que todo está 100% impactado en producción.
