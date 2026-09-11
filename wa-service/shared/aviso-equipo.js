/**
 * Avisarle algo al EQUIPO desde el wa-service. Llega como mensaje del sistema
 * a la mensajería interna del CRM (`/api/bot/aviso-equipo` → `avisarAlEquipo`).
 *
 * Decisión de Ishtar (10/9/2026): los avisos de "algo falló / hace falta una
 * persona" van a Mensajes del equipo; la campanita de Tareas es SOLO lo que
 * programa un vendedor. Antes el bot los dejaba como ClientTask con "⚠️", que
 * la campanita ya no muestra: sin este camino, "el bot pidió ayuda" quedaba
 * sin nadie que lo viera en el panel.
 *
 * Una ruta y no un INSERT directo: la mensajería tiene reglas propias (hilos,
 * participantes, dedup de 20 h) que no se copian a mano en otro servicio.
 *
 * Nunca lanza: un aviso que rompe la conversación es peor que el silencio.
 */

const axios = require('axios');

/**
 * @param {{ asunto: string, cuerpo: string, urgente?: boolean }} aviso
 *   `asunto` es también la llave del dedup: tiene que distinguir un caso de
 *   otro (nombre o número), o dos casos del mismo día se pisan.
 * @returns {Promise<boolean>} true si le llegó al menos a una persona.
 */
async function avisarAlEquipo({ asunto, cuerpo, urgente = false }) {
    const base = process.env.CRM_API_URL;
    const key = process.env.BOT_API_KEY;
    if (!base || !key) {
        console.error('[Aviso equipo] Falta CRM_API_URL o BOT_API_KEY: no se pudo avisar:', asunto);
        return false;
    }
    try {
        const r = await axios.post(`${base}/aviso-equipo`, { asunto, cuerpo, urgente }, {
            headers: { 'x-api-key': key },
            timeout: 15000,
        });
        return r.data?.ok === true;
    } catch (err) {
        console.error('[Aviso equipo] No se pudo avisar:', asunto, '—', err.message);
        return false;
    }
}

module.exports = { avisarAlEquipo };
