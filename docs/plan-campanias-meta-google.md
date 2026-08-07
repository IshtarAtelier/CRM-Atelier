# Plan de campañas — Meta Ads + Google Ads

**Fecha:** agosto 2026 · **Estado:** propuesta, nada implementado. Ninguna campaña
se crea, activa ni modifica sin OK explícito de la dueña (y toda escritura pasa
por `scripts/ads/manage.js` con su protocolo de confirmación — ver
`scripts/ads/CLAUDE.md`).

Fuentes: cuentas de Meta leídas con `scripts/checks/ver-campanias-meta.mjs` y
`scripts/checks/audit-gasto-meta-30dias.mjs`, datos comerciales de
`src/lib/business-info.ts`, mapa de keywords de `src/lib/static-blog-posts.ts`,
creatividades de `public/social/`, medición en `src/lib/ads/meta-insights.ts`,
`src/services/google-ads.service.ts` y `src/app/api/cron/ads-report/route.ts`.

---

## A) Diagnóstico: qué hay en las cuentas y qué no repetir

### Lo que se encontró

Dos cuentas publicitarias de Meta:

- **act_901723834933651 (Atelier Óptica, ARS)** — 13 campañas, **todas pausadas**.
- **act_2107444353167176 (Atelier Optica USD)** — 2 campañas figuran ACTIVE
  ("Campaña de Tráfico en Instagram" y "Mensajes ✉️"), pero el gasto de los
  últimos 30 días es **$0 en ambas cuentas** (auditado 8/7→6/8, dólar $1570).
  O sea: hoy no se está pautando nada, y hay campañas "prendidas" que no
  entregan — probablemente sin método de pago activo o con entrega cortada.

La historia que cuentan esas 13 campañas pausadas:

| Qué había | Lectura |
|---|---|
| 8 conjuntos de "Mensajes IG - WSP \| Multifocales \| 35-65+", varios literalmente "Copia", "Copia 2", "Copia 3" | La idea era correcta (mensajes de WhatsApp a 35-65+ por multifocales — es exactamente el negocio). La ejecución no: 8 conjuntos casi idénticos en la misma campaña compiten entre sí en la subasta, ninguno junta las ~50 conversiones semanales que necesita el algoritmo para aprender, y todos quedan eternamente en "aprendizaje limitado". |
| "❄️Ventas públicos fríos" con evento **Iniciar Pago**, públicos **Argentina entera**, intereses "Diseñadores gráficos, Programadores y Teletrabajo", lookalike 5% | Tres errores juntos: (1) optimizar a "Iniciar Pago" para un producto que se cierra por WhatsApp y en el local — el píxel casi no ve ese evento, así que Meta pujó a ciegas; (2) Argentina entera para una óptica cuya venta grande exige medición presencial en Córdoba; (3) lookalike 5% sobre una base de compradores chica = público casi aleatorio. |
| "Tráfico a Landing/Tienda Nube", "Campaña de Tráfico en Instagram" | Objetivo tráfico = clics baratos de gente que no compra. Además Tienda Nube ya no es la plataforma: la tienda hoy es propia (atelieroptica.com.ar) con píxel y CAPI. Obsoletas dos veces. |
| "Ventas Catalogo Adventage" + copia | Catálogo sin feed mantenido ni volumen de compras web es prematuro. No estaba mal como idea de futuro. |
| "🔥Remarketing: Públicos Tibios y Calientes" con conjuntos "Web 15" y "Redes 30" | **Esta estructura estaba bien** y se recicla: visitantes web 15 días + interacción en redes 30 días. Lo que faltaba era prospección que la alimentara y creatividad de cierre. |
| Cyber Monday, sorteo Día de la Madre, "Tendencia Oval", "Optica Atelier - Javi" | Acciones puntuales sin continuidad. El sorteo trae seguidores que no compran multifocales de ticket alto. |
| Cuenta paralela en USD con las mismas campañas de mensajes | Duplicar la operación en dos cuentas parte los datos a la mitad y complica la facturación (el gasto USD se convierte a blue en los reportes). |

### Qué NO repetir (reglas duras de este plan)

1. **No duplicar conjuntos.** Un conjunto por público, punto. Si algo no anda,
   se corrige o se apaga; no se clona.
2. **No optimizar a eventos de compra web para el negocio de multifocales.**
   El cierre es WhatsApp/local. El objetivo correcto es **Mensajes** y el ROAS
   real lo mide el CRM (ya existe la tabla "Qué devolvió cada anuncio" del cron
   `ads-report`), no el panel de Meta.
3. **No pautar a Argentina entera** lo que exige silla y pupilómetro en Córdoba.
4. **Nada de campañas de tráfico ni sorteos** con presupuesto de performance.
5. **Una sola cuenta (la de ARS).** La USD se deja en pausa total.
6. **Ningún anuncio de WhatsApp sin etiqueta `[metaXxx]`** en el nombre del
   anuncio Y en el mensaje precargado — es el puente que usa
   `meta-insights.ts`/`ads-report` para atribuir chats y ventas. Sin etiqueta,
   el anuncio es invisible para la medición propia.

---

## B) Estructura Meta Ads propuesta

Todo en **act_901723834933651 (ARS)**. Ubicaciones: Advantage+ (automáticas)
**excluyendo Audience Network**; en la práctica va a entregar en Feed, Stories y
Reels de IG/FB, que es donde están las creatividades. Geo de prospección:
**Córdoba capital + 15 km** (la venta multifocal es presencial).

### Campaña M1 — `[MF] Mensajes WhatsApp | Multifocales 2x1`
**Objetivo:** Interacción → Mensajes → WhatsApp (click-to-WhatsApp). Es la
campaña principal y la que más presupuesto lleva.

- **Conjunto único de prospección** (no ocho): Córdoba +15 km, 40-65+, hombres y
  mujeres, segmentación Advantage+ con la edad como único filtro duro. A esta
  edad el problema (presbicia) lo trae la vida, no un interés declarado.
- **Anuncios** (3-4 conviviendo, Meta reparte):
  - Video: `public/social/reels/2x1-multifocales.mp4` (portada `2x1-multifocales-cover.jpg`) — etiqueta `[meta2x1]`
  - Video: `public/social/reels/garantia-30-dias.mp4` — etiqueta `[metaGar30]`
  - Video: `public/social/reels/medicion-armazon.mp4` — etiqueta `[metaMedicion]`
  - Imagen: `public/social/campania-2x1-multifocales-feed/01.jpg` (feed) +
    `campania-2x1-multifocales-story/01.jpg` (stories) + `campania-2x1-multifocales-cuadrado/01.jpg`
    en un solo anuncio con personalización por ubicación — etiqueta `[meta2x1Img]`
- **Mensaje precargado:** "Hola! Quiero saber más del 2x1 en multifocales [meta2x1]"
  (la etiqueta entre corchetes, igual que los históricos `[metaFlor]`). El bot
  atiende 24/7, así que el anuncio puede correr también de noche.
- **Texto del anuncio:** el claim es el de la pieza: dos pares al precio de uno,
  medidos acá, garantía de adaptación 30 días. Sin precios en el copy (los
  precios solo salen de piezas generadas desde la base — regla R6 del sistema
  social; misma disciplina acá).

### Campaña M2 — `[RMK] Remarketing | Tibios y calientes`
**Objetivo:** Interacción → Mensajes → WhatsApp. Recicla la idea "Web 15 /
Redes 30" que ya existía, con dos conjuntos:

- **Conjunto "Web 30":** visitantes de atelieroptica.com.ar últimos 30 días
  (el píxel ya junta este público; con 15 días el público local queda muy chico
  — arrancar con 30 y achicar si el volumen da). Excluir quienes ya iniciaron
  conversación en 30 días.
- **Conjunto "Redes 30":** interacción con la cuenta de IG + página de FB
  últimos 30 días, más viewers ≥50% de los reels. **Acá es donde el orgánico
  alimenta la pauta**: el cronograma de 3 publicaciones semanales
  (`docs/cronograma-social-agosto-2026.md`) genera ese público tibio gratis; la
  campaña lo remata.
- **Anuncios** (los argumentos de cierre, no los de descubrimiento):
  - Imagen: `public/social/campania-6-cuotas-feed/01.jpg` + `-story/01.jpg` +
    `-cuadrado/01.jpg` — etiqueta `[metaRmk6c]`
  - Video: `public/social/reels/6-cuotas.mp4` — etiqueta `[metaRmk6cV]`
  - Video: `public/social/reels/garantia-30-dias.mp4` — etiqueta `[metaRmkGar]`
- Geo más laxa que M1 (Córdoba provincia): si ya visitó la web, que decida él.

### Campaña M3 — `[NIÑOS] Mensajes WhatsApp | Control de miopía` *(semana 3-4, no día 1)*
**Objetivo:** Interacción → Mensajes → WhatsApp. Nicho chico, ticket alto,
competencia casi nula en Córdoba, y ya posiciona orgánico (2 notas del blog).

- **Conjunto único:** Córdoba +15 km, 28-50 años, comportamiento/interés
  "padres con hijos de 3-12 años".
- **Anuncios:**
  - Video: `public/social/reels/stellest-frena-miopia.mp4` — etiqueta `[metaStellest]`
  - Video: `public/social/reels/que-es-la-miopia.mp4` — etiqueta `[metaMiopiaEdu]`
  - Video: `public/social/reels/lente-myofix.mp4` — etiqueta `[metaMyofix]`
    (ya existe el tag deducido `myofix` en `meta-insights.ts`, así que la
    atribución histórica empalma)
- Mensaje precargado: "Hola! Quiero información sobre control de miopía para mi hijo/a [metaStellest]".

### Campaña M4 — `[TIENDA] Ventas catálogo | Armazones` *(solo escenario agresivo, mes 2+)*
**Objetivo:** Ventas con píxel (purchase), catálogo Advantage+, Argentina.
Es la única donde optimizar a compra web tiene sentido: armazones de la línea
propia ($189.000 y $200.000 de lista — VALIDADO contra la base de producción el 6/8;
al contado con 15% quedan en $160.650 y $170.000 —
**validar contra producción antes de usar en anuncios**) que se venden por la
tienda con Payway. Requiere armar y mantener el feed de catálogo — por eso no
va en el arranque. Los precios del feed salen de la base, nunca a mano.

### Embudo completo

```
FRÍO      M1 (2x1 multifocales) + M3 (miopía)         → conversación WhatsApp → bot → presupuesto
             +
TIBIO     orgánico 3x/semana (reels + carruseles)     → alimenta "Redes 30"
          visitas web (SEO del blog, 51 notas)        → alimenta "Web 30"
             ↓
CALIENTE  M2 remarketing (6 cuotas + garantía)        → conversación WhatsApp → cierre en local
```

Los 9 reels educativos que no van en pauta (`lente-monofocal`, `lente-bifocal`,
`lente-progresiva`, `que-es-la-presbicia`, `que-es-la-hipermetropia`,
`fotocromaticos-dia`, etc.) se siguen publicando orgánico: su función en este
plan es fabricar el público de "Redes 30" a costo cero.

### Presupuestos Meta (ARS por día, por campaña)

| Campaña | Mínimo viable | Recomendado | Agresivo |
|---|---|---|---|
| M1 Multifocales 2x1 | $15.000 | $25.000 | $40.000 |
| M2 Remarketing | $5.000 | $8.000 | $15.000 |
| M3 Miopía infantil | — | $7.000 | $12.000 |
| M4 Catálogo tienda | — | — | $10.000 |
| **Total Meta / día** | **$20.000** | **$40.000** | **$77.000** |
| **Total Meta / mes (30d)** | **$600.000** | **$1.200.000** | **$2.310.000** |

Presupuesto a nivel conjunto (ABO), no de campaña: con conjuntos únicos por
campaña no hay nada que Advantage Budget pueda repartir mejor, y el control es
explícito.

---

## C) Estructura Google Ads propuesta

El blog ya dice qué buscan los que compran: las 51 notas de
`static-blog-posts.ts` se escribieron contra esas keywords (precio multifocales,
Varilux vs genéricos, control miopía Córdoba, presbicia). Búsqueda captura esa
demanda con intención; Meta la genera.

**Prerequisito técnico (ver sección D):** según `scripts/ads/CLAUDE.md` el
cliente de Google (`lib/google_client.js`) está implementado pero **falta el
developer token**, y `GoogleAdsService` necesita que se cree la acción de
conversión offline (`GOOGLE_ADS_OFFLINE_CONVERSION_ACTION`) y se habilite
`GOOGLE_ADS_UPLOAD_CONVERSIONS=1`. Sin eso, Google puja sin enterarse de qué
clic terminó en venta — exactamente el problema que ese service existe para
resolver. Se resuelve en la semana 0.

Geo: Córdoba capital + 20 km, español. Red de Búsqueda sola (sin partners de
búsqueda ni Display). Conversiones: "Contactar por WhatsApp" (clic al wa.me /
botón de WhatsApp, ya trackeado con `GOOGLE_ADS_CONVERSION_ID/LABEL`) como
conversión primaria al inicio; la conversión offline (venta real) se suma como
primaria cuando esté cargando, y ahí se pasa a Maximizar valor de conversiones.

### Campaña G1 — `Búsqueda | Multifocales Córdoba`

**Grupo 1 — Multifocales + ciudad** (la intención más caliente)
- `[lentes multifocales cordoba]`, `[multifocales cordoba]`,
  `[anteojos multifocales cordoba]`, `[opticas multifocales cordoba]`,
  `"lentes multifocales"` (frase — la geo ya recorta a Córdoba)
- RSA:
  - Titulares: `Multifocales 2x1 en Córdoba` · `Lentes Multifocales Varilux` ·
    `Dos Pares al Precio de Uno` · `Garantía de Adaptación 30 Días` ·
    `6 Cuotas Sin Interés` · `Medición Essilor Expert` · `Laboratorio Propio` ·
    `Óptica en Cerro de las Rosas` · `20% de Descuento en Efectivo` ·
    `Atelier Óptica`
  - Descripciones: `Dos pares de multifocales al precio de uno. Medidos acá, con garantía de adaptación.` ·
    `6 cuotas sin interés con tarjeta, 20% de descuento en efectivo o 15% por transferencia.` ·
    `Medición Essilor Expert y laboratorio propio, sin tercerizar. Cerro de las Rosas, Córdoba.` ·
    `Si en 30 días no te adaptás, lo resolvemos. Escribinos por WhatsApp y pedí tu presupuesto.`
  - URL final: landing de multifocales de atelieroptica.com.ar (o la nota
    "La mejor óptica para multifocales en Córdoba" si no hay landing comercial —
    definir con la dueña; una landing con botón de WhatsApp convierte mejor que
    una nota).

**Grupo 2 — Precio** (la keyword de las dos notas más comerciales del blog:
"Precio de Lentes Multifocales en Córdoba 2026" y "¿Cuánto cuesta un lente
multifocal en Argentina?")
- `[precio lentes multifocales]`, `[precio lentes multifocales cordoba]`,
  `[cuanto cuesta un lente multifocal]`, `[cuanto sale un lente multifocal]`,
  `"lentes multifocales precio"`
- RSA: mismos titulares del grupo 1 anteponiendo
  `Precio de Multifocales Córdoba` y `Pedí tu Presupuesto x WhatsApp`;
  descripción extra: `Presupuesto sin cargo por WhatsApp en el día. 2x1 en multifocales y 6 cuotas sin interés.`

**Grupo 3 — Varilux (marca)** (notas: "Varilux XR Series", "Varilux vs
Multifocales Genéricos", "Varilux, Zeiss o Kodak")
- `[varilux]`, `[lentes varilux]`, `[varilux precio]`, `[varilux cordoba]`,
  `"varilux comfort max"`, `"varilux xr"`
- RSA: titulares `Varilux Original en Córdoba` · `Especialista en Varilux` ·
  `Varilux XR Series` · `2x1 en Multifocales` + los de promo del grupo 1;
  descripción extra: `Especialista Essilor Expert en Varilux. Medición personalizada y garantía de adaptación.`

### Campaña G2 — `Búsqueda | Marca + óptica local`
Barata y defensiva: que buscarte a vos o a una óptica en la zona termine en
WhatsApp y no en un competidor.
- **Grupo marca:** `[atelier optica]`, `[optica atelier]`, `"atelier optica cordoba"`
- **Grupo local:** `[optica cerro de las rosas]`, `[opticas en cordoba]`,
  `"optica cordoba"` (frase, vigilar términos)
- RSA: titulares `Atelier Óptica` · `Óptica en Cerro de las Rosas` ·
  `La Óptica Mejor Calificada` · `Multifocales y Lentes de Sol` ·
  `6 Cuotas Sin Interés` · `Lun a Vie 8 a 20 · Sáb 9 a 17`;
  descripciones: `Óptica boutique en José Luis de Tejeda 4380, Cerro de las Rosas. Armazones de autor.` ·
  `Multifocales Varilux, laboratorio propio y garantía de adaptación de 30 días.` ·
  `Escribinos por WhatsApp y pedí tu presupuesto sin cargo. Respondemos siempre.`
- Extensiones: ubicación (vincular el perfil de Google Business — el `mapsUrl`
  de `business-info.ts`), llamada al +54 9 351 868-5644 en horario de local,
  enlaces de sitio (Multifocales / Lentes de sol / Tienda / Cómo llegar).

### Campaña G3 — `Búsqueda | Control de miopía infantil` *(cuando arranque M3)*
- `[lentes stellest]`, `[stellest precio]`, `[stellest cordoba]`,
  `[lentes myofix]`, `[control de miopia infantil]`, `[control de miopia cordoba]`,
  `"miopia infantil tratamiento"`, `"como frenar la miopia"`
- RSA: titulares `Control de Miopía Infantil` · `Lentes Stellest en Córdoba` ·
  `Frená el Avance de la Miopía` · `Lentes MyoFix` · `Medición Especializada` ·
  `6 Cuotas Sin Interés`;
  descripciones: `Lentes Stellest y MyoFix: frenan el avance de la miopía en chicos. Asesoramiento real.` ·
  `Medición especializada en Córdoba. Consultá por WhatsApp y coordiná una visita.` ·
  `Trabajamos control de miopía con seguimiento. 6 cuotas sin interés con tarjeta.`

### Negativas imprescindibles (lista compartida, día 1)

- **Otro producto:** `celular`, `camara`, `cámara`, `iphone`, `samsung`,
  `templado`, `vidrio`, `telescopio`, `microscopio`, `drone` (los "lentes/
  cristales" de electrónica queman plata rápido)
- **Sin plata / otro canal:** `gratis`, `usado`, `usados`, `segunda mano`,
  `mercado libre`, `mercadolibre`, `aliexpress`, `shein`
- **Empleo/formación:** `curso`, `carrera`, `empleo`, `trabajo`, `sueldo`,
  `optico tecnico`
- **Salud, no óptica:** `turno oftalmologo`, `oftalmologo` (frase), `cirugia`,
  `lasik`, `conjuntivitis`
- **Solo en G1/G3:** `lentes de contacto` (se venden, pero no es esta campaña
  ni esta landing)
- **A decidir con la dueña:** `obra social`, `pami`, `apross` — si no se
  trabaja con obras sociales van de negativas; si se trabaja, son un grupo de
  anuncios propio. *(Pregunta abierta.)*

Ritual: revisar el informe de términos de búsqueda cada semana el primer mes
(`scripts/ads/google_terminos.js` ya existe para esto) y engordar la lista con
`google_negativas.js`.

### ¿Performance Max? ¿Local? — Por ahora NO

- **PMax no**, por tres razones: (1) necesita volumen de conversiones y arranca
  con conversión de clic a WhatsApp, señal débil que PMax infla con basura;
  (2) canibaliza la marca y no deja ver términos de búsqueda — exactamente lo
  contrario de la disciplina de medición que este proyecto ya construyó;
  (3) sin feed de catálogo mantenido, la mitad de sus formatos queda vacía.
  **Se reevalúa en el mes 3** si las conversiones offline (ventas reales con
  valor) están cargando vía `GoogleAdsService`: con esa señal, PMax pasa a
  tener sentido para la tienda.
- Las **campañas "Locales" clásicas ya no existen** como tipo aparte (las
  absorbió PMax). Lo local se cubre con la extensión de ubicación en G1/G2,
  que habilita anuncios en Maps sin regalarle la puja a la caja negra.

### Presupuestos Google (ARS por día, por campaña)

| Campaña | Mínimo viable | Recomendado | Agresivo |
|---|---|---|---|
| G1 Multifocales | $12.000 | $22.000 | $35.000 |
| G2 Marca + local | $3.000 | $5.000 | $8.000 |
| G3 Miopía infantil | — | $8.000 | $10.000 |
| **Total Google / día** | **$15.000** | **$35.000** | **$53.000** |
| **Total Google / mes (30d)** | **$450.000** | **$1.050.000** | **$1.590.000** |

### Total ambas plataformas

| | Mínimo viable | Recomendado | Agresivo |
|---|---|---|---|
| Por día | $35.000 | $75.000 | $130.000 |
| **Por mes** | **$1.050.000** | **$2.250.000** | **$3.900.000** |

**Cuentas de servilleta para elegir escenario** *(supuestos a validar con el
CRM — el dato real sale de la tabla de ROAS del `ads-report`)*: si el ticket
promedio de una venta de multifocales ronda los $500.000–700.000 (supuesto:
armazón $160–200k + cristales premium) y el margen bruto es ~50% (supuesto a
validar), el escenario mínimo se paga con **1-2 cierres al mes** atribuidos a
pauta; el recomendado con 3-4. Con el bot atendiendo 24/7 y el histórico de que
las campañas de mensajes eran las que la óptica más insistió en duplicar, es un
umbral razonable. Recomendación: **arrancar con "mínimo viable" 3-4 semanas y
subir a "recomendado" recién cuando el reporte muestre cierres**, no antes.

---

## D) Medición y reglas de corte

### Lo que ya está construido (y hay que terminar de enchufar)

| Pieza | Estado | Acción |
|---|---|---|
| Meta Pixel + CAPI con conversiones offline | Funcionando | Nada |
| Atribución chat→venta por etiqueta `[metaXxx]` (`meta-insights.ts` + `Client.adTag`) | Funcionando | **Toda pieza nueva sale con etiqueta única** (registro en este doc o en el nombre del anuncio) |
| Cron `ads-report` (email diario: gasto, alertas, tabla "Qué devolvió cada anuncio") | Código listo | **Verificar el alta en cron-job.org** (9:45 AM) — es el tablero de la dueña |
| Google: conversión de clic a WhatsApp (`GOOGLE_ADS_CONVERSION_ID/LABEL`) | Configurada | Nada |
| Google: conversiones offline (`GoogleAdsService`) | Código listo, **inerte** | Semana 0: developer token aprobado, crear la acción de conversión con conversiones mejoradas habilitadas, setear `GOOGLE_ADS_OFFLINE_CONVERSION_ACTION`, probar con `GOOGLE_ADS_VALIDATE_ONLY=1`, recién después `GOOGLE_ADS_UPLOAD_CONVERSIONS=1` |
| Cron `social-cadencia` | Falta alta en cron-job.org | Darlo de alta — el orgánico sostiene el público tibio de M2 |

### Los 3 números de la dueña (sin ayuda de nadie)

Los tres salen del email diario "📊 Ads — reporte diario":

1. **Gasto de ayer** (primera línea). Si un día da $0 con campañas prendidas,
   el mail ya lo alerta solo: es tarjeta rechazada o pausa involuntaria.
2. **Chats por anuncio** (columna "Chats" de la tabla "Qué devolvió cada
   anuncio"). Es la máquina funcionando: plata entra → conversaciones salen.
3. **El multiplicador "×"** de la fila TOTAL de esa misma tabla: cuántos pesos
   de venta real (plata cobrada o pedido en laboratorio, no presupuestos)
   devolvió cada peso de pauta. Verde ≥3×. Debajo de 1× sostenido, la pauta
   pierde plata.

### Reglas de corte (simples, se ejecutan sin discusión)

- **Regla de los 14 días:** un conjunto/grupo de anuncios que gastó más de
  **$150.000 en 14 días con menos de 10 conversaciones de WhatsApp iniciadas**
  (o, en Google, menos de 10 conversiones de clic a WhatsApp) se pausa. No se
  duplica, no se le "da una semana más": se pausa y se cambia creatividad o
  público antes de volver a prenderlo.
- **Regla del costo por conversación:** objetivo ≤ $8.000 por conversación
  iniciada *(supuesto a calibrar el primer mes con datos propios)*. Si un
  anuncio sostiene el doble de eso durante 7 días, se apaga ese anuncio (no la
  campaña).
- **Regla de los 45 días:** si a los 45 días la fila TOTAL del reporte muestra
  **cero cierres** con más de $1.000.000 gastados, se frena todo y se revisa el
  eslabón conversación→presupuesto→cierre (el problema ya no sería la pauta,
  sería el circuito de venta).
- **Frecuencia >3,5 en 7 días** (el cron ya lo alerta): renovar creatividad del
  conjunto o ampliar público. Los 14 reels dan rotación para meses.
- **Higiene operativa** (de `scripts/ads/CLAUDE.md`): máximo un ajuste
  significativo por campaña cada 3-4 días, salvo gasto sin conversiones. Nada
  de toquetear presupuestos a diario.

---

## E) Calendario de implementación

### Semana 0 — prerequisitos (sin pauta)
- [ ] **Dueña:** elegir escenario de presupuesto (mínimo / recomendado / agresivo).
- [ ] **Dueña:** confirmar método de pago activo en la cuenta ARS.
- [ ] **Dueña:** OK para dejar la cuenta USD pausada por completo (hoy figura con
      2 campañas ACTIVE que no gastan — pausarlas explícitamente para que no
      arranquen solas al cargar un pago).
- [ ] **Dueña:** decidir landing de multifocales (¿existe una comercial o se usa
      la nota del blog mientras se arma?) y la pregunta de obras sociales.
- [ ] Verificar alta de los crons `ads-report` y `social-cadencia` en cron-job.org.
- [ ] Google: developer token + acción de conversión offline + prueba con
      `GOOGLE_ADS_VALIDATE_ONLY=1` (sección D).
- [x] Precios validados contra producción el 6/8: lista $189.000/$200.000 ($160.650/$170.000
      vistos en snapshot del 15/7) antes de cualquier pieza con precio.
- [ ] Asignar etiquetas `[metaXxx]` definitivas a cada anuncio de la sección B.

### Semana 1 — prender lo esencial
- **Meta:** M1 (multifocales 2x1) + M2 (remarketing). M2 arranca aunque el
  público sea chico: el píxel y el orgánico lo van llenando.
- **Google:** G1 (multifocales) + G2 (marca/local) con la lista de negativas
  del día 1.
- Todo al presupuesto del escenario elegido, sin excepciones ni "probemos con
  un poquito más".

### Semanas 2-3 — observar, no tocar (casi)
- Revisión semanal de términos de búsqueda (`google_terminos.js`) → negativas
  nuevas (`google_negativas.js`).
- Apagar anuncios individuales que violen la regla del costo por conversación.
- El resto no se toca: el algoritmo necesita 2 semanas de datos estables.

### Semana 4 — primera evaluación y expansión
- Aplicar la regla de los 14 días con datos completos.
- Si M1/G1 muestran cierres en el reporte: prender **M3 + G3 (miopía infantil)**.
- Si se eligió mínimo viable y funciona: proponer a la dueña subir a recomendado.

### Mes 2-3
- Escenario agresivo solo si el "×" total sostiene ≥3.
- M4 (catálogo tienda) recién con feed armado y precios validados.
- Reevaluar PMax únicamente si las conversiones offline de Google están
  cargando con valor real.

### Qué necesita aprobar la dueña (resumen)
1. Escenario de presupuesto y su total mensual (tabla de la sección C).
2. Pausa explícita de la cuenta USD.
3. Landing de multifocales y política de obras sociales.
4. El OK final para crear las campañas (se crean en pausa, se revisan juntas en
   el Ads Manager, y recién ahí se activan — mismo protocolo de doble
   confirmación que exige `scripts/ads/CLAUDE.md`).
