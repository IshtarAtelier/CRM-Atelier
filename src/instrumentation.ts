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

        /**
         * RECLAMA una corrida para UNA SOLA instancia.
         *
         * Hoy hay dos procesos ejecutando este mismo archivo, así que el patrón
         * "leer el guard y después escribirlo" no alcanza: los dos leen el valor
         * viejo y los dos disparan. Un UPDATE condicional (`updateMany` con
         * `NOT: { value }`) es atómico en Postgres — exactamente uno ve
         * `count === 1`. El que gana recibe el valor ANTERIOR (para poder
         * devolverlo si su corrida falla); el que pierde recibe `null`.
         */
        const reclamarCorrida = async (key: string, valor: string): Promise<string | null> => {
            const { prisma } = await import('@/lib/db');
            const previo = (await prisma.systemSetting.findUnique({ where: { key } }))?.value ?? null;
            if (previo === valor) return null; // ya corrió (o lo está corriendo la otra)
            if (previo === null) {
                // Nadie lo corrió nunca: la unicidad de `key` deja pasar a uno solo.
                try {
                    await prisma.systemSetting.create({ data: { key, value: valor } });
                    return '';
                } catch {
                    return null;
                }
            }
            const tomado = await prisma.systemSetting.updateMany({
                where: { key, value: previo },
                data: { value: valor },
            });
            return tomado.count === 1 ? previo : null;
        };

        /** Devuelve el guard a su valor anterior cuando la corrida reclamada falló. */
        const devolverCorrida = async (key: string, valor: string, previo: string | null) => {
            if (previo === null) return;
            try {
                const { prisma } = await import('@/lib/db');
                await prisma.systemSetting.updateMany({ where: { key, value: valor }, data: { value: previo } });
            } catch (err) {
                console.error(`[CRON] No se pudo devolver el guard ${key}:`, err);
            }
        };

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

            // ¿Otro proceso/reinicio ya lo corrió hoy?
            //
            // ANTES ERA LEER-Y-DESPUÉS-ESCRIBIR, y eso no es un candado: dos
            // instancias leían el valor viejo, las dos lo daban por no corrido y
            // las dos disparaban. Medido en LabAuditRun: la conciliación corría
            // DOS VECES todos los días, sin faltar uno, con 2 a 7 minutos de
            // diferencia — y por eso cada aviso llegaba duplicado y desde dos
            // remitentes distintos. Ahora se RECLAMA el día con un UPDATE
            // condicional, que en Postgres es atómico: de las dos instancias,
            // exactamente una ve `count === 1` y es la única que corre.
            let reclamoPrevio: string | null = null;
            try {
                reclamoPrevio = await reclamarCorrida(DAILY_KEY, dateKey);
                if (reclamoPrevio === null) {
                    dailyRanForDate = dateKey;
                    return; // lo tomó la otra instancia
                }
            } catch (err) {
                console.error('[CRON lab-invoices] No se pudo reclamar el día (se intenta igual):', err);
            }

            dailyRunning = true;
            console.log(`[CRON lab-invoices] Disparando conciliación diaria (${dateKey})...`);
            try {
                const res = await fetch(`${baseUrl}/api/cron/lab-invoices?secret=${cronSecret}&days=35`, {
                    method: 'GET',
                    headers: { 'Content-Type': 'application/json' },
                    // El diario hace IMAP 35 días + portal GO: puede tardar. Tope amplio
                    // para no dejarlo colgado eternamente.
                    // 25 min y no 9,5: la conciliación entra al portal de Grupo
                    // Óptico, que durante la migración tarda minutos por paso
                    // (8/9/26). Con 9,5 el fetch abortaba a mitad de una corrida
                    // que iba a terminar bien. Corre una vez por día: que tarde
                    // media hora no molesta a nadie.
                    signal: AbortSignal.timeout(25 * 60 * 1000),
                });
                if (!res.ok) {
                    const body = await res.text();
                    console.error(`[CRON lab-invoices] HTTP ${res.status}: ${body} — se reintenta en el próximo tick.`);
                    // El día quedó reclamado por nosotros y la corrida falló: se
                    // devuelve el valor anterior para que el próximo tick lo pueda
                    // volver a tomar. Sin esto, reclamar de antemano convertiría
                    // cualquier falla en "hoy ya corrió" y el diario se saltearía
                    // el día entero.
                    await devolverCorrida(DAILY_KEY, dateKey, reclamoPrevio);
                    return;
                }
                // Corrió OK: el día ya quedó marcado al reclamarlo. Solo la memoria.
                dailyRanForDate = dateKey;
                const data = await res.json().catch(() => ({}));
                console.log(`[CRON lab-invoices] Diario OK (${dateKey}). stale=${JSON.stringify(data.stale ?? [])} backfill=${JSON.stringify(data.backfill ?? [])}`);
            } catch (err) {
                console.error('[CRON lab-invoices] Error disparando el diario (se reintenta):', err);
                await devolverCorrida(DAILY_KEY, dateKey, reclamoPrevio);
            } finally {
                dailyRunning = false;
            }
        };

        // ---- REPORTE SEMANAL DE LABORATORIO, auto-disparado ----
        //
        // Es el que trae la CUENTA CORRIENTE al día de los dos laboratorios, y
        // NUNCA CORRIÓ: la ruta existía desde siempre pero no la disparaba nadie
        // —no estaba acá y no hay rastro de que se diera de alta en cron-job.org—,
        // así que ese reporte no llegó una sola vez. Lo mismo le pasaba a
        // `laboratorios-semanal`, que se dispara junto con este.
        //
        // Viernes a las 9:30 ARG, que es para cuando la ruta fue pensada
        // ("correr los viernes/domingos y dejar al día la tratativa").
        const SEMANAL_KEY = 'lab_weekly_report_last_run';
        const SEMANAL_DIA = 5; // viernes
        const SEMANAL_HORA = 9;
        const SEMANAL_MIN = 30;
        let semanalRunning = false;

        const maybeRunSemanalLab = async () => {
            const { hour, minute, dateKey } = argNow();
            // Día de la semana en hora argentina, del mismo dateKey que ya se calculó.
            const diaSemana = new Date(`${dateKey}T12:00:00Z`).getUTCDay();
            if (diaSemana !== SEMANAL_DIA) return;
            if (hour < SEMANAL_HORA || (hour === SEMANAL_HORA && minute < SEMANAL_MIN)) return;
            if (semanalRunning) return;

            const cronSecret = process.env.CRON_SECRET;
            if (!cronSecret) return;

            let previo: string | null = null;
            try {
                previo = await reclamarCorrida(SEMANAL_KEY, dateKey);
                if (previo === null) return; // ya corrió, o lo tomó la otra instancia
            } catch (err) {
                console.error('[CRON lab-weekly-report] No se pudo reclamar la semana:', err);
                return;
            }

            semanalRunning = true;
            try {
                for (const ruta of ['lab-weekly-report', 'laboratorios-semanal']) {
                    const res = await fetch(`${baseUrl}/api/cron/${ruta}?secret=${cronSecret}`, {
                        method: 'GET',
                        signal: AbortSignal.timeout(10 * 60 * 1000),
                    });
                    if (!res.ok) throw new Error(`${ruta} respondió HTTP ${res.status}: ${await res.text()}`);
                    console.log(`[CRON ${ruta}] Semanal OK (${dateKey}).`);
                }
            } catch (err) {
                console.error('[CRON lab-weekly-report] Falló el semanal (se reintenta en el próximo tick):', err);
                await devolverCorrida(SEMANAL_KEY, dateKey, previo);
            } finally {
                semanalRunning = false;
            }
        };

        // ---- REPORTE DIARIO DE ADS y CIERRE DE MES, auto-disparados ----
        //
        // Los dos existían como ruta y no los llamaba nadie. Medido el 8/9/2026:
        // el de ads no salía desde el 10/8 y el cierre de mes desde el 17/7 —
        // faltaban los cierres de JULIO y AGOSTO enteros, que es la foto de
        // facturación y ganancia del negocio.
        //
        // Ads a las 10:00 (ya cerró el día anterior en Meta). Cierre de mes el
        // día 1 a las 10:30, que es lo que la ruta espera: sin `?month=`,
        // los primeros días reportan el mes anterior completo.
        const ADS_KEY = 'ads_report_last_run';
        const CIERRE_KEY = 'month_close_last_run';
        let adsRunning = false;
        let cierreRunning = false;

        const dispararSimple = async (
            ruta: string, key: string, dateKey: string, etiqueta: string,
        ) => {
            const cronSecret = process.env.CRON_SECRET;
            if (!cronSecret) return;
            let previo: string | null = null;
            try {
                previo = await reclamarCorrida(key, dateKey);
                if (previo === null) return;
            } catch (err) {
                console.error(`[CRON ${etiqueta}] No se pudo reclamar la corrida:`, err);
                return;
            }
            try {
                const res = await fetch(`${baseUrl}/api/cron/${ruta}?secret=${cronSecret}`, {
                    method: 'GET',
                    signal: AbortSignal.timeout(10 * 60 * 1000),
                });
                if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
                console.log(`[CRON ${etiqueta}] OK (${dateKey}).`);
            } catch (err) {
                console.error(`[CRON ${etiqueta}] Falló (se reintenta en el próximo tick):`, err);
                await devolverCorrida(key, dateKey, previo);
            }
        };

        const maybeRunAds = async () => {
            const { hour, dateKey } = argNow();
            if (hour < 10 || adsRunning) return;
            adsRunning = true;
            try { await dispararSimple('ads-report', ADS_KEY, dateKey, 'ads-report'); }
            finally { adsRunning = false; }
        };

        const maybeRunCierreMes = async () => {
            const { hour, minute, dateKey } = argNow();
            if (!dateKey.endsWith('-01')) return;           // solo el día 1
            if (hour < 10 || (hour === 10 && minute < 30)) return;
            if (cierreRunning) return;
            cierreRunning = true;
            try { await dispararSimple('month-close', CIERRE_KEY, dateKey, 'month-close'); }
            finally { cierreRunning = false; }
        };

        // ---- RESUMEN DIARIO DEL EQUIPO, auto-disparado ----
        // Mismo patrón que el diario de arriba, y por el mismo motivo: acá adentro
        // no depende de ningún despertador externo que pueda pausarse en silencio.
        //
        // A las 9:00 ARG, después de la conciliación: así el resumen ya refleja lo
        // que el robot grande haya cerrado esa mañana.
        const RESUMEN_KEY = 'resumen_equipo_last_run';
        const RESUMEN_HORA = 9;
        let resumenRanForDate: string | null = null;
        let resumenRunning = false;

        const maybeRunResumen = async () => {
            const { hour, dateKey } = argNow();
            if (hour < RESUMEN_HORA) return;
            if (resumenRanForDate === dateKey || resumenRunning) return;

            const cronSecret = process.env.CRON_SECRET;
            if (!cronSecret) return;

            // Guarda persistente: un reinicio no vuelve a mandarle el resumen a
            // todo el equipo. (La ruta además tiene su propio dedupe por fecha,
            // así que son dos redes: esta evita el trabajo, aquella el duplicado.)
            try {
                const { prisma } = await import('@/lib/db');
                const row = await prisma.systemSetting.findUnique({ where: { key: RESUMEN_KEY } });
                if (row?.value === dateKey) { resumenRanForDate = dateKey; return; }
            } catch (err) {
                console.error('[CRON resumen-equipo] No se pudo leer el guard diario (se intenta igual):', err);
            }

            resumenRunning = true;
            try {
                // El secreto va en la CABECERA y no en la URL: los query params
                // terminan en los logs de acceso y en el historial del navegador.
                const res = await fetch(`${baseUrl}/api/cron/resumen-diario-equipo`, {
                    method: 'GET',
                    headers: { Authorization: `Bearer ${cronSecret}` },
                    signal: AbortSignal.timeout(5 * 60 * 1000),
                });
                if (!res.ok) {
                    console.error(`[CRON resumen-equipo] HTTP ${res.status} — se reintenta en el próximo tick.`);
                    return; // NO marcar el día: reintenta
                }
                const data = await res.json();
                console.log(`[CRON resumen-equipo] Enviado a: ${(data.enviados || []).join(', ') || 'nadie'}`);
                try {
                    const { prisma } = await import('@/lib/db');
                    await prisma.systemSetting.upsert({
                        where: { key: RESUMEN_KEY },
                        update: { value: dateKey },
                        create: { key: RESUMEN_KEY, value: dateKey },
                    });
                } catch (err) {
                    console.error('[CRON resumen-equipo] No se pudo persistir el guard:', err);
                }
                resumenRanForDate = dateKey;
            } catch (err) {
                console.error('[CRON resumen-equipo] Error disparando el resumen (se reintenta):', err);
            } finally {
                resumenRunning = false;
            }
        };

        // ---- SALUD DIARIA DE WHATSAPP (API oficial), 9:15 ARG ----
        // /api/cron/whatsapp-calidad figuraba como "dar de alta en cron-job.org
        // al migrar" y nunca se dio de alta. Mismo patrón que el resumen: guard
        // persistente, reintento si falla, sin despertador externo.
        const CALIDAD_KEY = 'whatsapp_calidad_last_run';
        let calidadRanForDate: string | null = null;
        let calidadRunning = false;
        const maybeRunCalidad = async () => {
            const { hour, minute, dateKey } = argNow();
            if (hour < 9 || (hour === 9 && minute < 15)) return;
            if (calidadRanForDate === dateKey || calidadRunning) return;
            const cronSecret = process.env.CRON_SECRET;
            if (!cronSecret) return;
            try {
                const { prisma } = await import('@/lib/db');
                const row = await prisma.systemSetting.findUnique({ where: { key: CALIDAD_KEY } });
                if (row?.value === dateKey) { calidadRanForDate = dateKey; return; }
            } catch (err) {
                console.error('[CRON whatsapp-calidad] No se pudo leer el guard diario (se intenta igual):', err);
            }
            calidadRunning = true;
            try {
                const res = await fetch(`${baseUrl}/api/cron/whatsapp-calidad`, {
                    method: 'GET',
                    headers: { Authorization: `Bearer ${cronSecret}` },
                    signal: AbortSignal.timeout(3 * 60 * 1000),
                });
                if (!res.ok) { console.error(`[CRON whatsapp-calidad] HTTP ${res.status} — se reintenta en el próximo tick.`); return; }
                try {
                    const { prisma } = await import('@/lib/db');
                    await prisma.systemSetting.upsert({ where: { key: CALIDAD_KEY }, update: { value: dateKey }, create: { key: CALIDAD_KEY, value: dateKey } });
                } catch (err) {
                    console.error('[CRON whatsapp-calidad] No se pudo persistir el guard:', err);
                }
                calidadRanForDate = dateKey;
            } catch (err) {
                console.error('[CRON whatsapp-calidad] Error disparando el chequeo (se reintenta):', err);
            } finally {
                calidadRunning = false;
            }
        };

        // ---- RECORDATORIO DE RETIRO (pedido listo), una vez por hora ----
        // /api/cron/pickup-reminder avisa al cliente que su pedido está listo
        // cuando el lab lo terminó hace más de 24 h y nadie lo pasó a READY. Ese
        // cron figuraba en vercel.json, que Railway NO ejecuta, y en dos docs
        // como "pendiente de dar de alta en cron-job.org": nunca corrió, y los
        // pedidos FINISHED se quedaban sin aviso (reporte de Ishtar del 3/9/26:
        // "no están llegando los avisos de que el pedido está listo"). Acá
        // adentro corre sí o sí mientras el server esté vivo, como el resto.
        //
        // Una vez por hora y en horario de local: la ruta reintenta sola lo que
        // falló (deja el pedido FINISHED), y cada fallo genera una tarea al
        // vendedor — cada 10 min sería una tarea nueva por pedido cada 10 min.
        const PICKUP_KEY = 'pickup_reminder_last_hour';
        let pickupLastHourKey: string | null = null;
        let pickupRunning = false;
        const maybeRunPickupReminder = async () => {
            const { hour, dateKey } = argNow();
            if (hour < 9 || hour >= 20) return;
            const hourKey = `${dateKey}T${hour}`;
            if (pickupLastHourKey === hourKey || pickupRunning) return;
            const cronSecret = process.env.CRON_SECRET;
            if (!cronSecret) return;
            // ESTE MANDA MENSAJES AL CLIENTE, así que el guard no puede vivir solo
            // en la memoria del proceso: con dos instancias corriendo este archivo
            // —y con los redeploys, que reinician la memoria— la misma hora se
            // disparaba más de una vez y la persona podía recibir dos veces el
            // aviso de que su pedido está listo. Se reclama la hora en la base.
            let previoPickup: string | null = null;
            try {
                previoPickup = await reclamarCorrida(PICKUP_KEY, hourKey);
                if (previoPickup === null) { pickupLastHourKey = hourKey; return; }
            } catch (err) {
                console.error('[CRON pickup-reminder] No se pudo reclamar la hora:', err);
                return; // ante la duda NO se manda: un aviso repetido es peor que uno tarde
            }
            pickupRunning = true;
            try {
                const res = await fetch(`${baseUrl}/api/cron/pickup-reminder`, {
                    method: 'GET',
                    headers: { Authorization: `Bearer ${cronSecret}` },
                    signal: AbortSignal.timeout(5 * 60 * 1000),
                });
                if (!res.ok) {
                    console.error(`[CRON pickup-reminder] HTTP ${res.status} — se reintenta en el próximo tick.`);
                    await devolverCorrida(PICKUP_KEY, hourKey, previoPickup);
                    return;
                }
                pickupLastHourKey = hourKey;
                const data = await res.json().catch(() => ({}));
                if (data.processed) console.log(`[CRON pickup-reminder] ${data.processed} pendiente(s): ${JSON.stringify(data.results ?? [])}`);
            } catch (err) {
                console.error('[CRON pickup-reminder] Error disparando el recordatorio (se reintenta):', err);
            } finally {
                pickupRunning = false;
            }
        };

        // ---- RECUPERO DE CARRITOS ABANDONADOS, una vez por hora ----
        // Mismo caso que el pickup-reminder: el schedule estaba declarado en
        // `vercel.json`, que Railway NO ejecuta, y la ruta lo dice en su propio
        // comentario ("el alta hay que hacerla en el scheduler externo"). Nadie
        // la hizo. Resultado: desde que existe el recupero multi-toque no salió
        // NUNCA un mail de carrito abandonado — ni el recordatorio de la hora ni
        // el de las 24hs con el cupón.
        //
        // Una vez por hora es lo que pide la ruta: con una corrida diaria el
        // toque temprano casi nunca cae dentro de su ventana de 1h a 24h.
        // Horario de local (9-20 ARG) a propósito: son mails a clientes reales
        // y a las 4 de la mañana no se manda nada. Un carrito abandonado de
        // noche entra en la primera corrida de la mañana, todavía adentro de la
        // ventana de 72hs.
        const CARRITOS_KEY = 'abandoned_carts_last_hour';
        let carritosLastHourKey: string | null = null;
        let carritosRunning = false;
        const maybeRunCarritos = async () => {
            const { hour, dateKey } = argNow();
            if (hour < 9 || hour >= 20) return;
            const hourKey = `${dateKey}T${hour}`;
            if (carritosLastHourKey === hourKey || carritosRunning) return;
            const cronSecret = process.env.CRON_SECRET;
            if (!cronSecret) return;
            // Mismo motivo que el recordatorio de retiro: esto le escribe al
            // cliente, y con dos instancias más los redeploys la memoria del
            // proceso no alcanza para garantizar "una vez por hora".
            let previoCarritos: string | null = null;
            try {
                previoCarritos = await reclamarCorrida(CARRITOS_KEY, hourKey);
                if (previoCarritos === null) { carritosLastHourKey = hourKey; return; }
            } catch (err) {
                console.error('[CRON abandoned-carts] No se pudo reclamar la hora:', err);
                return;
            }
            carritosRunning = true;
            try {
                const res = await fetch(`${baseUrl}/api/cron/abandoned-carts`, {
                    method: 'GET',
                    headers: { Authorization: `Bearer ${cronSecret}` },
                    signal: AbortSignal.timeout(5 * 60 * 1000),
                });
                if (!res.ok) {
                    console.error(`[CRON abandoned-carts] HTTP ${res.status} — se reintenta en el próximo tick.`);
                    await devolverCorrida(CARRITOS_KEY, hourKey, previoCarritos);
                    return;
                }
                carritosLastHourKey = hourKey;
                const data = await res.json().catch(() => ({}));
                if (data.processed) {
                    console.log(`[CRON abandoned-carts] ${data.processed} carrito(s): ${data.early || 0} recordatorios (1h), ${data.late || 0} con cupón (24h), ${data.sinCanal || 0} sin mail, ${data.failed || 0} fallidos`);
                }
            } catch (err) {
                console.error('[CRON abandoned-carts] Error disparando el recupero (se reintenta):', err);
            } finally {
                carritosRunning = false;
            }
        };

        // ---- RECORDATORIOS DE TURNO, una vez por hora ----
        // Dos avisos distintos, los dos desde `/api/cron/turnos-recordatorio`:
        // al EQUIPO la lista de los turnos de hoy (a primera hora, uno solo por
        // día) y al CLIENTE el recordatorio del turno de mañana.
        //
        // Va acá adentro y no en un scheduler externo por lo mismo que el
        // pickup-reminder y los carritos: los que se declararon en `vercel.json`
        // nunca corrieron, porque Railway no lo ejecuta y nadie los dio de alta
        // afuera. Un recordatorio que no sale no se nota hasta que el cliente
        // no viene.
        //
        // Horario de local: son mensajes a clientes reales, no se mandan de
        // madrugada. La ruta se encarga sola de no repetir (marca la tarea).
        let turnosLastHourKey: string | null = null;
        let turnosRunning = false;
        const maybeRunTurnos = async () => {
            const { hour, dateKey } = argNow();
            if (hour < 9 || hour >= 20) return;
            const hourKey = `${dateKey}T${hour}`;
            if (turnosLastHourKey === hourKey || turnosRunning) return;
            const cronSecret = process.env.CRON_SECRET;
            if (!cronSecret) return;
            turnosRunning = true;
            try {
                const res = await fetch(`${baseUrl}/api/cron/turnos-recordatorio`, {
                    method: 'GET',
                    headers: { Authorization: `Bearer ${cronSecret}` },
                    signal: AbortSignal.timeout(5 * 60 * 1000),
                });
                if (!res.ok) {
                    console.error(`[CRON turnos] HTTP ${res.status} — se reintenta en el próximo tick.`);
                    return;
                }
                turnosLastHourKey = hourKey;
                const data = await res.json().catch(() => ({}));
                if (data.avisadosCliente || data.turnosDeHoy) {
                    console.log(`[CRON turnos] ${data.avisadosCliente} recordatorio(s) al cliente · ${data.turnosDeHoy} turno(s) hoy · equipo avisado: ${data.avisoAlEquipo}`);
                }
            } catch (err) {
                console.error('[CRON turnos] Error disparando los recordatorios (se reintenta):', err);
            } finally {
                turnosRunning = false;
            }
        };

        // ---- MOTOR DE SEGUIMIENTOS, una vez por hora ----
        // `/api/cron/seguimientos` manda solo los toques del embudo que el
        // playbook dice que tocan hoy. Diseño en docs/plan-motor-seguimientos.md.
        // Modo real desde el 11/9/2026 (MODO_POR_DEFECTO en constants/seguimientos.ts). El horario y el
        // cupo los decide la ruta; acá solo se evita llamarla de madrugada.
        // Guard persistente de la hora: el motor LE ESCRIBE A CLIENTES, y con dos
        // instancias corriendo este archivo, la variable en memoria no alcanza.
        const SEGUIMIENTOS_KEY = 'seguimientos_ultima_hora';
        let seguimientosLastHourKey: string | null = null;
        let seguimientosRunning = false;
        const maybeRunSeguimientos = async () => {
            const { hour, dateKey } = argNow();
            if (hour < 9 || hour >= 20) return;
            const hourKey = `${dateKey}T${hour}`;
            if (seguimientosLastHourKey === hourKey || seguimientosRunning) return;
            const cronSecret = process.env.CRON_SECRET;
            if (!cronSecret) return;
            seguimientosRunning = true;
            // RECLAMO atómico, igual que los otros robots que escriben a clientes
            // (arreglo del 8/9/2026). Sin esto, en modo real las dos instancias
            // mandaban la misma plantilla a la misma persona.
            let previo: string | null = null;
            try {
                previo = await reclamarCorrida(SEGUIMIENTOS_KEY, hourKey);
                if (previo === null) { seguimientosLastHourKey = hourKey; return; }
                const res = await fetch(`${baseUrl}/api/cron/seguimientos`, {
                    method: 'GET',
                    headers: { Authorization: `Bearer ${cronSecret}` },
                    // 15 envíos con pausas de ~10 s son ~3 min; margen para que un
                    // tick lento no se corte a la mitad y quede sin registrar.
                    signal: AbortSignal.timeout(10 * 60 * 1000),
                });
                if (!res.ok) {
                    console.error(`[CRON seguimientos] HTTP ${res.status} — se reintenta en el próximo tick.`);
                    await devolverCorrida(SEGUIMIENTOS_KEY, hourKey, previo);
                    return;
                }
                seguimientosLastHourKey = hourKey;
                const data = await res.json().catch(() => ({}));
                const salieron = Array.isArray(data.enviados) ? data.enviados.length : 0;
                const habrian = Array.isArray(data.habrianSalido) ? data.habrianSalido.length : 0;
                console.log(`[CRON seguimientos] modo ${data.modo} · candidatos ${data.candidatos ?? 0} · ${data.modo === 'seco' ? `habrían salido ${habrian}` : `salieron ${salieron}`} · vetados ${data.vetados?.length ?? 0}`);
            } catch (err) {
                console.error('[CRON seguimientos] Error disparando el motor (se reintenta):', err);
                if (previo !== null) await devolverCorrida(SEGUIMIENTOS_KEY, hourKey, previo);
            } finally {
                seguimientosRunning = false;
            }
        };

        // ---- RECORDATORIO DE SALDO PENDIENTE, una vez por hora ----
        // `/api/cron/recordatorio-saldo` le escribe al cliente cuyo pedido está
        // listo, ya avisado, y a los 7 días sigue con saldo sin pagar. Una sola
        // vez: el segundo golpe lo decide una persona.
        let saldoLastHourKey: string | null = null;
        let saldoRunning = false;
        const maybeRunSaldo = async () => {
            const { hour, dateKey } = argNow();
            if (hour < 9 || hour >= 20) return;
            const hourKey = `${dateKey}T${hour}`;
            if (saldoLastHourKey === hourKey || saldoRunning) return;
            const cronSecret = process.env.CRON_SECRET;
            if (!cronSecret) return;
            saldoRunning = true;
            try {
                const res = await fetch(`${baseUrl}/api/cron/recordatorio-saldo`, {
                    method: 'GET',
                    headers: { Authorization: `Bearer ${cronSecret}` },
                    signal: AbortSignal.timeout(5 * 60 * 1000),
                });
                if (!res.ok) {
                    console.error(`[CRON recordatorio-saldo] HTTP ${res.status} — se reintenta en el próximo tick.`);
                    return;
                }
                saldoLastHourKey = hourKey;
                const data = await res.json().catch(() => ({}));
                if (data.enviados?.length || data.salteados?.length) {
                    console.log(`[CRON recordatorio-saldo] ${data.enviados?.length ?? 0} recordatorio(s) · ${data.salteados?.length ?? 0} salteado(s)`);
                }
            } catch (err) {
                console.error('[CRON recordatorio-saldo] Error disparando el recordatorio (se reintenta):', err);
            } finally {
                saldoRunning = false;
            }
        };

        // ---- Pase RÁPIDO SmartLab (robot chico), cada 10 min ----
        const runSync = async () => {
            // El diario se evalúa en cada tick, independiente del horario del pase
            // rápido (aunque 08:30 cae dentro de 8-20, esto lo deja robusto).
            maybeRunDaily().catch(err => console.error('[CRON lab-invoices] maybeRunDaily:', err));
            maybeRunSemanalLab().catch(err => console.error('[CRON lab-weekly-report] maybeRunSemanalLab:', err));
            maybeRunAds().catch(err => console.error('[CRON ads-report] maybeRunAds:', err));
            maybeRunCierreMes().catch(err => console.error('[CRON month-close] maybeRunCierreMes:', err));
            maybeRunResumen().catch(err => console.error('[CRON resumen-equipo] maybeRunResumen:', err));
            maybeRunPickupReminder().catch(err => console.error('[CRON pickup-reminder] maybeRunPickupReminder:', err));
            maybeRunCalidad().catch(err => console.error('[CRON whatsapp-calidad] maybeRunCalidad:', err));
            maybeRunCarritos().catch(err => console.error('[CRON abandoned-carts] maybeRunCarritos:', err));
            maybeRunTurnos().catch(err => console.error('[CRON turnos] maybeRunTurnos:', err));
            maybeRunSeguimientos().catch(err => console.error('[CRON seguimientos] maybeRunSeguimientos:', err));
            maybeRunSaldo().catch(err => console.error('[CRON recordatorio-saldo] maybeRunSaldo:', err));

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
                    // 14 min y no 9,5: desde el 7/9/26 el login reintenta hasta 3 veces
                    // (el portal de Grupo Óptico está lento y migrando), y en el
                    // peor caso son 5 min solo para entrar más el scraping. Con
                    // 9,5 el fetch abortaba a mitad de un pase que iba a terminar
                    // bien, y el log decía "falló" sobre una corrida sana. El
                    // solapamiento con el tick siguiente lo previene `isSyncing`.
                    // 25 min: el login solo puede llevarse 5 (ver ESPERA_MS en
                    // smartlab.service.ts) y después falta recorrer la lista de
                    // pedidos, con el portal en migración. `isSyncing` impide que
                    // dos corridas se pisen, así que un pase largo simplemente
                    // hace que el tick siguiente se saltee.
                    signal: AbortSignal.timeout(25 * 60 * 1000),
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

        console.log('[CRON SmartLab] Programado: cada 10 minutos, 8am-20pm ARG (+ conciliación diaria ~8:30 ARG + resumen del equipo ~9:00 ARG + carritos abandonados por hora)');
    }
}
