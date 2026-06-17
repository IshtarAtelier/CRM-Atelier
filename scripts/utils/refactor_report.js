const fs = require('fs');

const filePath = 'src/services/report.service.ts';
let code = fs.readFileSync(filePath, 'utf8');

// I'll skip complex AST manipulation and just replace the whole class.
// Since generateReportData is the only big function there.
// Actually, it's safer to just create a new file and replace it.
