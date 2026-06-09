import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

import path from 'path';

export async function POST(request: Request) {
    let browser;
    try {
        const body = await request.json();
        const { orderId } = body;

        if (!orderId) {
            return NextResponse.json({ error: 'Falta el ID del pedido' }, { status: 400 });
        }

        // 1. Obtener el pedido y sus datos del CRM
        const order = await prisma.order.findUnique({
            where: { id: orderId },
            include: {
                client: true,
                user: true,
                items: {
                    include: { product: true }
                }
            }
        });

        if (!order) {
            return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 });
        }

        // 2. Extraer datos para Grupo Óptico / SmartLab
        const lensItems = order.items.filter(i => i.product?.category === 'Cristal');
        const odItem = lensItems.find(i => i.eye === 'OD');
        const oiItem = lensItems.find(i => i.eye === 'OI');
        
        const lensType = (lensItems[0]?.product?.type || 'MONOFOCAL').toUpperCase();
        let lensTypeId = 1; // Monofocal
        if (lensType.includes('BIFOCAL')) lensTypeId = 2;
        if (lensType.includes('MULTIFOCAL') || lensType.includes('PROGRESIVO')) lensTypeId = 4;
        if (lensType.includes('OCUPACIONAL')) lensTypeId = 5;

        // 3. Lanzar navegador oculto para autenticación
        console.log('Iniciando sesión en SmartLab vía Headless Browser...');
        const puppeteer = (await import('puppeteer-core')).default;
        
        const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH || 
            (process.platform === 'win32' ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' : 
             process.platform === 'darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : 
             '/usr/bin/google-chrome-stable');

        browser = await puppeteer.launch({ 
            executablePath,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
            headless: true 
        });
        const page = await browser.newPage();

        await page.goto('https://grupooptico.dyndns.info/smartlab/auth/authSmartlab/login', { waitUntil: 'networkidle0' as any });
        await page.waitForSelector('input', { timeout: 10000 });
        
        const inputs = await page.$$('input');
        if (inputs.length < 2) {
            throw new Error('No se encontraron los campos de login en SmartLab.');
        }

        await inputs[0].type('pisano.ishtar@gmail.com');
        await inputs[1].type('atelier');
        
        const buttons = await page.$$('button');
        let loginClicked = false;
        for (const btn of buttons) {
            const text = await btn.evaluate(el => (el as HTMLElement).innerText || '');
            if (text.toLowerCase().includes('iniciar') || text.toLowerCase().includes('ingresar') || text.toLowerCase().includes('login')) {
                await btn.click();
                loginClicked = true;
                break;
            }
        }

        if (!loginClicked) {
            await inputs[1].press('Enter');
        }
        
        // Esperar a estar logueado
        await page.waitForNavigation({ waitUntil: 'networkidle0' as any, timeout: 15000 }).catch(() => {});
        console.log('Login exitoso. Generando borrador...');

        // 4. Preparar Payload para su API interna (smartlab-api-v2)
        const smartLabPayload = {
            lensTypeId: lensTypeId,
            rightEyeFarSpherical: odItem?.sphereVal || null,
            rightEyeFarCylindrical: odItem?.cylinderVal || null,
            rightEyeFarAxis: odItem?.axisVal || null,
            rightEyeAddition: odItem?.additionVal || null,
            rightEyeInterpupillaryDistance: order.labPdOd || null,
            
            leftEyeFarSpherical: oiItem?.sphereVal || null,
            leftEyeFarCylindrical: oiItem?.cylinderVal || null,
            leftEyeFarAxis: oiItem?.axisVal || null,
            leftEyeAddition: oiItem?.additionVal || null,
            leftEyeInterpupillaryDistance: order.labPdOi || null,
            
            calibrated: 1,
            diameter: order.labDiameter || null,
            
            opticsCode: order.id.slice(-4).toUpperCase(),
            opticsComment: order.labNotes || null,
            warrantyPatientName: order.client.name,
            
            clientId: "2462",
            userId: "2462",
            isClient: true,
            action: "insert"
        };

        // Realizamos el POST directamente usando el contexto de sesión autenticado
        const responseData = await page.evaluate(async (payload) => {
            const res = await fetch('https://grupooptico.dyndns.info/smartlab-api-v2/public/index.php/laboratory/order/createupdate', {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });
            if (!res.ok) {
                throw new Error(`Error en la API de SmartLab: ${res.status} - ${await res.text()}`);
            }
            return await res.json();
        }, smartLabPayload);

        console.log('Borrador creado en SmartLab:', responseData);

        // Actualizar el estado en nuestra BD
        await prisma.order.update({
            where: { id: orderId },
            data: {
                labStatus: 'IN_PROGRESS',
                // Si la API devuelve un ID interno, lo guardamos, sino usamos un placeholder o la referencia local
                labOrderNumber: responseData.id ? `SML-${responseData.id}` : `Borrador-${order.id.slice(-4).toUpperCase()}`,
                labSentAt: order.labSentAt || new Date()
            }
        });

        return NextResponse.json({
            success: true,
            message: 'El pedido fue pre-cargado exitosamente en SmartLab. Ingresá al portal de Grupo Óptico para revisar el borrador y darle el OK definitivo.',
            draftId: responseData.id ? responseData.id : 'N/A'
        });

    } catch (error: any) {
        console.error('Error al enviar a SmartLab:', error);
        return NextResponse.json({ error: error.message || 'Error interno al procesar el envío a SmartLab.' }, { status: 500 });
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}
