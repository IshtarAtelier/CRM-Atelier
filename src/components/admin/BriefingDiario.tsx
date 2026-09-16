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
// comunicado solo por color: "Cumplido" / "Te quedaron 7" van escritos.
// ────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from 'react';
import {
    AlertTriangle, ArrowLeft, ArrowRight, Calculator, Camera, CheckCircle2,
    ClipboardList, Coffee, ExternalLink, Gift, Headphones, Loader2, Lock, Mic, Send, Star, Tag, Wallet,
} from 'lucide-react';
import {
    BRIEFING_MINIMO_TEXTO, objetivosDe, type ObjetivosBriefing,
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
    /** Los mínimos de ESTA persona: no son los mismos para todos. */
    objetivos?: ObjetivosBriefing;
    /** Número de día argentino: con él rota el orden de las fichas de siempre. */
    rotacion?: number;
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

/** "Cumplido" / "Te quedaron 7". Ícono + palabra, nunca solo el color. */
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
    const [objetivoDelDia, setObjetivoDelDia] = useState('');
    // El tilde del arqueo: sin él la ficha no deja avanzar. Es la única de todo
    // el briefing que pide un acto y no una lectura, así que se responde ahí.
    const [arqueoHecho, setArqueoHecho] = useState(false);
    const [vueltasAtras, setVueltasAtras] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [guardando, setGuardando] = useState(false);

    const caja = useRef<HTMLDivElement>(null);
    const encabezado = useRef<HTMLHeadingElement>(null);
    const campo = useRef<HTMLTextAreaElement>(null);
    const campoObjetivo = useRef<HTMLTextAreaElement>(null);

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
    // Si el server no los mandó (respuesta vieja cacheada), se recalculan acá
    // con el mismo nombre: nunca se muestran los mínimos de otra persona.
    const objetivos = estado?.objetivos ?? objetivosDe(nombre);
    const sinActividad = !!a && a.presupuestos + a.tareasCerradas + a.resenasPedidas === 0;

    const volverAEmpezar = () => {
        setVueltasAtras(v => v + 1);
        setError(null);
        setFicha(0);
    };

    const terminar = async () => {
        const limpio = texto.trim();
        if (limpio.length < BRIEFING_MINIMO_TEXTO) {
            setError('Contame un poquito más, así sé que quedó claro.');
            campo.current?.focus();
            return;
        }
        // El objetivo del día va CON PALABRAS y no con un número: "10" no dice
        // nada que el mínimo no diga ya; "cerrar los dos multifocales que quedaron
        // de ayer" sí (pedido de Ishtar, 16/9/2026).
        const objetivo = objetivoDelDia.trim();
        if (objetivo.length < BRIEFING_MINIMO_TEXTO) {
            setError('Contame tu objetivo de hoy con palabras: qué te proponés lograr.');
            campoObjetivo.current?.focus();
            return;
        }
        setError(null);
        setGuardando(true);
        try {
            const res = await fetch('/api/briefing-diario', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ texto: limpio, objetivo, vueltasAtras }),
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

    // ── La ficha propia de cada uno ─────────────────────────────────────────
    // Lo que se le pide a UNA persona y no al resto. Va por NOMBRE, igual que
    // los objetivos: los ids de usuario difieren entre bases, y un id mal
    // copiado le muestra a alguien el pedido de otro sin error a la vista.
    // Quien no tenga ficha propia sigue viendo las 3 de siempre.
    const n = (nombre || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const propias: { titulo: string; cuerpo: React.ReactNode; trabada?: boolean }[] = [];

    if (n.includes('milena')) {
        propias.push({
            titulo: 'Arqueo de caja y las capturas',
            cuerpo: (
                <>
                    <ul className="space-y-3">
                        <Fila icono={Wallet} titulo="Hacé el arqueo de caja">
                            <p>
                                Las dos cajas: la tuya y la de Matías. Todos los días, aunque
                                haya sido un día tranquilo.
                            </p>
                        </Fila>
                        <Fila icono={Camera} titulo="Mandá las dos capturas al grupo de lotes">
                            <p>
                                Una de la caja de Matías y otra de la tuya, las dos al
                                <strong> grupo de lotes</strong>. Con esas dos, el día queda cerrado.
                            </p>
                        </Fila>
                    </ul>

                    {/* El acceso directo: el arqueo se hace acá al lado, no
                        buscando la pantalla en el menú con el modal abierto. */}
                    <a
                        href="/admin/caja/cierres"
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`${BOTON_SECUNDARIO} mt-4`}
                    >
                        <Wallet className="w-4 h-4" aria-hidden="true" />
                        Abrir la caja para hacer el arqueo
                        <ExternalLink className="w-4 h-4" aria-hidden="true" />
                    </a>

                    <label className="mt-4 flex items-start gap-3 p-4 rounded-2xl border-2 border-stone-400 dark:border-stone-500 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={arqueoHecho}
                            onChange={e => setArqueoHecho(e.target.checked)}
                            className="w-6 h-6 shrink-0 mt-0.5 accent-emerald-700 dark:accent-emerald-400"
                        />
                        <span className="text-[15px] font-bold text-stone-900 dark:text-white leading-relaxed">
                            Listo: hice el arqueo de las dos cajas y mandé las capturas al grupo de lotes.
                        </span>
                    </label>
                    {!arqueoHecho && (
                        <p className={`${TARJETA} ${TEXTO} mt-3 flex items-start gap-2`}>
                            <Lock className="w-5 h-5 shrink-0 mt-0.5" aria-hidden="true" />
                            <span>Cuando lo tengas hecho, tildalo y seguimos.</span>
                        </p>
                    )}
                </>
            ),
            trabada: !arqueoHecho,
        });
    }

    if (n.includes('matias')) {
        propias.push({
            titulo: 'Etiquetá todo y mandá audios',
            cuerpo: (
                <>
                    <ul className="space-y-3">
                        <Fila icono={Tag} titulo="Etiquetá TODO">
                            <p>
                                Cada conversación, etiquetada. Es lo que después nos deja saber de dónde
                                vino ese cliente y en qué quedaron.
                            </p>
                        </Fila>
                        <Fila icono={Mic} titulo="Mandá audios">
                            <p>
                                Sumale audios al texto. Escuchar tu voz no es lo mismo que leer: se nota
                                que hay alguien atendiendo del otro lado.
                            </p>
                        </Fila>
                    </ul>
                </>
            ),
        });
    }

    // ── Las fichas ──────────────────────────────────────────────────────────
    const fichas = [
        {
            titulo: 'No olvides mirar tu reporte de trabajo',
            cuerpo: (
                <>
                    <p className={TEXTO}>
                        Estos son los mínimos del día y cómo venís.
                    </p>
                    <ul className="mt-4 space-y-3">
                        <Fila icono={ClipboardList} titulo="Presupuestos">
                            <p>Mínimo <strong>{objetivos.presupuestos} por día</strong>.</p>
                            {a && (
                                <p className="flex flex-wrap items-center gap-2">
                                    <span>{dia}: hiciste <strong>{a.presupuestos}</strong>.</span>
                                    <Marca
                                        ok={a.presupuestos >= objetivos.presupuestos}
                                        texto={a.presupuestos >= objetivos.presupuestos
                                            ? 'Cumplido'
                                            : `Te quedaron ${objetivos.presupuestos - a.presupuestos}`}
                                    />
                                </p>
                            )}
                        </Fila>

                        <Fila icono={CheckCircle2} titulo="Tareas">
                            <p>{objetivos.tareasMax
                                ? <>Entre <strong>{objetivos.tareasMin} y {objetivos.tareasMax} por día</strong>.</>
                                : <>Mínimo <strong>{objetivos.tareasMin} por día</strong>.</>}</p>
                            {a && (
                                <p className="flex flex-wrap items-center gap-2">
                                    <span>{dia}: cerraste <strong>{a.tareasCerradas}</strong>.</span>
                                    <Marca
                                        ok={a.tareasCerradas >= objetivos.tareasMin}
                                        texto={a.tareasCerradas >= objetivos.tareasMin
                                            ? 'Cumplido'
                                            : `Te quedaron ${objetivos.tareasMin - a.tareasCerradas}`}
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
                            {dia} no quedó actividad tuya registrada. Si fue tu franco, ni mires los números de arriba.
                        </p>
                    )}

                    <p className={`${TARJETA} ${TEXTO} mt-3 flex items-start gap-2`}>
                        <Lock className="w-5 h-5 shrink-0 mt-0.5" aria-hidden="true" />
                        <span>Son un par de fichas cortas y al final te pedimos que escribas qué te llevás. Un minuto y seguimos.</span>
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

                </>
            ),
        },
    ];


    // El cierre va SIEMPRE último, pase lo que pase con el orden de arriba: es
    // donde escribe qué se le pidió, y sin eso el modal no se cierra.
    const cierre = {
        titulo: 'Contame qué te llevás de hoy',
        cuerpo: (
            <>
                    <div className="mt-5">
                        <label htmlFor="briefing-texto" className="block text-base font-black text-stone-900 dark:text-white">
                            Contame con tus palabras qué se te pidió hoy.
                        </label>
                        <p id="briefing-ayuda" className={`${TEXTO} mt-1`}>
                            No es un examen: con lo que te haya quedado, alcanza. Lo lee Ishtar.
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
                            placeholder={`Ej.: ${objetivos.presupuestos} presupuestos, ${objetivos.tareasMax ? `entre ${objetivos.tareasMin} y ${objetivos.tareasMax}` : objetivos.tareasMin} tareas, pedirle el comentario a todos los que entregué, atender con audios y fotos y el presupuesto del sistema, y ofrecer café y caramelos.`}
                            className={'mt-2 w-full rounded-2xl border-2 p-3 text-[15px] leading-relaxed resize-y'
                                + ' bg-white text-stone-900 placeholder:text-stone-500'
                                + ' dark:bg-stone-800 dark:text-white dark:placeholder:text-stone-400'
                                + ' focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ring-offset-white dark:ring-offset-stone-900'
                                + ' focus-visible:ring-emerald-700 dark:focus-visible:ring-emerald-300 '
                                + (error
                                    ? 'border-rose-800 dark:border-rose-300'
                                    : 'border-stone-400 dark:border-stone-500')}
                        />
                        <label htmlFor="briefing-objetivo" className="block text-base font-black text-stone-900 dark:text-white mt-5">
                            ¿Y cuál es tu objetivo para hoy?
                        </label>
                        <p id="briefing-objetivo-ayuda" className={`${TEXTO} mt-1`}>
                            Con palabras, no con un número: qué te gustaría lograr hoy.
                        </p>
                        <textarea
                            id="briefing-objetivo"
                            ref={campoObjetivo}
                            value={objetivoDelDia}
                            onChange={e => { setObjetivoDelDia(e.target.value); if (error) setError(null); }}
                            rows={3}
                            maxLength={2000}
                            aria-describedby={error ? 'briefing-objetivo-ayuda briefing-error' : 'briefing-objetivo-ayuda'}
                            aria-invalid={!!error}
                            placeholder="Ej.: cerrar los dos multifocales que quedaron de ayer y llamar a los que no contestaron."
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
                        <p className="mt-5 p-4 rounded-2xl bg-emerald-50 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200 text-base font-bold leading-relaxed">
                            ¡Que tengas un muy buen día y buenas ventas, {nombre}! Gracias por el minuto.
                        </p>
                    </div>
            </>
        ),
    };

    // Cuántas de las fichas de siempre ve cada uno. Milena hace el arqueo y
    // procesa los pedidos: su día no es el de un vendedor de mostrador, y un
    // briefing largo que no le habla a ella se lee sin leerse (Ishtar,
    // 16/9/2026). Le quedan dos: la suya y su reporte, más el cierre, que no es
    // salteable porque es donde escribe.
    //
    // Al resto le toca UNA por día, no las dos: cuatro fichas iguales todas las
    // mañanas son un montón y se pasan de largo. Como rotan, en dos días ve las
    // mismas dos de siempre, pero nunca las dos juntas.
    const cuantasDeSiempre = n.includes('milena') ? 0 : 1;

    // El orden de las de siempre rota con el día: son las mismas de memoria, y
    // leídas siempre en la misma posición se vuelven paisaje. Su reporte queda
    // fijo primero — son SUS números, no una cartelera.
    const [reporte, ...resto] = fichas;
    const giro = (estado?.rotacion ?? 0) % (resto.length || 1);
    const rotadas = [...resto.slice(giro), ...resto.slice(0, giro)].slice(0, cuantasDeSiempre);

    // Las propias van PRIMERO (pedido de Ishtar, 16/9/2026): lo que se le pide a
    // esa persona en particular es lo que tiene que leer con la cabeza fresca,
    // no después de tres fichas que ya vio ayer.
    //
    // Las propias NUNCA rotan ni se recortan: la del arqueo tiene que estar
    // todos los días (Ishtar, 16/9/2026). Lo que se saltea o se da vuelta son
    // las de siempre, que son recordatorios; el arqueo es trabajo del día.
    const orden: { titulo: string; cuerpo: React.ReactNode; trabada?: boolean }[] =
        [...propias, reporte, ...rotadas, cierre];

    const esUltima = ficha === orden.length - 1;

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
                    Briefing del día · Ficha {ficha + 1} de {orden.length}
                </p>

                {/* El saludo va en la PRIMERA ficha, sea cual sea: el orden
                    cambia con el día y con lo que le toca a cada uno, así que
                    atado a una ficha en particular aparecería por la mitad. */}
                {ficha === 0 && (
                    <p className="text-lg font-black text-stone-900 dark:text-white mt-3">
                        ¡Buen día, {nombre}! 👋
                    </p>
                )}

                <h2
                    id="briefing-titulo"
                    ref={encabezado}
                    tabIndex={-1}
                    className="text-2xl font-black text-stone-900 dark:text-white mt-3 mb-4 tracking-tight focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 dark:focus-visible:ring-emerald-300 rounded-lg"
                >
                    {orden[ficha].titulo}
                </h2>

                <div>{orden[ficha].cuerpo}</div>

                <div className="flex flex-wrap items-center justify-between gap-3 mt-7">
                    {/* Decorativo: el "Ficha 1 de 3" de arriba es lo que informa.
                        Aun así la actual es más ancha y no solo de otro color. */}
                    <div className="flex gap-1.5" aria-hidden="true">
                        {orden.map((_, i) => (
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
                                {guardando ? 'Guardando…' : '¡Listo, a vender!'}
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={() => setFicha(f => f + 1)}
                                disabled={!!orden[ficha].trabada}
                                className={BOTON_PRIMARIO}
                            >
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
