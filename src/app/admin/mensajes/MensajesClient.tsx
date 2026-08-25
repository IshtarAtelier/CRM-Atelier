'use client';

/**
 * Mensajería interna: bandeja a la izquierda, conversación a la derecha.
 *
 * Lo no leído se ve de tres formas a la vez, a propósito: fondo distinto en la
 * fila, nombre en negrita y globo con el número. Con una sola señal, una
 * conversación sin leer se pierde entre veinte iguales — que es exactamente lo
 * que pasaba con el sistema anterior, donde directamente no había ninguna.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { usePulso } from '@/components/mensajes/PulsoProvider';
import { BotonAvisos } from '@/components/mensajes/BotonAvisos';
import { Send, Users, Plus, X, Loader2, MessagesSquare, ArrowLeft, UserPlus, AlertTriangle } from 'lucide-react';

interface Participante { id: string; name: string; role: string }
interface Conversacion {
    id: string; kind: string; subject: string | null; lastMessageAt: string;
    miRol: string; noLeidos: number; participantes: Participante[];
    ultimoMensaje: { body: string; createdAt: string; senderId: string; senderName: string } | null;
}
interface Mensaje {
    id: string; body: string; createdAt: string; editedAt: string | null;
    senderId: string; senderName: string; urgent?: boolean;
}
interface Colaborador { id: string; name: string; role: string }

/** dd/MM a las HH:mm, u "Hoy"/"Ayer" cuando es reciente. */
function cuando(iso: string): string {
    const d = new Date(iso);
    const hoy = new Date();
    const mismoDia = d.toDateString() === hoy.toDateString();
    const ayer = new Date(hoy); ayer.setDate(hoy.getDate() - 1);
    const hora = d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
    if (mismoDia) return hora;
    if (d.toDateString() === ayer.toDateString()) return `Ayer ${hora}`;
    return `${d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })} ${hora}`;
}

/** Cómo se llama una conversación en la lista: su asunto, o con quién es. */
function tituloDe(c: Conversacion, yoId: string): string {
    if (c.subject) return c.subject;
    const otros = c.participantes.filter(p => p.id !== yoId);
    if (otros.length === 0) return 'Sin destinatarios';
    if (otros.length <= 2) return otros.map(o => o.name).join(' y ');
    return `${otros[0].name} y ${otros.length - 1} más`;
}

/** El puntito verde de "está en línea ahora". */
function PuntoEnLinea({ activo }: { activo: boolean }) {
    return (
        <span
            title={activo ? 'En línea ahora' : 'Desconectado'}
            aria-label={activo ? 'En línea' : 'Desconectado'}
            className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-white ${
                activo ? 'bg-green-500 shadow-[0_0_6px_#22c55e]' : 'bg-stone-300'
            }`}
        />
    );
}

/**
 * QUIÉN ESTÁ CONECTADO. Una tira con todo el equipo: verde el que tiene el
 * sistema abierto ahora, gris el que no.
 *
 * Va arriba de todo y no escondida dentro de una conversación, porque la
 * pregunta «¿está Yani?» se hace ANTES de escribir, no después: sirve para
 * decidir si mandar un mensaje o levantar el teléfono.
 *
 * Tocar a alguien abre el redactor con esa persona ya elegida.
 */
function EquipoEnLinea({ onElegir }: { onElegir: (id: string) => void }) {
    const { enLinea, yoId } = usePulso();
    const [equipo, setEquipo] = useState<Colaborador[]>([]);

    useEffect(() => {
        fetch('/api/mensajes/colaboradores')
            .then(r => r.ok ? r.json() : null)
            .then(d => setEquipo(d?.colaboradores || []))
            .catch(() => {});
    }, []);

    if (equipo.length === 0) return null;

    // Los conectados primero: si el equipo crece, quién está disponible no
    // puede quedar al final de la fila detrás de cinco desconectados.
    const ordenado = [...equipo].sort((a, b) =>
        Number(enLinea.includes(b.id)) - Number(enLinea.includes(a.id)) || a.name.localeCompare(b.name));
    const conectados = equipo.filter(c => enLinea.includes(c.id)).length;

    return (
        <div className="rounded-xl border border-stone-200 bg-white px-4 py-3">
            <div className="mb-2 flex items-baseline gap-2">
                <span className="text-xs font-bold uppercase tracking-wide text-stone-500">Equipo</span>
                <span className="text-xs text-stone-500">
                    {conectados === 0
                        ? 'nadie más conectado ahora'
                        : `${conectados} conectado${conectados === 1 ? '' : 's'}`}
                    {yoId && ' · vos estás en línea'}
                </span>
            </div>
            <div className="flex flex-wrap gap-2">
                {ordenado.map(c => {
                    const activo = enLinea.includes(c.id);
                    return (
                        <button
                            key={c.id}
                            onClick={() => onElegir(c.id)}
                            title={`${c.name} — ${activo ? 'en línea ahora' : 'desconectado'}. Tocá para escribirle.`}
                            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                                activo
                                    ? 'border-green-300 bg-green-50 text-green-900 hover:bg-green-100'
                                    : 'border-stone-200 bg-white text-stone-500 hover:border-stone-300'
                            }`}
                        >
                            <PuntoEnLinea activo={activo} />
                            {c.name}
                            {/* El texto además del color: quien no distingue bien
                                los colores no puede depender solo del puntito. */}
                            <span className="text-[10px] font-normal opacity-70">
                                {activo ? 'en línea' : 'desconectado'}
                            </span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

export default function MensajesClient() {
    const { enLinea, refrescar, noLeidos } = usePulso();
    const searchParams = useSearchParams();
    const router = useRouter();
    const [conversaciones, setConversaciones] = useState<Conversacion[]>([]);
    const [yo, setYo] = useState<{ id: string; name: string } | null>(null);
    const [activa, setActiva] = useState<string | null>(null);
    const [mensajes, setMensajes] = useState<Mensaje[]>([]);
    const [participantes, setParticipantes] = useState<Participante[]>([]);
    const [asunto, setAsunto] = useState<string | null>(null);
    // Paginado del historial: el service pagina de a 50 y devuelve `hayMas`, y
    // la ruta acepta `?antesDe=`. Nadie lo usaba, así que en una conversación
    // activa todo lo anterior a los últimos 50 mensajes era invisible — el dato
    // estaba en la base y la API sabía servirlo, pero no había forma de pedirlo.
    const [hayMas, setHayMas] = useState(false);
    const [cargandoMas, setCargandoMas] = useState(false);
    const [texto, setTexto] = useState('');
    const [enviando, setEnviando] = useState(false);
    const [cargando, setCargando] = useState(true);
    const [redactando, setRedactando] = useState(false);
    const [preElegido, setPreElegido] = useState<string | null>(null);
    const [urgente, setUrgente] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const finRef = useRef<HTMLDivElement>(null);
    // La conversación que se PIDIÓ por última vez. Toda respuesta de red se
    // descarta si al llegar ya no es la pedida: clickeando dos conversaciones
    // seguidas, la respuesta LENTA de la primera llegaba después y pisaba a la
    // segunda — el panel mostraba una conversación con la otra resaltada, y los
    // refrescos posteriores FUSIONABAN mensajes de las dos en una lista mezclada
    // que no se arreglaba sola.
    const pedida = useRef<string | null>(null);
    // El contenedor scrolleable y una marca de "no bajes al fondo esta vez".
    // Sin esto, cargar mensajes anteriores cambiaba `mensajes` y el efecto de
    // auto-scroll devolvía la vista al último mensaje: la persona apretaba
    // "Ver anteriores", se cargaban, y no veía ni uno.
    const scrollRef = useRef<HTMLDivElement>(null);
    const anclarScroll = useRef<number | null>(null);

    const cargarBandeja = useCallback(async () => {
        try {
            const res = await fetch('/api/mensajes');
            if (!res.ok) throw new Error('No se pudo cargar');
            const data = await res.json();
            setConversaciones(data.conversaciones || []);
            setYo(data.yo || null);
        } catch {
            // Silencioso: se reintenta en el próximo ciclo. Un error de red no
            // tiene que vaciar la pantalla de lo que ya se estaba leyendo.
        } finally {
            setCargando(false);
        }
    }, []);

    const abrir = useCallback(async (id: string) => {
        setActiva(id);
        pedida.current = id;
        // Al cambiar de hilo no puede quedar un ancla de scroll pendiente del
        // anterior: consumiría el primer render del nuevo y aterrizaría en una
        // posición arbitraria.
        anclarScroll.current = null;
        try {
            const res = await fetch(`/api/mensajes/${id}`);
            if (!res.ok) throw new Error('No se pudo abrir la conversación');
            const data = await res.json();
            if (pedida.current !== id) return; // llegó tarde: ya se pidió otra
            setMensajes(data.mensajes || []);
            setParticipantes(data.participantes || []);
            setAsunto(data.subject || null);
            setHayMas(!!data.hayMas);
            // Al abrirla queda leída: se refleja en la bandeja, en la campanita
            // y hace desaparecer el globo de urgentes sin esperar al próximo latido.
            cargarBandeja();
            refrescar();
        } catch (e: any) {
            setError(e.message);
        }
    }, [cargarBandeja, refrescar]);

    useEffect(() => { cargarBandeja(); }, [cargarBandeja]);

    // El globo de urgentes manda a ?abrir=<id>: se abre esa conversación sola.
    // Y se LIMPIA el parámetro: si queda pegado en la URL, cualquier
    // re-ejecución del efecto te arrastra de vuelta a esa conversación aunque
    // hayas abierto otra a mano.
    useEffect(() => {
        const id = searchParams.get('abrir');
        if (!id) return;
        abrir(id);
        router.replace('/admin/mensajes', { scroll: false });
    }, [searchParams, abrir, router]);

    // UN SOLO RELOJ para toda la mensajería: el del pulso.
    //
    // Antes esta pantalla tenía su propio setInterval de 15 s ADEMÁS del latido
    // de 20 s del pulso. Dos reglas distintas sobre los mismos datos, que encima
    // coincidían cada 60 s (mínimo común múltiplo) mandando ráfagas simultáneas
    // contra el mismo pool de conexiones. Y `bandeja()` ya devuelve los no
    // leídos que el pulso vuelve a calcular: el mismo número por dos caminos.
    //
    // Ahora se recarga cuando el pulso DETECTA un cambio real. En reposo —nadie
    // escribió nada— no se pide nada: el costo de tener la pantalla abierta cae
    // de ~58 consultas por minuto a las del latido.
    useEffect(() => {
        cargarBandeja();
        if (activa) {
            const cual = activa;
            fetch(`/api/mensajes/${cual}`)
                .then(r => r.ok ? r.json() : null)
                .then(d => {
                    if (!d?.mensajes) return;
                    if (pedida.current !== cual) return; // se cambió de hilo en el medio
                    // FUSIONAR, no reemplazar: si se apretó "ver anteriores", la
                    // lista tiene más de una página y este refresco solo trae la
                    // última. Reemplazar tiraba a la basura todo el historial que
                    // la persona acababa de cargar, cada vez que llegaba un
                    // mensaje nuevo.
                    setMensajes(prev => {
                        const nuevos: Mensaje[] = d.mensajes;
                        if (prev.length === 0) return nuevos;
                        const idsNuevos = new Set(nuevos.map((m: Mensaje) => m.id));
                        const anteriores = prev.filter(m => !idsNuevos.has(m.id));
                        return [...anteriores, ...nuevos];
                    });
                })
                .catch(() => {});
        }
        // `noLeidos` es la señal: cambia cuando entra o se lee algo.
    }, [noLeidos]);

    useEffect(() => {
        // Volviendo de "ver anteriores": se restaura la posición de lectura en
        // vez de saltar al fondo. Se compara el alto de antes contra el de ahora
        // y se corre el scroll esa diferencia, así lo que se estaba leyendo
        // queda exactamente donde estaba.
        if (anclarScroll.current !== null && scrollRef.current) {
            const crecio = scrollRef.current.scrollHeight - anclarScroll.current;
            scrollRef.current.scrollTop = crecio;
            anclarScroll.current = null;
            return;
        }
        finRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [mensajes]);

    /** Trae la página anterior y la antepone, sin perder lo que ya se cargó. */
    const cargarAnteriores = async () => {
        if (!activa || cargandoMas || mensajes.length === 0) return;
        // Alto actual: la referencia para restaurar la posición de lectura.
        anclarScroll.current = scrollRef.current?.scrollHeight ?? null;
        setCargandoMas(true);
        try {
            const res = await fetch(`/api/mensajes/${activa}?antesDe=${encodeURIComponent(mensajes[0].createdAt)}`);
            if (!res.ok) throw new Error('No se pudieron traer los anteriores');
            const data = await res.json();
            const previos: Mensaje[] = data.mensajes || [];
            // Anteponer y deduplicar por id: el refresco del pulso puede haber
            // traído alguno de estos en el medio.
            setMensajes(prev => {
                const vistos = new Set(prev.map(m => m.id));
                return [...previos.filter(m => !vistos.has(m.id)), ...prev];
            });
            setHayMas(!!data.hayMas);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setCargandoMas(false);
        }
    };

    const enviar = async () => {
        const cuerpo = texto.trim();
        if (!cuerpo || !activa || enviando) return;
        setEnviando(true);
        setError(null);
        try {
            const res = await fetch(`/api/mensajes/${activa}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mensaje: cuerpo, urgent: urgente }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'No se pudo enviar');
            setTexto('');
            setUrgente(false);
            // FUSIONAR y no `abrir()`: abrir reemplaza la lista con la última
            // página y tiraba a la basura el historial que la persona hubiera
            // cargado con "ver anteriores". Mismo criterio que el refresco.
            const cualEnvio = activa;
            const d = await fetch(`/api/mensajes/${cualEnvio}`).then(r => r.ok ? r.json() : null).catch(() => null);
            if (d?.mensajes && pedida.current === cualEnvio) {
                setMensajes(prev => {
                    const nuevos: Mensaje[] = d.mensajes;
                    if (prev.length === 0) return nuevos;
                    const idsNuevos = new Set(nuevos.map((m: Mensaje) => m.id));
                    return [...prev.filter(m => !idsNuevos.has(m.id)), ...nuevos];
                });
            }
            cargarBandeja();
            refrescar();
        } catch (e: any) {
            // El texto NO se borra si falló: perder lo escrito por un problema de
            // red es la peor forma de enterarse de que algo salió mal.
            setError(e.message);
        } finally {
            setEnviando(false);
        }
    };

    const totalNoLeidos = conversaciones.reduce((n, c) => n + c.noLeidos, 0);

    return (
        <div className="flex flex-col h-[calc(100vh-2rem)] gap-4">
            <header className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                    <h1 className="text-2xl font-bold text-stone-800 flex items-center gap-2">
                        <MessagesSquare className="text-primary" size={26} />
                        Mensajes del Equipo
                    </h1>
                    <p className="text-sm text-stone-500">
                        {totalNoLeidos > 0
                            ? `Tenés ${totalNoLeidos} mensaje${totalNoLeidos === 1 ? '' : 's'} sin leer`
                            : 'Todo leído'}
                    </p>
                </div>
                <button
                    onClick={() => { setPreElegido(null); setRedactando(true); }}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-stone-800 text-white text-sm font-semibold hover:bg-stone-700 transition"
                >
                    <Plus size={16} /> Mensaje nuevo
                </button>
            </header>

            <BotonAvisos />

            <EquipoEnLinea onElegir={(id) => { setPreElegido(id); setRedactando(true); }} />

            {error && (
                <div className="flex items-center justify-between gap-3 px-4 py-2 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                    <span>{error}</span>
                    <button onClick={() => setError(null)}><X size={16} /></button>
                </div>
            )}

            <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-[320px_1fr] gap-4">
                {/* ── Bandeja ─────────────────────────────────────────── */}
                <aside className={`min-h-0 overflow-y-auto rounded-xl border border-stone-200 bg-white ${activa ? 'hidden md:block' : ''}`}>
                    {cargando ? (
                        <div className="p-6 text-center text-stone-400"><Loader2 className="animate-spin mx-auto" /></div>
                    ) : conversaciones.length === 0 ? (
                        <div className="p-6 text-center text-stone-400 text-sm">
                            Todavía no hay conversaciones.<br />Empezá una con «Mensaje nuevo».
                        </div>
                    ) : conversaciones.map(c => {
                        const sinLeer = c.noLeidos > 0;
                        return (
                            <button
                                key={c.id}
                                onClick={() => abrir(c.id)}
                                className={`w-full text-left px-4 py-3 border-b border-stone-100 transition
                                    ${activa === c.id ? 'bg-stone-100' : sinLeer ? 'bg-amber-50/70 hover:bg-amber-50' : 'hover:bg-stone-50'}`}
                            >
                                <div className="flex items-center gap-2">
                                    <span className={`flex-1 truncate text-sm ${sinLeer ? 'font-bold text-stone-900' : 'font-medium text-stone-700'}`}>
                                        {yo ? tituloDe(c, yo.id) : '…'}
                                    </span>
                                    {c.miRol === 'CC' && (
                                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-stone-200 text-stone-600" title="Estás en copia">
                                            EN COPIA
                                        </span>
                                    )}
                                    {sinLeer && (
                                        <span className="inline-flex items-center justify-center min-w-5 h-5 px-1.5 text-[10px] font-black text-white bg-red-500 rounded-full">
                                            {c.noLeidos}
                                        </span>
                                    )}
                                </div>
                                {c.ultimoMensaje && (
                                    <div className={`mt-0.5 text-xs truncate ${sinLeer ? 'text-stone-700' : 'text-stone-400'}`}>
                                        <span className="font-medium">
                                            {yo && c.ultimoMensaje.senderId === yo.id ? 'Vos' : c.ultimoMensaje.senderName}:
                                        </span>{' '}
                                        {c.ultimoMensaje.body}
                                    </div>
                                )}
                                <div className="mt-0.5 text-[10px] text-stone-400">{cuando(c.lastMessageAt)}</div>
                            </button>
                        );
                    })}
                </aside>

                {/* ── Conversación ────────────────────────────────────── */}
                <section className={`min-h-0 flex flex-col rounded-xl border border-stone-200 bg-white ${activa ? '' : 'hidden md:flex'}`}>
                    {!activa ? (
                        <div className="flex-1 grid place-items-center text-stone-400 text-sm">
                            Elegí una conversación
                        </div>
                    ) : (
                        <>
                            <div className="px-4 py-3 border-b border-stone-200 flex items-center gap-3">
                                <button onClick={() => setActiva(null)} className="md:hidden text-stone-500"><ArrowLeft size={18} /></button>
                                <div className="min-w-0">
                                    <div className="font-semibold text-stone-800 truncate">
                                        {asunto || participantes.filter(p => p.id !== yo?.id).map(p => p.name).join(', ')}
                                    </div>
                                    <div className="text-xs text-stone-400 flex items-center gap-1">
                                        <Users size={12} />
                                        {participantes.map((p, i) => (
                                            <span key={p.id} className="inline-flex items-center gap-1">
                                                {i > 0 && <span className="text-stone-300">·</span>}
                                                <PuntoEnLinea activo={enLinea.includes(p.id)} />
                                                {p.name}{p.role === 'CC' ? ' (copia)' : ''}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">
                                {hayMas && (
                                    <div className="flex justify-center pb-2">
                                        <button
                                            onClick={cargarAnteriores}
                                            disabled={cargandoMas}
                                            className="rounded-full border border-stone-300 px-4 py-1.5 text-xs font-semibold text-stone-600 transition hover:bg-stone-50 disabled:opacity-50"
                                        >
                                            {cargandoMas ? 'Trayendo…' : 'Ver mensajes anteriores'}
                                        </button>
                                    </div>
                                )}
                                {mensajes.map(m => {
                                    const mio = m.senderId === yo?.id;
                                    return (
                                        <div key={m.id} className={`flex ${mio ? 'justify-end' : 'justify-start'}`}>
                                            <div className={`max-w-[75%] rounded-2xl px-4 py-2 ${
                                                m.urgent
                                                    ? 'bg-red-50 text-stone-800 ring-2 ring-red-400'
                                                    : mio ? 'bg-stone-800 text-white' : 'bg-stone-100 text-stone-800'
                                            }`}>
                                                {m.urgent && (
                                                    <div className="mb-1 flex items-center gap-1 text-[10px] font-black uppercase tracking-wide text-red-700">
                                                        <AlertTriangle size={11} /> Urgente
                                                    </div>
                                                )}
                                                {!mio && <div className="text-[10px] font-bold text-primary mb-0.5">{m.senderName}</div>}
                                                <div className="text-sm whitespace-pre-wrap break-words">{m.body}</div>
                                                <div className={`text-[10px] mt-1 ${mio ? 'text-stone-400' : 'text-stone-400'}`}>{cuando(m.createdAt)}</div>
                                            </div>
                                        </div>
                                    );
                                })}
                                <div ref={finRef} />
                            </div>

                            <div className="p-3 border-t border-stone-200 flex items-end gap-2">
                                <textarea
                                    value={texto}
                                    onChange={e => setTexto(e.target.value)}
                                    onKeyDown={e => {
                                        // Enter envía, Shift+Enter hace salto de línea.
                                        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar(); }
                                    }}
                                    rows={2}
                                    placeholder="Escribí tu mensaje…  (Enter envía, Shift+Enter salta de línea)"
                                    className="flex-1 resize-none rounded-lg border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                                />
                                <button
                                    onClick={() => setUrgente(u => !u)}
                                    title={urgente ? 'Se enviará como URGENTE: le tapa la pantalla hasta que lo lea' : 'Marcar como urgente'}
                                    aria-pressed={urgente}
                                    className={`h-10 px-3 rounded-lg border transition inline-flex items-center gap-1.5 text-xs font-bold ${
                                        urgente
                                            ? 'bg-red-600 text-white border-red-600'
                                            : 'bg-white text-stone-500 border-stone-300 hover:border-red-300 hover:text-red-600'
                                    }`}
                                >
                                    <AlertTriangle size={15} /> {urgente ? 'URGENTE' : 'Urgente'}
                                </button>
                                <button
                                    onClick={enviar}
                                    disabled={!texto.trim() || enviando}
                                    className="h-10 px-4 rounded-lg bg-primary text-white disabled:opacity-40 hover:opacity-90 transition inline-flex items-center gap-2"
                                >
                                    {enviando ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                                </button>
                            </div>
                        </>
                    )}
                </section>
            </div>

            {redactando && (
                <RedactarModal
                    preElegido={preElegido}
                    onCerrar={() => setRedactando(false)}
                    onEnviado={(id) => { setRedactando(false); cargarBandeja(); abrir(id); }}
                />
            )}
        </div>
    );
}

/** Ventana de "mensaje nuevo": a quién, quién va en copia, asunto y texto. */
function RedactarModal({ onCerrar, onEnviado, preElegido }: { onCerrar: () => void; onEnviado: (id: string) => void; preElegido?: string | null }) {
    const { enLinea } = usePulso();
    const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
    const [para, setPara] = useState<string[]>(preElegido ? [preElegido] : []);
    const [copia, setCopia] = useState<string[]>([]);
    const [subject, setSubject] = useState('');
    const [mensaje, setMensaje] = useState('');
    const [urgente, setUrgente] = useState(false);
    const [enviando, setEnviando] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Escape cierra. Sin esto, quien no usa mouse queda atrapado en el modal.
    useEffect(() => {
        const alTeclear = (e: KeyboardEvent) => { if (e.key === 'Escape') onCerrar(); };
        window.addEventListener('keydown', alTeclear);
        return () => window.removeEventListener('keydown', alTeclear);
    }, [onCerrar]);

    useEffect(() => {
        fetch('/api/mensajes/colaboradores')
            .then(r => r.json())
            .then(d => setColaboradores(d.colaboradores || []))
            .catch(() => setError('No se pudo cargar el equipo'));
    }, []);

    // Nadie puede estar como destinatario y en copia a la vez: al marcarlo de un
    // lado se lo saca del otro, así no hay estados contradictorios que resolver
    // después en el servidor.
    const alternar = (id: string, lista: 'para' | 'copia') => {
        if (lista === 'para') {
            setCopia(c => c.filter(x => x !== id));
            setPara(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);
        } else {
            setPara(p => p.filter(x => x !== id));
            setCopia(c => c.includes(id) ? c.filter(x => x !== id) : [...c, id]);
        }
    };

    const enviar = async () => {
        if (para.length === 0) return setError('Elegí al menos un destinatario');
        if (!mensaje.trim()) return setError('Escribí el mensaje');
        setEnviando(true); setError(null);
        try {
            const res = await fetch('/api/mensajes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ paraIds: para, copiaIds: copia, subject: subject.trim() || null, mensaje, urgent: urgente }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'No se pudo enviar');
            onEnviado(data.id);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setEnviando(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 grid place-items-center p-4">
            <button
                type="button"
                aria-label="Cerrar"
                onClick={onCerrar}
                className="absolute inset-0 h-full w-full cursor-default bg-black/40"
            />
            <div role="dialog" aria-modal="true" aria-label="Mensaje nuevo"
                className="relative w-full max-w-lg rounded-xl bg-white shadow-xl">
                <div className="flex items-center justify-between px-5 py-3 border-b border-stone-200">
                    <h2 className="font-bold text-stone-800">Mensaje nuevo</h2>
                    <button onClick={onCerrar} className="text-stone-400 hover:text-stone-600"><X size={18} /></button>
                </div>

                <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
                    <div>
                        <label className="block text-xs font-bold text-stone-500 uppercase mb-2">Para</label>
                        <div className="flex flex-wrap gap-2">
                            {colaboradores.map(c => (
                                <button key={c.id} onClick={() => alternar(c.id, 'para')}
                                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition inline-flex items-center gap-1.5
                                        ${para.includes(c.id) ? 'bg-stone-800 text-white border-stone-800' : 'bg-white text-stone-600 border-stone-300 hover:border-stone-400'}`}>
                                    <PuntoEnLinea activo={enLinea.includes(c.id)} />{c.name}
                                </button>
                            ))}
                            {colaboradores.length === 0 && <span className="text-xs text-stone-400">No hay otros colaboradores cargados.</span>}
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-stone-500 uppercase mb-2 flex items-center gap-1">
                            <UserPlus size={12} /> En copia <span className="font-normal normal-case text-stone-400">(ven todo, no son los destinatarios)</span>
                        </label>
                        <div className="flex flex-wrap gap-2">
                            {colaboradores.map(c => (
                                <button key={c.id} onClick={() => alternar(c.id, 'copia')}
                                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition
                                        ${copia.includes(c.id) ? 'bg-primary text-white border-primary' : 'bg-white text-stone-500 border-stone-200 hover:border-stone-300'}`}>
                                    {c.name}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-stone-500 uppercase mb-1">Asunto <span className="font-normal normal-case text-stone-400">(opcional)</span></label>
                        <input value={subject} onChange={e => setSubject(e.target.value)}
                            className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-stone-500 uppercase mb-1">Mensaje</label>
                        <textarea value={mensaje} onChange={e => setMensaje(e.target.value)} rows={4}
                            className="w-full resize-none rounded-lg border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                    </div>

                    <button
                        onClick={() => setUrgente(u => !u)}
                        aria-pressed={urgente}
                        className={`w-full rounded-lg border-2 px-4 py-3 text-left transition ${
                            urgente ? 'border-red-500 bg-red-50' : 'border-stone-200 bg-white hover:border-stone-300'
                        }`}
                    >
                        <span className="flex items-center gap-2 text-sm font-bold text-stone-800">
                            <AlertTriangle size={16} className={urgente ? 'text-red-600' : 'text-stone-400'} />
                            Marcar como URGENTE
                        </span>
                        <span className="mt-0.5 block text-xs text-stone-500">
                            Le aparece un aviso sobre toda la pantalla, esté donde esté en el sistema.
                            Lo puede achicar, pero no se le va hasta que lo lea.
                        </span>
                    </button>

                    {error && <div className="text-sm text-red-600">{error}</div>}
                </div>

                <div className="flex justify-end gap-2 px-5 py-3 border-t border-stone-200">
                    <button onClick={onCerrar} className="px-4 py-2 text-sm text-stone-600 hover:text-stone-800">Cancelar</button>
                    <button onClick={enviar} disabled={enviando}
                        className="px-4 py-2 rounded-lg bg-stone-800 text-white text-sm font-semibold disabled:opacity-40 inline-flex items-center gap-2">
                        {enviando ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Enviar
                    </button>
                </div>
            </div>
        </div>
    );
}
