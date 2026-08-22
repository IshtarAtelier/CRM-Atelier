import MensajesClient from './MensajesClient';

export const metadata = { title: 'Mensajes del Equipo' };

// Toda la pantalla es interactiva y los datos son por usuario: no hay nada que
// prerenderizar ni cachear, y una versión estática le mostraría a una persona
// la bandeja de otra.
export const dynamic = 'force-dynamic';

export default function MensajesPage() {
    return (
        <div className="p-4">
            <MensajesClient />
        </div>
    );
}
