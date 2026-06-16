const fs = require('fs');

const path = 'src/app/admin/layout.tsx';
let code = fs.readFileSync(path, 'utf8');

if (!code.includes('ErrorBoundary')) {
    code = code.replace(
        /import \{ CopilotChat \} from "@\/components\/admin\/CopilotChat";/,
        'import { CopilotChat } from "@/components/admin/CopilotChat";\nimport { ErrorBoundary } from "@/components/ErrorBoundary";'
    );
    code = code.replace(
        /{children}/,
        '<ErrorBoundary>{children}</ErrorBoundary>'
    );
    fs.writeFileSync(path, code);
}
