const fs = require('fs');
let code = fs.readFileSync('src/services/order.service.ts', 'utf8');

code = code.replace(/export async function GET\(\s*request: Request,\s*\{\s*params\s*\}:\s*\{\s*params:\s*Promise<\{\s*id:\s*string\s*\}>\s*\}\s*\)\s*\{/g, "export class OrderService {\n  static async getOrder(id: string) {");
code = code.replace(/export async function DELETE\(\s*request: Request,\s*\{\s*params\s*\}:\s*\{\s*params:\s*Promise<\{\s*id:\s*string\s*\}>\s*\}\s*\)\s*\{/g, "  static async deleteOrder(id: string, reason: string, role: string, userId: string, userName: string) {");
code = code.replace(/export async function PATCH\(\s*request: Request,\s*\{\s*params\s*\}:\s*\{\s*params:\s*Promise<\{\s*id:\s*string\s*\}>\s*\}\s*\)\s*\{/g, "  static async updateOrder(id: string, body: any) {");

code = code.replace(/const \{ id \} = await params;/g, "");
code = code.replace(/const body = await request\.json\(\);/g, "");

// Convert NextResponse to returns or throws
code = code.replace(/return NextResponse\.json\(\{\s*error:\s*(.+?)\s*\}\s*,\s*\{\s*status:\s*(\d+)\s*\}\s*\);/g, "throw new Error($1);");
code = code.replace(/return NextResponse\.json\((.*?)\);/g, "return $1;");

code += "\n}";

fs.writeFileSync('src/services/order.service.ts', code);
