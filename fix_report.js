const fs = require('fs');
let code = fs.readFileSync('src/services/report.service.ts', 'utf8');

code = code.replace(/};\n    }\n        } catch/g, '};\n        } catch');

fs.writeFileSync('src/services/report.service.ts', code);
