// Centraliza la URL del servidor WhatsApp en un solo lugar.
// En producción (Railway), se configura via variable de entorno WA_SERVER_URL.
// En desarrollo local, cae al default de 127.0.0.1:3100.
const WA_SERVER_URL = process.env.WA_SERVER_URL || 'http://127.0.0.1:3100';

export function fetchWa(url: string | URL, init?: RequestInit): Promise<Response> {
    const headers = new Headers(init?.headers);
    if (process.env.WA_API_KEY) {
        headers.set('x-api-key', process.env.WA_API_KEY);
    }
    
    const resolvedUrl = typeof url === 'string' && url.startsWith('/')
        ? `${WA_SERVER_URL}${url}`
        : url;

    return fetch(resolvedUrl, {
        ...init,
        headers
    });
}
