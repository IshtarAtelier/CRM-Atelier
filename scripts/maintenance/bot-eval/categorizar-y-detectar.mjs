/**
 * categorizar-y-detectar.mjs — Segunda etapa del pipeline de bot-eval.
 * NO toca ninguna base: lee el dump crudo que emitió minar-conversaciones.mjs
 * y produce `conversaciones-reales.json` (conversaciones donde participó el
 * Bot, categorizadas por intención y con fallas detectadas por heurística).
 *
 * Uso:
 *   node scripts/maintenance/bot-eval/categorizar-y-detectar.mjs /ruta/dump-crudo.json
 *
 * Escribe conversaciones-reales.json en esta misma carpeta e imprime por
 * stdout un resumen (distribución de categorías sobre TODO el dump y
 * frecuencia de cada falla).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const dumpPath = process.argv[2];
if (!dumpPath) { console.error('Uso: node categorizar-y-detectar.mjs <dump-crudo.json>'); process.exit(1); }
const dump = JSON.parse(fs.readFileSync(dumpPath, 'utf8'));

const norm = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/**
 * Anonimiza identificadores numéricos largos dentro del texto: teléfonos,
 * CBU/CVU, CUIT. Toda tira de 9+ dígitos (aunque tenga espacios o guiones
 * en el medio) queda reducida a sus últimos 4 dígitos.
 */
const scrub = (s) => (s || '').replace(/\d[\d\s.\-]{7,}\d/g, (m) => {
  const digits = m.replace(/\D/g, '');
  return digits.length >= 9 ? `…${digits.slice(-4)}` : m;
});

// Orden = prioridad: la primera categoría que matchea gana.
const CATEGORIAS = [
  ['reclamo', /(reclam|queja|se rompio|se me rompio|rayad|garantia|devolucion|devolver|no veo bien|me duele|mareo|no me sirv|mal hecho|defect|flojo el tornillo|se salio)/],
  ['estado_pedido', /(mi pedido|mis lentes|estan listos|esta listo|ya esta|ya estan|cuando (lo|los|la|las)? ?(retiro|estaria|estarian|llega)|para cuando|retirar|encargue|pedido n|listo para retirar|habia encargado|mande a hacer)/],
  ['obra_social', /(obra social|prepaga|cobertura|reintegro|osde|swiss medical|pami|apross|galeno|sancor|jerarquic|daspu|mutual|federada|omint|descuento por (la )?obra)/],
  ['multifocales', /(multifocal|progresiv|bifocal|cerca y (de )?lejos|lejos y (de )?cerca|varilux)/],
  ['receta_graduacion', /(receta|graduacion|aumento de|dioptria|miopia|astigmatismo|hipermetrop|oculista|oftalmolog|formula|od |oi |esf |cil )/],
  ['consulta_precio', /(precio|cuanto sale|cuanto cuesta|cuanto esta|cuanto me sale|valor|cotiz|presupuest|cuanto saldria|que precio|cuanto vale)/],
  ['compra_armazon_sol', /(armazon|lentes de sol|anteojos de sol|gafas|modelo|ray.?ban|vulk|marcos?|clip.?on|de sol|receta blanca|para ver|anteojos)/],
  ['turno_visita', /(turno|cuando puedo ir|puedo pasar|horario|a que hora|abren|cierran|atienden|direccion|donde estan|donde queda|ubicad|como llego)/],
];

function categorizar(conv) {
  const entrantes = conv.mensajes.filter((m) => m.quien === 'cliente').map((m) => norm(m.texto)).join(' \n ');
  if (!entrantes.trim()) return 'otro';
  for (const [cat, re] of CATEGORIAS) if (re.test(entrantes)) return cat;
  if (conv.adTag || /\[meta/i.test(entrantes)) return 'contacto_post_campana';
  return 'otro';
}

const PIDE_HUMANO = /(hablar con (alguien|una persona|un humano|un asesor)|persona real|sos un bot|es un bot|atiende alguien|me pueden llamar|llamame|quiero que me atienda|con ishtar|con matias)/;
const SALUDO_BOT = /^(hola|buen dia|buenos dias|buenas tardes|buenas noches|¡hola)/;

function detectarProblemas(conv) {
  const problemas = [];
  const msgs = conv.mensajes;
  const frag = (t) => scrub((t || '').slice(0, 200));

  // 1. Saludo repetido: el bot arranca saludando 2+ veces en el mismo hilo.
  const saludos = msgs.filter((m) => m.quien === 'Bot' && SALUDO_BOT.test(norm(m.texto)));
  if (saludos.length >= 2) {
    problemas.push({ tipo: 'repite_saludo', detalle: `El bot saludó ${saludos.length} veces en el mismo hilo`, fragmento: frag(saludos[1].texto) });
  }

  // 2. Respuesta idéntica repetida (pérdida de contexto / loop).
  const vistos = new Map();
  for (const m of msgs) {
    if (m.quien !== 'Bot' || m.texto.length < 30) continue;
    const k = norm(m.texto);
    if (vistos.has(k)) { problemas.push({ tipo: 'respuesta_repetida', detalle: 'El bot mandó dos veces exactamente el mismo texto', fragmento: frag(m.texto) }); break; }
    vistos.set(k, true);
  }

  // 3. No derivó: el cliente pidió un humano y el siguiente saliente fue del Bot.
  for (let i = 0; i < msgs.length; i++) {
    if (msgs[i].quien === 'cliente' && PIDE_HUMANO.test(norm(msgs[i].texto))) {
      const sig = msgs.slice(i + 1).find((m) => m.quien !== 'cliente');
      if (sig && sig.quien === 'Bot') {
        problemas.push({ tipo: 'no_deriva_a_humano', detalle: 'El cliente pidió hablar con una persona y siguió contestando el bot', fragmento: `Cliente: "${frag(msgs[i].texto)}" → Bot: "${frag(sig.texto)}"` });
        break;
      }
    }
  }

  // 4. Pregunta del cliente sin respuesta (último entrante con "?" y nadie contestó).
  const ultimo = msgs[msgs.length - 1];
  if (ultimo && ultimo.quien === 'cliente' && /\?/.test(ultimo.texto)) {
    problemas.push({ tipo: 'pregunta_sin_respuesta', detalle: 'La conversación termina con una pregunta del cliente sin contestar', fragmento: frag(ultimo.texto) });
  }

  // 5. Menciona precio con $ — revisar a mano si es inventado (el bot no
  //    debería cotizar cristales sin receta).
  const conPrecio = msgs.find((m) => m.quien === 'Bot' && /\$\s?[\d.]{4,}/.test(m.texto));
  if (conPrecio) {
    problemas.push({ tipo: 'precio_citado_revisar', detalle: 'El bot citó un precio en pesos — verificar contra lista vigente', fragmento: frag(conPrecio.texto) });
  }

  // 6. Respuesta genérica ante pregunta concreta: cliente pregunta con "?" y
  //    el bot responde corto sin datos (sin números, sin dirección, <90 chars).
  for (let i = 0; i < msgs.length - 1; i++) {
    if (msgs[i].quien !== 'cliente' || !/\?/.test(msgs[i].texto) || msgs[i].texto.length < 15) continue;
    const sig = msgs.slice(i + 1).find((m) => m.quien !== 'cliente');
    if (sig && sig.quien === 'Bot' && sig.texto.length < 90 && !/\d/.test(sig.texto) && /(consultar|un asesor|en breve|te responder|no tengo|no cuento|no dispongo)/.test(norm(sig.texto))) {
      problemas.push({ tipo: 'respuesta_generica', detalle: 'Pregunta concreta respondida con evasiva genérica', fragmento: `Cliente: "${frag(msgs[i].texto)}" → Bot: "${frag(sig.texto)}"` });
      break;
    }
  }

  // 7. Horario incorrecto: el horario real es L-V 8-20 y Sáb 9-17
  //    (business-info.ts). El bot venía informando el horario viejo.
  const malHorario = msgs.find((m) => m.quien === 'Bot' && /(9 a 13:?30|16 a 19:?30|s.bados? de 10 a 14)/i.test(m.texto));
  if (malHorario) {
    problemas.push({ tipo: 'horario_incorrecto', detalle: 'Informó el horario viejo (real: L-V 8 a 20, Sáb 9 a 17)', fragmento: frag(malHorario.texto) });
  }

  // 8. Descuento desactualizado: la promo vigente es 15% (efectivo y transferencia).
  const malDesc = msgs.find((m) => m.quien === 'Bot' && /20% de descuento/i.test(m.texto));
  if (malDesc) {
    problemas.push({ tipo: 'descuento_desactualizado', detalle: 'Mencionó 20% de descuento (promo vigente: 15%)', fragmento: frag(malDesc.texto) });
  }

  return problemas;
}

// Chats internos del equipo o de prueba: no son clientes, no van al dataset.
const ES_INTERNO = (c) => c.mensajes.some((m) => /ALERTA: FALLA EN BOT|Nuevo Cliente en CRM|\*\[Mat.as\]\*|\*\[Ishtar\]\*|poniendo a prueba el bot/i.test(m.texto));

// ── Distribución de categorías sobre TODO el dump ────────────────────────────
const distTotal = {};
for (const c of dump) { const cat = categorizar(c); distTotal[cat] = (distTotal[cat] || 0) + 1; }

// ── Dataset final: solo conversaciones donde participó el Bot ────────────────
const conBot = dump.filter((c) => c.stats.salientesBot > 0 && !ES_INTERNO(c));
const fallas = {};
const dataset = conBot.map((c, idx) => {
  const categoria = categorizar(c);
  const problemas = detectarProblemas(c);
  for (const p of problemas) fallas[p.tipo] = (fallas[p.tipo] || 0) + 1;
  return {
    id: `conv-${String(idx + 1).padStart(3, '0')}`,
    telefono: c.telefono,
    nombre: c.nombre,
    categoria,
    resumen: c.chatSummary ? scrub(c.chatSummary.slice(0, 400)) : null,
    adTag: c.adTag,
    turnos: c.mensajes.map((m) => ({
      quien: m.quien === 'cliente' ? 'cliente' : (m.quien === 'Bot' ? 'bot' : 'humano'),
      firmante: m.quien === 'cliente' ? undefined : m.quien,
      texto: scrub(m.texto),
      fecha: m.fecha,
    })),
    problemas_detectados: problemas,
  };
});

fs.writeFileSync(path.join(AQUI, 'conversaciones-reales.json'), JSON.stringify(dataset, null, 1));
console.log(JSON.stringify({
  totalDump: dump.length,
  distribucionCategoriasTodoElDump: distTotal,
  conversacionesConBot: conBot.length,
  distribucionCategoriasConBot: dataset.reduce((a, c) => ((a[c.categoria] = (a[c.categoria] || 0) + 1), a), {}),
  frecuenciaFallas: fallas,
  conProblemas: dataset.filter((d) => d.problemas_detectados.length > 0).length,
}, null, 2));
