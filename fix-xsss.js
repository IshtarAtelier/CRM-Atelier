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

walkDir('./src', function(filePath) {
    if (filePath.endsWith('.tsx') || filePath.endsWith('.jsx')) {
        let content = fs.readFileSync(filePath, 'utf8');
        let original = content;

        content = content.replace(/text-xsssss/g, 'text-xs');
        content = content.replace(/text-xssss/g, 'text-xs');
        content = content.replace(/text-xsss/g, 'text-xs');
        content = content.replace(/text-xss/g, 'text-xs');

        // And let's fix the original text-[9px] and text-[10px] correctly this time
        content = content.replace(/text-\[9px\]/g, 'text-xs');
        content = content.replace(/text-\[10px\]/g, 'text-xs');

        if (content !== original) {
            fs.writeFileSync(filePath, content, 'utf8');
            console.log('Fixed xsss in', filePath);
        }
    }
});
