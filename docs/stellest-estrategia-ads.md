# Stellest en Google Ads y Meta Ads — propuesta (10/10/2026)

Pedido de Ishtar: "que la persona ponga la palabra Stellest y le aparezcamos sí
o sí", y revisar si en Google Ads o en Meta se puede sumar estrategia.

**Nada de esto está aplicado.** Es una propuesta para aprobar, siguiendo la
regla permanente de anuncios: no tocar nada que reinicie el aprendizaje ni
suba el gasto de lo que ya corre. Todo lo de abajo son campañas o conjuntos
NUEVOS con presupuesto propio, que no tocan los que ya entregan.

## Qué se vio (solo lectura, 10/10/2026)

- **Google Ads, 90 días (12/7 → 9/10), 500 términos de búsqueda, $170.544:**
  ni UNA búsqueda con "stellest", "miopía", "niños" o "infantil" disparó un
  anuncio. No es que nadie busque: es que las campañas (Search - Recetados,
  Search - Multifocales, Search - Marca) no tienen ninguna palabra clave de
  control de miopía. Hoy una persona que busca "stellest córdoba" no nos ve.
- **Meta Ads, 14 días:** corren dos conjuntos de Mensajes (ATP y
  Multifocales) y la campaña de Ventas de la tienda. Ningún conjunto de
  Stellest. Las creatividades de Stellest del lote `ad-l3` (feed, story,
  cuadrado, apaisado) están renderizadas en `public/social/ad-l3-stellest-*`
  y nunca se usaron en una campaña.
- **Orgánico:** desde hoy hay 8 notas del blog sobre Stellest
  (`src/lib/constants/stellest-notas.ts`), enlazadas entre sí, con FAQ marcada
  para Google, más `/cristales-opticos/stellest`. Es lo que sostiene la
  búsqueda sin pagar y lo que hace que el clic pago tenga dónde caer.

## 1. Google Ads — campaña nueva "Search - Stellest"

Campaña de Búsqueda aparte. No se agregan palabras a Recetados ni a
Multifocales: una palabra nueva en una campaña que ya optimiza cambia a quién
le muestra y el dato de Stellest se mezclaría con el de "óptica cerca de mí".

| Campo | Propuesta |
|---|---|
| Tipo | Búsqueda, solo red de búsqueda (sin partners, sin display) |
| Zona | Córdoba Capital + 30 km (Stellest se retira en el local; no es venta web) |
| Idioma | Español |
| Puja | Maximizar clics con tope de CPC $250 las primeras 2 semanas; después evaluar pasar a conversiones |
| Presupuesto | **$3.000/día** (~$90.000/mes). Es el 65 % de lo que hoy gasta Recetados en 7 días; si no hay búsquedas, no gasta |
| Conversión | Chats de WhatsApp con etiqueta `google:stellest` (la landing ya etiqueta por UTM) |
| Landing | `/blog/stellest` para las búsquedas de "qué es"; `/blog/optica-certificada-stellest-cordoba` para "dónde / óptica"; `/blog/stellest-precio-argentina-y-formas-de-pago` para "precio" |

### Grupos de anuncios y palabras clave

**Grupo 1 — Marca Stellest** (landing: `/blog/optica-certificada-stellest-cordoba`)
- `[stellest]`, `[lentes stellest]`, `[stellest córdoba]`, `[stellest essilor]`
- `"stellest óptica"`, `"stellest donde comprar"`, `"optica stellest cordoba"`
- `"stellest precio"`, `"cuanto cuesta stellest"` → landing precio

**Grupo 2 — Control de miopía** (landing: `/blog/stellest`)
- `"control de miopia niños"`, `"lentes control miopia"`, `"frenar miopia niños"`
- `"lentes para frenar la miopia"`, `"miopia infantil tratamiento"`
- `"lentes miopia infantil cordoba"`

**Grupo 3 — Competidores de categoría** (landing: `/blog/stellest-vs-lentes-comunes`)
- `"miyosmart"`, `"myosmart"`, `"hoya miyosmart cordoba"`: es la otra lente
  de control de miopía que recetan los oftalmopediatras. Quien la busca está
  buscando exactamente lo que vendemos. Concordancia de frase, puja baja.

**Negativas de la campaña** (además de la lista compartida "General", que se
vincula): `ortoqueratologia`, `orto-k`, `lentes de contacto`, `atropina`,
`cirugia`, `laser`, `oftalmologo`, `oftalmologia`, `turno`, `obra social`,
`pdf`, `estudio`, `tesis`. Son búsquedas de tratamiento médico o académicas:
no compran un anteojo.

### Anuncios (responsivos, 2 por grupo)

Títulos (≤30 caracteres):
- `Óptica Certificada Stellest`
- `Stellest en Córdoba`
- `Lentes Stellest de Essilor`
- `Frená la Miopía de tu Hijo`
- `Control de Miopía Infantil`
- `Traé la Receta, Hacemos el Resto`
- `3 y 6 Cuotas Sin Interés`
- `Hasta 12 Cuotas Fijas`
- `Cerro de las Rosas, Córdoba`
- `Sin Turno Previo`

Descripciones (≤90):
- `Essilor fabrica Stellest solo para ópticas certificadas. Atelier lo está. Traé la receta.`
- `67% menos progresión de la miopía en promedio (ensayo clínico de 2 años). Consultá.`
- `Elegimos el armazón con tu hijo, medimos con el armazón puesto y reajustamos sin cargo.`
- `Presupuesto con la receta, el mismo día, por WhatsApp. Tejeda 4380, Cerro de las Rosas.`

Reglas que respetan: nunca "12 cuotas sin interés" (solo 3 y 6 son sin interés;
las 12 son fijas); el 67 % siempre con "en promedio" y la fuente.

### Qué se necesita para aplicarlo

1. OK de Ishtar a presupuesto y zona.
2. Un script `scripts/ads/google_crear_campania_stellest.js` con `validateOnly`
   primero y `GOOGLE_ADS_ALLOW_WRITES=1 … --yes` después, mismo patrón que
   `google_negativas_campania.js`. Se crea PAUSADA, se revisa en el panel y se
   prende a mano.
3. A los 14 días: `node --env-file=.env scripts/ads/google_terminos.js --days 14`
   filtrando la campaña, para ver qué términos reales entran y cargar negativas.

## 2. Meta Ads — campaña nueva "Mensajes | Stellest | Padres"

Campaña aparte (no un conjunto dentro de "Mensajes ✉️": con presupuesto de
campaña, un conjunto nuevo le roba entrega a ATP y Multifocales, que son los
que hoy cierran ventas).

| Campo | Propuesta |
|---|---|
| Objetivo | Mensajes a WhatsApp (mismo que los conjuntos que funcionan) |
| Público | Córdoba Capital + 25 km · 28 a 50 años · intereses: padres de hijos en edad escolar (6-12), educación primaria, pediatría, oftalmología |
| Ubicaciones | Feed e historias de Instagram y Facebook, automáticas |
| Presupuesto | **USD 3/día** (~USD 90/mes). Hoy la cuenta gasta ~USD 300/mes; esto es +30 %, aparte y pausable |
| Creatividades | 3 anuncios en un solo conjunto, desde el día uno (así no hay que agregar después, que reinicia): |

1. `stellest-optica-certificada` (carrusel nuevo de hoy, 5 placas) — el
   mensaje de "somos certificados".
2. `ad-l3-stellest-frena` (placa única "hasta 67 % menos avance") — ya
   renderizada en 4:5, 1:1, 9:16 y 1.91:1.
3. Reel `stellest-frena-miopia` (`public/social/reels/`) — video, que es lo
   que más entrega en Mensajes.

Texto principal (mismo para los tres, para que la comparación sea de
creatividad y no de copy):

> Si el oftalmopediatra le recetó Stellest a tu hijo: Essilor lo fabrica solo
> para ópticas certificadas, y Atelier lo está. Traé la receta y te explicamos
> todo por WhatsApp. Cerro de las Rosas, Córdoba.

Mensaje de bienvenida del WhatsApp con la etiqueta `[metaStellest]`, para que
la atribución del CRM lo cuente aparte (regla `[metaXxx]` de
`atribucion-crm-anuncios`).

### Qué se necesita para aplicarlo

1. OK de Ishtar a presupuesto, público y creatividades.
2. Subir las creatividades con `scripts/ads/subir_creatividades.js` y crear la
   campaña con el patrón de `crear_campania_ventas_tienda.js`: de a una
   llamada, con pausa, `META_ALLOW_WRITES=1` inline, PAUSADA al crearse.
3. Evaluar a los 14 días con `meta_report.js --level ad`: costo por
   conversación y cuántas de esas conversaciones traen receta.

## 3. Lo orgánico que falta y no cuesta plata

- **Ficha de Google (Perfil de Negocio):** una publicación "Somos óptica
  certificada Stellest" con la placa `public/social/stellest-optica-certificada/01.jpg`
  y link a `/blog/optica-certificada-stellest-cordoba`, y un producto
  "Lentes Stellest (control de miopía)" sin precio, con link a la nota. Es lo
  que aparece cuando alguien busca "stellest cerca de mí" en Maps.
- **Pedirle a Essilor que nos liste** en su buscador de ópticas Stellest, si
  todavía no estamos. Es la búsqueda con más intención que existe y el link
  viene del fabricante.
- **Search Console:** en dos semanas, filtrar consultas que contengan
  "stellest" y ver qué nota rankea para cada una; la que no rankee se ajusta.
