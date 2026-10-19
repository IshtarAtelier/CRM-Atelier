'use client';

// ────────────────────────────────────────────────────────────────────────────
// El guiado de novedades que aparece al abrir el admin, OBLIGATORIO para su
// audiencia (pedido de Ishtar, 24/8/26): sin X, sin cerrar clickeando afuera,
// sin Escape. La única salida es recorrer los pasos y confirmar al final —
// "no les permitas decir que no quieren ver".
//
// Quién lo tiene pendiente lo decide /api/novedades (server); acá vive el
// CONTENIDO de cada guiado, indexado por el mismo id. El visto se marca en el
// server: cambiar de máquina o de navegador no lo hace reaparecer.
// ────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Palette, Sun, Ruler, Lock, Gift, Check, X as XIcon, ArrowRight, Loader2, AlertTriangle, FileText, MessageCircle } from 'lucide-react';
import { AVISO_TENIDO_2X1 } from '@/lib/promo-utils';

interface Paso {
    titulo: string;
    cuerpo: React.ReactNode;
}

/** Si el guiado trae opciones, el último paso cierra con ellas en vez de "Entendido". */
const OPCIONES: Record<string, { texto: string; principal?: boolean; festejo?: boolean }[]> = {
    'desafio-resenas-lens-cerro-2026-10': [
        { texto: 'Me aseguro de no terminar el día sin lograrlo', principal: true, festejo: true },
        { texto: 'Dejá, me gusta el segundo puesto' },
    ],
};

const GUIADOS: Record<string, Paso[]> = {
    'solicitar-factura-2026-10': [
        {
            titulo: 'Cambió cómo se pide una factura',
            cuerpo: (
                <>
                    <p>Desde ahora las facturas <strong>no se piden solas</strong> al cargar un pago. Las pedís vos, desde la venta, en 3 pasos. Es 1 minuto.</p>
                    <p className="flex items-center gap-2 mt-3 p-3 rounded-xl bg-stone-100 dark:bg-stone-800 text-stone-500 dark:text-stone-400">
                        <Lock className="w-4 h-4 shrink-0" />
                        Este aviso no se puede saltear: el botón para cerrarlo aparece en el último paso.
                    </p>
                </>
            ),
        },
        {
            titulo: '1. Tocá «Solicitar factura» en la venta',
            cuerpo: (
                <>
                    <p>En la ficha del cliente, abrí la venta: el botón amarillo <strong>Solicitar factura</strong> está debajo de <em>Abonar</em> y <em>Calcular</em>, con el monto que falta facturar al lado.</p>
                    <div className="mt-3 flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 font-black text-[11px] uppercase tracking-widest ring-2 ring-rose-500 ring-offset-2 ring-offset-white dark:ring-offset-stone-900">
                        <FileText className="w-4 h-4" /> Solicitar factura <span className="opacity-60">· $110.000</span>
                    </div>
                    <p className="mt-3">También está en <strong>Ventas</strong>: el ícono de hoja amarillo en la fila de la venta.</p>
                    <p className="flex items-center gap-2 mt-3 text-amber-600 dark:text-amber-500 font-bold">
                        <AlertTriangle className="w-4 h-4 shrink-0" />
                        Solo aparece si la venta tiene pagos sin facturar: si no lo ves, primero registrá el cobro con Abonar.
                    </p>
                </>
            ),
        },
        {
            titulo: '2. Revisá los datos y contá si hay observación',
            cuerpo: (
                <>
                    <p>Se abre una ventana con el <strong>cliente, el DNI y el monto</strong>. Revisalos y tildá <strong>«Confirmo que los datos a facturar están correctos»</strong>.</p>
                    <p className="mt-2">Después contestá <strong>¿Necesita alguna observación?</strong> Si es Sí, escribila. Por ejemplo:</p>
                    <ul className="mt-2 list-disc pl-5 space-y-1">
                        <li>Factura a <strong>CUIT</strong>: el número y si es monotributista, responsable inscripto o exento.</li>
                        <li>A nombre de otra persona, o un dato a corregir.</li>
                        <li>Lo que el cliente necesite que figure (obra social, plan).</li>
                    </ul>
                    <p className="mt-3 p-3 rounded-xl bg-stone-100 dark:bg-stone-800 text-stone-500 dark:text-stone-400">
                        La observación sale impresa en la factura. Sin completar todo, el botón no envía.
                    </p>
                </>
            ),
        },
        {
            titulo: '3. Listo: a Ishtar le llega por WhatsApp',
            cuerpo: (
                <>
                    <p className="flex items-start gap-2">
                        <MessageCircle className="w-4 h-4 shrink-0 mt-0.5 text-emerald-500" />
                        <span>Le llega con los datos, tu observación y los pagos de la venta, y la factura queda armada para emitir. En la ficha queda anotado quién la pidió.</span>
                    </p>
                    <p className="mt-3">Si la venta ya tiene una solicitud pendiente, el sistema te avisa: no hace falta volver a pedirla.</p>
                    <p className="mt-3 p-3 rounded-xl bg-stone-100 dark:bg-stone-800 text-stone-500 dark:text-stone-400">
                        ¿Dudas? Escribile a Ishtar por la mensajería interna.
                    </p>
                </>
            ),
        },
    ],
    'desafio-resenas-lens-cerro-2026-10': [
        {
            titulo: 'Desafío del día: 10 reseñas arriba de Lens Cerro',
            cuerpo: (
                <>
                    <p><strong>Lens Cerro es tu rival directo:</strong> está a 80 metros, en Tejeda 4300, y tiene casi las mismas reseñas que vos (<strong>746 contra tus 741</strong>).</p>
                    <p className="mt-2">Ganarle en reseñas es lo que más te sube en el mapa.</p>
                    <p className="flex items-center gap-2 mt-3 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 font-bold">
                        <Gift className="w-4 h-4 shrink-0" /> El desafío de hoy: quedar al menos 10 reseñas arriba de ellos. Son 15 reseñas nuevas.
                    </p>
                </>
            ),
        },
    ],
    'tenido-una-linea-2026-08': [
        {
            titulo: 'Hay cambios en teñidos y recetas',
            cuerpo: (
                <>
                    <p>Antes de empezar el día, mirá estos 4 pasos. Es 1 minuto y evita errores en ventas.</p>
                    <p className="flex items-center gap-2 mt-3 p-3 rounded-xl bg-stone-100 dark:bg-stone-800 text-stone-500 dark:text-stone-400">
                        <Lock className="w-4 h-4 shrink-0" />
                        Este aviso no se puede saltear: el botón para cerrarlo aparece en el último paso.
                    </p>
                </>
            ),
        },
        {
            titulo: 'Armazón que trae el cliente: siempre por el botón',
            cuerpo: (
                <>
                    <p>Cuando el cliente trae SU PROPIO armazón, <strong>siempre</strong> hay que cargarlo con el botón <strong>“Agregar armazón del usuario”</strong> (abajo del carrito, en el presupuesto) — nunca dejarlo afuera ni contarlo solo de palabra.</p>
                    <p className="flex items-center gap-2 mt-3 text-amber-600 dark:text-amber-500 font-bold">
                        <AlertTriangle className="w-4 h-4 shrink-0" />
                        Sin ese botón, el sistema no sabe que hay un armazón ahí: no pide la foto ni las medidas al confirmar la venta, y ese anteojo queda sin rastro en la ficha del cliente.
                    </p>
                    <p className="mt-3 p-3 rounded-xl bg-stone-100 dark:bg-stone-800 text-stone-500 dark:text-stone-400">
                        Queda marcado “Sin cargo” solo — no hay que tocar el precio a mano.
                    </p>
                </>
            ),
        },
        {
            titulo: 'El teñido ahora es UNA sola línea',
            cuerpo: (
                <>
                    <p>Ya no se carga un teñido por ojo: los dos cristales van siempre del mismo color. Es una sola línea con un solo selector de <strong>color + grado + armazón</strong>.</p>
                    <p className="flex items-center gap-2 mt-3 text-amber-600 dark:text-amber-500 font-bold">
                        <AlertTriangle className="w-4 h-4 shrink-0" />
                        Sin esas 3 cosas elegidas, el sistema no deja enviar la venta a fábrica.
                    </p>
                </>
            ),
        },
        {
            titulo: 'Promo 2x1: un solo teñido sin cargo',
            cuerpo: (
                <>
                    <p>Con el 2x1 de multifocales se bonifica <strong>UN teñido</strong> (el del 1º anteojo). El del segundo anteojo <strong>se cobra</strong>.</p>
                    <p className="mt-2"><strong>El teñido según muestra NO entra</strong> en esta bonificación bajo ningún caso: se cobra siempre, tenga o no tenga la promo activa.</p>
                    <div className="flex flex-wrap gap-2 mt-3">
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-xs font-bold"><Check className="w-3.5 h-3.5" /> Compacto — entra</span>
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-xs font-bold"><Check className="w-3.5 h-3.5" /> Degradé — entra</span>
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 text-xs font-bold"><XIcon className="w-3.5 h-3.5" /> Según muestra — se cobra SIEMPRE</span>
                    </div>
                    <p className="flex items-center gap-2 mt-3 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 text-xs font-bold">
                        <Gift className="w-4 h-4 shrink-0" /> El cartel de la promo lo recuerda en cada presupuesto: “{AVISO_TENIDO_2X1}”.
                    </p>
                </>
            ),
        },
        {
            titulo: 'Armazones: cuándo se bonifica un par',
            cuerpo: (
                <>
                    <p>Hacen falta <strong>2 pares completos</strong> de cristales 2x1 para que un armazón entre en la promo. Con un solo par, el armazón se cobra entero.</p>
                    <p className="mt-2">Solo entran los armazones <strong>tildados a mano en Stock</strong> (“Elegible 2x1”). Sin ese tilde, el armazón se cobra completo aunque el pedido tenga los 2 pares.</p>
                    <div className="mt-3 space-y-2">
                        <div className="flex items-start gap-2 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/20">
                            <Gift className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
                            <span className="text-emerald-700 dark:text-emerald-400"><strong>2 o más armazones tildados:</strong> se cobra el más caro de la venta; el <strong>siguiente</strong> tildado más caro va <strong>GRATIS entero</strong>. Sin topes ni promedios.</span>
                        </div>
                        <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/20">
                            <Gift className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                            <span className="text-amber-700 dark:text-amber-400"><strong>1 solo armazón tildado:</strong> va al <strong>50%</strong> — sea el único armazón de la venta (el otro lo trae el cliente) o venga acompañado de otro sin promo.</span>
                        </div>
                    </div>
                </>
            ),
        },
        {
            titulo: 'Clip-on: el caso especial',
            cuerpo: (
                <>
                    <p>Un <strong>clip-on</strong> se engancha sobre otro armazón: no es un anteojo completo por sí solo, y eso cambia cómo se bonifica.</p>
                    <p className="flex items-start gap-2 mt-3 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-400">
                        <XIcon className="w-4 h-4 shrink-0 mt-0.5" />
                        <span><strong>Si es el ÚNICO armazón de la venta</strong>, se cobra ENTERO: el otro anteojo lo arma el cliente con el suyo, y el clip-on se engancha sobre ese mismo — no cuenta como segundo anteojo.</span>
                    </p>
                    <p className="flex items-start gap-2 mt-2 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400">
                        <Check className="w-4 h-4 shrink-0 mt-0.5" />
                        <span><strong>Con otro armazón de la óptica en la misma venta</strong> (entre o no en la promo), el clip-on SÍ se bonifica como cualquier armazón tildado.</span>
                    </p>
                </>
            ),
        },
        {
            titulo: 'Dos detalles más',
            cuerpo: (
                <>
                    <p className="flex items-start gap-2">
                        <Sun className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" />
                        <span>Un cristal con teñido ya no figura como “Blanco”: dice <strong>“De sol — teñido Sepia”</strong>, también en el PDF y en la confirmación que recibe el cliente.</span>
                    </p>
                    <p className="flex items-start gap-2 mt-3">
                        <Ruler className="w-4 h-4 shrink-0 mt-0.5 text-indigo-500" />
                        <span>La <strong>altura</strong> ahora se carga solo en el armazón (cuadros OD/OI). En la receta queda la DNP.</span>
                    </p>
                    <p className="mt-3 p-3 rounded-xl bg-stone-100 dark:bg-stone-800 text-stone-500 dark:text-stone-400">
                        ¿Dudas? Escribile a Ishtar por la mensajería interna.
                    </p>
                </>
            ),
        },
    ],
};

/** Festejo de gol: fuegos artificiales, lluvia de papelitos y la pantalla
 *  temblando. CSS puro, sin librerías. Dura ~6 s. */
const COLORES_FESTEJO = ['#c8a55c', '#10b981', '#f43f5e', '#6366f1', '#f59e0b', '#ffffff', '#38bdf8'];
// Posiciones y demoras fijas (no Math.random): mismo festejo en cada render.
const FOCOS_FESTEJO = [[15, 25, 0], [80, 20, .3], [50, 15, .6], [25, 70, .9], [75, 65, 1.2], [45, 45, 1.5], [10, 50, 1.8], [90, 45, 2.1]];
function Festejo() {
    return (
        <div className="fixed inset-0 z-[210] pointer-events-none overflow-hidden bg-black/75" aria-live="polite" style={{ animation: 'temblor .12s linear 8' }}>
            <style>{`
                @keyframes chispa { 0% { transform: translate(0,0) scale(1.4); opacity: 1 } 100% { transform: translate(var(--dx), var(--dy)) scale(.2); opacity: 0 } }
                @keyframes cohete { 0% { transform: translateY(100vh); opacity: 1 } 100% { transform: translateY(0); opacity: 0 } }
                @keyframes papelito { 0% { transform: translateY(-10vh) rotate(0) } 100% { transform: translateY(110vh) rotate(900deg) } }
                @keyframes gol { 0% { transform: scale(.1) rotate(-15deg); opacity: 0 } 30% { transform: scale(1.4) rotate(6deg); opacity: 1 } 50% { transform: scale(.95) rotate(-3deg) } 70% { transform: scale(1.1) } 100% { transform: scale(1) } }
                @keyframes latido { 0%, 100% { transform: scale(1) } 50% { transform: scale(1.12) } }
                @keyframes pelota { 0% { transform: translate(-60vw, 40vh) rotate(0) } 70% { transform: translate(0, 0) rotate(1080deg) } 85% { transform: translateY(-30px) } 100% { transform: translateY(0) rotate(1080deg) } }
                @keyframes temblor { 0%, 100% { transform: translate(0,0) } 25% { transform: translate(-8px, 5px) } 75% { transform: translate(8px, -5px) } }
                @keyframes destello { 0%, 100% { opacity: 0 } 10% { opacity: .35 } }
            `}</style>
            <div className="absolute inset-0 bg-white" style={{ animation: 'destello .6s ease-out 3' }} />
            {FOCOS_FESTEJO.map(([x, y, d], f) => (
                <div key={f}>
                    <span className="absolute w-1 h-10 rounded-full bg-amber-200" style={{ left: `${x}%`, top: `${y}%`, animation: `cohete .5s ease-in ${d}s both` }} />
                    <div className="absolute" style={{ left: `${x}%`, top: `${y}%` }}>
                        {Array.from({ length: 28 }, (_, i) => {
                            const ang = (i / 28) * Math.PI * 2;
                            const dist = 110 + (i % 4) * 40;
                            return (
                                <span key={i} className="absolute w-2.5 h-2.5 rounded-full" style={{
                                    background: COLORES_FESTEJO[(i + f) % COLORES_FESTEJO.length],
                                    boxShadow: `0 0 10px ${COLORES_FESTEJO[(i + f) % COLORES_FESTEJO.length]}`,
                                    ['--dx' as string]: `${Math.cos(ang) * dist}px`,
                                    ['--dy' as string]: `${Math.sin(ang) * dist}px`,
                                    animation: `chispa 1s ease-out ${d + .5}s infinite`,
                                }} />
                            );
                        })}
                    </div>
                </div>
            ))}
            {Array.from({ length: 70 }, (_, i) => (
                <span key={i} className="absolute top-0 w-2 h-3.5" style={{
                    left: `${(i * 37) % 100}%`,
                    background: COLORES_FESTEJO[i % COLORES_FESTEJO.length],
                    animation: `papelito ${2.2 + (i % 5) * .4}s linear ${(i % 10) * .25}s infinite`,
                }} />
            ))}
            <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center" style={{ animation: 'gol 1s ease-out both' }}>
                    <div className="text-8xl" style={{ animation: 'pelota 1.2s ease-out both' }}>⚽</div>
                    <p className="mt-4 text-7xl font-black text-white tracking-tight drop-shadow-[0_0_25px_rgba(250,204,21,.8)]" style={{ animation: 'latido .5s ease-in-out 1.2s infinite' }}>¡GOOOOOL!</p>
                    <p className="mt-4 text-xl font-black text-amber-300 uppercase tracking-widest">¡Vamos por el primer puesto! 🏆</p>
                </div>
            </div>
        </div>
    );
}

export default function NovedadesGuiadas() {
    const [festejando, setFestejando] = useState(false);
    const [guiadoId, setGuiadoId] = useState<string | null>(null);
    const [paso, setPaso] = useState(0);
    const [guardando, setGuardando] = useState(false);
    const ruta = usePathname();

    useEffect(() => {
        let vivo = true;
        fetch('/api/novedades')
            .then(r => (r.ok ? r.json() : { pendiente: null }))
            .then(d => { if (vivo && d.pendiente && GUIADOS[d.pendiente]) setGuiadoId(d.pendiente); })
            .catch(() => { /* sin red no se traba el admin */ });
        return () => { vivo = false; };
    }, []);

    // La caja queda EXENTA, por el mismo motivo que el briefing: este modal se
    // monta en todo /admin y tampoco se puede cerrar, así que tapaba la
    // pantalla del arqueo y dejaba a quien lo hace sin poder trabajar. Sigue
    // pendiente en el resto del panel: no se saltea, solo no estorba ahí.
    if (festejando) return <Festejo />;
    if (!guiadoId || ruta?.startsWith('/admin/caja')) return null;
    const pasos = GUIADOS[guiadoId];
    const esUltimo = paso === pasos.length - 1;

    const confirmar = async (respuesta?: string, festejo?: boolean) => {
        setGuardando(true);
        try {
            const res = await fetch('/api/novedades', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: guiadoId, respuesta }),
            });
            // Solo se cierra si el server lo registró: si falló, mañana no
            // tiene que "haberse visto solo".
            if (res.ok) {
                setGuiadoId(null);
                if (festejo) {
                    setFestejando(true);
                    setTimeout(() => setFestejando(false), 6000);
                }
            }
        } catch { /* se queda abierto */ }
        setGuardando(false);
    };

    return (
        // Sin onClick en el fondo y sin listener de Escape: no hay forma de
        // cerrarlo que no sea el botón del último paso. Es a propósito.
        <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Novedades del sistema">
            <div className="bg-white dark:bg-stone-900 rounded-[2rem] border border-stone-200 dark:border-stone-700 shadow-2xl max-w-lg w-full p-8 animate-in zoom-in-95 duration-300">
                <p className="text-[10px] font-black text-violet-600 dark:text-violet-400 uppercase tracking-[0.2em] flex items-center gap-2">
                    <Palette className="w-4 h-4" /> Novedades del sistema · paso {paso + 1} de {pasos.length}
                </p>
                <h3 className="text-xl font-bold text-stone-900 dark:text-white mt-3 mb-4 tracking-tight">{pasos[paso].titulo}</h3>
                <div className="text-sm text-stone-600 dark:text-stone-300 leading-relaxed space-y-1">
                    {pasos[paso].cuerpo}
                </div>

                <div className="flex items-center justify-between mt-8">
                    <div className="flex gap-1.5">
                        {pasos.map((_, i) => (
                            <span key={i} className={`w-2 h-2 rounded-full ${i <= paso ? 'bg-violet-600' : 'bg-stone-200 dark:bg-stone-700'}`} />
                        ))}
                    </div>
                    <div className="flex items-center gap-2">
                        {paso > 0 && (
                            <button
                                type="button"
                                onClick={() => setPaso(p => p - 1)}
                                className="px-4 py-2.5 text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 font-bold text-[11px] uppercase tracking-widest transition-colors"
                            >
                                Atrás
                            </button>
                        )}
                        {esUltimo && OPCIONES[guiadoId] ? (
                            OPCIONES[guiadoId].map(o => (
                                <button
                                    key={o.texto}
                                    type="button"
                                    onClick={() => confirmar(o.texto, o.festejo)}
                                    disabled={guardando}
                                    className={o.principal
                                        ? 'inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-[11px] uppercase tracking-widest transition-all disabled:opacity-60'
                                        : 'px-4 py-2.5 text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 font-bold text-[11px] uppercase tracking-widest transition-colors disabled:opacity-60'}
                                >
                                    {o.texto}
                                </button>
                            ))
                        ) : esUltimo ? (
                            <button
                                type="button"
                                onClick={() => confirmar()}
                                disabled={guardando}
                                className="inline-flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-[11px] uppercase tracking-widest transition-all disabled:opacity-60"
                            >
                                {guardando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                                Entendido, lo vi
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={() => setPaso(p => p + 1)}
                                className="inline-flex items-center gap-2 px-6 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-black text-[11px] uppercase tracking-widest transition-all"
                            >
                                Siguiente <ArrowRight className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
