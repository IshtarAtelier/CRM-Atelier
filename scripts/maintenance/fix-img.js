const fs = require('fs');

const files = [
    'src/app/admin/inventario/page.tsx'
];

files.forEach(filePath => {
    let content = fs.readFileSync(filePath, 'utf8');
    let original = content;

    content = content.replace(/<img([\s\S]*?)>/g, (match, attrs) => {
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
        console.log('Fixed img in', filePath);
    }
});
