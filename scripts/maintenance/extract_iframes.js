const { chromium } = require('playwright');
const path = require('path');

async function main() {
    const browsersPath = path.join(process.cwd(), '.playwright-browsers');
    process.env.PLAYWRIGHT_BROWSERS_PATH = browsersPath;
    
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
        console.log('Logging in...');
        await page.goto('https://grupooptico.dyndns.info/smartlab/auth/authSmartlab/login', { waitUntil: 'networkidle' });
        await page.waitForSelector('input', { timeout: 10000 });
        
        const inputs = await page.$$('input');
        await inputs[0].fill('pisano.ishtar@gmail.com');
        await inputs[1].fill('atelier');
        
        const buttons = await page.$$('button');
        for (const btn of buttons) {
            const text = await btn.innerText();
            if (text.toLowerCase().includes('iniciar') || text.toLowerCase().includes('ingresar') || text.toLowerCase().includes('login')) {
                await btn.click();
                break;
            }
        }
        
        await page.waitForURL('**/smartlab**', { timeout: 15000 });
        await page.goto('https://grupooptico.dyndns.info/smartlab/laboratory/new', { waitUntil: 'networkidle' });
        await page.waitForTimeout(5000);
        
        console.log('Looking for frames...');
        for (const frame of page.frames()) {
            console.log(`Frame URL: ${frame.url()}`);
            try {
                // Find all dropdowns with an arrow button (MUI autocomplete)
                const buttons = await frame.$$('button.MuiAutocomplete-popupIndicator');
                for (let i = 0; i < buttons.length; i++) {
                    try {
                        const btn = buttons[i];
                        
                        // Find label
                        const labelEl = await frame.evaluateHandle((el) => {
                            let current = el;
                            while (current && !current.querySelector('label')) {
                                current = current.parentElement;
                            }
                            return current ? current.querySelector('label').innerText : null;
                        }, btn);
                        const labelText = await labelEl.jsonValue();
                        if (!labelText) continue;
                        
                        console.log(`Clicking dropdown: ${labelText}`);
                        await btn.click();
                        await page.waitForTimeout(1000);
                        
                        const options = await frame.$$eval('[role="option"]', opts => opts.map(o => o.textContent ? o.textContent.trim() : ''));
                        console.log(`[${labelText}] Options:`, options);
                        
                        await page.keyboard.press('Escape');
                        await page.waitForTimeout(500);
                    } catch(e) {}
                }
                
                // Radios
                const radios = await frame.$$eval('input[type="radio"]', inputs => {
                    return inputs.map(i => {
                        const l = i.closest('label');
                        return l ? (l.textContent ? l.textContent.trim() : '') : '';
                    }).filter(x=>x);
                });
                if (radios.length > 0) console.log('Radios:', radios);
                
            } catch (e) {
                console.log('Frame error', e.message);
            }
        }
        
    } finally {
        await browser.close();
    }
}
main().catch(console.error);
