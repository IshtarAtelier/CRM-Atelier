import { retryWithBackoff } from './retry-utils';

// Centraliza la URL del servidor WhatsApp en un solo lugar.
// En producción (Railway), se configura via variable de entorno WA_SERVER_URL.
// En desarrollo local, cae al default de 127.0.0.1:3100.
const WA_SERVER_URL = process.env.WA_SERVER_URL || 'http://127.0.0.1:3100';

export const ADMIN_PHONE_FALLBACK = '5493541215971';

export function getAdminChatId(): string {
    const adminPhone = process.env.ADMIN_PHONE || ADMIN_PHONE_FALLBACK;
    return adminPhone.includes('@') ? adminPhone : `${adminPhone.replace(/[^0-9]/g, '')}@c.us`;
}

export function fetchWa(url: string | URL, init?: RequestInit): Promise<Response> {
    const headers = new Headers(init?.headers);
    // La clave entre servicios es BOT_API_KEY: la misma que el bot usa para
    // llamar al CRM, así existe en los dos lados sin configurar nada nuevo.
    // El wa-service valida con esta misma preferencia (apiAuth en su index.js)
    // — si se cambia el orden acá, cambiarlo allá también.
    const apiKey = process.env.BOT_API_KEY || process.env.WA_API_KEY;
    if (apiKey) {
        headers.set('x-api-key', apiKey);
    }
    
    const resolvedUrl = typeof url === 'string' && url.startsWith('/')
        ? `${WA_SERVER_URL}${url}`
        : url;

    // Timeout duro por intento: si el wa-service no responde (p.ej. cola/sesión
    // colgada), abortamos en vez de esperar para siempre. Un AbortError no es
    // "transitorio", así que retryWithBackoff no lo reintenta en bucle.
    const FETCH_TIMEOUT_MS = 100000;

    // 🔴 Reintentar SOLO lo idempotente.
    //
    // `POST /api/send` NO es idempotente: si el wa-service ya le pasó el mensaje
    // a Meta y la respuesta se pierde (timeout, 502 del proxy, socket cortado),
    // el reintento manda el mensaje DE NUEVO. El cliente lo recibe dos veces y
    // Meta cobra dos conversaciones. Con el reintento de abajo (cloud-transport)
    // el peor caso eran 3×3 = 9 envíos por un solo click de "Enviar".
    //
    // Regla: GET/HEAD (estado, chats, catálogo) pueden reintentarse; todo lo que
    // muta —POST/PUT/PATCH/DELETE— se intenta UNA sola vez y, ante la duda, se
    // le dice la verdad al vendedor ("verificá si le llegó") en vez de duplicar.
    const method = (init?.method || 'GET').toUpperCase();
    const esIdempotente = method === 'GET' || method === 'HEAD';

    return retryWithBackoff(
        async () => {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
            try {
                const res = await fetch(resolvedUrl, {
                    ...init,
                    headers,
                    signal: init?.signal ?? controller.signal
                });
                // Retry transient 5xx server status codes
                if (!res.ok && [502, 503, 504].includes(res.status)) {
                    throw Object.assign(
                        new Error(`WhatsApp API responded with transient status ${res.status}`),
                        { status: res.status }
                    );
                }
                return res;
            } finally {
                clearTimeout(timer);
            }
        },
        {
            maxRetries: esIdempotente ? 3 : 1,
            delayMs: 500,
            maxDelayMs: 2000,
            label: `WhatsApp API (${url})`
        }
    );
}
