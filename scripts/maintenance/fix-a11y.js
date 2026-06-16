const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
    fs.readdirSync(dir).forEach(f => {
        let dirPath = path.join(dir, f);
        let isDirectory = fs.statSync(dirPath).isDirectory();
        isDirectory ? 
            walkDir(dirPath, callback) : callback(path.join(dir, f));
    });
}

const focusRegex = /focus:outline-none(?! focus-visible)/g;
const focusReplace = 'focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none';

walkDir('./src', function(filePath) {
    if (filePath.endsWith('.tsx') || filePath.endsWith('.jsx')) {
        let content = fs.readFileSync(filePath, 'utf8');
        let original = content;

        // Fix contrasts and text sizes properly without matching text-xs again
        content = content.replace(/text-stone-300/g, 'text-stone-500');
        content = content.replace(/text-stone-400/g, 'text-stone-600');
        content = content.replace(/text-gray-400/g, 'text-gray-600');
        content = content.replace(/text-\[9px\]/g, 'text-xs');
        content = content.replace(/text-\[10px\]/g, 'text-xs');

        // Focus
        content = content.replace(focusRegex, focusReplace);

        // Fix missing roles
        content = content.replace(/<(div|span|p)([^>]*)onClick={([^}]*)}/g, (match, tag, attrs, onclick) => {
            if (!attrs.includes('role=') && !attrs.includes('role ')) {
                return `<${tag}${attrs}onClick={${onclick}} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.currentTarget.click(); } }}`;
            }
            return match;
        });

        // Add empty alt to imgs missing alt
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
