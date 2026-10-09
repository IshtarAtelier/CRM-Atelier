import { headers } from 'next/headers';
import { unstable_cache } from 'next/cache';
import { Cormorant_Garamond } from 'next/font/google';
import { getGoogleReviews } from '@/lib/googleReviews';
import GiftCardsClient from './GiftCardsClient';

export const metadata = { title: 'Gift Cards' };

// Datos vivos y por usuario (quién puede reactivar o anular): nada que prerenderizar.
export const dynamic = 'force-dynamic';

// La serifa de la marca (la misma de las piezas de redes, scripts/social/identidad.mjs).
const serifMarca = Cormorant_Garamond({ subsets: ['latin'], weight: ['500'], style: ['normal', 'italic'], display: 'swap' });

// Las reseñas de la tarjeta son las REALES de Google (regla de prueba social:
// nunca un número escrito a mano). Se piden como mucho cada 6 horas.
const resenasGoogle = unstable_cache(
    async () => {
        const r = await getGoogleReviews().catch(() => ({ rating: 0, userRatingCount: 0 }));
        return { rating: Number(r.rating) || 0, cantidad: Number(r.userRatingCount) || 0 };
    },
    ['gift-card-resenas'],
    { revalidate: 21600 },
);

export default async function GiftCardsPage() {
    const h = await headers();
    const resenas = await resenasGoogle();
    return (
        <GiftCardsClient
            esAdmin={(h.get('x-user-role') || 'STAFF') === 'ADMIN'}
            fuenteSerif={serifMarca.style.fontFamily}
            claseSerif={serifMarca.className}
            resenas={resenas}
        />
    );
}
