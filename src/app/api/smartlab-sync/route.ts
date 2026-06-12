import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

interface ScrapedOrder {
    pedido: string;
    codigoOptica: string;
    fechaCarga: string;
    sectorActual: string;
    progreso: number;
    factura: string;
    tratamiento: string;
    fechaIngreso: string;
    diasEnLab: number;
}

interface MatchResult {
    smartLabPedido: string;
    crmOrderId: string;
    labOrderNumber: string;
    sector: string;
    progress: number;
    statusChanged: boolean;
    newLabStatus?: string;
}

export async function POST() {
    let browser;
    try {
        const path = await import('path');
        const browsersPath = path.join(process.cwd(), '.playwright-browsers');
        process.env.PLAYWRIGHT_BROWSERS_PATH = browsersPath;
        const { chromium } = await import('playwright');
        browser = await chromium.launch({ headless: true });
        const context = await browser.newContext();
        const page = await context.newPage();

        await page.goto('https://grupooptico.dyndns.info/smartlab/auth/authSmartlab/login', { waitUntil: 'networkidle' });
        await page.waitForSelector('input', { timeout: 10000 });

        const inputs = await page.$$('input');
        if (inputs.length < 2) {
            throw new Error('No se encontraron los campos de login en SmartLab.');
        }

        await inputs[0].fill('pisano.ishtar@gmail.com');
        await inputs[1].fill('atelier');

        const buttons = await page.$$('button');
        let loginClicked = false;
        for (const btn of buttons) {
            const text = await btn.innerText();
            if (text.toLowerCase().includes('iniciar') || text.toLowerCase().includes('ingresar') || text.toLowerCase().includes('login')) {
                await btn.click();
                loginClicked = true;
                break;
            }
        }

        if (!loginClicked) {
            await inputs[1].press('Enter');
        }

        await page.waitForURL('**/smartlab**', { timeout: 15000 });
        console.log('SmartLab Sync: Login exitoso. Navegando a lista de pedidos...');

        await page.goto('https://grupooptico.dyndns.info/smartlab/laboratory/list', { waitUntil: 'networkidle' });

        const allScrapedOrders: ScrapedOrder[] = [];

        const scrapeCurrentPage = async (): Promise<ScrapedOrder[]> => {
            try {
                await page.waitForSelector('table tbody tr', { timeout: 15000 });
            } catch {
                console.log('SmartLab Sync: No se encontró tabla con pedidos.');
                return [];
            }

            const rows = await page.$$eval('table tbody tr', (trs) => {
                return trs.map(tr => {
                    const cells = tr.querySelectorAll('td');
                    if (cells.length < 5) return null;

                    // Extract progress %
                    let progreso = 0;
                    const progressCol = cells[4];
                    const progressBar = progressCol?.querySelector('.progress-bar, [role="progressbar"], [class*="progress"]');
                    if (progressBar) {
                        const widthStyle = progressBar.getAttribute('style') || '';
                        const widthMatch = widthStyle.match(/width:\s*([\d.]+)%/);
                        if (widthMatch) {
                            progreso = Math.round(parseFloat(widthMatch[1]));
                        } else {
                            const ariaValue = progressBar.getAttribute('aria-valuenow');
                            if (ariaValue) progreso = Math.round(parseFloat(ariaValue));
                        }
                    }
                    if (progreso === 0) {
                        const progressText = progressCol?.textContent?.trim() || '';
                        const percentMatch = progressText.match(/([\d.]+)\s*%/);
                        if (percentMatch) {
                            progreso = Math.round(parseFloat(percentMatch[1]));
                        }
                    }

                    // Extract entry date ("Ingreso: 12-06-26 14:09") from the progress column
                    const progressFullText = progressCol?.textContent || '';
                    let fechaIngreso = '';
                    const ingresoMatch = progressFullText.match(/[Ii]ngreso:?\s*([\d\-\/]+\s*[\d:]*)/);
                    if (ingresoMatch) {
                        fechaIngreso = ingresoMatch[1].trim();
                    }

                    // Extract days count ("1 dias", "3 días")
                    let diasEnLab = 0;
                    const diasMatch = progressFullText.match(/(\d+)\s*d[ií]as?/i);
                    if (diasMatch) {
                        diasEnLab = parseInt(diasMatch[1]);
                    }

                    // Try pedido number from first cell - might have icons/badges, extract just the number
                    const pedidoText = cells[0]?.textContent?.trim() || '';
                    const pedidoMatch = pedidoText.match(/(\d{6,})/);
                    const pedido = pedidoMatch ? pedidoMatch[1] : pedidoText;

                    return {
                        pedido,
                        codigoOptica: cells[1]?.textContent?.trim() || '',
                        fechaCarga: cells[2]?.textContent?.trim() || '',
                        sectorActual: cells[3]?.textContent?.trim() || '',
                        progreso,
                        factura: cells[5]?.textContent?.trim() || '',
                        tratamiento: cells[6]?.textContent?.trim() || '',
                        fechaIngreso,
                        diasEnLab,
                    };
                }).filter(Boolean);
            }) as ScrapedOrder[];

            return rows;
        };

        const firstPageOrders = await scrapeCurrentPage();
        allScrapedOrders.push(...firstPageOrders);

        let hasNextPage = true;
        while (hasNextPage) {
            const nextButton = await page.$('a.next:not(.disabled), li.next:not(.disabled) a, [aria-label="Next"]:not([disabled]), .pagination .next a');
            if (nextButton) {
                const isDisabled = await nextButton.evaluate(el => {
                    const li = el.closest('li');
                    return el.classList.contains('disabled') || el.hasAttribute('disabled') || (li?.classList.contains('disabled') ?? false);
                });

                if (isDisabled) {
                    hasNextPage = false;
                } else {
                    await nextButton.click();
                    await page.waitForTimeout(2000);
                    const pageOrders = await scrapeCurrentPage();
                    if (pageOrders.length === 0) {
                        hasNextPage = false;
                    } else {
                        allScrapedOrders.push(...pageOrders);
                    }
                }
            } else {
                hasNextPage = false;
            }
        }

        console.log(`SmartLab Sync: ${allScrapedOrders.length} pedidos scrapeados.`);

        const crmOrders = await prisma.order.findMany({
            where: {
                labOrderNumber: { not: null },
                isDeleted: false,
            },
            select: {
                id: true,
                labOrderNumber: true,
                labStatus: true,
                smartLabProgress: true,
                client: { select: { name: true } },
                user: { select: { name: true } },
            },
        });

        const matchResults: MatchResult[] = [];
        let updatedCount = 0;
        let newlyFinished = 0;

        for (const scraped of allScrapedOrders) {
            if (!scraped.pedido) continue;

            const matchedOrder = crmOrders.find(crm => {
                if (!crm.labOrderNumber) return false;
                const crmNum = crm.labOrderNumber.replace('SML-', '');
                return crmNum === scraped.pedido || crm.labOrderNumber === scraped.pedido;
            });

            if (!matchedOrder) continue;

            const updateData: Record<string, unknown> = {
                smartLabSector: scraped.sectorActual || null,
                smartLabProgress: scraped.progreso,
                smartLabLastSync: new Date(),
                smartLabEntryDate: scraped.fechaIngreso || null,
                smartLabDays: scraped.diasEnLab || null,
            };

            let statusChanged = false;
            let newLabStatus: string | undefined;

            // Si el progreso llega al 100% y antes no estaba al 100%, notificar al vendedor
            // NO auto-avanzar a READY para no disparar WhatsApp al cliente
            const wasNotFinished = (matchedOrder.smartLabProgress || 0) < 100;
            const isNowFinished = scraped.progreso >= 100;
            const isActiveInLab = matchedOrder.labStatus === 'SENT' || matchedOrder.labStatus === 'IN_PROGRESS';

            if (isNowFinished && wasNotFinished && isActiveInLab) {
                statusChanged = true;
                newLabStatus = 'FABRICADO';
                newlyFinished++;

                // Crear notificación interna para el vendedor
                await prisma.notification.create({
                    data: {
                        type: 'LAB_READY',
                        message: `🏭 Pedido finalizado en laboratorio — ${matchedOrder.client.name} (N° ${scraped.pedido}). Sector: ${scraped.sectorActual}`,
                        orderId: matchedOrder.id,
                        requestedBy: 'SmartLab Sync',
                        status: 'PENDING',
                    },
                });
            }

            await prisma.order.update({
                where: { id: matchedOrder.id },
                data: updateData,
            });

            updatedCount++;
            matchResults.push({
                smartLabPedido: scraped.pedido,
                crmOrderId: matchedOrder.id,
                labOrderNumber: matchedOrder.labOrderNumber!,
                sector: scraped.sectorActual,
                progress: scraped.progreso,
                statusChanged,
                newLabStatus,
            });
        }

        console.log(`SmartLab Sync: ${matchResults.length} coincidencias, ${updatedCount} actualizados, ${newlyFinished} nuevos finalizados.`);

        return NextResponse.json({
            success: true,
            totalScraped: allScrapedOrders.length,
            matched: matchResults.length,
            updated: updatedCount,
            newlyFinished,
            details: matchResults,
        });

    } catch (error: any) {
        console.error('Error en SmartLab Sync:', error);
        return NextResponse.json(
            { error: error.message || 'Error interno al sincronizar con SmartLab.' },
            { status: 500 }
        );
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}
