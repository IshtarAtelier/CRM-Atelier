import { chromium } from 'playwright';

(async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    page.on('request', request => {
        if (request.method() === 'POST' && (request.url().includes('api') || request.url().includes('trpc'))) {
            console.log('--- POST REQUEST ---');
            console.log('URL:', request.url());
            console.log('Headers:', request.headers());
            console.log('Data:', request.postData());
        }
    });

    try {
        await page.goto('https://grupooptico.dyndns.info/smartlab/auth/authSmartlab/login', { waitUntil: 'networkidle' });
        await page.waitForSelector('input', { timeout: 10000 });
        
        const inputs = await page.$$('input');
        if (inputs.length >= 2) {
            await inputs[0].fill('pisano.ishtar@gmail.com');
            await inputs[1].fill('atelier');
            
            const buttons = await page.$$('button');
            for (let btn of buttons) {
                const text = await btn.innerText();
                if (text.toLowerCase().includes('iniciar') || text.toLowerCase().includes('ingresar') || text.toLowerCase().includes('login')) {
                    await btn.click();
                    break;
                }
            }
            
            await page.waitForURL('**/smartlab**');
            await page.waitForTimeout(2000);
            
            await page.goto('https://grupooptico.dyndns.info/smartlab/laboratory/new', { waitUntil: 'networkidle' });
            await page.waitForTimeout(4000);
            
            // Try to fill something just to avoid immediate validation errors
            const allInputs = await page.$$('input[type="text"]');
            if (allInputs.length > 0) {
                await allInputs[0].fill('Juan Perez Test');
            }

            // Click Guardar pedido
            const saveBtns = await page.$$('button');
            for (let btn of saveBtns) {
                const text = await btn.innerText();
                if (text.includes('Guardar pedido')) {
                    await btn.click();
                    break;
                }
            }

            await page.waitForTimeout(4000);

        }
    } catch (e) {
        console.error('Error:', e);
    } finally {
        await browser.close();
    }
})();
