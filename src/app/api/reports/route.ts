import { NextResponse } from 'next/server';
import { ReportService } from '@/services/report.service';
import { withErrorHandler } from '@/lib/api-handler';
import { serverCache } from '@/lib/cache';

export const dynamic = 'force-dynamic';

export const GET = withErrorHandler(async (request: Request) => {
    const role = request.headers.get('x-user-role') || 'STAFF';
    if (role !== 'ADMIN') {
        return NextResponse.json({ error: 'Acceso no autorizado' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    const cacheKey = `reports:${from || 'all'}:${to || 'all'}`;
    const cached = serverCache.get<any>(cacheKey);
    if (cached !== null) {
        return NextResponse.json(cached);
    }

    const reportData = await ReportService.generateReportData(from, to);
    
    serverCache.set(cacheKey, reportData, 60); // Cache for 60 seconds
    
    return NextResponse.json(reportData);
});
