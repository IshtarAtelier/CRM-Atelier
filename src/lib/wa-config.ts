// Centraliza la URL del servidor WhatsApp en un solo lugar.
// En producción (Railway), se configura via variable de entorno WA_SERVER_URL.
// En desarrollo local, cae al default de 127.0.0.1:3100.
export const WA_SERVER_URL = process.env.WA_SERVER_URL || 'http://127.0.0.1:3100';
