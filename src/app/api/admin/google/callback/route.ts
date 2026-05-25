import { NextResponse } from 'next/server';
import { GoogleContactsService } from '@/services/google-contacts.service';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const error = searchParams.get('error');

    // Podemos redirigir de vuelta a una página de settings del CRM
    const redirectUrl = new URL('/admin/settings', request.url);

    if (error) {
        console.error('[Google Callback Error]', error);
        redirectUrl.searchParams.set('error', 'google_auth_failed');
        return NextResponse.redirect(redirectUrl);
    }

    if (!code) {
        redirectUrl.searchParams.set('error', 'no_code');
        return NextResponse.redirect(redirectUrl);
    }

    try {
        const success = await GoogleContactsService.handleCallback(code);
        if (success) {
            redirectUrl.searchParams.set('success', 'google_contacts_connected');
        } else {
            redirectUrl.searchParams.set('error', 'no_refresh_token');
        }
        return NextResponse.redirect(redirectUrl);
    } catch (err) {
        console.error('[Google Callback Exception]', err);
        redirectUrl.searchParams.set('error', 'exception');
        return NextResponse.redirect(redirectUrl);
    }
}
