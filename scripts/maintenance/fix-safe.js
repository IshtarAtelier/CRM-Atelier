const fs = require('fs');

const files = [
    'src/app/admin/facturacion/page.tsx',
    'src/app/admin/whatsapp/page.tsx',
    'src/components/admin/DoctorCommissions.tsx',
    'src/components/billing/InvoiceModal.tsx',
    'src/app/admin/inventario/page.tsx',
    'src/app/admin/web/page.tsx'
];

const contrastMap = {
    'text-stone-300': 'text-stone-500',
    'text-stone-400': 'text-stone-600',
    'text-gray-400': 'text-gray-600',
    'text-\\[9px\\]': 'text-xs',
    'text-\\[10px\\]': 'text-xs'
};

const focusRegex = /focus:outline-none(?! focus-visible)/g;
const focusReplace = 'focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none';

files.forEach(filePath => {
    if (fs.existsSync(filePath)) {
        let content = fs.readFileSync(filePath, 'utf8');
        let original = content;

        for (const [bad, good] of Object.entries(contrastMap)) {
            content = content.replace(new RegExp(bad, 'g'), good);
        }

        content = content.replace(focusRegex, focusReplace);

        content = content.replace(/<img([^>]*?)>/g, (match, attrs) => {
            if (!attrs.includes('alt=')) {
                if (match.endsWith('/>')) {
                    return `<img${attrs.replace(/\/$/, '')} alt="" />`;
                } else {
                    return `<img${attrs} alt="">`;
                }
            }
            return match;
        });

        if (content !== original) {
            fs.writeFileSync(filePath, content, 'utf8');
            console.log('Fixed', filePath);
        }
    }
});
