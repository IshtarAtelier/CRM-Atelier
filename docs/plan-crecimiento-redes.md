# Plan de crecimiento de redes — Atelier Óptica

**Fecha:** 28/8/2026 · **Alcance:** Instagram + Facebook, orgánico.
**Qué es esto:** un documento para ejecutar. Cada afirmación sobre Meta lleva fuente, y
cada afirmación sobre Atelier lleva el archivo del repo donde se verifica. Lo que no sé,
lo digo.

**Lo que este documento NO es:** no es un plan de publicidad paga (eso vive en
`docs/plan-campanias-meta-google.md`), no autoriza publicar nada, y no cambia ninguna
regla de comunicación de Ishtar — las asume.

---

## 1. Dónde estamos

Todo lo de esta sección sale de leer el repo el 28/8/2026, no de recuerdos.

### El inventario

| Qué | Cuánto | Dónde se verifica |
|---|---|---|
| Piezas declaradas (JSON) | **189** | `social/contenido/*.json` (175) + `social/contenido/reels/*.json` (14) |
| — de esas, creativos de Ads (no orgánicos) | 47 | `social/contenido/ad-*.json` |
| — de esas, stories de producto con precio | 26 | `social/contenido/story-producto-*.json` |
| — orgánicas de feed y story | **116** | el resto |
| Piezas renderizadas a JPEG | 178 carpetas | `public/social/*/NN.jpg` |
| Reels renderizados a mp4 | 14 | `public/social/reels/*.mp4` |
| Notas de blog publicadas | 68 | base de producción |
| Notas de blog en borrador local (creadas hoy) | 6 | base local, `status = DRAFT` |

### La cadencia real, por formato

**Stories: 6 por día, todos los días.** Desde hoy. Dos tandas, 10:00 y 17:00 ART:
mañana 2 de contenido + 2 de producto, tarde 2 de contenido.
Fuente: `PLAN` en `src/app/api/cron/social-story-diaria/route.ts` y el `schedule` de
`.github/workflows/social-crons.yml`. Antes eran 4/día en una sola tanda.

- Carril `contenido`: **58 entradas**, consume 4/día → el ciclo completo dura **14,5 días**.
- Carril `producto`: **24 entradas**, consume 2/día → ciclo de **12 días**.
- Simulado sobre 30 días: 180 stories, 6 por día exactas, cero repeticiones el mismo día
  y cero en días consecutivos.

**Feed: 5,1 publicaciones por semana** (4,1 carruseles + 1,0 reel).
90 entradas programadas del 29/8 al 31/12 sobre ~17,7 semanas
(`social/feed-programacion.json`): 72 carruseles y 18 reels.
Días fijos: carrusel martes, jueves, sábado y domingo; reel miércoles. Lunes y viernes
sin feed a propósito — la constancia diaria la sostienen las stories.

**Repetición del feed:** 90 emisiones sobre **39 piezas distintas**. Las promos son las
más repetidas (`campania-12-pagos-feed` 6 veces, `campania-6-cuotas-feed` 5); el resto
del catálogo rota 3 veces cada uno, con 21 días mínimos entre repeticiones.

**Facebook vs Instagram — esto importa y casi nadie lo tiene presente:**
los carruseles salen a **las dos** plataformas; los reels y las stories salen **solo a
Instagram**. `publicarStory()` y `publicarReel()` en
`src/services/social-publisher.service.ts` publican contra `IG_USER_ID` únicamente.
Traducción: Facebook recibe 4 posts por semana y nada más. No hay stories de Facebook,
no hay reels de Facebook.

### Qué cubre hoy el contenido

Bien cubierto: multifocales y Varilux, Stellest y miopía infantil, tratamientos
(Crizal, fotocromáticos, filtro azul), índices de refracción, armazones de catálogo,
financiación, y el bloque de servicio (taller propio, garantía 30 días, medición con el
armazón puesto, reseñas, dónde estamos).

El mapa completo con los huecos está en la sección 5.

### Qué NO existe hoy

- **Ninguna medición de rendimiento orgánico.** No hay una sola llamada a insights de
  posts orgánicos en todo el repo. `src/lib/ads/meta-insights.ts` existe pero es de
  **Ads** (gasto, ROAS, atribución), con otro token y otros permisos. Lo único que se
  mide es *que salió*, vía la bitácora en `SystemSetting.social_publicaciones`, que
  guarda las últimas 60 publicaciones con `{pieza, plataformas, slides, urls, fecha}`.
- **Ninguna interacción.** El sistema publica y se va. No responde comentarios, no
  responde DMs desde el sistema, no pone stickers. El token ni siquiera pide
  `pages_manage_engagement` (está listado como opcional y no otorgado, ver
  `scripts/social/meta-check.mjs`).
- **Cero stickers interactivos en stories.** La API de publicación de Instagram acepta
  `media_type: 'STORIES'` con una `image_url` y nada más — no hay parámetro para
  encuesta, quiz, caja de preguntas ni sticker de link. Es una limitación de la API, no
  del código nuestro. Cualquier sticker lo tiene que poner una persona desde el teléfono.

---

## 2. Qué pide Meta hoy

Separado a propósito en dos: lo que dice el fabricante y lo que dice la industria.
La diferencia importa cuando algo falla y hay que decidir a quién creerle.

### 2.a — Política y guía oficial de Meta/Instagram

Esto es del fabricante. Se cumple, no se discute.

1. **Originalidad.** Instagram da menos distribución a lo re-subido y prioriza contenido
   original; lo no original queda fuera de las recomendaciones (no llega a no-seguidores).
   → https://help.instagram.com/313829416281232/
2. **Nada de marcas de agua de otras apps, ni video borroso o de baja resolución.** Es
   causa directa de menos recomendación. Vertical 9:16.
   → https://creators.instagram.com/blog/instagram-recommendations-eligibility-tips-creators
3. **Los primeros 3 segundos.** Instagram le pide literalmente a los creadores captar la
   atención ahí. Es de las poquísimas indicaciones numéricas que da el fabricante.
   → mismo link que (2)
4. **Engagement bait prohibido.** Meta lo define como publicaciones que piden
   explícitamente interacción (votos, compartidas, comentarios, etiquetas, likes) para
   fines que no sean una llamada a la acción específica. "Etiquetá a una amiga",
   "comentá SÍ y te paso el precio", "compartí para participar" caen acá. Preguntar algo
   genuino y esperar respuesta, no.
   → https://transparency.meta.com/en-gb/features/approach-to-ranking/content-distribution-guidelines/engagement-bait
5. **Concursos y sorteos** están listados como contenido no recomendable: pueden servir
   con los seguidores actuales, pero no traen alcance nuevo.
   → https://help.instagram.com/313829416281232/
6. **Feedback negativo baja la distribución**: lo que la gente oculta, silencia o por lo
   que deja de seguir. Publicar promociones repetidas activa esta señal.
   → https://transparency.meta.com/features/ranking-and-content/
7. **Atributos personales — la regla que más rebota anuncios de ópticas.** Un anuncio no
   puede afirmar ni dar a entender la condición de salud de quien lo ve. NO va:
   "¿Te cuesta ver de cerca?", "¿Tenés miopía?", "¿Tu hijo tiene astigmatismo?".
   SÍ va, con la misma intención: "Multifocales medidos con el armazón puesto",
   "Control de miopía infantil con lentes Stellest". La diferencia es describir el
   **servicio**, no la **condición**. El ejemplo oficial de Meta es exactamente esa
   frontera: "Nuevo tratamiento para la diabetes disponible" ✅ vs "¿Tenés diabetes?" ❌.
   → https://transparency.meta.com/policies/ad-standards/objectionable-content/privacy-violations-personal-attributes
8. **Salud y bienestar:** prohibido afirmar que un producto cura, sana o elimina una
   condición; prohibido el lenguaje sensacionalista con afirmaciones exageradas;
   prohibidas las declaraciones de inferioridad sobre la apariencia física (esto toca el
   antes/después). Stellest **ralentiza** la progresión de la miopía; no la cura ni la
   revierte, y cualquier otra formulación es un rechazo.
   → https://transparency.meta.com/policies/ad-standards/restricted-goods-services/health-wellness/
9. **Las tres señales de ranking que Mosseri confirmó explícitamente:** tiempo de
   visualización (incluyendo repeticiones), likes por alcance, y **envíos por alcance**
   (compartidas por DM) — esta última es la que más pesa en 2026.
   → https://later.com/blog/how-instagram-algorithm-works/ (reporte de las declaraciones
   públicas de Mosseri; Meta no publica un documento con los pesos)

**Meta NO publica una cadencia recomendada.** Cualquier número exacto de posts por semana
que aparezca abajo viene de la industria, no del fabricante.

### 2.b — Observación de la industria (números medidos, no política)

Esto orienta decisiones pero no es normativo. Si contradice a 2.a, gana 2.a.

- **Feed: 3 a 5 por semana.** Buffer, sobre 2,1 millones de posts y 102.000 cuentas:
  pasar de 1-2 a 3-5 posts semanales más que duplica el crecimiento de seguidores
  (+0,12% → +0,26%) y suma ~12% de alcance por publicación. Arriba de 5-6 semanales hay
  rendimientos decrecientes claros. → https://buffer.com/resources/how-often-to-post-on-instagram/
- **Stories: 2 a 5 por día, todos los días.** Mosseri recomienda públicamente "un par de
  stories por día" como piso. La cadencia se mide en *días con stories*, no en total
  semanal: un día en cero pesa más que un día con seis.
  → https://www.kontentino.com/blog/how-often-to-post-on-instagram/
- **Reels: 2 a 5 por semana** para una cuenta de ~12k. Las guías de 2026 piden 4-5, pero
  el benchmark real de Socialinsider sobre 35 millones de posts mide una mediana de ~8
  reels **por mes**, no por semana. Recomendación honesta: 2-3 sostenibles antes que 5
  con calidad caída. → https://www.socialinsider.io/social-media-benchmarks/instagram
- **Interacción por formato** (Socialinsider, mismo dataset): carrusel 0,55%, reel 0,52%,
  foto 0,37%. Pero el reel tiene la distribución orgánica más amplia (llega a
  no-seguidores). Conclusión práctica: **reel para que te conozcan, carrusel para que te
  crean.**
- **Stickers:** los interactivos (encuesta, quiz, caja de preguntas) rinden bastante más
  que el sticker de link solo, y el patrón recomendado en 2026 es interactuar primero y
  mandar el link por DM después — que además genera un DM, la señal que más pesa.
  → https://later.com/blog/how-instagram-algorithm-works/ y
  https://sproutsocial.com/insights/instagram-algorithm/

### 2.c — Lo que se dice y no pude verificar

- Que desde julio de 2026 Meta pasó la aplicación en salud de "basada en el producto" a
  "basada en el claim" (o sea: la imagen antes/después ya no se rechaza sola, pero el
  texto es donde se juega el cumplimiento). **Es dato de la industria, no lo encontré en
  la página oficial.** No apoyar ninguna decisión importante solo en esto.
- Que a las cuentas categorizadas como salud/bienestar Meta les restringe optimizar por
  eventos de conversión de fondo de embudo (compras, turnos). **No sé si a la cuenta de
  Atelier le aplica.** Hay que mirarlo en el administrador de anuncios antes de armar la
  próxima campaña, porque si aplica cambia toda la estructura de conjuntos.

---

## 3. La brecha

Ordenada por impacto. "Impacto" = cuánto alcance nuevo o cuánta plata mueve.

| # | Brecha | Hoy | Debería | Por qué duele |
|---|---|---|---|---|
| 1 | **Reels** | 1/semana | 2-3/semana | Es el único formato que llega a **no-seguidores**. Con 1/semana, el crecimiento de cuenta depende de que alguien nos busque. Es la brecha más cara. |
| 2 | **Nada se mide** | Solo "salió/no salió" | Alcance, envíos, guardados por pieza | Estamos publicando 42 stories + 5 posts por semana **a ciegas**. No sabemos qué pieza funciona, así que no podemos hacer más de lo que funciona. Todo el resto del plan es opinión hasta que esto exista. |
| 3 | **Cero interacción** | El sistema publica y se va | Responder comentarios y DMs el mismo día | "Envíos por alcance" es la señal #1 de 2026 y se alimenta de conversación. Un comentario sin responder es alcance tirado. |
| 4 | **Stories sin stickers** | Placas estáticas | Encuesta/quiz/preguntas | La API no los soporta (sección 1). Es trabajo humano y hoy no lo hace nadie. Las respuestas a stories alimentan la relación que rankea el feed. |
| 5 | **Facebook está a mitad de máquina** | 4 carruseles/semana, nada más | Al menos las stories replicadas | Facebook no recibe ni una story ni un reel. Y el público 50+ de multifocales —el cliente más rentable— vive más en Facebook que en Instagram. |
| 6 | **Casilleros vacíos del mapa** | Ver sección 5 | — | Astigmatismo, lentes de contacto, cambio de cristales y las temporadas no tienen pieza. Son búsquedas con demanda real y hoy se las lleva entera la competencia. |
| 7 | **El blog y las redes no se hablan** | 68 notas, 116 piezas, cero links entre sí | CTA de story → nota | Trabajo ya hecho dos veces que no se suma. Es la brecha más barata de cerrar. |
| 8 | **Repetición de promos** | `campania-12-pagos` 6 veces en 4 meses | Alternar con contenido | Meta baja la distribución por feedback negativo, y las promos repetidas son lo que más lo activa (2.a punto 6). |

Lo que **NO** es brecha, y conviene decirlo para no "arreglar" lo que está bien:

- La cadencia de feed (5,1/semana) está en el techo del rango recomendado. **No subirla.**
- Las 6 stories/día están dentro del rango 2-5 por tanda y con constancia diaria. **No subirlas.**
- El carril de producto en 2/día es correcto: tiene precios adentro con guarda de
  frescura, y sacar 3/día lo quemaría en 8 días.

---

## 4. El plan, en fases

### Fase 1 — Volumen y cobertura ✅ HECHA (28/8/2026)

**Qué se hizo:**
- Stories de 4 a 6 por día, en dos tandas (10:00 y 17:00 ART), con el índice resuelto por
  un único objeto `PLAN` que evita las dos trampas conocidas (la tarde republicando la
  mañana, y la tarde repitiéndose al día siguiente).
- Carril `contenido` de 20 a 58 entradas: +35 piezas nuevas (5 Stellest, 2 Kodak, 3 índices,
  14 datos del blog, 6 derivadas de reels, 3 Crizal que estaban renderizadas y nunca
  habían entrado al carril). Orden en round-robin de cuatro familias, así dos adyacentes
  nunca son del mismo tema.
- Feed de 63 a 102 entradas, cobertura hasta el 31/12/2026.
- 4 carruseles Varilux, 3 Stellest, 1 Kodak, 1 de índices, 4 creativos de Ads Stellest,
  6 stories derivadas de reels, 14 de datos del blog. Todas pasaron el validador.
- 6 notas de blog nuevas en **borrador local** (cambio de cristales, obras sociales,
  Kodak, índices, Varilux comparativa, Stellest guía para padres) + la nota de las hermanas.
- Un reel corregido (`garantia-30-dias`): dejó de encuadrar el mensaje desde el miedo.

**Quién dispara:** ya está en los crons. **Cómo se mide:** `npm run check:social` verde,
90 entradas por delante. **Pendiente de Fase 1:** commitear y deployar (ver riesgo del
deploy atómico en la sección 7).

### Fase 2 — Cerrar las guardas que faltan (1 semana, código)

Antes de subir volumen hay que tapar los agujeros por donde el sistema puede fallar en
silencio. Un sistema que publica más y falla callado es peor que uno chico.

| Qué | Quién dispara | Cómo se mide |
|---|---|---|
| Regla en `check:social` que valide **los carriles de stories**: que cada id del JSON tenga su `01.jpg`. Hoy el check no abre `stories-diarias.json`. | `npm run check:social` (local + CI) | El check falla con un id inventado a propósito |
| Regla que compare el **mtime del `.mp4` contra el del JSON** del reel y falle si el JSON es más nuevo. Hoy un reel con caption nuevo y video viejo pasa verde. | mismo check | Falla con `garantia-30-dias` hasta que se re-renderice |
| Re-renderizar `garantia-30-dias` — sale al aire el 9/9 con video viejo | humano, hoy | `node scripts/social/render-reel.mjs social/contenido/reels/garantia-30-dias.json` |
| Verificación en vivo de la tanda de la tarde el primer día post-deploy | humano | `?tanda=tarde&dryRun=1` devuelve piezas distintas a las de la mañana |

### Fase 3 — Medición orgánica (2 semanas, código) ← la que desbloquea todo

Sin esto, las fases siguientes son intuición.

**Qué se hace:** un cron semanal que, para cada entrada de la bitácora
(`SystemSetting.social_publicaciones`, que ya guarda los `urls.instagram` y
`urls.facebook`), pida a Graph API las métricas del post y las guarde. Los ids ya están
guardados: la mitad del trabajo está hecha sin saberlo.

**Lo que hay que resolver primero, y no sé la respuesta:** el token actual
(`META_SYSTEM_USER_TOKEN`) tiene 5 permisos de publicación. **No verifiqué si alcanzan
para leer insights orgánicos de Instagram** — probablemente falte
`instagram_manage_insights`. Paso cero de la fase: correr
`node scripts/social/meta-check.mjs` y confirmar. Si falta, hay que agregarlo al usuario
del sistema, y eso pasa por Uriel (que gestiona las cuentas) y por el OK de Ishtar.

**Guardar solo esto, nada más:** alcance, **envíos** (shares por DM), guardados,
comentarios, likes, y para reels el tiempo total de visualización. Todo por pieza.

**Cómo se mide el éxito de la fase:** al mes hay una tabla que dice qué 10 piezas
tuvieron más envíos por alcance. Esa tabla decide qué se produce en Fase 5.

**Quién dispara:** cron semanal nuevo en `social-crons.yml`, mismo patrón
(`github.event.schedule`, nunca el reloj).

### Fase 4 — Reels a 2-3 por semana (4 semanas, producción)

El formato que trae gente nueva. Hoy: 1/semana. Objetivo: 2-3.

- Ya hay 14 reels declarados. Multiplicarlos por variantes no sirve (originalidad, 2.a
  punto 1): hacen falta guiones nuevos.
- Fuente de guiones sin escribir nada: las 14 stories de dato del blog. Cada una es un
  reel de 12-15 segundos con el gancho en los primeros 3.
- Programar los miércoles + un segundo día (lunes o viernes, que hoy están vacíos de feed).
- **Quién dispara:** humano crea el JSON y renderiza; el cron publica según calendario.
- **Cómo se mide:** alcance de no-seguidores por reel (dato de Fase 3), no cantidad de reels.

### Fase 5 — Interacción y stickers (continuo, humano)

Lo único de todo el plan que un cron no puede hacer.

- **Responder comentarios y DMs el mismo día.** Es la señal #1 de 2026. 15 minutos
  diarios, una persona.
- **Un sticker interactivo por día**, puesto a mano sobre la story que ya publicó el cron.
  Encuesta o quiz a la mañana (fricción baja), caja de preguntas a la tarde. Ojo: el
  sticker va **antes** del remate, y "¿cuál de estos tres es un progresivo?" es un quiz,
  no engagement bait; "etiquetá a una amiga" sí lo es.
- Las respuestas de la caja de preguntas alimentan contenido de la semana siguiente. Es
  el pilar Educación sin escribir nada nuevo.
- **Cómo se mide:** tiempo de respuesta a comentarios y DMs, y cantidad de respuestas a
  stories por semana.

### Fase 6 — Llenar el mapa y tender el puente al blog (continuo)

- Un casillero vacío de la sección 5 por semana. Agregar un tema es escribir un JSON, no
  rediseñar nada: esa es toda la gracia del sistema.
- Cada story de tratamiento que ya tiene su nota escrita, con CTA al blog. El tráfico que
  eso genera alimenta el ranking de la nota, que a su vez trae gente nueva.
- Estacionales con 3 semanas de anticipación (ver la fila "temporada" del mapa).

### Fase 7 — Facebook a máquina completa (a evaluar, no antes de Fase 3)

Replicar stories a Facebook. **Lo dejo explícitamente sin fecha porque no sé si conviene:**
sin los datos de Fase 3 no tenemos idea de cuánta gente ve hoy Facebook. Decidirlo con el
número puesto, no con la corazonada de que "el público de multifocales está ahí".

---

## 5. El mapa de contenido

Esta es la parte que hace el sistema **modular**: agregar un tema es llenar un casillero,
no rediseñar nada. Cada fila es un tema del mundo de la óptica; cada columna, un formato.

Leyenda: ✅ cubierto · ◐ parcial · ✗ vacío

### Eje SÍNTOMA (techo del embudo — lo que la persona *siente*)

| Tema | Carrusel | Story | Reel | Blog |
|---|---|---|---|---|
| Presbicia / vista cansada | ✗ | ✅ `story-presbicia`, `story-dato-add-es-presbicia` | ✅ `que-es-la-presbicia` | ✗ |
| Miopía en adultos | ✗ | ✅ `story-miopia` | ✅ `que-es-la-miopia` | ✗ |
| Hipermetropía | ✗ | ✅ `story-hipermetropia` | ✅ `que-es-la-hipermetropia` | ✗ |
| **Astigmatismo** | ✗ | ✗ | ✗ | ✗ |
| Miopía infantil / control | ✅ 3 Stellest | ✅ 5 + 3 datos | ✅ 2 | ✅ 4 notas |
| Fatiga por pantallas | ✅ `eyezen-pantallas`, `filtro-azul-o-antirreflejo` | ✅ `story-tratamiento-filtroazul` | ✗ | ✅ |
| Mareo al adaptarse a multifocales | ✅ `multifocales-marean` | ✅ `story-marean` | ✗ | ✅ |
| Encandilamiento al manejar de noche | ✅ `polarizados-manejo` | ✗ | ✗ | ✅ |
| **Vaho / antivaho (Optifog)** | ✗ | ✗ | ✗ | ✅ |
| **Deporte con graduación** | ✗ | ✗ | ✗ | ✅ |
| **Post-cirugía de cataratas** | ✗ | ✗ | ✗ | ✗ |
| **Anteojos de lectura vs. recetados de cerca** | ✗ | ✗ | ✗ | ✗ |

### Eje PRODUCTO

| Tema | Carrusel | Story | Reel |
|---|---|---|---|
| Multifocales / progresivos | ✅ 5 | ✅ 4 | ✅ `lente-progresiva` |
| Monofocales | ✗ | ✅ | ✅ |
| Bifocales | ✗ | ✅ 2 | ✅ |
| **Ocupacional / de oficina** | ✗ | ✗ | ✗ |
| Índices y espesor | ✅ `indices-de-refraccion` | ✅ 3 | ✗ |
| Antirreflejo / Crizal | ✅ 2 | ✅ 3 + 2 | ✗ |
| Fotocromáticos / Transitions | ✅ `cristales-transitions` | ✅ 3 | ✅ `fotocromaticos-dia` |
| Polarizados / Xperio | ✅ | ✅ dato | ✗ |
| Sol con receta | ✅ 2 | ✗ | ✗ |
| Armazones de catálogo | ✅ 2 | ✅ 26 de producto | ✗ |
| **Lentes de contacto** | ◐ 1 pieza suelta | ✗ | ✗ |
| **Smart glasses (Ray-Ban Meta, Wicue)** | ✗ | ✅ 2 datos | ✗ |

### Eje MARCA (la búsqueda que más convierte)

| Marca | Carrusel | Story | Reel |
|---|---|---|---|
| Varilux | ✅ 4 | ✅ 3 | ✗ |
| Essilor / Stellest | ✅ 3 | ✅ 5 | ✅ 2 |
| Kodak | ✅ 1 | ✅ 2 | ✗ |
| Crizal | ✅ 2 | ✅ 3 | ✗ |
| Transitions / Xperio | ✅ | ✅ | ✅ |
| **Nikon** | ✗ | ✗ | ✗ |
| **Ray-Ban Meta** | ✗ | ◐ dato | ✗ |
| **Marcas propias de armazón (estelar + color)** | ◐ catálogo | ✅ | ✗ |

### Eje LOCAL Y SERVICIO (la búsqueda que camina hasta la puerta)

| Tema | Carrusel | Story | Reel |
|---|---|---|---|
| Dónde estamos / horarios | ✅ | ✅ 2, rotando cada 3-4 días | ✗ |
| Reseñas y calificación | ✅ 2 | ✗ | ✗ |
| Taller propio | ✅ | ✅ | ✗ |
| Garantía de adaptación 30 días | ✅ | ✅ | ✅ |
| Medición con el armazón puesto | ✅ | ✅ | ✅ |
| Financiación y cuotas | ✅ 2 | ✅ 2 | ✅ `6-cuotas` |
| Comprar online | ✅ | ✗ | ✗ |
| Obras sociales / reintegro | ◐ 1 pieza | ✗ | ✗ |
| **Cambiar los cristales en tu armazón de siempre** | ✗ | ✗ | ✗ |
| **Reparaciones y ajustes** | ◐ solo "no la pegues con gotita" | ✗ | ✗ |
| **El equipo / las hermanas / detrás de escena** | ✗ | ✗ | ✗ |
| Sin turno previo | ◐ `agenda-tu-medicion` | ✗ | ✗ |

### Eje TEMPORADA (el más vacío, y el que hay que planificar con anticipación)

| Momento | Cuándo se prepara | Estado |
|---|---|---|
| Verano / sol | oct-nov | ✅ `sol-seleccion`, `sol-con-receta` |
| **Vuelta al cole** | **ene, sale feb-mar** | ✗ |
| **Día de la Madre / del Padre** | 3 semanas antes | ✗ |
| **Navidad / regalo** | nov | ✗ |
| **Fin de año / pirotecnia** | dic | ✗ (hay draft de blog sin publicar) |
| **Día Mundial de la Visión (8 oct)** | sep | ✗ |
| **Black Friday / Cyber Monday** | nov | ◐ hay 2x1 el 26/11, sin pieza propia |

**Cómo se llena un casillero** (el procedimiento completo, para que no haya que preguntar):
1. Escribir `social/contenido/<id>.json`. Copiar la estructura de una pieza del mismo
   formato que ya funcione.
2. `node scripts/social/render.mjs social/contenido/<id>.json`. El validador corre solo y
   es bloqueante.
3. Mirar los JPEG de `public/social/<id>/`. Que renderice no es que se vea bien.
4. Programar: carrusel/reel en `social/feed-programacion.json`, story en el carril de
   `social/stories-diarias.json`.
5. `npm run check:social` y `npm run check:orden`, los dos verdes.
6. Commitear **los JPEG también** — Instagram descarga una URL pública HTTPS, no acepta
   los bytes.

---

## 6. Qué medir

Cinco métricas. Nada más. Ninguna es cantidad de seguidores.

| # | Métrica | De dónde sale | Estado |
|---|---|---|---|
| 1 | **Envíos por alcance** (compartidas por DM ÷ alcance), por pieza | Graph API insights, `shares` / `reach` | **No implementado — Fase 3.** Es la señal #1 de Mosseri. La usamos para decidir qué producir más. |
| 2 | **Alcance de no-seguidores en reels** | Graph API insights del reel | **No implementado — Fase 3.** Es el único número que mide *crecimiento de cuenta*, no de engagement. |
| 3 | **Días con publicación** (feed y stories, por separado) | bitácora `SystemSetting.social_publicaciones` | ✅ Ya se mide. Llega por mail todos los días desde `/api/cron/social-cadencia`. Un día en cero pesa más que un día con seis. |
| 4 | **Conversaciones iniciadas por WhatsApp con origen redes** | CRM — la regla de atribución `[metaXxx]` en precargado + nombre de contacto (ver `docs/` de atribución) | ◐ Existe para Ads. **No sé si distingue orgánico de pago** — verificarlo antes de apoyarse en el número. |
| 5 | **Guardados y comentarios**, por pieza | Graph API insights | **No implementado — Fase 3.** Segundo nivel: dice si el contenido educativo funciona. |

**Vanity metrics que NO vamos a mirar:** seguidores totales, impresiones, likes en
absoluto. Los likes sí cuentan pero **por alcance**, que es la métrica 1 en su versión
menor.

**La verdad incómoda:** hoy solo tenemos la métrica 3. Estamos publicando 42 stories y 5
posts por semana sin ningún dato de qué funciona. Por eso Fase 3 va antes que Fase 4.

---

## 7. Riesgos y guardas

Lo importante de esta sección no son los riesgos cubiertos: son los **descubiertos**.

### Cubiertos por el sistema

| Riesgo | Guarda | Dónde vive |
|---|---|---|
| Publicar un precio viejo | **R6**: una pieza con algo que parezca precio solo renderiza si tiene `fuente: "base"`, o sea si la generó un script leyendo la base. No se exime nunca. | `scripts/social/validador.mjs` |
| Publicar una reseña inventada | **R7**: un slide `testimonio` exige cita textual (≤180 car.), autor real (rechaza `{Nombre}`, "un cliente", "anónimo") y plataforma pública de una lista cerrada. No se exime nunca. | ídem |
| Citar una imagen que no existe | **R5**. No se exime nunca. | ídem |
| Una pieza fea (toda foto, sin bisagra, cuatro placas seguidas de texto) | R1-R4, eximibles solo con `images_waived` **y una razón escrita de más de 8 caracteres** | ídem |
| Precio fresco pero **vencido** entre que se generó y el día que sale | Guarda de frescura, con el mismo helper que usa el día D | `src/lib/social/frescura.ts`, `salud-programacion.ts` |
| Cron duplicado publicando dos veces | Dedup en cada endpoint: el feed mira 7 días de bitácora, las stories miran el día. Por eso los disparos dobles a 40 minutos son seguros. | rutas de `src/app/api/cron/social-*` |
| Un cron atrasado haciendo lo del vecino (el bug del 12/8) | Cuál cron corrió se lee de `github.event.schedule`, **nunca del reloj**. Un schedule sin mapear falla el job. | `.github/workflows/social-crons.yml` |
| Que se corte y nadie se entere | Mail **todos los días** con el número puesto, aunque esté todo bien. Una alarma que solo suena con problema no se distingue de una alarma rota. | `/api/cron/social-cadencia` |
| Un id mal escrito en el calendario del feed | `npm run check:social` verifica que exista el JPEG/mp4 de cada entrada futura | `scripts/checks/social-programacion.check.mjs` |
| Basura en el repo | `npm run check:orden`, también en CI | `scripts/checks/orden-del-repo.check.mjs` |
| Publicar sin querer | `publicar.mjs` sin `--facebook`/`--instagram` solo muestra qué haría. Es el default, no una opción. | `scripts/social/publicar.mjs` |
| Filtrar el token | Ningún script imprime el token ni el App Secret; el de Página se deriva en cada corrida y no se guarda | convención verificada en `scripts/social/` |

### SIN guarda — esto es lo que puede pasar hoy

1. **Un id inventado en un carril de stories no lo detecta nadie** hasta el día que le
   toca salir. `check:social` valida el feed pero **no abre `stories-diarias.json`**.
   58 + 24 = 82 ids sin verificar automáticamente. → Fase 2.
2. **Un reel con caption nuevo y video viejo pasa verde.** El caption se lee en vivo del
   JSON al publicar, pero el texto quemado en el video solo cambia re-renderizando. Ya
   pasó con `medicion-armazon`, y **está pasando ahora mismo con `garantia-30-dias`, que
   sale el 9/9**. → Fase 2.
3. **Un claim de salud mal redactado no lo frena ninguna regla.** El validador chequea
   precios y reseñas, pero nada impide escribir "¿Tenés miopía?" (atributo personal
   prohibido, 2.a punto 7) o "elimina la miopía". Hoy la guarda es humana. Se podría
   agregar una R8 que rechace patrones de pregunta sobre condición de salud —
   está en "lo que falta".
4. **La regla de las cuotas no está en el código.** "12 cuotas" nunca "12 pagos" ni "12
   sin interés" ni el porcentaje: es una regla de Ishtar que hoy vive solo en CLAUDE.md
   y en la cabeza de quien escribe. Un `grep` bloqueante sería trivial.
5. **El deploy de la tanda de la tarde es atómico o no es.** El workflow ya llama a
   `?tanda=tarde`; hasta que el endpoint esté deployado, ese parámetro se ignora (default
   `manana`), el dedup frena la republicación —así que no duplica— pero **no sale nada a
   la tarde y el run queda verde mintiendo.** Hay que mergear código y workflow juntos.
6. **Stellest se publica como lanzamiento sin una sola venta.** El producto tiene
   `publishToWeb=false` y cero ventas en la base. Está programado en el feed el 24/10,
   31/10 y 10/11, más 6 stories. Las piezas están redactadas como lanzamiento ("ya está
   en Atelier"), nunca como "lo que usan nuestros chicos" — eso está bien hecho — pero si
   el producto no está disponible para esas fechas hay que sacarlo del calendario.
7. **Tres reels programados sin que nadie mirara el video**: `lente-monofocal` (4/11),
   `lente-stellest` (11/11), `lente-myofix` (18/11). El mp4 existe; nadie lo vio.
8. **Se triplicó la superficie automática** (4 → 6 stories/día, 3 → 4 disparos de cron).
   Si Meta empieza a limitar por volumen, el síntoma va a ser fallos parciales en la tanda
   de la tarde, que es la última del día.
9. **Dos fechas de octubre con contenido ya aprobado fueron desplazadas** para adelantar
   Stellest (24/10 `armazones-destacados` y 31/10 `sol-seleccion`, las dos únicas cuartas
   repeticiones del año). Está documentado en el JSON y se revierte cambiando dos ids.
   La decisión de adelantar el lanzamiento a octubre no la dio nadie explícitamente.

---

## 8. Lo que falta

Priorizado. El esfuerzo es una estimación mía, no una promesa.

| # | Qué | Esfuerzo | Por qué ahí |
|---|---|---|---|
| 1 | Re-renderizar `garantia-30-dias` y commitear + deployar todo lo de Fase 1 (código y workflow **juntos**) | 1 hora | Tiene fecha de vencimiento: el reel sale el 9/9, y la tanda de la tarde no funciona hasta el deploy |
| 2 | Guardas de Fase 2: carriles de stories en `check:social`, y mtime del mp4 vs. su JSON | medio día | Son los dos únicos modos de fallar en silencio que quedan |
| 3 | Verificar permisos de insights orgánicos (`meta-check.mjs`) y, si falta, pedir el permiso | 1 hora + espera de terceros | Es el paso cero de la medición y depende de otra persona, así que se arranca ya |
| 4 | Cron de insights orgánicos por pieza (Fase 3) | 3-4 días | Sin esto todo lo demás es opinión |
| 5 | Subir reels a 2-3/semana con guiones nuevos desde las stories de dato (Fase 4) | 1-2 días por reel | Es el único formato que trae gente nueva |
| 6 | Rutina humana diaria: responder comentarios/DMs + un sticker interactivo (Fase 5) | 15-20 min/día, continuo | La señal que más pesa, y ningún cron la puede hacer |
| 7 | Llenar los casilleros vacíos, en este orden: cambiar cristales → astigmatismo → lentes de contacto → obras sociales → equipo/hermanas → vuelta al cole | 2-3 horas por pieza | Ordenados por intención de compra: los primeros tres ya tienen la nota de blog escrita |
| 8 | Validador R8 (claims de salud y reglas de cuotas) + puente blog↔redes en los CTAs | 1 día | Convierte dos reglas humanas en código, y suma tráfico entre trabajo ya hecho |

---

## Apéndice — las reglas de comunicación, que no se negocian

Están arriba de cualquier buena práctica de Meta de este documento.

1. **"12 cuotas"**, nunca "12 pagos", nunca "12 sin interés", nunca el porcentaje de
   recargo. 3 y 6 **sí** son "sin interés".
2. **Nada de errores ajenos.** Ni "un multifocal que marea estuvo mal medido" ni "mala
   experiencia en otra óptica". Se habla del **proceso propio** en positivo: medimos con
   el armazón puesto, 30 días de garantía de adaptación, taller propio.
3. **Ningún claim médico sin respaldo del fabricante.** Si va un número, va con la fuente
   **en la placa**, no solo en el caption. El 67% de Stellest se dice siempre como
   "ralentiza la progresión un 67% de media, según ensayo clínico de 2 años de Essilor".
4. **Las piezas muestran anteojos o el local.** Nada de objetos decorativos sueltos.
5. **Nada se publica automáticamente sin aprobación.** `publicar.mjs` sin bandera solo
   muestra qué haría, y eso es el comportamiento por defecto.
