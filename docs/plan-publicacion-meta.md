# Plan: publicar en Instagram y Facebook desde Atelier

Análisis de `guia-publicacion-meta.md` (Sinfonix) y su aplicación concreta a este
proyecto. Escrito el 4/8/2026.

La guía es buena y está probada en producción por otra cuenta. Este documento NO
la repite: dice qué de eso **ya está resuelto en Atelier**, qué falta, y en qué
orden conviene hacerlo para que quede robusto y no se abandone a mitad de camino.

---

## 1. Con qué se arranca (verificado en el repo, no supuesto)

| Pieza que pide la guía | Estado en Atelier |
|---|---|
| Playwright para renderizar | **Ya está** — `playwright ^1.60.0`, y el build ya instala Chromium |
| Color de marca parametrizado | **Ya está** — `--primary: #9e7f65` en `globals.css`, con variante dark |
| Banco de imágenes propio | **Ya está** — 59 fotos en `public/images/blog` + `editorial/`, `cristales/`, `banners/` |
| URL pública HTTPS para Instagram | **Ya está** — `atelieroptica.com.ar` sirve `/public` y hay `/api/storage/view` |
| Política de privacidad publicada | **Ya está** — `/politicas-de-privacidad` |
| Precedente de "contenido declarado" | **Ya está** — `scripts/upload_posts.js` sube el blog desde archivos, mismo patrón |
| Credenciales de Meta | **Parciales** — hay `META_ACCESS_TOKEN`, `META_PIXEL_ID`, `META_ADS_TOKEN`, `META_AD_ACCOUNT_ID` |

**Ojo con lo último, que es el malentendido más caro posible:** las credenciales
que hay son de **Ads y Pixel** (medición y campañas). Publicar contenido usa otro
token, otros permisos y otro flujo. Tener `META_ACCESS_TOKEN` NO significa que se
pueda publicar. Faltan `META_PAGE_ID`, `META_IG_USER_ID` y un token de usuario
del sistema con permisos de publicación.

### Lo único que falta y no es código

- **El ancla de eliminación de datos.** La guía avisa que Meta pide una URL de
  eliminación de datos y que si es un ancla (`#eliminacion-de-datos`), el `id`
  tiene que existir de verdad en el HTML. Hoy `/politicas-de-privacidad` **no lo
  tiene**. Es media hora de trabajo y bloquea la creación de la app.
- **Los pasos con login en Meta** (Business, app, usuario del sistema, token).
  Los hace una persona; ningún agente puede: son pantallas con sesión iniciada.

---

## 2. Lo que la guía no contempla, y acá cambia el diseño

La guía está escrita para una cuenta sin sistema propio. Atelier tiene un CRM con
datos reales, y eso habilita algo que la guía no aprovecha:

**Las piezas pueden nacer de la base, no solo de un archivo escrito a mano.**

Un carrusel de producto no necesita que alguien copie el nombre, el precio y la
foto: eso ya vive en `WebProduct` / `Product`, es lo mismo que ve la tienda y el
bot de WhatsApp. Si el precio cambia, la próxima pieza sale con el precio nuevo
sin que nadie se acuerde de actualizar un JSON.

Esto se resuelve con **dos fuentes para la misma estructura**:

```
contenido/*.json          escrito a mano  → educación, adentro, prueba
generado desde la base    armado por código → producto, promo, precio
        ↓                        ↓
        └────── misma forma de pieza ──────┘
                      ↓
              validador → render → publicador
```

La forma de la pieza es una sola. De dónde salieron los datos, no le importa a
nadie más abajo. **Eso es lo que lo hace modular**: mañana se puede sumar una
tercera fuente (por ejemplo, reseñas de Google) sin tocar el render ni el
publicador.

Y hay un beneficio secundario que vale por sí solo: **una pieza generada desde la
base no puede mentir un precio.** El error de publicar un valor viejo deja de ser
posible, no queda como algo "a tener cuidado".

---

## 3. Riesgos propios de este proyecto

Escritos antes de empezar porque son los que lo pueden hundir.

**El número de Instagram es el mismo negocio que el WhatsApp.** No es una cuenta
de pruebas. Todo lo que se publique mal se ve. Por eso la regla de la guía —nada
se publica sin `--dry-run` y aprobación de una persona— acá no es opcional.

**Ya hay tres tokens de Meta dando vueltas.** Sumar un cuarto sin ordenar es
pedir un incidente. El token de publicación va con nombre distinto y explícito
(`META_SYSTEM_USER_TOKEN`), y el de Página **se deriva en cada corrida**, nunca
se guarda — como dice la guía.

**Este proyecto ya sufrió el patrón de "protección que existe y nunca se activó"**
(el aviso de post venta que se reenviaba cada 10 minutos porque el dedupe miraba
un texto que nadie escribía). El validador de la guía tiene que ser **bloqueante
de verdad**: si no renderiza cuando falla, se prueba solo. Si es una advertencia,
en tres semanas nadie la mira.

**El riesgo real no es técnico, es el abandono.** La guía lo dice: con dos
publicaciones por mes, montar esto cuesta más de lo que rinde. Si no hay decisión
de publicar tres veces por semana, conviene no empezar.

---

## ESTADO (5/8/2026)

Todo lo que no depende de credenciales está **construido y en producción**.

| Etapa | Estado | Qué quedó |
|---|---|---|
| 0 · Ancla de eliminación de datos | ✅ | `/politicas-de-privacidad#eliminacion-de-datos`, verificada en el DOM renderizado |
| 0 · Pasos con login en Meta | ⏳ **PENDIENTE** | Los hace una persona; ver abajo |
| 1 · Diagnóstico | ✅ | `npm run social:check` |
| 2 · Render | ✅ | `npm run social:render <pieza>` |
| 3 · Validador | ✅ | Bloqueante, R1–R6 |
| 4 · Publicador | ✅ código · ⏳ sin usar | `npm run social:publicar <pieza>` (modo prueba por defecto) |
| 5 · Piezas desde la base | ✅ | `npm run social:producto` |
| 6 · Aviso de cadencia | ✅ | `/api/cron/social-cadencia` — falta darlo de alta en cron-job.org |

**Lo único que falta para publicar** (pantallas con sesión iniciada, no las puede
hacer un agente):

1. En el Business "Atelier Óptica" → Usuarios del sistema. **El usuario del
   sistema YA EXISTE** (verificado: el token actual es de tipo `SYSTEM_USER` y no
   vence), así que no hay que crearlo. ✅ **HECHO** — usuario `Ishtar`
   (`61592498900635`), con la Página `112571191818391` y el Instagram
   `17841458761171093` asignados (Contenido / Actividad de la comunidad /
   Estadísticas). Los activos pasaron de 9 a 11.
2. Asignarle **los activos**: la Página y la cuenta de Instagram. Ojo: tener la
   app asignada NO da acceso a los activos — son dos pantallas distintas y es el
   error más común. ✅ **HECHO** (ver punto 1).
3. Regenerar el token con los seis permisos y guardarlo como
   `META_SYSTEM_USER_TOKEN`, junto con `META_PAGE_ID` y `META_IG_USER_ID`.
   Verificar el salto de línea final del `.env` antes de agregar.
   ⏳ **BLOQUEADO POR EL PUNTO 5** — el desplegable de permisos solo ofrecía
   `ads_*`, `business_management` y `pages_show_list`; buscar "instagram" no
   devolvía nada. No es un bug: los permisos de un token salen de los **casos de
   uso de la app**, y la única app del Business (`Atelier Ads API`,
   `1680337733032126`) es de Ads y no tiene ninguno de contenido.
4. `npm run social:check` hasta que dé todo OK.
5. **Crear una app propia de publicación.** En curso el 5/8/2026:
   `Atelier Optica Contenido`, portfolio Atelier Óptica, con los dos casos de uso
   de "Administración de contenido": *Administrar mensajes y contenido en
   Instagram* y *Administrar todos los aspectos de tu página*. Meta no pidió
   requisitos de revisión (se publica sobre activos propios). Quedó en el diálogo
   final de contraseña, que lo completa una persona.

### Dos pozos que costaron una sesión entera (5/8/2026)

**El registro de Meta for Developers se traba si el teléfono ya es tuyo.** Para
crear cualquier app hace falta una cuenta de desarrollador verificada, y esa
verificación quiere *agregar* un celular al perfil. Si el número ya está cargado
y confirmado en la cuenta —como estaba—, Meta responde *"Solo puedes completar
esta acción en el centro de cuentas"* y manda a una pantalla donde no hay nada
que confirmar. Círculo cerrado. Se sale con la tarjeta de crédito (Meta no cobra,
solo valida que sea una persona) o con un número que no esté en esa cuenta.

**Y antes de eso, el diálogo vence.** Si la pantalla de verificación queda abierta
unos minutos, cualquier envío falla con *"Your verification session has expired"*.
No es el número: hay que recargar y hacer los pasos de corrido.

Verificado que no hay atajo: el registro directo, `/apps/<id>/dashboard/` y
`/apps/creation/` **los tres** terminan en el mismo diálogo. Tener acceso total a
una app desde el Business no alcanza para entrar a su panel de desarrollador.

Hay **dos piezas ya renderizadas y servidas** para probar el publicador apenas
haya token: `progresivos-que-medimos` (educación, escrita a mano) y
`armazones-destacados` (producto, generada desde la base).

---

## 4. El plan, por etapas

Cada etapa deja algo que sirve por sí solo. Si se abandona en la 3, lo hecho
sigue teniendo valor.

### Etapa 0 — Destrabar lo que bloquea (medio día, sin código de publicación)

1. **Agregar el ancla de eliminación de datos** a `/politicas-de-privacidad`, con
   el `id` verificado en el HTML **renderizado** (no solo en el fuente).
2. **Los pasos con login en Meta**, en el orden de la guía: Business → app →
   usuario del sistema → asignar app **y** activos (son dos pantallas distintas)
   → token con los seis permisos.
3. Guardar `META_SYSTEM_USER_TOKEN`, `META_PAGE_ID`, `META_IG_USER_ID` en `.env`,
   **verificando el salto de línea final** antes de agregar (pozo documentado).

> Sin esto no se puede probar nada de lo que sigue.

### Etapa 1 — El diagnóstico (bloqueante)

`scripts/social/meta-check.mjs`. Tres chequeos: token (permisos y vencimiento),
Página (que aparezca con permiso de crear contenido), Instagram (que la Página
devuelva `instagram_business_account`). Nunca imprime credenciales.

**No se sigue hasta que dé todo OK.** Es el que va a explicar el 90% de las
fallas futuras.

*Valor propio:* aunque el proyecto se abandone acá, queda una herramienta para
diagnosticar los tokens de Meta que ya existen.

### Etapa 2 — Identidad y render

- `social/identidad.json` que **lee el color de `globals.css`**, no lo copia. Una
  sola fuente de verdad para el `#9e7f65`.
- Render HTML + CSS capturado con Playwright a 1080×1350. Dos archivos por slide:
  PNG master y **JPEG real** (no renombrado).
- Empezar con `4:5` solamente, y con tres tipos de slide (`cover`, `list`, `cta`).
  Los otros cinco se agregan cuando hagan falta.

*Valor propio:* un generador de imágenes de marca, útil para el blog y para
WhatsApp aunque nunca se publique en redes.

### Etapa 3 — El validador

Las cinco reglas de la guía (R1 a R5), bloqueantes, con mensajes citables. Más
una propia de Atelier:

- **R6: una pieza con precio se genera desde la base, nunca a mano.** Si el JSON
  trae un precio escrito, falla. Es la regla que hace imposible publicar un valor
  viejo.

### Etapa 4 — El publicador

`scripts/social/publicar.mjs` con el contrato exacto de la guía: token de Página
derivado, Facebook en una sola entrada, Instagram en cuatro pasos con la espera
del `status_code`, `HEAD` a cada URL antes de crear contenedores, y `--dry-run`
como comportamiento por defecto.

### Etapa 5 — Las piezas desde la base

El generador que arma carruseles de producto leyendo `WebProduct`. Es lo que
convierte esto de "un publicador" a "un sistema de la óptica".

### Etapa 6 — Detección temprana

Coherente con lo que ya se decidió para el resto del sistema: un chequeo que
avise **si hace más de X días que no se publica**, con un número, todos los días.
El silencio no puede significar "está bien".

---

## 5. Lo que NO conviene traer de la guía

- **Los ocho tipos de slide desde el día uno.** Tres alcanzan para las primeras
  veinte piezas. Cada tipo es una plantilla que hay que mantener.
- **Los tres formatos (4:5, 1:1, 9:16).** Solo `4:5`, como dice la propia guía.
- **Un `CLAUDE.md` nuevo en la raíz.** Este proyecto ya tiene uno con reglas de
  negocio importantes. Las reglas de publicación van como sección adentro, no en
  un archivo aparte que compita con él.

---

## 6. Cadencia y contenido

De la guía, sin cambios porque aplica igual: **tres por semana**, cinco pilares
rotando (Educación, Producto, Prueba, Adentro, Acción), carruseles de 4 a 7
slides con la bisagra ilustrada.

Con una ventaja: **el pilar Educación ya está escrito.** Hay 67 notas en el blog,
varias sobre exactamente lo que la guía dice que rinde (cómo leer una receta,
diferencias entre multifocales, por qué un progresivo cuesta lo que cuesta). Una
nota del blog se convierte en carrusel sin escribir contenido nuevo.

Ese es probablemente el mejor punto de partida de todo el plan: **la primera
pieza no hay que inventarla, hay que adaptarla.**
