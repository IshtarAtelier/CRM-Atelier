import { NextResponse } from 'next/server';
import { BackupService } from '@/lib/backup';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Endpoint público pero protegido por secreto
export async function GET(request: Request) {
    try {
        const authHeader = request.headers.get('authorization');
        
        // Verificación del secreto cron
        if (
            !process.env.CRON_SECRET ||
            authHeader !== `Bearer ${process.env.CRON_SECRET}`
        ) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }

        const startTime = Date.now();
        console.log('⏰ Ejecutando cron job de backup automático...');

        // 1. Ejecutar Backup Completo a S3/Local
        const backupResult = await BackupService.executeFullBackup();
        
        // 2. Limpiar antiguos (mantener últimos 30 días)
        const deletedCount = await BackupService.cleanOldBackups(30);
        
        // 3. Sincronizar Producción a Desarrollo (si las variables existen)
        let syncStatus = 'skipped';
        const hasProdUrl = !!process.env.PROD_DATABASE_URL;
        const hasDevUrl = !!process.env.DEV_DATABASE_URL;
        
        // Nos aseguramos de correrlo sólo en producción cuando las variables están
        if (hasProdUrl && hasDevUrl) {
            try {
                console.log('🔄 Ejecutando sincronización de producción a desarrollo...');
                // Ejecuta el script de sincronización
                const { stdout, stderr } = await execAsync('node scripts/sync-prod-to-dev.js');
                if (stderr && !stderr.includes('Sincronización exitosa')) {
                    console.warn('Advertencias durante sync:', stderr);
                }
                syncStatus = 'success';
            } catch (err: any) {
                console.error('Error durante sincronización cron:', err);
                syncStatus = `error: ${err.message}`;
            }
        }

        const duration = Date.now() - startTime;

        return NextResponse.json({ 
            success: true, 
            backup: backupResult,
            cleaned: deletedCount,
            sync: syncStatus,
            durationMs: duration
        });

    } catch (error: any) {
        console.error('Error en cron de backup:', error);
        return NextResponse.json({ error: error.message || 'Error executing cron backup' }, { status: 500 });
    }
}
