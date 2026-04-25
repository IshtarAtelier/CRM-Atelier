import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { BackupService } from '@/lib/backup';

// GET /api/backup — Download full DB backup (ADMIN only)
export async function GET() {
    try {
        const headersList = await headers();
        const userRole = headersList.get('x-user-role');

        if (userRole !== 'ADMIN') {
            return NextResponse.json({ error: 'Solo administradores pueden descargar backups' }, { status: 403 });
        }

        const fileBuffer = await BackupService.createBackup();
        const now = new Date();
        const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}`;
        const filename = `atelier-crm-backup-${timestamp}.json.gz`;

        return new NextResponse(new Uint8Array(fileBuffer), {
            status: 200,
            headers: {
                'Content-Type': 'application/gzip',
                'Content-Disposition': `attachment; filename="${filename}"`,
                'Content-Length': String(fileBuffer.length),
            },
        });
    } catch (error: any) {
        console.error('Error creating backup:', error);
        return NextResponse.json({ error: error.message || 'Error creating backup' }, { status: 500 });
    }
}

// POST /api/backup — Force a backup execution (ADMIN only)
export async function POST() {
    try {
        const headersList = await headers();
        const userRole = headersList.get('x-user-role');

        if (userRole !== 'ADMIN') {
            return NextResponse.json({ error: 'Solo administradores pueden forzar backups' }, { status: 403 });
        }

        const backupResult = await BackupService.executeFullBackup();
        
        return NextResponse.json({ 
            success: true, 
            message: 'Backup generado y guardado exitosamente',
            backup: backupResult
        });
    } catch (error: any) {
        console.error('Error forcing backup:', error);
        return NextResponse.json({ error: error.message || 'Error executing backup' }, { status: 500 });
    }
}
