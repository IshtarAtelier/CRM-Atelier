// Cron automático SmartLab — corre cada 10 minutos de 8am a 20pm (Argentina, UTC-3).
// Además del sync de estados, cada corrida hace el pase rápido de conciliación de
// costos de Grupo Óptico (importes nuevos + alertas inmediatas) — ver la ruta.
export async function register() {
    if (process.env.NEXT_RUNTIME === 'nodejs') {
        const INTERVAL_MS = 10 * 60 * 1000; // 10 minutos (pedido: revisión cada 10 min)

        const isBusinessHours = () => {
            const now = new Date();
            // Argentina es UTC-3
            const argHour = (now.getUTCHours() - 3 + 24) % 24;
            return argHour >= 8 && argHour <= 20;
        };

        const runSync = async () => {
            if (!isBusinessHours()) {
                console.log('[CRON SmartLab] Fuera de horario (8-20 ARG). Saltando.');
                return;
            }
            console.log('[CRON SmartLab] Iniciando sync automático...');
            try {
                const cronSecret = process.env.CRON_SECRET;
                if (!cronSecret) {
                    console.error('[CRON SmartLab] CRON_SECRET no está configurado. Abortando.');
                    return;
                }
                const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_URL || `http://localhost:${process.env.PORT || 3000}`;
                const res = await fetch(`${baseUrl}/api/cron/smartlab-sync?secret=${cronSecret}`, {
                    method: 'GET',
                    headers: { 'Content-Type': 'application/json' },
                });
                if (!res.ok) {
                    const body = await res.text();
                    console.error(`[CRON SmartLab] HTTP ${res.status}: ${body}`);
                    return;
                }
                const data = await res.json();
                if (data.skipped) {
                    console.log(`[CRON SmartLab] Omitido: ${data.reason}`);
                } else {
                    console.log(`[CRON SmartLab] Resultado: ${data.matched || 0} actualizados, ${data.newlyFinished || 0} fabricados`);
                }
            } catch (err) {
                console.error('[CRON SmartLab] Error de conexión:', err);
            }
        };

        // Esperar 30 segundos después del inicio para el primer sync
        setTimeout(() => {
            runSync();
            setInterval(runSync, INTERVAL_MS);
        }, 30000);

        console.log('[CRON SmartLab] Programado: cada 10 minutos, 8am-20pm ARG');
    }
}
