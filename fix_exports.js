const fs = require('fs');

const replacements = [
    { file: 'src/lib/afip.ts', target: 'export const BILLING_ACCOUNTS', replace: 'const BILLING_ACCOUNTS' },
    { file: 'src/lib/backup.ts', target: 'export const BACKUP_PREFIX', replace: 'const BACKUP_PREFIX' },
    { file: 'src/lib/client-pdf-generator.ts', target: 'export function getClientHtml', replace: 'function getClientHtml' },
    { file: 'src/lib/copilot-tools.ts', target: 'export const STAFF_TOOLS', replace: 'const STAFF_TOOLS' },
    { file: 'src/lib/copilot-tools.ts', target: 'export const ADMIN_TOOLS', replace: 'const ADMIN_TOOLS' },
    { file: 'src/lib/crystal-color-utils.ts', target: 'export function getColorCategoryLabel', replace: 'function getColorCategoryLabel' },
    { file: 'src/lib/googleReviews.ts', target: 'export const FALLBACK_REVIEWS', replace: 'const FALLBACK_REVIEWS' },
    { file: 'src/lib/googleReviews.ts', target: 'export const fetchLegacyReviews', replace: 'const fetchLegacyReviews' },
    { file: 'src/lib/googleReviews.ts', target: 'export const fetchNewReviews', replace: 'const fetchNewReviews' },
    { file: 'src/lib/order-pdf-generator.ts', target: 'export function getOrderHtml', replace: 'function getOrderHtml' },
    { file: 'src/lib/promo-utils.ts', target: 'export function calculatePromoFrameDiscount', replace: 'function calculatePromoFrameDiscount' },
    { file: 'src/lib/receipt-pdf-generator.ts', target: 'export function getReceiptHtml', replace: 'function getReceiptHtml' },
    { file: 'src/lib/wa-config.ts', target: 'export const WA_SERVER_URL', replace: 'const WA_SERVER_URL' },
    { file: 'src/services/order.service.ts', target: 'export const dynamic', replace: '// export const dynamic' }
];

for (const req of replacements) {
    if (fs.existsSync(req.file)) {
        let content = fs.readFileSync(req.file, 'utf8');
        content = content.replace(new RegExp(req.target, 'g'), req.replace);
        fs.writeFileSync(req.file, content);
    }
}
