import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

interface ScrapedDetail {
    num: string;
    sector: string;
    progress: number;
    entryDate: string;
    days: number;
}

export async function POST() {
    let browser;
    try {
        const { chromium } = await import('playwright');
        browser = await chromium.launch({ headless: true });
        const context = await browser.newContext();
        const page = await context.newPage();

        // ── Login ──────────────────────────────────
        await page.goto('https://grupooptico.dyndns.info/smartlab/auth/authSmartlab/login', { waitUntil: 'networkidle' });
        await page.waitForSelector('input', { timeout: 10000 });

        const inputs = await page.$$('input');
        if (inputs.length < 2) throw new Error('No se encontraron los campos de login en SmartLab.');

        // Llenar datos de login de forma humana (lenta)
        await page.waitForTimeout(1000);
        await inputs[0].fill('pisano.ishtar@gmail.com');
        await page.waitForTimeout(800);
        await inputs[1].fill('atelier');
        await page.waitForTimeout(1000);

        const buttons = await page.$$('button');
        let loginClicked = false;
        for (const btn of buttons) {
            const text = await btn.innerText();
            if (text.toLowerCase().includes('iniciar') || text.toLowerCase().includes('ingresar') || text.toLowerCase().includes('login')) {
                await page.waitForTimeout(500);
                await Promise.all([
                    page.waitForNavigation({ waitUntil: 'networkidle' }),
                    btn.click({ delay: 200 })
                ]);
                loginClicked = true;
                break;
            }
        }
        if (!loginClicked) {
            await Promise.all([
                page.waitForNavigation({ waitUntil: 'networkidle' }),
                inputs[1].press('Enter', { delay: 200 })
            ]);
        }
        console.log('[SmartLab Sync] Login exitoso');

        // ── Navegar a lista ──────────────────────────
        console.log('[SmartLab Sync] Navegando a lista de pedidos...');
        await page.goto('https://grupooptico.dyndns.info/smartlab/laboratory/list', { waitUntil: 'networkidle' });
        
        // Esperar a que la SPA renderice los campos de búsqueda
        console.log('[SmartLab Sync] Esperando a que carguen los campos de búsqueda...');
        await page.waitForSelector('input[type="text"]', { timeout: 15000 }).catch(() => console.log('Timeout esperando inputs'));
        await page.waitForTimeout(2000); // Dar un extra de tiempo para que termine de armar el DOM

        // ── Obtener pedidos del CRM que son de Grupo Óptico y activos ──
        const crmOrders = await prisma.order.findMany({
            where: {
                labOrderNumber: { not: null },
                isDeleted: false,
                orderType: 'SALE',
                labStatus: { in: ['SENT', 'IN_PROGRESS'] },
            },
            select: {
                id: true,
                labOrderNumber: true,
                labStatus: true,
                smartLabProgress: true,
                client: { select: { name: true } },
                items: {
                    select: {
                        product: { select: { category: true, laboratory: true } }
                    }
                },
            },
        });

        // Filtrar solo pedidos de Grupo Óptico con números válidos
        const grupoOpticoOrders = crmOrders.filter(order => {
            const isGO = order.items.some((i: any) =>
                i.product?.category === 'Cristal' &&
                /grupo[\s\-]?[oó]ptico/i.test(i.product?.laboratory || '')
            );
            return isGO && order.labOrderNumber && !/sin\s+(lab|numero|laboratorio)/i.test(order.labOrderNumber);
        });

        console.log(`[SmartLab Sync] ${grupoOpticoOrders.length} pedidos Grupo Óptico activos`);

        // ── Extraer números individuales ──
        const ordersToSearch: { crmOrder: typeof grupoOpticoOrders[0]; numbers: string[] }[] = [];
        for (const order of grupoOpticoOrders) {
            const nums = order.labOrderNumber!.match(/\d{6,}/g) || [];
            if (nums.length > 0) ordersToSearch.push({ crmOrder: order, numbers: nums });
        }

        // ── Función: buscar UN número en SmartLab ──
        const searchAndScrape = async (num: string): Promise<ScrapedDetail | null> => {
            try {
                // Encontrar el campo "NRO. PEDIDO / CÓD. INTERNO"
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
                    await searchInput.click({ clickCount: 3, delay: 50 });
                    await page.waitForTimeout(500);
                    await searchInput.fill(num);
                    await page.waitForTimeout(1000);
                }

                // Click "Aplicar filtros"
                const applyBtn = await page.$('button:has-text("Aplicar"), button:has-text("filtros"), a:has-text("Aplicar")');
                if (applyBtn) {
                    await applyBtn.click({ delay: 100 });
                } else {
                    await searchInput?.press('Enter', { delay: 100 });
                }
                
                // Simular tiempo humano de espera a que cargue la tabla
                await page.waitForTimeout(4000);

                // Scrapear primera fila de resultados
                const rows = await page.$$('table tbody tr');
                for (const row of rows) {
                    const cells = await row.$$('td');
                    if (cells.length < 5) continue;

                    const pedidoText = await cells[0].textContent() || '';
                    if (!pedidoText.includes(num)) continue;

                    // Sector
                    const sector = (await cells[3].textContent() || '').trim();

                    // Progreso
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
                        const ptxt = (await progressCol.textContent() || '').trim();
                        const pm = ptxt.match(/([\d.]+)\s*%/);
                        if (pm) progress = Math.round(parseFloat(pm[1]));
                    }

                    // Fecha ingreso y días
                    const fullText = await progressCol.textContent() || '';
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

        // ── Buscar cada pedido ──
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

            // Calcular resumen: progreso mínimo (orden no está lista hasta que TODOS los cristales estén)
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

            // Si TODOS llegan al 100% y antes no estaba → notificar
            const wasNotFinished = (crmOrder.smartLabProgress || 0) < 100;
            const allFinished = details.every(d => d.progress >= 100);

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

            await prisma.order.update({
                where: { id: crmOrder.id },
                data: updateData,
            });

            updatedCount++;
            matchResults.push({
                client: crmOrder.client.name,
                numbers,
                details: details.map(d => ({ num: d.num, progress: d.progress, sector: d.sector })),
                overallProgress: minProgress,
                isNew: allFinished && wasNotFinished,
            });
        }

        console.log(`[SmartLab Sync] Resultado: ${updatedCount} actualizados, ${newlyFinished} nuevos fabricados`);

        return NextResponse.json({
            success: true,
            totalCrmOrders: grupoOpticoOrders.length,
            matched: updatedCount,
            newlyFinished,
            details: matchResults,
        });

    } catch (error: any) {
        console.error('[SmartLab Sync] Error:', error);
        return NextResponse.json(
            { error: error.message || 'Error interno al sincronizar con SmartLab.' },
            { status: 500 }
        );
    } finally {
        if (browser) await browser.close();
    }
}
