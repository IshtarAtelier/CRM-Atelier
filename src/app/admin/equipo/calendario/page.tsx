import { headers } from 'next/headers';
import CalendarioClient from './CalendarioClient';

export const metadata = { title: 'Feriados y pedidos del equipo' };

// Datos vivos y por usuario (quién puede anotar qué): nada que prerenderizar.
export const dynamic = 'force-dynamic';

export default async function CalendarioEquipoPage() {
    const h = await headers();
    return (
        <CalendarioClient
            yo={{
                id: h.get('x-user-id') || '',
                nombre: h.get('x-user-name') || 'Usuario',
                esAdmin: (h.get('x-user-role') || 'STAFF') === 'ADMIN',
            }}
        />
    );
}
