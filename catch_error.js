const puppeteer = require('puppeteer');

(async () => {
    try {
        const browser = await puppeteer.launch();
        const page = await browser.newPage();

        page.on('console', msg => {
            if (msg.type() === 'error') {
                console.log('BROWSER CONSOLE ERROR:', msg.text());
            }
        });
        page.on('pageerror', err => {
            console.log('BROWSER PAGE ERROR:', err.toString());
        });

        console.log('Navigating to http://localhost:3000/test...');
        await page.goto('http://localhost:3000/test', { waitUntil: 'networkidle0', timeout: 30000 });
        
        await new Promise(r => setTimeout(r, 2000));
        await browser.close();
    } catch (err) {
        console.error('Script Error:', err);
        process.exit(1);
    }
})();

