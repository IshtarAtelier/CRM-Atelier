// Cron automático SmartLab — corre cada 10 minutos de 8am a 20pm (Argentina, UTC-3).
// Además del sync de estados, cada corrida hace el pase rápido de conciliación de
// costos de Grupo Óptico (importes nuevos + alertas inmediatas) — ver la ruta.
//
// El MISMO scheduler interno dispara además, una vez por día (~8:30 ARG), la
// conciliación DIARIA completa (/api/cron/lab-invoices). Antes eso dependía de un
// despertador externo (cron-job.org): si se pausaba o quedaba con el secret viejo,
// el robot grande no corría y las alertas de costos quedaban mudas. Al vivir acá
// adentro ya no depende de nada externo — corre sí o sí mientras el server esté vivo.
export async function register() {
    if (process.env.NEXT_RUNTIME === 'nodejs') {
        const INTERVAL_MS = 10 * 60 * 1000; // 10 minutos (pedido: revisión cada 10 min)

        // Hora/fecha de pared en Argentina (UTC-3), con corte de día correcto.
        const argNow = () => {
            const d = new Date(Date.now() - 3 * 3600 * 1000); // corrido a ARG; leer campos en UTC
            const pad = (n: number) => String(n).padStart(2, '0');
            return {
                hour: d.getUTCHours(),
                minute: d.getUTCMinutes(),
                dateKey: `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`,
            };
        };
        const isBusinessHours = () => {
            const { hour } = argNow();
            return hour >= 8 && hour <= 20;
        };

        const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_URL || `http://localhost:${process.env.PORT || 3000}`;

        // ---- Conciliación DIARIA (robot grande), auto-disparada ----
        // Objetivo: 08:30 ARG. Garantías: una sola corrida por día, reintento si
        // falla, sin solaparse consigo misma, y resiliente a reinicios (persiste el
        // día ya corrido en SystemSetting). Si el server estuvo caído toda la mañana
        // y arranca 14:00, igual corre ese día (mejor tarde que nunca).
        const DAILY_KEY = 'lab_recon_daily_last_run'; // 'YYYY-MM-DD' ARG del último día que corrió OK
        const DAILY_TARGET_HOUR = 8;
        const DAILY_TARGET_MIN = 30;
        let dailyRanForDate: string | null = null; // memoria del proceso
        let dailyRunning = false;

        const maybeRunDaily = async () => {
            const { hour, minute, dateKey } = argNow();
            // ¿Ya pasó la hora objetivo de hoy?
            const pastTarget = hour > DAILY_TARGET_HOUR || (hour === DAILY_TARGET_HOUR && minute >= DAILY_TARGET_MIN);
            if (!pastTarget) return;
            if (dailyRanForDate === dateKey || dailyRunning) return;

            const cronSecret = process.env.CRON_SECRET;
            if (!cronSecret) {
                console.error('[CRON lab-invoices] CRON_SECRET no está configurado. No se dispara el diario.');
                return;
            }

            // ¿Otro proceso/reinicio ya lo corrió hoy? (persistente)
            try {
                const { prisma } = await import('@/lib/db');
                const row = await prisma.systemSetting.findUnique({ where: { key: DAILY_KEY } });
                if (row?.value === dateKey) {
                    dailyRanForDate = dateKey;
                    return;
                }
            } catch (err) {
                console.error('[CRON lab-invoices] No se pudo leer el guard diario (se intenta igual):', err);
            }

            dailyRunning = true;
            console.log(`[CRON lab-invoices] Disparando conciliación diaria (${dateKey})...`);
            try {
                const res = await fetch(`${baseUrl}/api/cron/lab-invoices?secret=${cronSecret}&days=35`, {
                    method: 'GET',
                    headers: { 'Content-Type': 'application/json' },
                    // El diario hace IMAP 35 días + portal GO: puede tardar. Tope amplio
                    // para no dejarlo colgado eternamente.
                    signal: AbortSignal.timeout(9.5 * 60 * 1000),
                });
                if (!res.ok) {
                    const body = await res.text();
                    console.error(`[CRON lab-invoices] HTTP ${res.status}: ${body} — se reintenta en el próximo tick.`);
                    return; // NO marcar el día: reintenta al próximo tick
                }
                // Corrió OK: marcar el día (persistente + memoria) para no repetir.
                try {
                    const { prisma } = await import('@/lib/db');
                    await prisma.systemSetting.upsert({
                        where: { key: DAILY_KEY },
                        update: { value: dateKey },
                        create: { key: DAILY_KEY, value: dateKey },
                    });
                } catch (err) {
                    console.error('[CRON lab-invoices] Corrió OK pero no se pudo persistir el guard diario:', err);
                }
                dailyRanForDate = dateKey;
                const data = await res.json().catch(() => ({}));
                console.log(`[CRON lab-invoices] Diario OK (${dateKey}). stale=${JSON.stringify(data.stale ?? [])} backfill=${JSON.stringify(data.backfill ?? [])}`);
            } catch (err) {
                console.error('[CRON lab-invoices] Error disparando el diario (se reintenta):', err);
            } finally {
                dailyRunning = false;
            }
        };

        // ---- Pase RÁPIDO SmartLab (robot chico), cada 10 min ----
        const runSync = async () => {
            // El diario se evalúa en cada tick, independiente del horario del pase
            // rápido (aunque 08:30 cae dentro de 8-20, esto lo deja robusto).
            maybeRunDaily().catch(err => console.error('[CRON lab-invoices] maybeRunDaily:', err));

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
                const res = await fetch(`${baseUrl}/api/cron/smartlab-sync?secret=${cronSecret}`, {
                    method: 'GET',
                    headers: { 'Content-Type': 'application/json' },
                    // Tope de 9,5 min: un sync colgado no debe pisarse con el
                    // siguiente disparo del intervalo ni quedar esperando eterno.
                    signal: AbortSignal.timeout(9.5 * 60 * 1000),
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

        console.log('[CRON SmartLab] Programado: cada 10 minutos, 8am-20pm ARG (+ conciliación diaria interna ~8:30 ARG)');
    }
}
