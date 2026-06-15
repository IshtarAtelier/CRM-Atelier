import { chromium } from 'playwright';
import fs from 'fs';

async function run() {
    console.log("Launching browser...");
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
        console.log("Logging in...");
        await page.goto('https://grupooptico.dyndns.info/smartlab/auth/authSmartlab/login', { waitUntil: 'domcontentloaded' });
        
        await page.waitForSelector('input', { timeout: 10000 });
        const inputs = await page.$$('input');
        
        await inputs[0].fill('pisano.ishtar@gmail.com');
        await inputs[1].fill('atelier');
        
        await Promise.all([
            page.waitForNavigation({ waitUntil: 'networkidle' }),
            inputs[1].press('Enter')
        ]);
        
        console.log("Logged in. Getting links on main page...");
        
        // Wait a bit for the menu to load
        await page.waitForTimeout(3000);
        
        // Extract all links
        const links = await page.evaluate(() => {
            const anchors = Array.from(document.querySelectorAll('a'));
            return anchors.map(a => ({
                text: a.innerText.trim(),
                href: a.href
            })).filter(a => a.text.length > 0 || a.href.includes('pedido'));
        });
        
        console.log("Links found:", links);
        
        // Go to orders page
        console.log("Navigating to orders page...");
        await page.goto('https://grupooptico.dyndns.info/smartlab/operaciones/pedidos/index', { waitUntil: 'networkidle' });
        await page.waitForTimeout(3000);
        
        const orderLinks = await page.evaluate(() => {
            const anchors = Array.from(document.querySelectorAll('a, button'));
            return anchors.map(a => ({
                tag: a.tagName,
                text: (a as HTMLElement).innerText.trim(),
                href: (a as HTMLAnchorElement).href || null,
                id: a.id,
                className: a.className
            })).filter(a => a.text.toLowerCase().includes('nuevo') || 
                            a.text.toLowerCase().includes('cargar') || 
                            a.text.toLowerCase().includes('crear') || 
                            a.text.toLowerCase().includes('add'));
        });
        
        console.log("Action buttons on Orders page:", orderLinks);

    } catch (e) {
        console.error(e);
    } finally {
        await browser.close();
    }
}

run();
