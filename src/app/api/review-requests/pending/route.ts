import { NextResponse } from 'next/server';
import { ContactService } from '@/services/contact.service';
import { serverCache } from '@/lib/cache';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const cacheKey = 'review-requests-pending';
        const cached = serverCache.get<any>(cacheKey);
        if (cached !== null) {
            return NextResponse.json(cached);
        }

        const requests = await ContactService.getAllPendingReviewRequests();
        serverCache.set(cacheKey, requests, 60); // Cache for 60 seconds
        return NextResponse.json(requests);
    } catch (error) {
        console.error('Error fetching pending review requests:', error);
        return NextResponse.json({ 
            error: 'Error al obtener solicitudes',
            message: error instanceof Error ? error.message : String(error)
        }, { status: 500 });
    }
}
