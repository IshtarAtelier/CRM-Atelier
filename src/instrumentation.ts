// Cron automático SmartLab — corre cada 15 minutos de 8am a 18pm (Argentina, UTC-3)
export async function register() {
    if (process.env.NEXT_RUNTIME === 'nodejs') {
        const INTERVAL_MS = 15 * 60 * 1000; // 15 minutos

        const isBusinessHours = () => {
            const now = new Date();
            // Argentina es UTC-3
            const argHour = (now.getUTCHours() - 3 + 24) % 24;
            return argHour >= 8 && argHour <= 18;
        };

        const runSync = async () => {
            if (!isBusinessHours()) {
                console.log('[CRON SmartLab] Fuera de horario (7-18 ARG). Saltando.');
                return;
            }
            console.log('[CRON SmartLab] Iniciando sync automático...');
            try {
                const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_URL || `http://localhost:${process.env.PORT || 3000}`;
                const res = await fetch(`${baseUrl}/api/cron/smartlab-sync?secret=atelier-smartlab-2026`, {
                    method: 'GET',
                    headers: { 'Content-Type': 'application/json' },
                });
                const data = await res.json();
                console.log(`[CRON SmartLab] Resultado: ${data.matched || 0} actualizados, ${data.newlyFinished || 0} fabricados`);
            } catch (err) {
                console.error('[CRON SmartLab] Error:', err);
            }
        };

        // Esperar 30 segundos después del inicio para el primer sync
        setTimeout(() => {
            runSync();
            setInterval(runSync, INTERVAL_MS);
        }, 30000);

        console.log('[CRON SmartLab] Programado: cada 15 minutos, 8am-18pm ARG');
    }
}
