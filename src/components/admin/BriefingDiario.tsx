'use client';

// ────────────────────────────────────────────────────────────────────────────
// El BRIEFING DIARIO que aparece cuando un vendedor abre el panel, una vez por
// día. OBLIGATORIO, igual que las novedades guiadas: sin X, sin cerrar
// clickeando afuera, sin Escape. La única salida es recorrer las 3 fichas y
// escribir al final qué se le pidió — que es, además, lo que le llega a Ishtar
// por la mensajería interna.
//
// Quién lo tiene pendiente lo decide /api/briefing-diario (server, día
// argentino); acá vive el CONTENIDO. Los números de cada ficha son los reales
// de esa persona: un mínimo sin el número al lado es un cartel, no un reporte.
//
// ACCESIBILIDAD (no es un detalle acá): hay una compañera con baja visión y
// esto lo va a ver todos los días. Texto de 15-16 px en vez de los 11-13 px
// habituales del panel, contraste medido ≥ 7:1 en casi todo (piso 4,5:1),
// targets de 44 px, foco visible con anillo + separación, y ningún estado
// comunicado solo por color: "Cumplido" / "Te faltaron 7" van escritos.
// ────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from 'react';
import {
    AlertTriangle, ArrowLeft, ArrowRight, Calculator, Camera, CheckCircle2,
    ClipboardList, Coffee, Gift, Headphones, Loader2, Lock, Mic, Send, Star,
} from 'lucide-react';
import {
    BRIEFING_MINIMO_PRESUPUESTOS, BRIEFING_MINIMO_TEXTO,
    BRIEFING_TAREAS_MAX, BRIEFING_TAREAS_MIN,
} from '@/lib/constants/briefing';

interface Actividad {
    presupuestos: number;
    tareasCerradas: number;
    resenasPedidas: number;
}

interface Pendiente {
    pendiente: boolean;
    nombre?: string;
    /** "viernes, 29/08" — el día del que hablan los números. */
    dia?: string;
    actividad?: Actividad | null;
}

// ── Estilos compartidos ─────────────────────────────────────────────────────
// El anillo de foco lleva `ring-offset` para que se vea también sobre los
// botones oscuros: sin separación, un anillo verde sobre verde no existe.
const BOTON =
    'inline-flex items-center justify-center gap-2 min-h-11 px-5 rounded-xl text-sm font-black uppercase tracking-wider transition-colors'
    + ' focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ring-offset-white dark:ring-offset-stone-900'
    + ' focus-visible:ring-emerald-700 dark:focus-visible:ring-emerald-300';

// Verde 700 (y no el 600 del resto del panel): blanco sobre emerald-600 da
// 3,67:1 y no llega al piso de 4,5:1 para texto chico. El 700 da 5,37:1.
// En oscuro se invierte —texto oscuro sobre verde claro— y sube a 9,05:1.
const BOTON_PRIMARIO = `${BOTON} bg-emerald-700 hover:bg-emerald-800 text-white`
    + ' dark:bg-emerald-400 dark:hover:bg-emerald-300 dark:text-stone-900'
    // Deshabilitado con color sólido, nunca con opacidad: bajarle la opacidad
    // al texto es exactamente lo que no se puede leer con baja visión.
    + ' disabled:bg-stone-500 disabled:text-white dark:disabled:bg-stone-500 dark:disabled:text-white';

const BOTON_SECUNDARIO = `${BOTON} bg-white text-stone-800 border-2 border-stone-400 hover:bg-stone-100`
    + ' dark:bg-stone-800 dark:text-stone-100 dark:border-stone-500 dark:hover:bg-stone-700';

const TARJETA = 'rounded-2xl border-2 border-stone-200 dark:border-stone-700 bg-stone-100 dark:bg-stone-800 p-4';
const TEXTO = 'text-[15px] leading-relaxed text-stone-700 dark:text-stone-200';
const TITULO_FILA = 'text-base font-black text-stone-900 dark:text-white';

/** Ítem con ícono: el ícono es decorativo, todo lo que importa está escrito. */
function Fila({ icono: Icono, titulo, children }: {
    icono: React.ComponentType<{ className?: string }>;
    titulo: string;
    children: React.ReactNode;
}) {
    return (
        <li className={TARJETA}>
            <div className="flex items-start gap-3">
                <Icono className="w-5 h-5 mt-0.5 shrink-0 text-stone-700 dark:text-stone-200" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                    <p className={TITULO_FILA}>{titulo}</p>
                    <div className={`${TEXTO} mt-1 space-y-2`}>{children}</div>
                </div>
            </div>
        </li>
    );
}

/** "Cumplido" / "Te faltaron 7". Ícono + palabra, nunca solo el color. */
function Marca({ ok, texto }: { ok: boolean; texto: string }) {
    const Icono = ok ? CheckCircle2 : AlertTriangle;
    const estilo = ok
        ? 'bg-emerald-50 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200'
        : 'bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-200';
    return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-sm font-black ${estilo}`}>
            <Icono className="w-4 h-4 shrink-0" aria-hidden="true" />
            {texto}
        </span>
    );
}

export default function BriefingDiario() {
    const [estado, setEstado] = useState<Pendiente | null>(null);
    const [ficha, setFicha] = useState(0);
    const [texto, setTexto] = useState('');
    const [vueltasAtras, setVueltasAtras] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [guardando, setGuardando] = useState(false);

    const caja = useRef<HTMLDivElement>(null);
    const encabezado = useRef<HTMLHeadingElement>(null);
    const campo = useRef<HTMLTextAreaElement>(null);

    const abierto = !!estado?.pendiente;

    useEffect(() => {
        let vivo = true;
        fetch('/api/briefing-diario')
            .then(r => (r.ok ? r.json() : { pendiente: false }))
            .then(d => { if (vivo && d?.pendiente) setEstado(d); })
            .catch(() => { /* sin red no se traba el panel */ });
        return () => { vivo = false; };
    }, []);

    // Mientras está abierto no hay nada más con lo que interactuar: se bloquea
    // el scroll del fondo y el Tab da vueltas adentro del modal. Sin la trampa
    // de foco, quien navega con teclado se va al panel de atrás y queda con el
    // cursor en una pantalla que no puede ver ni usar.
    useEffect(() => {
        if (!abierto) return;
        const scrollPrevio = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        const alTeclear = (e: KeyboardEvent) => {
            if (e.key !== 'Tab' || !caja.current) return;
            const foco = Array.from(
                caja.current.querySelectorAll<HTMLElement>('button, textarea, a[href], [tabindex]:not([tabindex="-1"])'),
            ).filter(el => !el.hasAttribute('disabled'));
            if (foco.length === 0) return;
            const primero = foco[0];
            const ultimo = foco[foco.length - 1];
            if (e.shiftKey && document.activeElement === primero) { e.preventDefault(); ultimo.focus(); }
            else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primero.focus(); }
        };

        document.addEventListener('keydown', alTeclear);
        return () => {
            document.removeEventListener('keydown', alTeclear);
            document.body.style.overflow = scrollPrevio;
        };
    }, [abierto]);

    // Al cambiar de ficha el foco va al título: es lo que hace que el lector de
    // pantalla lea la ficha nueva en vez de quedarse callado.
    useEffect(() => {
        if (abierto) encabezado.current?.focus();
    }, [ficha, abierto]);

    if (!abierto) return null;

    const nombre = estado?.nombre || 'equipo';
    // "Ayer (domingo 30-08)": el día va escrito porque un lunes "ayer" es
    // domingo, y un cero de domingo no es lo mismo que un cero de martes.
    const dia = estado?.dia ? `Ayer (${estado.dia})` : 'Ayer';
    const a = estado?.actividad ?? null;
    const sinActividad = !!a && a.presupuestos + a.tareasCerradas + a.resenasPedidas === 0;

    const volverAEmpezar = () => {
        setVueltasAtras(v => v + 1);
        setError(null);
        setFicha(0);
    };

    const terminar = async () => {
        const limpio = texto.trim();
        if (limpio.length < BRIEFING_MINIMO_TEXTO) {
            setError('Escribí un poquito más: con eso no alcanza para saber que quedó claro.');
            campo.current?.focus();
            return;
        }
        setError(null);
        setGuardando(true);
        try {
            const res = await fetch('/api/briefing-diario', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ texto: limpio, vueltasAtras }),
            });
            // Solo se cierra si el server lo registró: si falló, mañana no tiene
            // que "haberse hecho solo" ni perderse lo que escribió.
            if (res.ok) { setEstado(null); return; }
            const datos = await res.json().catch(() => ({}));
            setError(datos?.error || 'No se pudo guardar. Probá de nuevo en un momento.');
        } catch {
            setError('No se pudo guardar: revisá la conexión y probá de nuevo.');
        }
        setGuardando(false);
    };

    // ── Las 3 fichas ────────────────────────────────────────────────────────
    const fichas = [
        {
            titulo: 'No olvides mirar tu reporte de trabajo',
            cuerpo: (
                <>
                    <p className={TEXTO}>
                        Buen día, {nombre}. Arrancamos por lo tuyo: estos son los mínimos del día y cómo venís.
                    </p>
                    <ul className="mt-4 space-y-3">
                        <Fila icono={ClipboardList} titulo="Presupuestos">
                            <p>Mínimo <strong>{BRIEFING_MINIMO_PRESUPUESTOS} por día</strong>.</p>
                            {a && (
                                <p className="flex flex-wrap items-center gap-2">
                                    <span>{dia}: hiciste <strong>{a.presupuestos}</strong>.</span>
                                    <Marca
                                        ok={a.presupuestos >= BRIEFING_MINIMO_PRESUPUESTOS}
                                        texto={a.presupuestos >= BRIEFING_MINIMO_PRESUPUESTOS
                                            ? 'Cumplido'
                                            : `Te faltaron ${BRIEFING_MINIMO_PRESUPUESTOS - a.presupuestos}`}
                                    />
                                </p>
                            )}
                        </Fila>

                        <Fila icono={CheckCircle2} titulo="Tareas">
                            <p>Entre <strong>{BRIEFING_TAREAS_MIN} y {BRIEFING_TAREAS_MAX} por día</strong>.</p>
                            {a && (
                                <p className="flex flex-wrap items-center gap-2">
                                    <span>{dia}: cerraste <strong>{a.tareasCerradas}</strong>.</span>
                                    <Marca
                                        ok={a.tareasCerradas >= BRIEFING_TAREAS_MIN}
                                        texto={a.tareasCerradas >= BRIEFING_TAREAS_MIN
                                            ? 'Cumplido'
                                            : `Te faltaron ${BRIEFING_TAREAS_MIN - a.tareasCerradas}`}
                                    />
                                </p>
                            )}
                        </Fila>

                        <Fila icono={Star} titulo="El comentario">
                            <p>
                                Pedile el comentario a <strong>todos</strong> los clientes a los que les entregaste.
                                A todos, no a los que te parece que van a decir que sí.
                            </p>
                            {a && (
                                <p>{dia}: pediste <strong>{a.resenasPedidas}</strong>.</p>
                            )}
                        </Fila>
                    </ul>

                    {sinActividad && (
                        <p className={`${TARJETA} ${TEXTO} mt-3`}>
                            {dia} no quedó actividad tuya registrada. Si fue tu franco, ignorá los números de arriba.
                        </p>
                    )}

                    <p className={`${TARJETA} ${TEXTO} mt-3 flex items-start gap-2`}>
                        <Lock className="w-5 h-5 shrink-0 mt-0.5" aria-hidden="true" />
                        <span>Este briefing no se puede saltear: son 3 fichas cortas y al final te vamos a pedir que escribas qué se te pidió.</span>
                    </p>
                </>
            ),
        },
        {
            titulo: 'A los clientes se los atiende online',
            cuerpo: (
                <>
                    <p className={TEXTO}>
                        Que el cliente no esté en el local no quiere decir atenderlo a medias. Online se atiende igual de bien que en el mostrador.
                    </p>
                    <ul className="mt-4 space-y-3">
                        <Fila icono={Mic} titulo="Con audios">
                            <p>Mandale audios. Escuchar tu voz no es lo mismo que leer un texto: se nota que hay alguien atendiéndolo.</p>
                        </Fila>
                        <Fila icono={Camera} titulo="Con fotos">
                            <p>Mandale fotos. Del armazón, del color, de cómo le queda. Que vea lo que le estás contando.</p>
                        </Fila>
                        <Fila icono={Calculator} titulo="Con el presupuesto del sistema">
                            <p>
                                El presupuesto sale <strong>siempre del sistema</strong>. Nunca de memoria ni escrito a mano:
                                ahí es donde se cuelan los precios viejos y las promos que ya no van.
                            </p>
                        </Fila>
                    </ul>
                    <p className="mt-4 p-4 rounded-2xl bg-emerald-50 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200 text-base font-bold leading-relaxed flex items-start gap-2">
                        <Headphones className="w-5 h-5 shrink-0 mt-0.5" aria-hidden="true" />
                        <span>Una buena atención online asegura mayores posibilidades de cierre.</span>
                    </p>
                </>
            ),
        },
        {
            titulo: 'En el local: café, caramelos y un detalle',
            cuerpo: (
                <>
                    <ul className="space-y-3">
                        <Fila icono={Coffee} titulo="Café y caramelos, a todos">
                            <p>
                                Ofrecele café y caramelos a <strong>todos</strong> los que entran.
                                A todos, sin adivinar quién va a comprar y quién no.
                            </p>
                        </Fila>
                        <Fila icono={Gift} titulo="Ticket alto: un bombón o un chocolate">
                            <p>
                                Si es un <strong>ticket alto</strong>, sumale un bombón o un chocolate. Algo más cuidado:
                                se están llevando algo importante y tiene que notarse.
                            </p>
                        </Fila>
                    </ul>

                    <div className="mt-5">
                        <label htmlFor="briefing-texto" className="block text-base font-black text-stone-900 dark:text-white">
                            Ahora escribime con tus palabras qué se te pidió hoy.
                        </label>
                        <p id="briefing-ayuda" className={`${TEXTO} mt-1`}>
                            No es un examen: con que escribas lo que te quedó, alcanza. Lo lee Ishtar.
                        </p>
                        <textarea
                            id="briefing-texto"
                            ref={campo}
                            value={texto}
                            onChange={e => { setTexto(e.target.value); if (error) setError(null); }}
                            rows={4}
                            maxLength={2000}
                            aria-describedby={error ? 'briefing-ayuda briefing-error' : 'briefing-ayuda'}
                            aria-invalid={!!error}
                            placeholder="Ej.: 15 presupuestos, entre 5 y 10 tareas, pedirle el comentario a todos los que entregué, atender con audios y fotos y el presupuesto del sistema, y ofrecer café y caramelos."
                            className={'mt-2 w-full rounded-2xl border-2 p-3 text-[15px] leading-relaxed resize-y'
                                + ' bg-white text-stone-900 placeholder:text-stone-500'
                                + ' dark:bg-stone-800 dark:text-white dark:placeholder:text-stone-400'
                                + ' focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ring-offset-white dark:ring-offset-stone-900'
                                + ' focus-visible:ring-emerald-700 dark:focus-visible:ring-emerald-300 '
                                + (error
                                    ? 'border-rose-800 dark:border-rose-300'
                                    : 'border-stone-400 dark:border-stone-500')}
                        />
                        {error && (
                            <p
                                id="briefing-error"
                                role="alert"
                                className="mt-2 p-3 rounded-xl bg-rose-50 text-rose-800 dark:bg-rose-950 dark:text-rose-300 text-[15px] font-bold flex items-start gap-2"
                            >
                                <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" aria-hidden="true" />
                                <span>{error}</span>
                            </p>
                        )}
                    </div>
                </>
            ),
        },
    ];

    const esUltima = ficha === fichas.length - 1;

    return (
        // Sin onClick en el fondo y sin listener de Escape: no hay forma de
        // cerrarlo que no sea terminar la última ficha. Es a propósito.
        <div
            className="fixed inset-0 z-[195] bg-black/70 flex items-center justify-center p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="briefing-titulo"
        >
            <div
                ref={caja}
                className="bg-white dark:bg-stone-900 rounded-[2rem] border-2 border-stone-200 dark:border-stone-700 shadow-2xl max-w-xl w-full max-h-[92vh] overflow-y-auto p-6 sm:p-8"
            >
                <p className="text-sm font-black uppercase tracking-widest text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                    <Send className="w-4 h-4" aria-hidden="true" />
                    Briefing del día · Ficha {ficha + 1} de {fichas.length}
                </p>

                <h2
                    id="briefing-titulo"
                    ref={encabezado}
                    tabIndex={-1}
                    className="text-2xl font-black text-stone-900 dark:text-white mt-3 mb-4 tracking-tight focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 dark:focus-visible:ring-emerald-300 rounded-lg"
                >
                    {fichas[ficha].titulo}
                </h2>

                <div>{fichas[ficha].cuerpo}</div>

                <div className="flex flex-wrap items-center justify-between gap-3 mt-7">
                    {/* Decorativo: el "Ficha 1 de 3" de arriba es lo que informa.
                        Aun así la actual es más ancha y no solo de otro color. */}
                    <div className="flex gap-1.5" aria-hidden="true">
                        {fichas.map((_, i) => (
                            <span
                                key={i}
                                className={`h-2.5 rounded-full ${i === ficha
                                    ? 'w-7 bg-emerald-700 dark:bg-emerald-300'
                                    : i < ficha
                                        ? 'w-2.5 bg-stone-600 dark:bg-stone-300'
                                        : 'w-2.5 bg-stone-300 dark:bg-stone-600'}`}
                            />
                        ))}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        {esUltima ? (
                            <button type="button" onClick={volverAEmpezar} className={BOTON_SECUNDARIO}>
                                <ArrowLeft className="w-4 h-4" aria-hidden="true" />
                                Tengo dudas, quiero volver a leer
                            </button>
                        ) : ficha > 0 ? (
                            <button type="button" onClick={() => setFicha(f => f - 1)} className={BOTON_SECUNDARIO}>
                                <ArrowLeft className="w-4 h-4" aria-hidden="true" />
                                Atrás
                            </button>
                        ) : null}

                        {esUltima ? (
                            <button type="button" onClick={terminar} disabled={guardando} className={BOTON_PRIMARIO}>
                                {guardando
                                    ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                                    : <CheckCircle2 className="w-4 h-4" aria-hidden="true" />}
                                {guardando ? 'Guardando…' : 'Listo, a trabajar'}
                            </button>
                        ) : (
                            <button type="button" onClick={() => setFicha(f => f + 1)} className={BOTON_PRIMARIO}>
                                Siguiente
                                <ArrowRight className="w-4 h-4" aria-hidden="true" />
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
