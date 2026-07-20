import { NextResponse } from 'next/server';
import { BackupService } from '@/lib/backup';

/**
 * Backup automático programado de la base. Corre el export completo (JSON gzip)
 * y limpia los backups viejos. Dar de alta en el scheduler (cron-job.org) una vez
 * al día apuntando a esta URL con el header Authorization: Bearer <CRON_SECRET>.
 *
 * Cierra el gap del audit: hasta ahora el backup era SOLO manual (POST /api/backup)
 * y `db:backup` es no-op en Postgres.
 */
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(request: Request) {
  if (!CRON_SECRET) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
  }
  // Solo header Authorization (nunca ?secret= en la URL → no queda en logs/proxies).
  const hostname = new URL(request.url).hostname;
  const isLocalDev = hostname === 'localhost' || hostname === '127.0.0.1';
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${CRON_SECRET}` && !isLocalDev) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const result = await BackupService.executeFullBackup();
    let cleaned = 0;
    try {
      cleaned = await BackupService.cleanOldBackups(30);
    } catch (e) {
      console.error('[cron/backup] cleanOldBackups falló:', e);
    }
    return NextResponse.json({ success: true, backup: result, cleanedOld: cleaned });
  } catch (error: any) {
    console.error('[cron/backup] error:', error);
    return NextResponse.json({ error: error.message || 'Backup falló' }, { status: 500 });
  }
}
