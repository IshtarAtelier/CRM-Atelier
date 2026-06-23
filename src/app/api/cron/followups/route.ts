import { spawn } from 'child_process';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    
    // Verificación básica para evitar que cualquiera lo dispare
    if (searchParams.get('key') !== 'atelier2026') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        // Lanzar el script en segundo plano de forma independiente (detached)
        // para que la respuesta HTTP no se quede colgando y el bot trabaje tranquilo.
        const child = spawn('npx', ['tsx', 'scripts/broadcast-followup.ts'], {
            detached: true,
            stdio: 'ignore'
        });
        
        child.unref();

        return NextResponse.json({ 
            status: 'success',
            message: '🚀 Bot de seguimiento masivo iniciado en segundo plano. Procesará los cierres de este mes.' 
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
