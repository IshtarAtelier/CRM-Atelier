import { prisma } from '@/lib/db';
import { sendEmail } from '@/lib/email';
import { fetchWa, getAdminChatId } from '@/lib/wa-config';
import { LabCostReconciliationService } from './lab-cost-reconciliation.service';

interface ScrapedDetail {
    num: string;
    sector: string;
    progress: number;
    entryDate: string;
    days: number;
}

let isSyncing = false;

export class SmartLabService {
    /**
     * Sincroniza los pedidos de Grupo Óptico con el sistema SmartLab.
     * Retorna el número de pedidos actualizados y recién finalizados.
     */
    static async syncOrders() {
        if (isSyncing) {
            console.log('[SmartLab Sync] Ya hay una sincronización en curso. Omitiendo.');
            return { skipped: true, reason: 'already_running' };
        }
        isSyncing = true;

        try {
            const lastSyncOrder = await prisma.order.findFirst({
                where: { smartLabLastSync: { not: null } },
                orderBy: { smartLabLastSync: 'desc' },
                select: { smartLabLastSync: true }
            });
            
            if (lastSyncOrder?.smartLabLastSync) {
                const minsSinceLastSync = (Date.now() - lastSyncOrder.smartLabLastSync.getTime()) / 60000;
                if (minsSinceLastSync < 14) { // Use 14 just in case to allow 15m intervals safely
                    console.log(`[SmartLab Sync] Omitido. La última sincronización fue hace ${Math.round(minsSinceLastSync)} mins.`);
                    isSyncing = false;
                    return { skipped: true, reason: 'too_soon' };
                }
            }
        } catch (err) {
            isSyncing = false;
            throw err;
        }
        let browser;
        try {
            const { chromium } = await import('playwright');
            browser = await chromium.launch({
                headless: true,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-gpu',
                ],
            });
            const context = await browser.newContext();
            const page = await context.newPage();

            // ── Login ──────────────────────────────────
            await page.goto('https://grupooptico.dyndns.info/smartlab/auth/authSmartlab/login', { waitUntil: 'domcontentloaded' });
            await page.waitForSelector('input', { timeout: 10000 });

            const inputs = await page.$$('input');
            if (inputs.length < 2) throw new Error('No se encontraron los campos de login en SmartLab.');

            await page.waitForTimeout(2000);
            await inputs[0].fill('pisano.ishtar@gmail.com');
            await page.waitForTimeout(1500);
            await inputs[1].fill('atelier');
            await page.waitForTimeout(2000);

            const buttons = await page.$$('button');
            let loginClicked = false;
            for (const btn of buttons) {
                const text = await btn.innerText();
                if (text.toLowerCase().includes('iniciar') || text.toLowerCase().includes('ingresar') || text.toLowerCase().includes('login')) {
                    await page.waitForTimeout(1000);
                    await Promise.all([
                        page.waitForNavigation({ waitUntil: 'domcontentloaded' }),
                        btn.click({ delay: 300 })
                    ]);
                    loginClicked = true;
                    break;
                }
            }
            if (!loginClicked) {
                await Promise.all([
                    page.waitForNavigation({ waitUntil: 'domcontentloaded' }),
                    inputs[1].press('Enter', { delay: 200 })
                ]);
            }
            console.log('[SmartLab Sync] Login exitoso');

            // ── Navegar a lista ──────────────────────────
            console.log('[SmartLab Sync] Navegando a lista de pedidos...');
            await page.goto('https://grupooptico.dyndns.info/smartlab/laboratory/list', { waitUntil: 'domcontentloaded' });
            
            console.log('[SmartLab Sync] Esperando a que carguen los campos de búsqueda...');
            await page.waitForSelector('input[type="text"]', { timeout: 15000 }).catch(() => console.log('Timeout esperando inputs'));
            await page.waitForTimeout(2000);

            // ── Limpiar Filtro de Fechas y Cambiar a 100 registros para ver pedidos trabados ──
            let stuckOrdersList: any[] = [];
            const portalOrdersSeen: { num: string; client: string; date: string }[] = [];
            try {
                console.log('[SmartLab Sync] Limpiando filtro de fechas via DOM...');
                await page.evaluate(() => {
                    const el = document.querySelector('input[placeholder="Seleccionar fechas"]') as HTMLInputElement | null;
                    if (el) {
                        el.value = '';
                        el.dispatchEvent(new Event('input', { bubbles: true }));
                        el.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                });
                await page.waitForTimeout(1000);

                const applyBtn = await page.$('button:has-text("Aplicar"), button:has-text("filtros"), a:has-text("Aplicar")');
                if (applyBtn) {
                    console.log('[SmartLab Sync] Aplicando filtros...');
                    await applyBtn.click({ delay: 300 });
                    await page.waitForTimeout(4000);
                }

                console.log('[SmartLab Sync] Seleccionando 100 registros por página...');
                await page.selectOption('select', '100').catch(() => {});
                await page.waitForTimeout(4000);

                // Scrapear pedidos trabados en validación / ingreso pendiente por más de 2 días
                const rows = await page.$$('table tbody tr');
                for (const row of rows) {
                    const cells = await row.$$('td');
                    if (cells.length < 5) continue;
                    
                    const num = (await cells[0].innerText() || '').trim();
                    const client = (await cells[1].innerText() || '').trim();
                    const dateStr = (await cells[2].innerText() || '').trim();
                    const sector = (await cells[3].innerText() || '').trim().replace(/\n/g, ' ');
                    const progressColText = (await cells[4].innerText() || '').trim().replace(/\n/g, ' ');

                    // Guardar todo pedido visible del portal para el control de huérfanos
                    if (/\d{4,}/.test(num)) portalOrdersSeen.push({ num, client, date: dateStr });

                    let progress = 0;
                    const progressMatch = progressColText.match(/([\d.]+)\s*%/);
                    if (progressMatch) progress = Math.round(parseFloat(progressMatch[1]));
                    
                    // Calcular días transcurridos
                    let days = 0;
                    const m = dateStr.match(/^(\d{2})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})$/);
                    if (m) {
                        const day = parseInt(m[1]);
                        const month = parseInt(m[2]) - 1;
                        const year = 2000 + parseInt(m[3]);
                        const hour = parseInt(m[4]);
                        const min = parseInt(m[5]);
                        const entryDate = new Date(year, month, day, hour, min);
                        const diffTime = Math.abs(Date.now() - entryDate.getTime());
                        days = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                    }
                    
                    const sectorLower = sector.toLowerCase();
                    const progressLower = progressColText.toLowerCase();
                    const isStuckText = sectorLower.includes('pendiente') || sectorLower.includes('validación') || progressLower.includes('pendiente');
                    const isLowProgress = progress < 15;

                    if ((isStuckText || isLowProgress) && days >= 2) {
                        stuckOrdersList.push({
                            num,
                            client: client || 'Sin especificar',
                            dateStr,
                            sector,
                            progress: `${progress}%`,
                            days
                        });
                    }
                }
                console.log(`[SmartLab Sync] Se encontraron ${stuckOrdersList.length} pedidos trabados/pendientes.`);
            } catch (errScrape) {
                console.error('[SmartLab Sync] Error al obtener pedidos trabados:', errScrape);
            }

            // ── Excluir pedidos ANULADOS de los trabados: la tabla HTML no muestra
            // ese estado, pero la API JSON del portal sí (campo Anulado) ──
            if (stuckOrdersList.length > 0) {
                try {
                    const clientId = process.env.SMARTLAB_CLIENT_ID || '2462';
                    const pendingNums = new Set(
                        stuckOrdersList.map(o => (o.num.match(/\d{4,}/) || [])[0]).filter(Boolean)
                    );
                    const anulados = new Set<string>();
                    for (let current = 1; current <= 10 && pendingNums.size > 0; current++) {
                        const url = `https://grupooptico.dyndns.info/smartlab-api-v2/public/index.php/laboratory/order/list?rowPerPage=100&current=${current}` +
                            `&isClient=1&isSeller=0&userId=${clientId}&sellerId=0` +
                            `&search=&invoiceNumber=&sector=0&client=null&invoice=0&lensType=0&calibratedBy=0&zone=0`;
                        const res: any = await page.evaluate(async (u) => {
                            const r = await fetch(u, { credentials: 'include' });
                            if (!r.ok) return { error: r.status };
                            return await r.json();
                        }, url);
                        if (res?.error) throw new Error(`API SmartLab respondió ${res.error} en la página ${current}`);
                        const apiRows: any[] = res?.rows || [];
                        if (apiRows.length === 0) break;
                        for (const r of apiRows) {
                            const n = String(r.IdPedido || '');
                            if (pendingNums.has(n)) {
                                pendingNums.delete(n);
                                if (r.Anulado === '1') anulados.add(n);
                            }
                        }
                        await page.waitForTimeout(400);
                    }
                    if (anulados.size > 0) {
                        const before = stuckOrdersList.length;
                        stuckOrdersList = stuckOrdersList.filter(o => !anulados.has((o.num.match(/\d{4,}/) || [])[0] || o.num));
                        console.log(`[SmartLab Sync] ${before - stuckOrdersList.length} pedidos trabados descartados por ANULADOS: ${[...anulados].join(', ')}`);
                    }
                } catch (errAnulados) {
                    console.error('[SmartLab Sync] No se pudo verificar anulados (se alerta igual):', errAnulados);
                }
            }

            // ── Control de huérfanos: pedidos del portal sin venta en el sistema ──
            try {
                if (portalOrdersSeen.length > 0) {
                    const known = await prisma.order.findMany({
                        where: {
                            isDeleted: false,
                            OR: [
                                { labOrderNumber: { not: null } },
                                { postSaleCases: { some: { newOrderNumber: { not: null } } } },
                            ],
                        },
                        select: {
                            labOrderNumber: true,
                            postSaleCases: { select: { newOrderNumber: true } },
                        },
                    });
                    const knownNums = new Set<string>();
                    for (const o of known) {
                        for (const src of [o.labOrderNumber, ...o.postSaleCases.map(c => c.newOrderNumber)]) {
                            for (const n of src?.match(/\d{4,}/g) || []) knownNums.add(n);
                        }
                    }
                    const orphans = portalOrdersSeen.filter(p => {
                        const n = (p.num.match(/\d{4,}/) || [])[0];
                        return n && !knownNums.has(n);
                    });
                    if (orphans.length > 0) {
                        const registered = await LabCostReconciliationService.registerPortalOrphans('GRUPO_OPTICO', orphans);
                        console.log(`[SmartLab Sync] ${registered} pedidos del portal SIN venta en el sistema (huérfanos) registrados en la conciliación.`);
                    } else {
                        console.log('[SmartLab Sync] Todos los pedidos visibles del portal tienen venta en el sistema.');
                    }
                }
            } catch (errOrphans) {
                console.error('[SmartLab Sync] Error en el control de huérfanos:', errOrphans);
            }

            // ── Obtener pedidos del CRM que son de Grupo Óptico y activos ──
            const crmOrders = await prisma.order.findMany({
                where: {
                    isDeleted: false,
                    orderType: 'SALE',
                    labStatus: { in: ['SENT', 'IN_PROGRESS'] },
                    OR: [
                        { labOrderNumber: { not: null } },
                        {
                            postSaleCases: {
                                some: {
                                    orderOption: 'DIFFERENT',
                                    newOrderNumber: { not: null }
                                }
                            }
                        }
                    ]
                },
                select: {
                    id: true,
                    labOrderNumber: true,
                    labStatus: true,
                    smartLabProgress: true,
                    postSaleCases: {
                        orderBy: { createdAt: 'desc' as const },
                        select: {
                            orderOption: true,
                            newOrderNumber: true
                        }
                    },
                    client: { select: { name: true } },
                    items: {
                        select: {
                            product: { select: { category: true, laboratory: true } }
                        }
                    },
                },
            });

            const grupoOpticoOrders = crmOrders.filter(order => {
                const isGO = order.items.some((i: any) =>
                    i.product?.category === 'Cristal' &&
                    /grupo[\s\-]?[oó]ptico/i.test(i.product?.laboratory || '')
                );
                const activeCase = order.postSaleCases?.[0];
                const activeNum = activeCase?.orderOption === 'DIFFERENT' ? activeCase.newOrderNumber : order.labOrderNumber;
                return isGO && activeNum && !/sin\s+(lab|numero|laboratorio)/i.test(activeNum);
            });

            console.log(`[SmartLab Sync] ${grupoOpticoOrders.length} pedidos Grupo Óptico activos`);

            const ordersToSearch: { crmOrder: typeof grupoOpticoOrders[0]; numbers: string[] }[] = [];
            for (const order of grupoOpticoOrders) {
                const activeCase = order.postSaleCases?.[0];
                const activeNum = activeCase?.orderOption === 'DIFFERENT' ? activeCase.newOrderNumber : order.labOrderNumber;
                const nums = activeNum!.match(/\d{6,}/g) || [];
                if (nums.length > 0) ordersToSearch.push({ crmOrder: order, numbers: nums });
            }

            const searchAndScrape = async (num: string): Promise<ScrapedDetail | null> => {
                try {
                    const allInputs = await page.$$('input[type="text"], input[type="search"], input:not([type])');
                    let searchInput = null;
                    for (const inp of allInputs) {
                        const parentText = await inp.evaluate(el => {
                            const parent = el.closest('.form-group, .filter-group, div, .col, .col-md-3, .col-sm-6');
                            return parent?.textContent || '';
                        });
                        if (parentText.includes('PEDIDO') || parentText.includes('INTERNO') || parentText.includes('NRO')) {
                            searchInput = inp;
                            break;
                        }
                    }
                    if (!searchInput) searchInput = allInputs[0] || null;
                    if (searchInput) {
                        console.log(`[SmartLab Sync] Buscando pedido ${num}...`);
                        await searchInput.click({ clickCount: 3, delay: 150 });
                        await page.waitForTimeout(1000);
                        await searchInput.fill(num);
                        await page.waitForTimeout(2000);
                    }

                    const applyBtn = await page.$('button:has-text("Aplicar"), button:has-text("filtros"), a:has-text("Aplicar")');
                    if (applyBtn) {
                        await applyBtn.click({ delay: 300 });
                    } else {
                        await searchInput?.press('Enter', { delay: 300 });
                    }
                    
                    await page.waitForTimeout(7000);

                    const rows = await page.$$('table tbody tr');
                    for (const row of rows) {
                        const cells = await row.$$('td');
                        if (cells.length < 5) continue;

                        const pedidoText = await cells[0].innerText() || '';
                        if (!pedidoText.includes(num)) continue;

                        const sector = (await cells[3].innerText() || '').replace(/\n/g, ' ').trim();

                        let progress = 0;
                        const progressCol = cells[4];
                        const progressBar = await progressCol.$('.progress-bar, [role="progressbar"], [class*="progress"]');
                        if (progressBar) {
                            const style = await progressBar.getAttribute('style') || '';
                            const wm = style.match(/width:\s*([\d.]+)%/);
                            if (wm) progress = Math.round(parseFloat(wm[1]));
                            if (progress === 0) {
                                const av = await progressBar.getAttribute('aria-valuenow');
                                if (av) progress = Math.round(parseFloat(av));
                            }
                        }
                        if (progress === 0) {
                            const ptxt = (await progressCol.innerText() || '').trim();
                            const pm = ptxt.match(/([\d.]+)\s*%/);
                            if (pm) progress = Math.round(parseFloat(pm[1]));
                        }

                        const fullText = await progressCol.innerText() || '';
                        let entryDate = '';
                        const im = fullText.match(/[Ii]ngreso:?\s*([\d\-\/]+\s*[\d:]*)/);
                        if (im) entryDate = im[1].trim();

                        let days = 0;
                        const dm = fullText.match(/(\d+)\s*d[ií]as?/i);
                        if (dm) days = parseInt(dm[1]);

                        return { num, sector, progress, entryDate, days };
                    }
                } catch (err) {
                    console.error(`[SmartLab Sync] Error scraping ${num}:`, err);
                }
                return null;
            };

            const matchResults: any[] = [];
            let updatedCount = 0;
            let newlyFinished = 0;

            for (const { crmOrder, numbers } of ordersToSearch) {
                const details: ScrapedDetail[] = [];

                for (const num of numbers) {
                    const scraped = await searchAndScrape(num);
                    if (scraped) {
                        details.push(scraped);
                        console.log(`[SmartLab Sync] ✓ ${num}: ${scraped.progress}% - ${scraped.sector}`);
                    } else {
                        console.log(`[SmartLab Sync] ✗ ${num}: no encontrado`);
                    }
                }

                if (details.length === 0) continue;

                try {
                    const minProgress = Math.min(...details.map(d => d.progress));
                    const maxDays = Math.max(...details.map(d => d.days));
                    const earliestEntry = details.map(d => d.entryDate).filter(Boolean)[0] || '';
                    const sectorSummary = details.length === 1 
                        ? details[0].sector 
                        : details.map(d => `${d.num.slice(-4)}: ${d.sector}`).join(' | ');

                    const updateData: Record<string, unknown> = {
                        smartLabSector: sectorSummary,
                        smartLabProgress: minProgress,
                        smartLabLastSync: new Date(),
                        smartLabEntryDate: earliestEntry,
                        smartLabDays: maxDays,
                        smartLabDetails: JSON.stringify(details),
                    };

                    const wasNotFinished = (crmOrder.smartLabProgress || 0) < 100;
                    const allFinished = details.every(d => d.progress >= 100);

                    if (allFinished) {
                        updateData.labStatus = 'FINISHED';
                    } else if (minProgress > 0) {
                        updateData.labStatus = 'IN_PROGRESS';
                    }

                    // Primero actualizar la DB, luego notificar (evita notificaciones duplicadas si falla el update)
                    await prisma.order.update({
                        where: { id: crmOrder.id },
                        data: updateData,
                    });

                    if (allFinished && wasNotFinished) {
                        newlyFinished++;
                        await prisma.notification.create({
                            data: {
                                type: 'LAB_READY',
                                message: `🏭 Pedido finalizado en laboratorio — ${crmOrder.client.name} (${numbers.join(', ')})`,
                                orderId: crmOrder.id,
                                requestedBy: 'SmartLab Sync',
                                status: 'PENDING',
                            },
                        });
                    }

                    updatedCount++;
                    matchResults.push({
                        client: crmOrder.client.name,
                        numbers,
                        details: details.map(d => ({ num: d.num, progress: d.progress, sector: d.sector })),
                        overallProgress: minProgress,
                        isNew: allFinished && wasNotFinished,
                    });
                } catch (orderError) {
                    console.error(`[SmartLab Sync] Error actualizando pedido ${crmOrder.id} (${crmOrder.client.name}):`, orderError);
                    // Continuar con el siguiente pedido sin abortar el sync completo
                }
            }

            console.log(`[SmartLab Sync] Resultado: ${updatedCount} actualizados, ${newlyFinished} nuevos fabricados`);

            // --- ALERTA DE PEDIDOS TRABADOS ---
            try {
                if (stuckOrdersList.length > 0) {
                    const notifiedSetting = await prisma.systemSetting.findUnique({
                        where: { key: 'smartlab_notified_stuck_orders' }
                    });
                    
                    let notifiedNums: string[] = [];
                    try {
                        if (notifiedSetting?.value) {
                            notifiedNums = JSON.parse(notifiedSetting.value);
                        }
                    } catch (e) {
                        console.error('Error al parsear smartlab_notified_stuck_orders:', e);
                    }

                    const newStuckOrders = stuckOrdersList.filter(o => !notifiedNums.includes(o.num));

                    // Como máximo UNA alerta de trabados por día. Si estamos en ventana
                    // de silencio, los nuevos NO se marcan como notificados: se acumulan
                    // y salen todos juntos en el aviso del día siguiente.
                    const STUCK_ALERT_MIN_INTERVAL_MS = 20 * 60 * 60 * 1000; // ~1/día con cron cada 4 h
                    const lastStuckAlert = await prisma.systemSetting.findUnique({
                        where: { key: 'smartlab_stuck_alert_last_at' }
                    });
                    const lastStuckAlertMs = lastStuckAlert?.value ? new Date(lastStuckAlert.value).getTime() : 0;
                    const inQuietWindow = Date.now() - lastStuckAlertMs < STUCK_ALERT_MIN_INTERVAL_MS;

                    if (newStuckOrders.length > 0 && inQuietWindow) {
                        console.log(`[SmartLab Sync] ${newStuckOrders.length} trabados nuevos, pero la alerta diaria ya se envió — quedan para el próximo aviso.`);
                    } else if (newStuckOrders.length > 0) {
                        console.log(`[SmartLab Sync] Detectados ${newStuckOrders.length} nuevos pedidos trabados. Enviando alertas...`);
                        
                        const orderDetailsText = newStuckOrders.map(o => 
                            `- Pedido ${o.num}: Paciente "${o.client}", ingresado el ${o.dateStr} (${o.days} días trabado, progreso ${o.progress}, sector "${o.sector}")`
                        ).join('\n');

                        const orderDetailsHtml = newStuckOrders.map(o => 
                            `<li><b>Pedido ${o.num}</b>: Paciente "<i>${o.client}</i>", ingresado el ${o.dateStr} (<b>${o.days} días trabado</b>, progreso ${o.progress}, sector "${o.sector}")</li>`
                        ).join('');

                        // Enviar Email
                        await sendEmail({
                            to: 'pisano.ishtar@gmail.com',
                            subject: '⚠️ Alerta SmartLab — Pedidos trabados en ingreso/validación',
                            text: `Atelier Óptica\n\nSe detectaron nuevos pedidos con más de 2 días de demora en el ingreso/validación:\n\n${orderDetailsText}\n\nPor favor, verifica el estado en SmartLab.`,
                            html: `<h3 style="color: #d32f2f;">⚠️ Alerta de Pedidos Trabados</h3><p>Se detectaron nuevos pedidos con más de 2 días de demora en el ingreso/validación en SmartLab:</p><ul>${orderDetailsHtml}</ul><p>Por favor, realiza el seguimiento con el laboratorio.</p>`
                        }).catch(err => console.error('Error enviando email de alerta stuck orders:', err));

                        // Enviar WhatsApp
                        await fetchWa('/api/send', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                chatId: getAdminChatId(),
                                message: `⚠️ *Atelier Alerta - Pedidos Trabados en SmartLab*\n\nSe detectaron nuevos pedidos demorados en el ingreso/validación:\n\n${orderDetailsText}\n\n_Por favor, realiza el seguimiento con el laboratorio._`
                            })
                        }).catch(err => console.error('Error enviando WhatsApp de alerta stuck orders:', err));

                        const updatedNotifiedNums = [...notifiedNums, ...newStuckOrders.map(o => o.num)];
                        await prisma.systemSetting.upsert({
                            where: { key: 'smartlab_notified_stuck_orders' },
                            update: { value: JSON.stringify(updatedNotifiedNums) },
                            create: { key: 'smartlab_notified_stuck_orders', value: JSON.stringify(updatedNotifiedNums) }
                        });
                        notifiedNums = updatedNotifiedNums;

                        const nowIso = new Date().toISOString();
                        await prisma.systemSetting.upsert({
                            where: { key: 'smartlab_stuck_alert_last_at' },
                            update: { value: nowIso },
                            create: { key: 'smartlab_stuck_alert_last_at', value: nowIso }
                        });
                    }

                    // Limpieza de pedidos que ya salieron de trabados
                    const currentStuckNums = stuckOrdersList.map(o => o.num);
                    const activeNotifiedNums = notifiedNums.filter((num: string) => currentStuckNums.includes(num));
                    if (activeNotifiedNums.length !== notifiedNums.length) {
                        await prisma.systemSetting.upsert({
                            where: { key: 'smartlab_notified_stuck_orders' },
                            update: { value: JSON.stringify(activeNotifiedNums) },
                            create: { key: 'smartlab_notified_stuck_orders', value: JSON.stringify(activeNotifiedNums) }
                        });
                    }
                }
            } catch (alertError) {
                console.error('[SmartLab Sync] Error al procesar alertas de pedidos trabados:', alertError);
            }

            return {
                totalCrmOrders: grupoOpticoOrders.length,
                matched: updatedCount,
                newlyFinished,
                details: matchResults,
                stuckOrders: stuckOrdersList
            };

        } catch (error) {
            console.error('[SmartLab Sync] Error general:', error);
            throw error;
        } finally {
            if (browser) {
                try {
                    await browser.close();
                } catch (closeError) {
                    console.error('[SmartLab Sync] Error closing browser:', closeError);
                }
            }
            isSyncing = false;
        }
    }
}
