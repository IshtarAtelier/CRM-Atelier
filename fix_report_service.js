const fs = require('fs');

const path = 'src/services/report.service.ts';
let code = fs.readFileSync(path, 'utf8');

// The method generateReportData starts at `static async generateReportData`
// I'll just add try/catch if it doesn't have it.

if (!code.includes('try {') && code.includes('generateReportData')) {
    code = code.replace(
        /static async generateReportData\((.*?)\) \{/,
        `static async generateReportData($1) {\n        try {`
    );
    code = code.replace(/}(\s*)$/, `        } catch (error) {\n            console.error('Error in generateReportData:', error);\n            throw error;\n        }\n    }\n}`);
}
fs.writeFileSync(path, code);
