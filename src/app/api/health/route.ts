import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

// Health check para monitoreo externo (cron-job.org): responde 200 si la app
// y la base de datos están vivas, 503 si la DB no contesta en 5 segundos.
export async function GET() {
  try {
    await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('DB timeout (5s)')), 5000)
      ),
    ]);
    return NextResponse.json({ status: 'ok', db: 'up' });
  } catch (error: any) {
    console.error('[Health] DB check failed:', error?.message);
    return NextResponse.json(
      { status: 'error', db: 'down' },
      { status: 503 }
    );
  }
}
