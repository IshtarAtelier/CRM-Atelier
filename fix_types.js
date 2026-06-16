const fs = require('fs');

const replacements = [
    { file: 'src/services/agents/agents/QuoteAgent.ts', target: 'export interface QuoteOption', replace: 'interface QuoteOption' },
    { file: 'src/services/billing.service.ts', target: 'export interface CreateInvoiceItem', replace: 'interface CreateInvoiceItem' },
    { file: 'src/services/report.service.ts', target: 'export interface BillingStat', replace: 'interface BillingStat' },
    { file: 'src/services/smartlab.service.ts', target: 'export interface ScrapedDetail', replace: 'interface ScrapedDetail' },
    { file: 'src/store/useCart.ts', target: 'export interface CartItem', replace: 'interface CartItem' }
];

for (const req of replacements) {
    if (fs.existsSync(req.file)) {
        let content = fs.readFileSync(req.file, 'utf8');
        content = content.replace(new RegExp(req.target, 'g'), req.replace);
        fs.writeFileSync(req.file, content);
    }
}
