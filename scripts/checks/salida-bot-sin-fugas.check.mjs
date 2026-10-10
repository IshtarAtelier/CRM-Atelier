/**
 * Lo que el bot NUNCA le puede mandar a un cliente. Sin base ni red (también en CI).
 *
 *   npm run check:salida-bot
 *
 * Cada caso es un mensaje que de verdad salió a producción:
 *  - 4/10: razonamiento interno en inglés ("I have already confirmed… I should not respond").
 *  - 21/9: "El cliente agradeció. Te espero…" (hablaba DEL cliente).
 *  - 8 y 9/10: copió las notas del historial ("Respetá lo que ya dijo y no lo repitas.]")
 *    y reenvió los mensajes de una vendedora.
 *  - 14/8: "desde [precio]" sin completar.
 * Si alguien afloja `wa-service/shared/limpiar-salida-bot.js`, esto falla.
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { limpiarSalidaBot } = require('../../wa-service/shared/limpiar-salida-bot.js');

const NO_PUEDE_SALIR = [
    /\b(?:the|should|according|instructions|user)\b/i,
    /el cliente|seg[uú]n las instrucciones|no debo responder/i,
    /Respet[áa] lo que ya dijo|Lo escrib|NO vos/i,
    /\[(?!IMAGE:)[^\]]*\]|\]/,
];
const casos = [
    "I have already confirmed that a call will be scheduled for tomorrow and the user has thanked me.\n\nAccording to the instructions, I should not respond further if the client's last message doesn't require a new action.",
    'El cliente agradeció. Te espero si tenés alguna otra consulta 😊',
    '😊\n\nRespetá lo que ya dijo y no lo repitas.] Dale Juanma, te esperamos mañana. Un abrazo!\n\nLo confirmo y te escribo en un ratito',
    'Respetá lo que ya dijo y no lo repitas.] Dale! Cuando puedas!',
    '[mié, 8 oct, 16:24] [Lo escribió Mile, del equipo] hola',
    'Hola Vaidaa! La promo 2x1 es desde [precio]. Pasate por Tejeda 4380.',
];
// Lo que SÍ tiene que salir intacto.
const INTACTOS = [
    'Hola Luciano, cómo estás? contame un poquito qué estás necesitando',
    'Dale, cuando la tengas me la pasás. trabajamos con todas las obras sociales y prepagas.',
    'Ray-Ban Clubmaster Classic, el más vendido 👉 https://atelieroptica.com.ar/tienda',
    'Te paso fotitos [IMAGE: https://atelieroptica.com.ar/a.jpg]',
];

let fallas = 0;
for (const c of casos) {
    const { texto } = limpiarSalidaBot(c);
    const mal = NO_PUEDE_SALIR.find(re => re.test(texto));
    if (mal) { fallas++; console.log(`  ❌ salió: "${texto.slice(0, 80)}"`); }
}
for (const c of INTACTOS) {
    const { texto } = limpiarSalidaBot(c);
    if (texto !== c) { fallas++; console.log(`  ❌ se tocó un mensaje sano: "${c.slice(0, 60)}" → "${texto.slice(0, 60)}"`); }
}
if (fallas) { console.log(`\n❌ ${fallas} caso(s) de fuga.`); process.exit(1); }
console.log(`✅ Salida del bot: ${casos.length} fugas reales bloqueadas, ${INTACTOS.length} mensajes sanos intactos.`);
