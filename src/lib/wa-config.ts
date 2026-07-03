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
    if (process.env.WA_API_KEY) {
        headers.set('x-api-key', process.env.WA_API_KEY);
    }
    
    const resolvedUrl = typeof url === 'string' && url.startsWith('/')
        ? `${WA_SERVER_URL}${url}`
        : url;

    // Timeout duro por intento: si el wa-service no responde (p.ej. cola/sesión
    // colgada), abortamos en vez de esperar para siempre. Un AbortError no es
    // "transitorio", así que retryWithBackoff no lo reintenta en bucle.
    const FETCH_TIMEOUT_MS = 70000;

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
            maxRetries: 3,
            delayMs: 500,
            maxDelayMs: 2000,
            label: `WhatsApp API (${url})`
        }
    );
}
