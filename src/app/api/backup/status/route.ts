import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { BackupService } from '@/lib/backup';

// GET /api/backup/status — Obtiene el estado del sistema de backups (ADMIN only)
export async function GET() {
    try {
        const headersList = await headers();
        const userRole = headersList.get('x-user-role');

        if (userRole !== 'ADMIN') {
            return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
        }

        const status = await BackupService.getBackupStatus();

        return NextResponse.json(status);
    } catch (error: any) {
        console.error('Error obteniendo estado de backups:', error);
        return NextResponse.json({ error: error.message || 'Error del servidor' }, { status: 500 });
    }
}
