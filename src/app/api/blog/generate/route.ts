import { NextResponse } from 'next/server';
import { generateWeeklyBlogPost } from '@/services/blog-agent.service';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const adminPhone = body.adminPhone; // We pass the phone dynamically from the frontend config or just use a default

        // Default to a hardcoded string if not passed, or from env 
        // In this project it's common to use an ENV or pass from front
        // As a fallback, we can use the default business phone or wait for config.
        const phone = adminPhone || process.env.ADMIN_WHATSAPP_PHONE || '5493512222222';

        const newPost = await generateWeeklyBlogPost(phone);

        return NextResponse.json({ success: true, post: newPost });
    } catch (error: any) {
        console.error('[API Blog Generate] Error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
