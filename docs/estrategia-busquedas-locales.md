# ESTRATEGIA INTEGRADA — Atelier Óptica · Director de estrategia · 8/8/2026

## 1. LA ESTRATEGIA (la idea madre)

Atelier ya ganó lo más difícil de ganar: es la 1ª óptica orgánica de su zona con la única calificación 5,0 (675 reseñas) y tiene el canal de cierre más barato del mercado (Meta a $250-450/chat con bot 24/7). El problema no es visibilidad, es que **el 82% del gasto de Google ($517k/mes) compra una señal fabricada** (clics a "Cómo llegar") mientras las campañas que sí producen conversaciones reales a $2.255-2.386 están ahogadas. La estrategia es un reordenamiento en tres capas: **lo que ya se gana gratis se defiende gratis** (Maps orgánico, perfil, reseñas, SEO — sacando las dos prácticas que hoy lo ponen en riesgo de sanción); **lo pago captura solo intención tipeada** (Search con ~90 keywords vivas en vez de 2.761 zombies, horario extendido al que el bot ya cubre); y **la señal se reemplaza por plata real** (conversiones = chats hoy, ventas del CRM con su valor real mañana). Todo secuenciado para que cada cambio sea legible, reversible y sin un solo claim que un revisor pueda objetar — porque el mandato es cero sanciones y hoy mismo hay anuncios corriendo que lo violan.

**El criterio que ordena todas las decisiones de abajo:** ante conflicto entre velocidad y legibilidad, gana legibilidad. La dueña tiene que poder ver QUÉ movió cada número, o al primer mes malo el plan muere políticamente y la cuenta vuelve a $7.296/chat.

---

## 2. PLAN POR HORIZONTE

### ESTA SEMANA (lunes 11/8 — "F0 + arranque limpio")

| # | Acción | Quién | Costo | Resultado esperado |
|---|---|---|---|---|
| 1 | **Compliance de anuncios, antes que todo:** pausar todo anuncio con "Mejor Óptica", "chau dolores de cabeza", typos, promos vencidas y URLs a `promo.atelieroptica.com.ar`; publicar los RSA nuevos ya redactados (sin el titular "Calificación 5,0", ver §6). Cambiar anuncios NO resetea la puja. | Agente por API | $0 | Riesgo de sanción a cero; se resuelve el APPROVED_LIMITED |
| 2 | **Pausar Maps** ($131k/mes liberados) y arrancar el experimento — ver §3 | Agente | −$131k/mes | El experimento más importante del plan |
| 3 | **Pregunta de mostrador "¿cómo nos encontraste?"** anotada en la ficha de cada cliente que entra | Dueña + staff, a mano | $0 | El único árbitro real entre "Maps traía gente" y "Maps era humo" |
| 4 | Config de una sola vez: presencia-only en todas las campañas, corregir el geo patagónico de la campaña pausada, Connected TV −100%, apagar Display en las Search, parche de negativas (tildes, `osde`, `pami`, `apross`; "cerca de mí" negativa SOLO en Multifocales y Recetados) | Agente | $0 | Deja de gastarse $12k/mes en "área de interés" y goteras conocidas |
| 5 | **SEO P0:** 301 de las ~55 páginas `/blog/busquedas/*` + borrar `aggregateRating` de `schema.ts` (limpia 4 páginas de una edición) | Agente (código, ~3h) | $0 | Elimina los dos riesgos de acción manual activos hoy |
| 6 | Crear la página `/multifocales` con 2x1 + condiciones + garantía 30 días con plazo explícito + cuotas — es bloqueante de política para los RSA nuevos | Agente escribe, dueña valida el texto | $0 | La landing que el head term y los anuncios necesitan |
| 7 | Medición: aceptar Términos de datos de clientes, activar enhanced conversions para leads, crear acción "Venta CRM" (valor importado, ARS, 90 días), y **test de allowlist** con `--validar` (con OK de la dueña para leer prod) | Agente | $0 | Sabemos esta semana si hay que portar a Data Manager API |
| 8 | Dueña: **cerrar la pregunta de obras sociales** (¿se trabaja alguna activamente sí o no?) | Dueña | $0 | Define negativas y el sitelink; hoy es un agujero que gasta |
| 9 | Congelar el Perfil de Empresa (no tocar fotos/posts/categorías durante el experimento de Maps) | Nadie — abstenerse | $0 | Que el experimento mida una sola cosa |

### ESTE MES (día 21: el Gran Corte · día 28: veredictos)

| # | Acción | Quién | Costo | Resultado esperado |
|---|---|---|---|---|
| 10 | **Día 21 — Gran Corte, todo en un solo día:** conversiones primarias = solo "Conversación iniciada" + "WhatsApp del sitio" (locales y llamadas a secundarias, nunca borradas; Tiendanube eliminadas) · presupuestos definitivos (tabla §4) · cirugía de Multifocales (grupos exacta/frase del mapa de keywords, prohibida la amplia) · campaña Marca + Cerro nueva con assets de ubicación · horario 9-21 corrido + sábado, domingo en observación · agregar Unquillo, Río Ceballos, Salsipuedes, Saldán y La Calera a las Search | Agente | Redistribución | UN solo reset de aprendizaje concentrado. **Avisar antes a la dueña: la columna "Conversiones" cae ~88% (deja de contar humo) y hay 2-4 semanas de valle** |
| 11 | Día 28: **veredicto de Maps** con 3 semanas de datos consolidados (las métricas del perfil demoran 2-4 días) + el conteo de mostrador | Director + dueña | — | Decisión permanente con datos, no con fe |
| 12 | Si el allowlist pasó: **backfill offline de 90 días con valor = `total` de la orden (no la seña cobrada** — corregir la línea del script antes) y prender el runtime en Railway con `VALIDATE_ONLY` una semana. Si no pasó: portar service+script a Data Manager API | Agente | $0 | La señal definitiva empieza a acumular |
| 13 | Post-experimento: **optimización del perfil de Google** — servicios completos, categorías, 2-4 fotos/semana, posts con vigencia, Q&A sembrado, WhatsApp del bot en la ficha si es elegible | Dueña a mano (guiada), 1h/semana | $0 | Frescura = ranking local 2026; el foso se profundiza gratis |
| 14 | Informe de términos de búsqueda semanal → negativas (scripts ya existentes). Única mano permitida sobre las campañas entre el día 21 y el 45 | Agente | $0 | El algoritmo necesita 2 semanas quietas |
| 15 | Histograma hora×día de chats entrantes del bot (script de solo lectura en `scripts/checks/`) | Agente | $0 | El calendario definitivo se recorta con datos propios, no de Google |

### TRIMESTRE (septiembre–noviembre)

| # | Acción | Quién | Gatillo | Resultado esperado |
|---|---|---|---|---|
| 16 | tCPA por campaña = CPA real observado +10% | Agente | 30 conversiones reales/30d en esa campaña | Estabiliza costo sin frenar volumen |
| 17 | Search a Maximizar valor de conversión | Agente | Venta CRM ≥15-30 conv atribuidas/30d | Google aprende que un multifocal ($834k promedio) vale 3,9 monofocales y puja acorde |
| 18 | G3 Miopía infantil ($1.000/d) + M3 en Meta, con su landing creada; RSA sin promesas de resultado en el hijo del lector | Agente | Mes 2, si el valle del corte ya pasó | Nicho de ticket alto sin competencia paga |
| 19 | Rebalanceo mensual: mover 10-15% del presupuesto de la plataforma más cara a la más barata por **$/venta atribuida**. Pisos: Google Search $250k/mes, Meta US$6/d. Techos: IS perdida <10% → el excedente va a Meta | Director + agente | 1 vez/mes, no más | La mezcla se decide con plata, no con opinión |
| 20 | Sol con receta (grupo N10) en octubre; recalibrar cualquier target de valor por inflación cada trimestre | Agente | Estacional | — |
| 21 | Revisar grupo de marca con Estadísticas de subastas: si nadie puja "atelier", bajarle el presupuesto al mínimo | Agente | Día 60 | No pagar por clics que ya eran nuestros |
| 22 | Escalar hacia ~$1M/mes total **solo si** el $/venta medido lo justifica y el local absorbe el volumen de chats | Dueña decide | Datos de 2 meses | Crecimiento comprado con evidencia |

---

## 3. MAPS — VEREDICTO ÚNICO

**Se pausa la campaña de Maps, hoy, y no vuelve como estaba. El pin se cubre gratis con assets de ubicación en las campañas de Search.**

Respuesta directa a la objeción de la dueña ("¿no aparecería primero? para eso sirve pagar"): **hoy pagás $131.000 por mes y NO aparecés primera — aparecés segunda patrocinada, abajo de Lens Cerro, con un anuncio con typo y restringido por Google.** El pin no se alquila: se subasta en cada búsqueda, y la subasta la está ganando el competidor. Primera ya estás, gratis, en el renglón orgánico, sostenida por 675 reseñas que Lens Cerro no puede comprar. Google es explícito en que pagar anuncios no protege ni mejora el ranking orgánico: son sistemas separados. Y el pin de Lens Cerro pesca compradores de Ray-Ban y sol de lujo — no présbitas con receta, que es el negocio de Atelier.

Pero incorporo la objeción legítima del especialista en riesgos: "0 chats en 90 días" no prueba que Maps no traiga gente al mostrador, porque el que toca "Cómo llegar" y entra al local jamás aparece como chat. Por eso el veredicto es **pausa con experimento bien diseñado, no pausa ciega**:

- **21 días** (no 14: las métricas del perfil demoran 2-4 días y una quincena sola es ruido), sin tocar PMax ni el perfil en la ventana, comparando contra las mismas semanas del mes anterior.
- Se mide: chats reales de WhatsApp (CRM), llamadas del perfil, **y la pregunta de mostrador anotada en ficha** — el único dato que arbitra walk-ins.
- **Gatillo de reversa:** solo si chats + llamadas + walk-ins declarados caen >20% sostenido, se reactiva — con anuncio corregido y horario 9-19, nunca más 24/7 hacia un local cerrado.
- Pronóstico que dejo por escrito: las ~350 "direcciones" de Ads se desploman (eran fabricadas por la puja) y las direcciones orgánicas del perfil quedan casi iguales. Ese contraste es la prueba visual para la dueña.

---

## 4. PRESUPUESTO FINAL Y PROYECCIÓN

**Total: ~$820.000/mes (−20% vs los $1.027.000 actuales). Mezcla 51/49.** Se arranca acá y se escala solo con $/venta medido (regla #19). Techo autorizado del trimestre: $900k con G3+M3.

**Google — $420.000/mes ($14.000/día):**

| Campaña | $/día | $/mes | Rol |
|---|---|---|---|
| Search Óptica (genérico local + grupo "cerca" a radio 5 km) | $5.000 | $150.000 | La mejor de la cuenta ($2.255/chat), hoy pierde 47% de impresiones por presupuesto |
| Search Recetados | $3.500 | $105.000 | Segunda mejor ($2.386/chat) |
| Search Multifocales (reconstruida: exactas, grupos precio/Varilux) | $2.500 | $75.000 | El producto estrella; hoy quema $29.425/chat en amplia |
| Search Marca + Cerro de las Rosas (nueva, con assets de ubicación) | $1.000 | $30.000 | Defensa del pin y de "atelier"; blindaje anti-conquesting |
| PMax (una sola, en cuarentena, bajo espada quincenal) | $2.000 | $60.000 | 44 chats/mes reales no se tiran; a la segunda quincena >$8.000/chat, se pausa |
| Maps + PMax Ventas nueva | $0 | $0 | Pausadas (nunca borradas) |

**Meta — $400.000/mes (US$9/día, sin tocar el primer mes):** multifocales US$4,5 · ATP US$2,5 · remarketing US$2. Recién optimizado el 7-8/8: se lo deja madurar. Mes 2, si Google entra en valle post-corte, Meta es el amortiguador natural de volumen.

**Proyección de chats/mes (banda honesta):**

| Canal | Hoy | Con el plan (día 60) |
|---|---|---|
| Google (reales) | 86 a $7.296 | **130-160 a $2.600-3.200** |
| Meta | ~900-1.500 (según se confirme el benchmark $250-270 o el histórico $448) | 900-1.500, misma banda |
| **Total** | ~1.000-1.600 | **~1.050-1.650, con $200k/mes menos de gasto** |

Digo lo que los especialistas insinuaron y nadie firmó: **el total de chats no explota en 60 días — se compra lo mismo o algo más con 20% menos, sin riesgo de sanción, y con la señal limpia que habilita escalar de verdad en el trimestre.** Vender otra cosa sería mentirle a la dueña. La economía de fondo cierra de sobra: aun a $2.600/chat con cierre 20-25%, el costo por venta multifocal es ~3% del margen.

---

## 5. LOS 5 NÚMEROS DE CADA SEMANA (tablero de la dueña)

1. **Conversaciones reales de WhatsApp por origen** (Google / Meta / orgánico-directo), del CRM — nunca de la columna "Conversiones" de Ads.
2. **$/conversación por plataforma** (Google limpio vs Meta). El día que se crucen raro, ahí va la plata del mes siguiente.
3. **% de impresiones perdidas por presupuesto en las 3 Search** — mientras esté arriba de 20% con $/chat ≤$3.500, hay crecimiento barato disponible; cuando llegue a ~0, más plata compra ranking, no clientes.
4. **Presupuestos enviados y ventas atribuidas** (chat → presupuesto queda asentado en la ficha; ventas vía carga offline) — la calidad del chat, no solo la cantidad.
5. **Salud de cuenta y foso:** cero anuncios en estado distinto de "Aprobado" + reseñas nuevas de la semana (respondidas al 100%). Es el número del mandato "cero sanciones" y del activo que sostiene todo lo demás.

---

## 6. QUÉ RECHACÉ Y POR QUÉ (el criterio a la vista)

1. **El "Gran Corte el día 15" (estructura) → movido al día 21.** Riesgos demostró que recortar PMax y cambiar conversiones en plena ventana del experimento de Maps lo vuelve ilegible (R2+R4). Cuesta ~$50k de PMax una semana más; compro con eso un experimento que la dueña pueda creer. Legibilidad > velocidad. Sí mantengo la lógica de estructura de concentrar TODOS los resets en un solo día — gotearlos sería peor.
2. **Negativizar "cerca de mí" en toda la cuenta (keywords, versión dura).** Riesgos tiene razón: que haya salido cara en una campaña rota de amplia QS 3 no prueba que sea mala. Queda el término VIVO en Search Óptica dentro del grupo controlado a radio 5 km y puja corta, negativa solo en Multifocales y Recetados. Se decide con el CPA del grupo, no por trauma.
3. **El titular "Calificación 5,0 en Google" en los RSA (anuncios lo proponía con reserva).** El doc propio de buenas prácticas lo marca zona gris y el mandato es cero riesgo: no se publica lo que uno mismo anotó como dudoso. Va solo "Más de 675 Reseñas en Google", que es factual y nadie puede objetar. Mismo criterio ya aplicado a "La Óptica Mejor Calificada": muerto.
4. **Pujar marcas de competidores.** Keywords y competencia coinciden, y firmo el porqué económico: la cuenta ya lo hizo sin querer — 35% del gasto visible de términos — con QS 2-3 y conversión casi nula. Además invita a la guerra recíproca sobre "atelier", que hoy nadie disputa. Reevaluable en 90 días; no antes, y solo "lens cerro" en exacta.
5. **Escenarios A ($1M) y C ($1,5M) de entrada (presupuesto los modeló).** El riesgo nº1 del plan es el techo de demanda de Córdoba (98,7% de las keywords sin gasto en 30 días). Se arranca en ~$820k, que ya financia todo lo estructural, y se escala con la regla mensual — no con proyecciones. C además exige validar que el local absorba 2.000+ chats/mes: cuello de atención, no de pauta.
6. **Experimento nocturno 21-24 y madrugada (horarios).** Diferido a mes 2, con su criterio de éxito preescrito (≥5 chats/franja a ≤$3.500) y solo tras 2 semanas de bot sin incidentes — el bot tiene historial de cola zombie y un clic nocturno a un chat mudo es plata quemada más un cliente enojado. La madrugada, nunca. La siesta y el 19-21, sí desde el día 21: eso es cultural, no de demanda.
7. **Campaña espejo para Carlos Paz/Punilla con tCPA 1,5× (horarios).** No se multiplican entidades mientras la cuenta esté en fase de aprendizaje con señal recién limpiada. Punilla queda cubierta por Multifocales/Recetados; se revisa en el trimestre.
8. **Páginas SEO por barrio y todo formato de doorway.** SEO lo dijo y lo firmo con énfasis: la cuenta va a DESHACER 55 doorways esta semana; crear otras con otro nombre sería absurdo. Los barrios van como sección "cómo llegar desde…" dentro de páginas existentes.
9. **Sitelink "Obras Sociales" incondicional (anuncios).** Congelado hasta la respuesta de la dueña (#8 de esta semana). Si no hay convenios activos, el sitelink sale y `pami/apross/osde` quedan en negativas — un anuncio que insinúa un convenio inexistente es exactamente el tipo de discrepancia que el mandato prohíbe. Las negativas de `pami`/`gratis` van hoy igual: ese usuario no compra Varilux con o sin convenio.
10. **Ponerle valor monetario proxy a los chats (idea que rondaba la mesa).** Medición lo mató bien: contaría la misma plata dos veces cuando entren las ventas offline con valor real. Chats por cantidad hoy, ventas por valor mañana, nunca mezclados.

**Firma:** la estrategia se sostiene en tres verdades verificadas — la señal actual de Google es 88% humo, el mejor canal de Atelier ya es gratis (5,0/675), y la única señal que no miente es la venta asentada en el CRM. Todo lo demás del plan son las consecuencias operativas de tomarse esas tres en serio. Se ejecuta el lunes: pasos 1-9 no requieren discusión, el Gran Corte tiene fecha (día 21) y aviso previo de valle, y ninguna decisión es irreversible salvo las que eliminan riesgo de sanción — esas no se revierten.

---
Producido por mesa de 10 especialistas (9 en paralelo + director de sintesis), 8/8/2026.
Expediente y datos crudos de la auditoria en el scratchpad de la sesion; auditoria Google Ads del mismo dia.
