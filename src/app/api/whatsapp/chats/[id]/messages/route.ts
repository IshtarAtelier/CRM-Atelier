import { NextResponse } from 'next/server';

import { WA_SERVER_URL } from '@/lib/wa-config';

// GET /api/whatsapp/chats/[id]/messages
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    try {
        const res = await fetch(`${WA_SERVER_URL}/api/chats/${id}/messages`, { cache: 'no-store' });
        const data = await res.json();
        
        if (Array.isArray(data)) {
            const { getSignedUrl } = await import('@/lib/storage');
            const messagesWithUrls = await Promise.all(data.map(async (msg: any) => {
                if (msg.mediaUrl) {
                    msg.mediaUrl = await getSignedUrl(msg.mediaUrl);
                }
                return msg;
            }));
            return NextResponse.json(messagesWithUrls);
        }
        return NextResponse.json(data);
    } catch (e: any) {
        console.error('Error fetching messages:', e);
        return NextResponse.json([]);
    }
}
