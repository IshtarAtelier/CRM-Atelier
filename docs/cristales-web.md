# Cristales de la tienda ("Arma tus lentes"): cómo se conectan al sistema

Estado: diseño aprobado el 26/9/2026, implementación en `feat/cristales-tienda-precios`.

## El problema que reemplaza

Hasta septiembre de 2026 cada opción de cristal del configurador se priceaba
buscando productos por **palabras clave** contra `Product.category = 'Cristal'`
(`src/lib/config/crystal-mapping.ts`) y tomando el más barato. Ese matcher
estaba copiado **seis veces** (endpoint, dos en el checkout, `checkout-pricing`,
landing de multifocales y la placa de redes), con exclusiones distintas y con
**tres tablas de números escritos a mano** que tapaban cualquier hueco
(`|| 20000`, `|| 45000`, `|| 350000`, `TINT: 25000`). Resultado medido el
25/9/2026 en producción: el cristal "Básico" se vendía a $20.000 (el del
sistema vale $34.480), el "Antirreflex" a $45.000 (vale $49.500), el teñido a
$25.000 fijos (el sistema cobra $30.000/$40.000 por estilo), y "Multi
Fotocromático" adjuntaba a la orden un "MI PRIMER KODAK" con restricción de
adición. Un rename en el inventario cambiaba el precio de la web sin que nadie
lo viera.

## Regla nueva (única)

**Cada opción del configurador apunta a UN producto del sistema, por id, y el
precio de la web es el precio de ese producto. Sin producto no hay opción.
Nunca un número tipeado.** El vínculo se edita en `/admin/web` → "Cristales de
Arma tus lentes". Es la misma regla R6 de las piezas de redes (un precio
publicado sale de la base o no sale).

## Piezas

| Pieza | Archivo | Qué hace |
|---|---|---|
| Tabla `WebLensOption` | `prisma/schema.prisma`, migración `web_lens_option` | Una fila por opción: `key` (`MONOFOCAL.ORGANICO_AR`, `TENIDO.COMPACTO`…), grupo, etiqueta comercial, descripción, badge, orden, `activa`, `productId` (FK a `Product`, `ON DELETE SET NULL`). |
| Claves y tipos | `src/lib/cristales-web/claves.ts` | Las claves son las MISMAS que ya viajan en `lensConfig.treatment` de los carritos (contrato estable). `LensConfig` tipado, `claveDeConfiguracion()`. |
| Cálculo puro | `src/lib/cristales-web/calculo.ts` | `calcularConfiguracion({ basePrice, lensConfig, opciones })` → total y desglose. **La tienda y el checkout llaman a esta misma función**: por eso el guard de precio del checkout ya no puede divergir. Sin base, sin red, testeable. |
| Resolutor | `src/services/cristales-web.service.ts` | Lee `WebLensOption` + su `Product` (select explícito, nunca `cost`), descarta producto inexistente / `[ARCHIVADO]` / precio ≤ 0 y devuelve cada opción con `disponible` y `motivo`. Teñido: precio por estilo de `TintStylePrice`, si no hay fila, `Product.price` (mismo orden que el mostrador, `applyTeñidoPromoDiscount`). |
| Endpoint público | `GET /api/web/pricing` | Serializa el resultado del resolutor (`opciones[]` + el mapa numérico viejo por compatibilidad). `force-dynamic`: un cambio de precio en el CRM se ve en la siguiente carga. |
| Endpoint CRM | `GET/PATCH /api/admin/web-lens-options` | ADMIN por `x-user-role`. Lista opciones + candidatos (`category: 'Cristal'` o teñidos, no archivados, precio > 0). Guarda por `productId`, valida categoría/tipo, `await logAudit` firmado con `getActor`, `invalidateWebCatalog()`. |
| Pantalla CRM | `src/components/admin/web/CristalesConfigurador.tsx` | Una fila por opción: etiqueta, producto vinculado, precio actual, laboratorio, estado (rojo si falta). Buscador de cristales. Guardar explícito. |
| Configurador | `src/components/Storefront/LensConfigurator.tsx` | Renderiza las cards desde `opciones` (título/descripción/badge vienen de la base). Sin tabla de respaldo: mientras carga, esqueleto; si el endpoint falla, aviso y botón deshabilitado. Colores de teñido de `TONOS_TENIDO` y estilos de `ESTILOS_TENIDO` (`src/lib/constants/tenido.ts`), no una paleta propia. |
| Checkout | `src/app/api/checkout/payway/route.ts` | Resuelve cada ítem con el resolutor y `calcularConfiguracion`. Opción no disponible → 400 claro. Líneas de la orden: armazón + OD/OI con `productId` del cristal vinculado y `price = round(precio/2)` por ojo (igual que el mostrador) + **una línea de teñido** con el producto "Teñido <estilo>", `crystalColorType`, `crystalColor` (tono canónico) y `framePosition`. Con eso el CRM, el PDF, la hoja de laboratorio y el cruce de costos ven la venta web igual que una del mostrador. |
| Landing y redes | `src/lib/pricing/multifocal-desde.ts`, `scripts/social/generar-multifocal.mjs` | Leen el resolutor. El "desde" de multifocales es la opción marcada como ancla (`SMART_FREE`). |
| Guardianes | `scripts/checks/cristales-web.check.mjs` (CI, sin base) y `scripts/checks/cristales-web-vinculos.mjs --prod` (solo lectura) | El primero fija el cálculo con fixtures, verifica que tienda y checkout importen el mismo módulo y que no vuelva ningún literal de respaldo ni `crystal-mapping`. El segundo lista cada vínculo en producción y falla si alguno apunta a un producto faltante, archivado, a $0, sin costo o sin laboratorio. |

## Qué se borra

`src/lib/config/crystal-mapping.ts`, `findPrice`/`findMatchedProduct`/
`resolveCrystalProduct` y los `PRICING` con `|| N` del checkout,
`findTintPrice`/`findPrice`/`buildPricingMap` de `checkout-pricing.ts`, la
tabla de respaldo del `LensConfigurator`, `CristalesShowcase.tsx` (muerto desde
el 19/8), la categoría inexistente `'Tratamientos y Accesorios'`.

## Decisiones que no se deducen del código

- **El precio de un cristal es `Product.price` (lista), sin `salePrice`.** El
  CRM no muestra ofertas de cristales en ningún lado; aplicarlas en la web
  sería un cambio invisible. El armazón sí lleva su oferta (`precioConOferta`).
- **Las claves de opción no se renombran nunca.** Viven en los carritos
  guardados en el navegador de los visitantes y en el apareo del 2x1
  (`treatment === 'VARILUX'`). Agregar una opción = agregar una fila.
- **El teñido web es el mismo producto del mostrador**, priceado por estilo
  (`TintStylePrice`). La web ofrece COMPACTO y DEGRADE; "según muestra" exige
  traer una muestra al local. El **grado** no se pide en la web: la línea nace
  sin `crystalColorNote` y la ficha lo reclama antes de mandar a fábrica (es
  lo que ya hace para el mostrador).
- **El segundo par del 2x1 Varilux** guarda OD/OI a $0 (regla del cruce: los
  cristales bonificados no tienen costo esperado) y el armazón regalado también
  a $0 en `price` (el cliente no lo paga; su costo real queda en el snapshot).
- **Una opción sin producto válido desaparece de la web** y el checkout la
  rechaza con 400. El aviso está en `/admin/web` (fila en rojo) y en
  `cristales-web-vinculos.mjs`.
- **Migración con bootstrap por nombre exacto**: la migración crea la tabla,
  inserta las filas y, por única vez, vincula cada clave al producto cuyo
  nombre coincide con el elegido el 26/9/2026 (`WHERE "productId" IS NULL`).
  Si un nombre no existe en esa base, la fila queda sin producto y la opción
  no se publica hasta que alguien la vincule desde el CRM. Así el deploy no
  deja la tienda sin cristales ni un minuto.

## Cómo se opera

- Cambiar qué producto vende una opción: `/admin/web` → Cristales.
- Cambiar el precio: en el inventario, como cualquier producto. La web lo toma
  en la siguiente carga del configurador.
- Auditar producción: `node scripts/checks/cristales-web-vinculos.mjs --prod`.
- Agregar una opción nueva: fila en `WebLensOption` (migración con INSERT) +
  clave en `claves.ts` + card en el configurador si el grupo lo requiere.

## Pendientes que este cambio deja a la vista (no resueltos acá)

- El 2x1 se reconoce en cuatro lectores por señales implícitas (precio $0,
  texto "2x1"); falta un marcador persistido (ver rama `fix/lab-2x1-par-bonificado`).
- `Product` no tiene columna de archivado: el prefijo `[ARCHIVADO]` se tipea a mano.
- `productNameSnapshot` de las líneas web sigue siendo el rótulo del
  configurador; PDF y factura muestran `product.name` del vinculado (correcto,
  pero conviene un campo propio para el título comercial).
- `GET /api/settings` publica toda clave `web_*` sin proyección.
