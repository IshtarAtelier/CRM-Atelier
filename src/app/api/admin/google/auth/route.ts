import { NextResponse } from 'next/server';
import { GoogleContactsService } from '@/services/google-contacts.service';

export async function GET() {
    try {
        const url = await GoogleContactsService.getAuthUrl();
        return NextResponse.redirect(url);
    } catch (error) {
        console.error('[Google Auth Error]', error);
        return NextResponse.json({ error: 'Error generating auth URL' }, { status: 500 });
    }
}
