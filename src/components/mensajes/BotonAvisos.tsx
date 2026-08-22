"use client";

/**
 * El botón que activa los carteles del sistema operativo.
 *
 * Existe porque el permiso NO se puede pedir solo: Chrome ignora (y Firefox
 * penaliza) los pedidos que no salen de un clic de la persona. Un `requestPermission()`
 * al cargar la página no muestra nada y encima gasta el intento.
 *
 * Se muestra en tres estados distintos a propósito, porque las tres situaciones
 * necesitan que la persona haga cosas diferentes:
 *   · sin decidir → invitación a activarlos
 *   · activados   → confirmación discreta (así se sabe que están andando)
 *   · bloqueados  → hay que desbloquearlos desde el candado del navegador, y el
 *                   botón NO puede hacerlo por ella: el navegador no vuelve a
 *                   preguntar una vez que se dijo que no.
 */

import { useEffect, useState } from 'react';
import { Bell, BellOff, BellRing, Check } from 'lucide-react';
import { estadoAvisos, pedirPermiso, avisar, type EstadoAviso } from './avisos-escritorio';

export function BotonAvisos() {
    const [estado, setEstado] = useState<EstadoAviso>('no-soportado');

    // En el servidor no existe `Notification`: se lee recién en el navegador.
    useEffect(() => { setEstado(estadoAvisos()); }, []);

    if (estado === 'no-soportado') return null;

    if (estado === 'granted') {
        return (
            <div className="flex items-center gap-2 rounded-lg bg-green-50 px-3 py-2 text-xs text-green-800 ring-1 ring-green-200">
                <Check size={14} className="shrink-0" />
                <span>
                    <strong>Avisos activados.</strong> Te van a llegar aunque estés en otra pestaña o en otro programa.
                </span>
                <button
                    onClick={() => avisar({
                        titulo: '🔔 Avisos de Atelier',
                        cuerpo: 'Así se van a ver los mensajes del equipo.',
                        etiqueta: 'prueba',
                    })}
                    className="ml-auto shrink-0 rounded px-2 py-1 font-semibold underline hover:bg-green-100"
                >
                    Probar
                </button>
            </div>
        );
    }

    if (estado === 'denied') {
        return (
            <div className="flex items-start gap-2 rounded-lg bg-stone-100 px-3 py-2 text-xs text-stone-700 ring-1 ring-stone-200">
                <BellOff size={14} className="mt-0.5 shrink-0" />
                <span>
                    <strong>Los avisos están bloqueados en este navegador.</strong> Para volver a activarlos,
                    tocá el candado 🔒 al lado de la dirección web, buscá «Notificaciones» y ponelo en
                    «Permitir». Desde acá no se puede: una vez que se dijo que no, el navegador no vuelve a preguntar.
                </span>
            </div>
        );
    }

    return (
        <button
            onClick={async () => {
                const r = await pedirPermiso();
                setEstado(r);
                // Un aviso de prueba apenas se concede: así se ve dónde aparecen
                // y se confirma que quedaron andando, sin esperar a que llegue
                // un mensaje real.
                if (r === 'granted') {
                    avisar({
                        titulo: '🔔 Listo',
                        cuerpo: 'Te vamos a avisar acá cuando llegue un mensaje del equipo.',
                        etiqueta: 'prueba',
                    });
                }
            }}
            className="flex w-full items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-left text-xs text-amber-900 ring-1 ring-amber-200 transition hover:bg-amber-100"
        >
            <BellRing size={15} className="shrink-0 animate-pulse" />
            <span>
                <strong>Activá los avisos de escritorio.</strong> Te avisamos de los mensajes aunque
                estés en otra pestaña o en otro programa, como el correo.
            </span>
            <Bell size={14} className="ml-auto shrink-0" />
        </button>
    );
}
