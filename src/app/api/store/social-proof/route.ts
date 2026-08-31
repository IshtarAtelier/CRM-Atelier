import { NextResponse } from 'next/server';
import { getSocialProof } from '@/lib/social-proof';

export const dynamic = 'force-dynamic';

// GET /api/store/social-proof — conteos REALES para los carteles de prueba
// social de la ficha de producto ("Elegido por N clientes" y el respaldo por
// marca). Los mapas llegan ya filtrados por umbral desde getSocialProof():
// lo que no alcanza para mostrarse no viaja, así que este endpoint público no
// expone las ventas producto por producto.
//
// Doble caché: 1 h en memoria (getSocialProof) + CDN vía s-maxage, porque un
// conteo de ventas no puede pegarle a la base en cada pageview de la tienda.
export async function GET() {
    const data = await getSocialProof();
    return NextResponse.json(data, {
        headers: {
            'Cache-Control': 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400',
        },
    });
}
