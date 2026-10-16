# Banco de pruebas conversacionales del bot de WhatsApp

Corre el **turno real** del bot (`wa-service/bot-cloud.js` → `handleInbound` →
debounce → `processBotTurn`: fase de la charla, clasificador de entrantes,
grafo con prompts/CORE_RULES/módulos, `responder_al_cliente`/`no_responder`,
saneador, `armarRespuesta` con `quitarRepeticiones` y burbujas, punto de salida
del transporte) en conversaciones de varios turnos. El cliente lo juega otro
LLM con una persona y un objetivo; hay además guiones fijos para lo
determinístico (silencios, contestadores, proveedores). Cada charla se puntúa
con chequeos determinísticos (precios, links, ¿¡, emojis, inglés, corchetes,
preguntas por turno, silencio) y con un LLM-juez (temperatura 0) contra una
rúbrica A–H.

**Usa IA PAGA** (Gemini, la `GOOGLE_GENAI_API_KEY` del `.env`, el mismo modelo
del bot): ~40 charlas de hasta 8 turnos. Si la API contesta 402/429 el banco
frena y lo dice.

## Qué NO hace (y cómo está garantizado)

- **No envía nada a WhatsApp.** El transporte real (`transport/cloud-transport.js`)
  nunca se carga: se reemplaza por uno falso que pasa por el MISMO punto de
  salida (`conPuntoDeSalida`) y solo registra.
- **No escribe en ninguna base.** `wa-service/db.js` y `@prisma/client` se
  reemplazan por una base EN MEMORIA (`prisma-en-memoria.cjs`); el CRM
  (`axios` → `/api/bot/*`) lo atiende `entorno-aislado.cjs` en el mismo
  proceso. `/pricing` corre la ruta REAL del repo contra el catálogo volcado
  de producción; tareas, notas, quejas, PDFs y etiquetas se registran y
  devuelven un OK realista.
- **Guardia de red**: `fetch`, `http`, `https` y `axios` solo pueden ir a
  Gemini. Cualquier otro destino falla y queda en `bloqueosDeRed` del resumen.
- El proceso arranca **sin variables de entorno** salvo la clave de Gemini.

## Uso

```bash
# 1. Catálogo de producción (solo SELECT, sesión READ ONLY), FUERA del repo:
bash scripts/maintenance/bot-eval/banco/armar-fixtures.sh /tmp/banco-bot/fixtures

# 2. Probar la cañería gratis (modelo falso, solo guiones):
node scripts/maintenance/bot-eval/banco/correr-banco.cjs --fixtures /tmp/banco-bot/fixtures --salida /tmp/banco-bot/simulacro --simulacro

# 3. Corrida real (paga):
node scripts/maintenance/bot-eval/banco/correr-banco.cjs --fixtures /tmp/banco-bot/fixtures --salida /tmp/banco-bot/corrida [--solo id1,id2] [--paralelo 3] [--sin-juez]
```

`--salida` tiene que estar fuera del repo: los transcripts no se commitean.
Deja un `<escenario>.json` por charla (turnos, burbujas, herramientas pedidas,
precios devueltos, escrituras simuladas, logs del turno, fallas determinísticas
y veredicto del juez) y un `_resumen.json`.

Los escenarios viven en `escenarios.cjs` (nombres y datos inventados; las
aperturas de anuncio son los textos precargados reales de cada anuncio).
`BANCO_VERBOSO=1` muestra los logs del bot por consola.
