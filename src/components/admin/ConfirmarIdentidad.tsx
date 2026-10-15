'use client';

// Cada HORAS_ENTRE_CONFIRMACIONES horas de trabajo activo pregunta quién está
// frente a la computadora compartida (Milena / Matías). Ver
// src/lib/constants/confirmar-identidad.ts.
//
// El reloj vive en localStorage y es de la COMPUTADORA, no de la pestaña: si
// hay dos pestañas abiertas suman una sola vez (cada tick solo agrega el
// tiempo transcurrido desde la última marca global).

import { useCallback, useEffect, useState } from 'react';
import { UserRound } from 'lucide-react';
import {
    HORAS_ENTRE_CONFIRMACIONES,
    MINUTOS_INACTIVIDAD,
    NOMBRES_VISIBLES,
    USUARIOS_COMPARTIDOS,
    usuarioCompartido,
} from '@/lib/constants/confirmar-identidad';

const CLAVE = 'identidad-compartida';
const TICK_MS = 30_000;
const LIMITE_MS = HORAS_ENTRE_CONFIRMACIONES * 60 * 60 * 1000;
const INACTIVIDAD_MS = MINUTOS_INACTIVIDAD * 60 * 1000;
// Si pasó más que esto entre dos ticks la compu estuvo dormida: no es trabajo.
const SALTO_MAXIMO_MS = TICK_MS * 4;

interface Reloj {
    userId: string;
    acumuladoMs: number;
    ultimaMarca: number;
}

function leer(): Reloj | null {
    try {
        const crudo = localStorage.getItem(CLAVE);
        return crudo ? (JSON.parse(crudo) as Reloj) : null;
    } catch {
        return null;
    }
}

function guardar(reloj: Reloj) {
    try {
        localStorage.setItem(CLAVE, JSON.stringify(reloj));
    } catch {
        // Sin localStorage el reloj queda en memoria de la pestaña (ver abajo).
    }
}

export default function ConfirmarIdentidad({ userName, userId }: { userName: string; userId: string }) {
    const propio = usuarioCompartido(userName);
    const [preguntando, setPreguntando] = useState(false);
    const [saliendo, setSaliendo] = useState(false);

    useEffect(() => {
        if (!propio) return;

        let ultimaActividad = Date.now();
        const marcarActividad = () => { ultimaActividad = Date.now(); };
        const eventos = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'] as const;
        eventos.forEach((e) => window.addEventListener(e, marcarActividad, { passive: true }));

        // Otro usuario (o primera vez): el reloj arranca de cero.
        let reloj = leer();
        if (!reloj || reloj.userId !== userId) {
            reloj = { userId, acumuladoMs: 0, ultimaMarca: Date.now() };
            guardar(reloj);
        } else if (reloj.acumuladoMs >= LIMITE_MS) {
            setPreguntando(true);
        }

        const tick = () => {
            const ahora = Date.now();
            const actual = leer() ?? reloj!;
            const transcurrido = ahora - actual.ultimaMarca;
            const activo =
                document.visibilityState === 'visible' &&
                ahora - ultimaActividad < INACTIVIDAD_MS &&
                transcurrido > 0 &&
                transcurrido <= SALTO_MAXIMO_MS;
            const siguiente: Reloj = {
                userId,
                acumuladoMs: actual.acumuladoMs + (activo ? transcurrido : 0),
                ultimaMarca: ahora,
            };
            reloj = siguiente;
            guardar(siguiente);
            if (siguiente.acumuladoMs >= LIMITE_MS) setPreguntando(true);
        };

        const id = window.setInterval(tick, TICK_MS);
        return () => {
            window.clearInterval(id);
            eventos.forEach((e) => window.removeEventListener(e, marcarActividad));
        };
    }, [propio, userId]);

    const elegir = useCallback(
        async (elegido: (typeof USUARIOS_COMPARTIDOS)[number]) => {
            if (elegido === propio) {
                guardar({ userId, acumuladoMs: 0, ultimaMarca: Date.now() });
                setPreguntando(false);
                return;
            }
            // Era el otro: se cierra esta sesión para que entre con su usuario.
            setSaliendo(true);
            try {
                localStorage.removeItem(CLAVE);
                await fetch('/api/auth/logout', { method: 'POST' });
            } finally {
                window.location.href = '/login';
            }
        },
        [propio, userId],
    );

    if (!propio || !preguntando) return null;

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="identidad-titulo"
            className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60 p-4"
        >
            <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-2xl">
                <UserRound className="mx-auto mb-3 h-8 w-8 text-stone-600" aria-hidden />
                <h2 id="identidad-titulo" className="text-xl font-semibold text-stone-900">
                    ¿Quién está trabajando?
                </h2>
                <p className="mt-2 text-sm text-stone-600">
                    Comparten la computadora. Confirmá quién sos para que cada venta y cada nota
                    quede a nombre de la persona correcta.
                </p>
                <div className="mt-5 grid grid-cols-2 gap-3">
                    {USUARIOS_COMPARTIDOS.map((u) => (
                        <button
                            key={u}
                            type="button"
                            disabled={saliendo}
                            onClick={() => elegir(u)}
                            className="rounded-xl border border-stone-300 bg-stone-50 px-4 py-3 text-base font-medium text-stone-900 hover:bg-stone-100 disabled:opacity-50"
                        >
                            Soy {NOMBRES_VISIBLES[u]}
                        </button>
                    ))}
                </div>
                <p className="mt-4 text-xs text-stone-500">
                    Si sos la otra persona, se cierra esta sesión y entrás con tu usuario.
                </p>
            </div>
        </div>
    );
}
