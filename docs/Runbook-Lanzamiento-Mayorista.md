# Runbook — Lanzamiento del Canal Mayorista

Estado al viernes 18/7: código auditado y commiteado en `desarrollo` (hasta
`4e82c1f3`), build y typecheck del árbol commiteado en verde, flujo mayorista
verificado de punta a punta en local. Este es el orden exacto del lunes.

## 1. Deploy del código (requiere OK de Ishtar)

```bash
git checkout main && git pull
git merge desarrollo        # lleva TODO lo acumulado (mayorista + caja + post-venta…)
git push                    # Railway auto-deploya; las migraciones corren solas
```

- Verificar el deploy: `https://atelieroptica.com.ar/api/health` → ok.
- Las migraciones nuevas (`OpticaLead`, caja custodia) se aplican solas al deployar.

## 2. Precios y catálogo mayorista en PRODUCCIÓN

```bash
node scripts/set_wholesale_prices.js --prod          # DRY RUN: muestra qué haría
node scripts/set_wholesale_prices.js --prod --yes    # escribe (atómico, 1 transacción)
```

Tiers definidos: Receta $32.000 · Estelares $45.000 · Sol $32.000 · Clip-on $45.000.
Verificar: `https://atelieroptica.com.ar/api/store/products?channel=wholesale` debe
devolver ~106 productos con `wholesalePrice`.

## 3. Variables de entorno en Railway (servicio CRM-Atelier)

- `OPTICAS_LEADS_EMAILS` = email de Milena (da acceso al panel de captación
  sin ser ADMIN). Ishtar entra siempre por ser ADMIN.

## 4. Usuarios ópticas

- Configuración → Usuarios → crear con rol **Óptica (OPTICA)**.
- La óptica entra por `atelieroptica.com.ar/login?type=mayorista`.
- Ve TODA la tienda con precios netos, banner "Canal Mayorista", checkout sin
  tarjeta/cupones — pedido queda "a coordinar" (nunca se cobra solo).

## 5. Contactos (panel /admin/opticas)

- Scrapear: `GOOGLE_MAPS_API_KEY=xxx node scripts/scrape_opticas_places.js`
  (necesita key con Places API + billing; ~USD 25-60 por 1000 ópticas).
  Genera `scripts/opticas_leads.json`.
- Importar: /admin/opticas → **Importar** → pegar el JSON. Dedup automático
  por place_id y teléfono; re-importar nunca pisa el trabajo hecho
  (estados/notas) ni borra datos.
- El botón **WhatsApp** abre wa.me con la plantilla editable ({nombre} se
  reemplaza). El envío SIEMPRE lo dispara una persona — nada de blast
  automático desde números personales (riesgo de ban).

## 6. Presentación

- `docs/Presentacion-Canal-Mayorista.pdf` (3 páginas, 460 KB, lista para WhatsApp).
- Flujo sugerido: mensaje corto → si responde, mandar PDF → si quiere, crear
  usuario y que entre al portal con sus precios.

## Rollback

- Código: `git revert -m 1 <merge-commit>` y push (Railway redeploya).
- Precios: los tiers viven en `scripts/set_wholesale_prices.js`; para apagar el
  canal alcanza `UPDATE "Product" SET "publishToWholesale" = false;` (los
  precios quedan guardados) — o despublicar por producto desde el admin.

## Deudas conocidas (no bloquean; semana siguiente)

- Detección de sesión OPTICA duplicada en 5 componentes → adoptar `useIsWholesale`.
- Acceso de Milena por env → migrar a flag en User (patrón cashManager).
- Si se borra el localStorage con sesión válida, la UI no detecta mayorista
  hasta /checkout (el cobro siempre es correcto igual).
- InitiateCheckout (tracking) reporta valor minorista para sesiones mayoristas.
- Import masivo secuencial (aceptable hasta ~5000 filas).
