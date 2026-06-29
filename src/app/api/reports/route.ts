import { NextResponse } from 'next/server';
import { ReportService } from '@/services/report.service';
import { withErrorHandler } from '@/lib/api-handler';

export const dynamic = 'force-dynamic';

export const GET = withErrorHandler(async (request: Request) => {
    const role = request.headers.get('x-user-role') || 'STAFF';
    if (role !== 'ADMIN') {
        return NextResponse.json({ error: 'Acceso no autorizado' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    const reportData = await ReportService.generateReportData(from, to);
    
    return NextResponse.json(reportData);
});
