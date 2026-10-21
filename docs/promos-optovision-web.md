# Las webs de promo de Optovisión (cupones) — relevamiento

Relevado el 20/10/2026 desde el Chrome de Ishtar, con la sesión de la óptica
abierta en los dos sitios (solo lectura: no se confirmó ningún pedido). Es lo
que el robot usa para generar el cupón del paso 1 del procedimiento de la
promo (`src/services/lab-modules/optovision/promo.ts`).

| Promo | Web | `provider` | Cupón | Pares |
|---|---|---|---|---|
| Varilux Doble Disfrute (VDD) | `https://www.variluxdobledisfrute.com.ar` | `varilux` | `VA` + 6 | 2 |
| Mi Primer Varilux (MPV) | ídem | `mi-primer-varilux` | `MP` + 6 | 1 |
| Kodak 2x1 (K2x1) | `https://promos.lenteskodak.com.ar` | `kodak` | `KO` + 6 | 2 |
| Mi Primer Progresivo Kodak | ídem | `kodak-progresivos` | (no hay ejemplo en el historial) | 1 |

Los dos sitios son la MISMA aplicación (Laravel + Vue, mismo `app.js`), con
la misma cuenta de la óptica (`atelier.optica.cerro@gmail.com`; la clave vive
en Railway como `PROMO_VARILUX_USER/PASSWORD` y `PROMO_KODAK_USER/PASSWORD`,
nunca en el código ni en el chat). El cupón es gratis de generar, pero el de
"Mi Primer" **se otorga una sola vez por cliente**: el robot nunca genera dos
para el mismo DNI (busca en el historial antes de crear).

## Login

`GET /login` → formulario clásico: `_token` (CSRF), `email`, `password`,
`remember`. **Sin reCAPTCHA** (el script de reCAPTCHA se carga en todas las
páginas pero no hay widget ni `g-recaptcha-response` en el login ni en el
pedido). Logueado, `/login` redirige al inicio. Logout = `POST /logout`.

## Crear un pedido (= generar el cupón)

`GET /pedidos/crear?provider=<provider>` muestra el formulario (componente Vue
`order-form`, `inline-template`, validación con vee-validate). Sin
`provider`, pide elegir la promo. El envío es un **POST clásico** a
`/pedidos` (`e.target.submit()` tras validar), con `_token` y `provider`
ocultos; la respuesta redirige a `/pedidos/<id>`.

Campos (`name` del form):

| Campo | Regla del sitio | De dónde lo saca el robot |
|---|---|---|
| `first_name`, `last_name` | máx 255 | nombre del cliente, repartido (1er token / el resto) |
| `document_number` (oculto) + `document_number_input` (máscara `00.000.000`, raw) | numérico, máx 8 | `Client.dni` |
| `gender` | **obligatorio**: `F` / `M` | lo elige quien prepara (el CRM no lo guarda) |
| `phone` | máscara `00U 0000-0000`, opcional | `Client.phone` (solo dígitos) |
| `birthdate` (oculto, `YYYY-MM-DD`) + tres `select` sin nombre (Día 1–31, Mes **0–11**, Año) | **obligatorio** | `Client.birthDate`; si falta, frena |
| `email` | formato email, opcional | `Client.email` si es válido |
| `lab_id` | obligatorio | la opción cuyo texto es "Optovisión" (hoy `7`); nunca por id fijo |
| `lab_other_name` | solo con "Otro…" | no se usa |
| `od_esferico` / `oi_esferico` | **obligatorio**, máscara `Z0U.00`, `lens:0.00,14.00,0.25` | receta del par (signo solo si es negativo) |
| `od_cilindrico` / `oi_cilindrico` | **obligatorio**, `Z0.00`, `lens:0.00,6.00,0.25` | receta; `0.00` si no hay |
| `od_eje` / `oi_eje` | `0UU`, 1–3 dígitos ≤ 180, opcional | receta; vacío sin cilindro |
| `od_adicion` / `oi_adicion` | **obligatorio**, `0.00`, `lens:0.75,3.75,0.25` | receta (todas las promos son progresivos) |
| `od_dnp` / `oi_dnp` | **obligatorio**, `00`, 2 dígitos ≤ 40 | DNP del par, redondeada a entero |
| `promotions_product_line_id` | obligatorio | la línea (diseño) por nombre |
| `first_product_id` | obligatorio; se carga por AJAX al elegir la línea | el producto por material + tecnología + Crizal |
| `second_product_id` | obligatorio en las promos de 2 pares; **misma línea**, deshabilitado hasta elegir el 1º | ídem, del 2º par |

Botón: "Confirmar pedido". El select del 2º par solo lista los productos de la
misma línea con `order <= order del 1º` (`canSelectSecondProduct`): el 2º par
tiene que ser **igual o de menor valor** según el orden del sitio. Si el par
que el CRM pone 1º (el de mayor lista) tiene un `order` menor en el sitio, el
robot no inventa: frena y lo dice.

### Catálogo (API, con la sesión)

- `GET /api/promotions/lines?provider=<p>` → `[{ id, provider, name, order, enabled }]`.
- `GET /api/promotions/lines/<lineId>/products?provider=<p>` → `[{ id, name, order, enabled, promotions_product_line_id }]`.

Líneas al 20/10/2026: Varilux (VDD ids 3–11 / MPV 12–19): Xr Pro, Xr Design,
Physio 3.0, Physio, Comfort Max, Comfort, Liberty 3.0, Liberty. Kodak (K2x1
1–2 / MPK 28–29): Unique Dro, Precise Next. Productos: 354 en Varilux, 136 en
Kodak. El nombre del producto codifica material + tecnología + Crizal:

- Material: `Stylis 1.67`, `Airwear 1.59` (una fila dice `Airwear` a secas), `Orma`.
- Tecnología: `Transitions Gens` / `Transitions Gen S` (con la lista de colores
  "Gris / Café / …", que el robot ignora), `Transitions Xtractive Gris`,
  `Xperio …`, `Blue Uv` / `Blueuv`, o nada (solo Kodak: "Stylis 1.67 Crizal Prevencia").
- Tratamiento: `Con Crizal Prevencia | Sapphire | Forte Uv` (Varilux), `Crizal …`
  o `Trio Easy Clean Uv` (Kodak). En "Mi Primer Varilux" los nombres van SIN el
  diseño adelante ("Orma Blue Uv Con Crizal Forte Uv").
- Hay dobles espacios y mayúsculas irregulares: se compara normalizado.
- Varilux NO tiene producto "liso" (sin Blue UV): un "ORMA + CRIZAL" del CRM
  va como `Orma Blue Uv` (misma decisión abierta que en OVES, decisión 1 de
  `docs/optovision-plan.md`) y se avisa.
- Acclimates no existe en la web de promo: va a mano.

El robot resuelve línea y producto **en vivo** contra la API (el catálogo
cambia: Kodak renovó el suyo el 4/8/2026), no contra una copia.

## Historial y resultado

- `GET /pedidos` → tabla con TODOS los pedidos de la óptica (59 filas al
  20/10, sin paginación): Fecha (dd/MM/yyyy), Promoción (`VDD`, `MPV`,
  `K2x1`…), Código (el cupón), Cliente, Detalle (`/pedidos/<id>`), Voucher
  Lab. (`/pedidos/<id>/pdf?signature=…`), Voucher Cliente.
- `GET /pedidos/<id>` → la página trae el pedido entero embebido en el
  atributo `:order="{…}"` del `order-form` (HTML-escapado): `id`, `provider`,
  `code` (el cupón), `code_used_at`, `first_name`, `last_name`, `email`,
  `document_number`, `gender`, `phone`, `birthdate`, `lab_id`, receta,
  `promotions_product_line_id`, `first_product_id`, `second_product_id`,
  `created_at`, `document_url`, `client_document_url`. Es lo que el robot lee
  después de confirmar para quedarse con el cupón, y lo que compara contra el
  DNI al buscar un cupón ya generado.
- El PDF del voucher ("enviar esta planilla al laboratorio") queda enlazado en
  el borrador del 1er par; el procedimiento de Optovisión no lo pide por mail
  (el cupón va en la observación de OVES y en el asunto del mail).

## Cómo lo usa el robot (`optovision/cupon-web.ts` + `cupon-robot.ts`)

1. **Al preparar el 1er par** sin cupón tipeado: entra en SOLO LECTURA (se
   abortan los POST que no sean el login), resuelve línea y productos contra la
   API y lo deja en el borrador para que la revisión lo muestre. Si el DNI ya
   tiene un cupón de esa promo en el historial, lo toma y no genera otro.
2. **Al aprobar**, antes de grabar en OVES: vuelve a buscar en el historial
   (por si alguien lo generó a mano mientras tanto); si no hay, llena el
   formulario, confirma, espera la redirección a `/pedidos/<id>` y lee el
   `code`. Lo anota en el borrador EN EL ACTO (un reintento nunca genera dos) y
   recién entonces escribe la observación "Primer par de Promo num cupón …" en
   OVES.
3. Si el sitio no acepta el robot (CAPTCHA, cambio de formulario, credencial
   rechazada), FRENA y lo dice en la ficha: el cupón se genera a mano y se
   tipea en el campo "Cupón". Nunca se intenta saltar un CAPTCHA.

Lo puro (parseo de nombres, armado del formulario, el cupón que lee de la
respuesta) lo fija `npm run check:carga-optovision`.
