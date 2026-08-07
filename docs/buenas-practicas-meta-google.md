# Buenas prácticas — Meta y Google

Referencia permanente para operar las plataformas sin sanciones. Redactado por
dos auditores especializados el **7-8/8/2026**, verificando cada dato contra
fuentes oficiales vigentes. Cada regla nació de un incidente real del proyecto
o de política oficial. Complementa `plan-publicacion-meta.md`,
`plan-campanias-meta-google.md` y la sección "Publicación en redes" del CLAUDE.md.

**Regla madre (aplica a todo):** parecer exactamente lo que somos — un negocio
real, con gasto estable, contenido honesto y crecimiento gradual. La prisa y
las ráfagas son lo que los algoritmos de riesgo castigan.

---

# PARTE I · Meta

## 1. Lo que banea (y cómo lo evitamos)

| Causa de bloqueo | Práctica que lo evita |
|---|---|
| **Ráfaga de actividad en cuenta nueva** — el 7/8/2026 Meta puso checkpoint SMS a la cuenta dev por "actividad inusual" (cuenta recién creada + muchas publicaciones seguidas) | Espaciar las publicaciones (los crons ya lo hacen: 4 stories/día, 3 carruseles/semana). Ante checkpoint: developers.facebook.com → Confirmar cuenta → código SMS. **El código lo ingresa la dueña, nunca un agente.** El mail de fallo del cron avisa al instante. |
| **Insistir contra un rate limit** — reintentar rápido tras un code 17/4/80004 escala el bloqueo | Backoff largo (minutos, no segundos) y cortar la corrida. Nunca loop de reintentos cortos. |
| **Creación masiva de estructura por API** — decenas de campañas/públicos/adsets en una corrida parece automatización abusiva | Crear de a poco: una campaña o un par de públicos por sesión, y siempre **EN PAUSA**. |
| **Violaciones de política de contenido acumuladas** — cada rechazo baja el score de Account Quality; el amarillo precede a la restricción | Revisar el texto contra la sección 3 ANTES de crear el anuncio. No "probar a ver si pasa": los rechazos quedan en el historial aunque se corrijan. |
| **Apelar por apelar** — apelaciones sin fundamento cuentan negativo | Solo apelar cuando el rechazo es claramente erróneo; si el texto pisa una zona gris, reescribirlo. |
| **Credenciales expuestas** — un token filtrado usado por un tercero es actividad inusual instantánea | Ningún script imprime token ni App Secret, ni parcialmente. El token de Página se deriva en cada corrida, jamás se guarda. |
| **Datos de negocio inconsistentes** — URL de privacidad caída, método de pago vencido | Mantener `/politicas-de-privacidad` siempre viva y el método de pago al día (la app "Atelier Ads API" pasó a ACTIVO justamente por la URL de privacidad). |

## 2. Reglas de API aprendidas con sangre

Cada una es imperativa porque el error ya ocurrió acá.

1. **Después de actualizar el creative de un anuncio por API, re-pausalo y verificá el status.** Meta resetea el status a `ACTIVE` sin aviso al tocar el creative — un anuncio que la dueña dejó en pausa puede empezar a gastar solo.
2. **Ante error 17, 4 u 80004 (rate limit), backoff largo y abandonar la corrida.** Los headers `X-Business-Use-Case-Usage` dicen cuánto falta para recuperar acceso — leerlos, no adivinar.
3. **Los públicos web (Custom Audience desde píxel) se crean SIN el parámetro `subtype` en v21.** Con `subtype` la API devuelve "no se admite" — contraintuitivo porque la doc vieja lo pedía.
4. **Todo adset nuevo lleva `bid_strategy: LOWEST_COST_WITHOUT_CAP` explícito.** Sin él falla con "importe de puja requerido", y el mensaje no menciona `bid_strategy`.
5. **Antes de usar públicos personalizados en una cuenta, la dueña debe aceptar las Condiciones de públicos personalizados en Business Manager.** El bloqueo es silencioso: el conjunto queda en "Cambios sin publicar" sin error visible.
6. **Una app en modo desarrollo no puede crear anuncios (error 1885183).** Debe estar publicada/activa, y para eso Meta exige la URL de política de privacidad.
7. **El rol "Anuncios" sobre la Página es un permiso separado de `ads_management`.** Se asigna en BM → Usuarios del sistema → activos → Página; sin él, el system user crea campañas pero no puede usar la Página como identidad del anuncio.
8. **Los permisos de un token salen de los casos de uso de la app, no del desplegable.** Publicar contenido usa la app "Atelier Optica Contenido"; Ads usa "Atelier Ads API" — el token de Ads no tiene NINGÚN permiso de publicación, y viceversa.
9. **Públicos de video: retención máxima 365 días, y se llenan retroactivamente.** No hay que esperar a que "junten gente": al crearlos ya traen el historial.
10. **Instagram no acepta bytes: descarga una URL pública HTTPS, y el JPEG tiene que ser real.** Un PNG renombrado a `.jpg` se rechaza. Por eso los JPEG viven commiteados en `public/social/` y el publicador hace `HEAD` antes de crear contenedores.
11. **En Instagram, esperar el `status_code` del contenedor antes de publicar.** El flujo es asincrónico (crear contenedor → poll → publish).
12. **Tokens: system user sin vencimiento, nunca impresos, nunca logueados.** `META_AD_ACCOUNT_ID` trae DOS cuentas separadas por coma.
13. **Presupuesto de rate limit (referencia):** tier Standard ≈ 100.000 puntos/hora por cuenta publicitaria + 40 por anuncio activo; lectura = 1 punto, escritura = 3. Si aparece un rate limit, el problema es una ráfaga o un loop, no el cupo.
14. **Publicación orgánica por API: máximo oficial 100 posts por cuenta IG en ventana móvil de 24 h** (un carrusel cuenta como 1). Hay enforcement reportado a 25–50 en cuentas nuevas.
15. **Cualquier falla de publicación empieza por `node scripts/social/meta-check.mjs`.**

## 3. Políticas de contenido para una óptica

La óptica toca **salud** (visión) — la regla más violada es **Atributos
personales**: prohibido afirmar o implicar que *el lector* tiene una condición.
El test: ¿la frase describe el servicio, o afirma algo sobre quien la lee?

### Atributos personales (la trampa nº 1)

| ❌ No pasa (implica condición del lector) | ✅ Pasa (describe el servicio) |
|---|---|
| "¿Tu visión está empeorando?" | "Medimos tu visión con [equipo/método]" |
| "¿Tus lentes están mal medidos?" | "Verificamos gratis la medición de cualquier lente" |
| "¿Ya no ves bien de cerca?" | "Lentes progresivos para ver bien a toda distancia" |
| "Si tenés más de 45, necesitás progresivos" | "Progresivos: la opción más elegida después de los 45" |

Regla práctica: **el "vos/tu" puede acompañar al servicio ("tu receta", "te
asesoramos"), nunca a la condición ("tu problema de visión")**.

### Afirmaciones de salud y resultados

- **Nada de promesas de resultado de salud** ("recuperá tu visión") — claims médicos: rechazo o restricción.
- **Sin antes/después de condición física** ("así veías / así ves": no usarlo).
- **Lo que sí**: producto y proceso (materiales, tratamientos, medición personalizada), precios, cuotas, beneficios del producto ("antirreflejo que reduce reflejo de pantallas") — atributos del cristal, no de la salud del lector.

### Ofertas, 2x1 y garantías

- **Toda promo publicada debe ser cumplible tal como se lee**: condiciones reales en el anuncio o a un clic. "Letra chica" no dicha = práctica engañosa para Meta y para Lealtad Comercial argentina.
- **Vigencia declarada y respetada**: los anuncios de promos se pausan cuando la promo termina (ojo con el creative-reset del §2.1 al editarlos).
- **"Garantía" solo si es real y verificable**: qué cubre y por cuánto tiempo. "Garantizado" a secas es un claim absoluto.
- **Precios: SOLO desde la base** (regla R6 del validador, sin excepciones).

### Reseñas y testimonios

- **Se puede citar una reseña real** si: existe y es verificable, se cita textual, y el nombre se usa como aparece públicamente (nombre + inicial es lo prudente). ⚠️ **Pero ver Parte II §1: si la reseña es de Google, los términos de GOOGLE la restringen aunque Meta la permita.**
- **Nunca inventar ni "mejorar" un testimonio**, ni ilustrarlo con stock como si fuera el cliente.
- **Resultado no típico → aclarar que los resultados varían** (estándar FTC). Para reseñas de atención no hace falta.
- **Testimonio pagado o a cambio de producto → se divulga** ("colaboración").

### Zonas seguras (verificado 2026, canvas 1080×1920)

- **Stories**: 250 px libres arriba y abajo; nada importante a menos de 65 px de los laterales.
- **Reels**: 108 px arriba, **320–400 px abajo**, 60 px izquierda, 120 px derecha. Nuestra regla de "un dedo" (380–460 px abajo) está en el rango correcto.
- **Feed 4:5**: sin overlay, pero el recorte a 1:1 de la grilla corta arriba y abajo — lo central va al cuadrado del medio.
- **Ads**: SIEMPRE los 4 tamaños (4:5, 1:1, 9:16, 1.91:1) mapeados por `asset_customization_rules`.

## 4. Estructura de campañas

- **Anuncios por conjunto: 3 a 5** (tope 6-7 si todos convierten). Menos de 3 no da opciones; más de 6 reparte migajas.
- **Conjuntos por campaña: 1 o 2, anchos.** 5 conjuntos con 10 conversiones aprenden peor que 1 con 50. La historia lo confirma: ATP amplio fue lo mejor ($448/chat), tráfico lo peor.
- **Aprendizaje: ~50 eventos en 7 días para salir de "limitado".** Con $2–5/día probablemente nunca — esperable, no es emergencia, no tocar "para arreglarlo".
- **Qué reinicia el aprendizaje**: cambiar público, creative, evento de optimización, puja, o presupuesto >20% de una vez. **No tocar un conjunto que funciona.** Presupuesto: máx +20% cada 5 días. Desde el update Andromeda (abril 2026) el umbral de "edición significativa" se endureció.
- **Ventana de no-edición: 7–14 días tras lanzar.** Todo se decide ANTES de activar (por eso se crea en pausa).
- **Frecuencia sana: frío < 3/semana; remarketing 3–4/semana.** Frecuencia alta + costo subiendo = público agotado: refrescar creative (cada 2-3 semanas) antes que subir presupuesto.
- **Remarketing: excluir a quienes ya convirtieron** (compradores 30–90 días). Las placas "ya los viste" viven SOLO en remarketing, nunca en frío.
- **Edad 25+ en Advantage+: no pelearla** (el 83% de conversiones ya son 45+; el algoritmo lo resuelve).
- **Nada se activa sin OK explícito de la dueña.** Los agentes crean en pausa; la dueña activa.

## 5. Checklist semanal de salud de cuenta (10 min, viernes)

1. **Account Quality** (business.facebook.com/accountquality): todo verde. Amarillo = leer qué anuncio y sumar la regla a este doc.
2. **Status de pausados**: los que deben estar en pausa siguen en pausa (creative-reset §2.1).
3. **Gasto vs. esperado** por campaña; campañas viejas ACTIVE con $0 se pausan (pendiente: conjunto viejo `…397030023` y campaña Tráfico USD).
4. **Frecuencia**: frío < 3, remarketing < 5. Arriba de eso, anotar refresh de creative.
5. **Costo por chat** contra benchmarks propios ($0.08–0.19). Un anuncio 3× peor que sus hermanos por 2 semanas se pausa.
6. **Mail testigo de las 18:00** llegó todos los días; si no, revisar crons de GitHub Actions primero.
7. **`node scripts/social/meta-check.mjs`** OK.
8. **Frescura de piezas con precio**: ninguna de base con >10 días.
9. **Vigencias**: ninguna promo vencida activa.
10. **Sin checkpoints pendientes** en developers.facebook.com ni BM; si hay banner, resolver YA con la dueña.

---

# PARTE II · Google

> Verificado contra fuentes oficiales el **7/8/2026**. Lo no confirmable está
> marcado **[a verificar]**.

## 1. Reseñas de Google fuera de Google

### Veredicto sobre la placa con reseña (incidente 8/8/2026)

**La placa "★ 5,0 — 675 reseñas" con la cita de la reseña incumplía los
términos de Google Maps Platform** (se pausó el anuncio el mismo día). Tres
problemas: (1) el texto salió de la Places API y los términos prohíben usar
contenido de Places fuera del servicio y almacenarlo (una imagen JPEG es
almacenamiento permanente); (2) faltaba la atribución obligatoria (autor con
avatar, nombre y link al perfil); (3) la reseña es contenido del autor,
licenciado a Google — usarla en publicidad paga requiere su permiso.

**Las vías legítimas:**
- **Orgánico**: el [Marketing Kit oficial de Google](https://marketingkit.withgoogle.com) genera placas con reseñas del Business Profile — la única forma "bendecida".
- **Pauta paga**: permiso por escrito del autor (WhatsApp alcanza) y publicar como **"opinión de una clienta"**, sin logo de Google, sin estrellas de Google, sin conteo de reseñas.
- **El dato "★ 5,0 en Google" como texto factual**: zona gris — más seguro "la óptica mejor calificada de la zona" con link a la ficha. **[a verificar con asesoría si se insiste con la cifra]**
- La página `/resenas` del sitio está bien (muestra autor, foto y link) — mantener `author_url` clickeable y texto sin truncar.

## 2. Google Ads — políticas para óptica y reglas de cuenta

- **Anteojos y multifocales NO son categoría restringida** (no requieren certificación). *Lentes de contacto*: regulados en algunos países — verificar tabla por país antes de pautarlos.
- **El "2x1" es legal pero debe ser real, vigente y fácil de encontrar en la landing** (política Misrepresentation). Promo terminada = anuncio pausado ESE día.
- **"Garantía de adaptación 30 días" exige las condiciones publicadas en la landing** antes de prender la campaña.
- **Cuotas y descuentos: mostrar el costo total claro** (modelo de pago completo).
- **NUNCA crear cuenta nueva para "empezar de cero"** — evadir una suspensión con otra cuenta es Circumventing Systems, la política que sí termina en baneo permanente. Todo se apela desde la cuenta existente.
- **API: developer token Basic (15.000 operaciones/día) alcanza de sobra** para nuestro volumen. Test → Basic tarda ~5 días hábiles.
- **Conversiones offline: probar con `GOOGLE_ADS_VALIDATE_ONLY=1` antes de habilitar la subida real** — conversiones mal formadas ensucian la puja y no se deshacen.

## 3. Contenido con IA (imágenes y voz)

- **Google Ads (Argentina): hoy NO es obligatorio declarar imágenes IA** en anuncios comerciales comunes (la obligación es para electorales y jurisdicciones con ley: UE, India, NY). Desde julio 2026 hay un "AI label setting" opcional.
- **Meta: declarar el contenido IA con el control del Ads Manager.** Meta lo detecta igual vía metadatos C2PA (Gemini/Imagen los incrustan) y etiqueta "AI info" — declararlo evita parecer ocultamiento.
- **No borrar los metadatos C2PA para "zafar" de la etiqueta** — remover procedencia para evadir detección convierte una etiqueta inocua en infracción.
- **Voz TTS (Aoede) en reels: hoy no exige declaración** en contenido comercial. Regla propia: la voz nunca dice ser una persona real. **[revisar cada trimestre — es lo que más rápido cambia]**
- **Nunca generar con IA personas "reales" reconocibles ni testimonios inventados** — eso es directamente fraude publicitario en ambas plataformas.

## 4. SEO local

- **Pedir reseñas: PERMITIDO. Incentivarlas: PROHIBIDO** (nada de descuentos/regalos/sorteos; prohibido el review gating; desde abril 2026 también prohibido pedir reseñas que nombren a un empleado o poner cuotas al staff).
- **SACAR el `aggregateRating` con datos de Google del schema de `/resenas`** (`src/app/resenas/page.tsx` líneas 109-111): las guidelines de review snippet declaran inelegibles las reseñas self-serving y exigen que el rating venga de usuarios propios, no copiado de terceros. Riesgo: acción manual por structured data spam. Las reseñas VISIBLES pueden quedar; el markup no.
- **Business Profile como fuente única de NAP** (nombre, dirección, horario), consistente con `business-info.ts`.
- **Blog: cada nota nueva con un dato que solo Atelier tiene** (precios reales, casos, fotos del local). Lo que Google penaliza es contenido IA masivo sin valor, no el uso de IA.
- **Responder TODAS las reseñas desde el perfil** — señal de ranking y contenido propio legítimo.

## 5. Cuotas y costos de APIs

- **Places: `reviews`/`rating`/`userRatingCount` son SKUs Enterprise** (los caros). Desde marzo 2025 no hay crédito de USD 200: cuota gratis por SKU/mes (~1.000 Enterprise). **[verificar cuota exacta en consola]**
- **El cacheo actual (`revalidate = 3600`) está bien: NO bajarlo** (~720 llamadas/mes, dentro del tier gratis). No sumar la sección de reseñas a más páginas sin compartir este mismo fetch.
- **Separar la key de Places de la de GenAI** (hoy `GOOGLE_GENAI_API_KEY` es fallback de Places en `resenas/page.tsx:76`) y restringir cada key a su API + referrer/IP en la consola.
- **Places API Legacy: en estado Legacy sin fecha de apagado** — el fallback del código morirá solo; la página ya degrada bien. Anotado, no urgente.
- **Gemini TTS: `gemini-2.5-pro-preview-tts` no tiene tier gratis** (USD 1/1M texto + USD 20/1M audio; Flash TTS: USD 0.50/10 y con tier gratis). Por reel son centavos. Ambos son *preview*: no cablear el nombre del modelo en más de un lugar.

---

## Última verificación: 8 de agosto de 2026 — revisar cada trimestre

1. **Disclosure de IA en anuncios** (Google y Meta) — lo que más cambió en 2025-2026; si Argentina/Mercosur legislan, la obligación se activa.
2. **Fecha de apagado de Places API Legacy** — el fallback del código depende de esto.
3. **Cuotas gratis por SKU de Maps Platform** — cambiaron de raíz en marzo 2025.
4. **Modelos TTS preview** — pueden ser reemplazados con otro precio.
5. **Política de reseñas de Maps** — endurecida en abril 2026; vienen más.
6. **Marketing API de Meta** — versión vigente y changelog (hoy v21; el proyecto la tiene fijada en los scripts).

## Fuentes principales

Meta: [Rate Limiting Marketing API](https://developers.facebook.com/docs/marketing-api/overview/rate-limiting/) · [Instagram Content Publishing](https://developers.facebook.com/docs/instagram-platform/content-publishing/) · [Personal Health policy](https://www.facebook.com/business/help/2489235377779939) · [Personal Attributes](https://transparency.meta.com/policies/ad-standards/objectionable-content/privacy-violations-personal-attributes) · [AI in ads](https://www.meta.com/help/artificial-intelligence/355108217670024/)
Google: [Maps Platform ToS](https://cloud.google.com/maps-platform/terms) · [Places policies](https://developers.google.com/maps/documentation/places/web-service/policies) · [Healthcare policy](https://support.google.com/adspolicy/answer/176031) · [Misrepresentation](https://support.google.com/adspolicy/answer/6020955) · [AI labeling jul-2026](https://support.google.com/adspolicy/answer/17257106) · [Review snippet guidelines](https://developers.google.com/search/docs/appearance/structured-data/review-snippet) · [Maps UGC policy](https://support.google.com/contributionpolicy/answer/7400114) · [Gemini pricing](https://ai.google.dev/gemini-api/docs/pricing) · [Google Ads API access levels](https://developers.google.com/google-ads/api/docs/access-levels)
Otros: [FTC 16 CFR 255 — Testimonios](https://www.ecfr.gov/current/title-16/chapter-I/subchapter-B/part-255)
