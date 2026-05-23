import { NextResponse } from 'next/server';
import { ContactService } from '@/services/contact.service';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const requests = await ContactService.getAllPendingReviewRequests();
        return NextResponse.json(requests);
    } catch (error) {
        console.error('Error fetching pending review requests:', error);
        return NextResponse.json({ 
            error: 'Error al obtener solicitudes',
            message: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined
        }, { status: 500 });
    }
}
