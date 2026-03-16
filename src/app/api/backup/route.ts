import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import fs from 'fs';
import path from 'path';

// GET /api/backup — Download SQLite database file (ADMIN only)
export async function GET() {
    try {
        const headersList = await headers();
        const userRole = headersList.get('x-user-role');

        if (userRole !== 'ADMIN') {
            return NextResponse.json({ error: 'Solo administradores pueden descargar backups' }, { status: 403 });
        }

        const dbPath = path.join(process.cwd(), 'prisma', 'dev.db');

        if (!fs.existsSync(dbPath)) {
            return NextResponse.json({ error: 'Database file not found' }, { status: 404 });
        }

        const fileBuffer = fs.readFileSync(dbPath);
        const now = new Date();
        const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}`;
        const filename = `atelier-crm-backup-${timestamp}.db`;

        return new NextResponse(fileBuffer, {
            status: 200,
            headers: {
                'Content-Type': 'application/octet-stream',
                'Content-Disposition': `attachment; filename="${filename}"`,
                'Content-Length': String(fileBuffer.length),
            },
        });
    } catch (error: any) {
        console.error('Error creating backup:', error);
        return NextResponse.json({ error: error.message || 'Error creating backup' }, { status: 500 });
    }
}
