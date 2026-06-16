const fs = require('fs');

const files = [
    'src/app/admin/facturacion/page.tsx',
    'src/app/admin/whatsapp/page.tsx'
];

files.forEach(filePath => {
    let content = fs.readFileSync(filePath, 'utf8');
    let original = content;

    // A safer way to inject role="button" tabIndex={0} into div/span with onClick
    // We match <div ... onClick={...} ... >
    let lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('onClick={') && (lines[i].includes('<div') || lines[i].includes('<span'))) {
            // Check if it's already a button
            if (lines[i].includes('role="button"')) continue;

            // Find where the opening tag ends
            let endOfTag = lines[i].indexOf('>');
            if (endOfTag !== -1 && endOfTag > lines[i].indexOf('onClick')) {
                // Not perfectly robust for multi-line tags, but usually these are single line or we match the exact line
                // Let's just insert before the >
                let before = lines[i].substring(0, endOfTag);
                let after = lines[i].substring(endOfTag);
                
                // Remove any trailing slash to handle self closing (though div/span shouldn't be)
                if (before.endsWith('/')) {
                    before = before.substring(0, before.length - 1);
                    after = '/>' + after.substring(1);
                }

                // Append our a11y attributes
                lines[i] = before + ' role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === \'Enter\' || e.key === \' \') { e.preventDefault(); e.currentTarget.click(); } }}' + after;
            }
        }
    }
    content = lines.join('\n');

    if (content !== original) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log('Fixed roles in', filePath);
    }
});
