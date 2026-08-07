'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
    ChevronUp, ChevronRight, ImageIcon, Loader2, X, Wallet, Lock,
    MessageSquarePlus, Check, AlertCircle, FlaskConical, Tag,
} from 'lucide-react';
import {
    POST_SALE_CASE_TYPES, POST_SALE_COVERAGE, POST_SALE_RESPONSIBLE_CAUSES,
    caseTypeStyle, postSaleColumnLabel,
    parseResponsibleOption, responsibleOptionOf, responsibleUserValue, cajaDestino,
    type PostSaleUser,
} from '@/lib/constants/postSale';
import { formatDateTime } from '@/lib/format-date';
import { resolveStorageUrl } from '@/lib/utils/storage';

/**
 * Los datos del caso que necesita el formulario, sin atarse a la forma en que
 * los guarda cada pantalla: la ficha del cliente los tiene como PostSaleCase y
 * las de ventas/pedidos como campos `postSale*` de la orden.
 */
export interface PostSaleFormValue {
    orderId: string;
    labOrderNumber?: string | null;
    status?: string | null;
    notes?: string | null;
    notesList?: { id: string; content: string; createdBy?: string | null; createdAt?: string | Date | null; imageUrl?: string | null }[];
    cost?: number | null;
    responsible?: string | null;
    fault?: string | null;
    faultUserId?: string | null;
    coverage?: string | null;
    caseType?: string | null;
    orderOption?: string | null;
    newOrderNumber?: string | null;
    /** Si el caso ya se descontó de una caja, el costo y el responsable quedan cerrados. */
    cashEntryId?: string | null;
}

/** Adapta una venta (campos `postSale*`) a lo que espera el formulario. */
export function postSaleValueFromOrder(order: any): PostSaleFormValue {
    return {
        orderId: order.id,
        labOrderNumber: order.labOrderNumber,
        status: order.postSaleStatus,
        notes: order.postSaleNotes,
        notesList: order.postSaleCases?.[0]?.notesList,
        cost: order.postSaleCost,
        responsible: order.postSaleResponsible,
        fault: order.postSaleFault,
        faultUserId: order.postSaleFaultUserId,
        coverage: order.postSaleCoverage,
        caseType: order.postSaleCaseType,
        orderOption: order.postSaleOrderOption,
        newOrderNumber: order.postSaleNewOrderNumber,
        cashEntryId: order.postSaleCashEntryId,
    };
}

/** Adapta un caso de post venta (ficha del cliente) a lo que espera el formulario. */
export function postSaleValueFromCase(c: any): PostSaleFormValue {
    return {
        orderId: c.order?.id || c.orderId,
        labOrderNumber: c.order?.labOrderNumber,
        status: c.status,
        notes: c.notes,
        notesList: c.notesList,
        cost: c.cost,
        responsible: c.responsible,
        fault: c.fault,
        faultUserId: c.faultUserId,
        coverage: c.coverage,
        caseType: c.caseType,
        orderOption: c.orderOption,
        newOrderNumber: c.newOrderNumber,
        cashEntryId: c.cashEntryId,
    };
}

interface PostSaleServiceFormProps {
    value: PostSaleFormValue;
    onRefresh: () => void;
    userRole?: string;
    /** Panel de reproceso (recetas + carga en SmartLab). Lo arma la pantalla que lo tiene. */
    reprocessSlot?: React.ReactNode;
    /** Avisa qué opción de laboratorio quedó elegida, para que el contenedor muestre su slot. */
    onOrderOptionChange?: (option: string) => void;
    /** Campos extra que suma el contenedor al guardar (ej. los datos de receta del reproceso). */
    extraSavePayload?: (orderOption: string) => Record<string, any>;
    /** 'card' dibuja su propio recuadro y el encabezado colapsable; 'plain' se embebe. */
    variant?: 'card' | 'plain';
    defaultOpen?: boolean;
}

// ── Escala tipográfica ───────────────────────────────────────────────────────
// Etiquetas a 10px y texto a 13-14px. Las de 8px con tracking ancho que había
// antes fallan por tamaño el mismo piso de legibilidad que fijamos por contraste
// (hay una compañera del equipo con baja visión).
const SECCION = 'text-[11px] font-black uppercase tracking-wider text-stone-500 dark:text-stone-400';
const LABEL = 'block text-[10px] font-bold uppercase tracking-wide text-stone-600 dark:text-stone-300 mb-1.5';
const CAMPO = 'w-full text-sm px-3 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 placeholder-stone-500 dark:placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-600 transition-all';
const AYUDA = 'mt-1.5 text-[11px] text-stone-600 dark:text-stone-400 leading-relaxed';
const CHIP = 'text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-md border';

/** Bloque con título: da la estructura que antes era una lista plana de 7 controles. */
function Seccion({ titulo, icono, children }: { titulo: string; icono?: React.ReactNode; children: React.ReactNode }) {
    return (
        <section className="space-y-3">
            <h4 className={`${SECCION} flex items-center gap-1.5`}>
                {icono}
                {titulo}
            </h4>
            {children}
        </section>
    );
}

/**
 * Tarjeta "Servicio de Post Venta": el historial del caso y los campos que lo
 * definen. Es la MISMA tarjeta en la ficha del cliente, en ventas y en el
 * cotizador — antes eran dos copias distintas que fueron divergiendo.
 *
 * Tres decisiones de diseño que vale la pena no deshacer:
 * - **Agregar una observación es su propia acción.** Es lo que más se hace en un
 *   caso y antes exigía apretar "Guardar Registro", que reescribía todos los
 *   campos de paso. Ahora tiene su botón y no toca nada más.
 * - **Primero el estado, después el formulario.** Arriba se lee de un vistazo qué
 *   caso es; los campos vienen abajo, agrupados por lo que se está decidiendo.
 * - **Guardar solo aparece si hay algo para guardar**, y dice qué cambió.
 *
 * Dos reglas de negocio:
 * - El costo lo carga SOLO el administrador. Aunque el error sea del laboratorio,
 *   muchas veces algo nos terminan cobrando: el número final no lo define quien vende.
 * - Un solo campo "Responsable" contesta de quién fue, y de él se derivan la
 *   atribución y la caja a la que va a impactar el costo (que se muestra).
 */
export function PostSaleServiceForm({
    value,
    onRefresh,
    userRole = 'STAFF',
    reprocessSlot,
    onOrderOptionChange,
    extraSavePayload,
    variant = 'card',
    defaultOpen = false,
}: PostSaleServiceFormProps) {
    const isAdmin = userRole === 'ADMIN';
    // Caso ya descontado de una caja: el costo y el responsable son historia y
    // corregirlos exige revertir el movimiento (la API los rechaza igual).
    const yaImputado = !!value.cashEntryId;

    const [open, setOpen] = useState(defaultOpen);
    const [users, setUsers] = useState<PostSaleUser[]>([]);
    const [guardando, setGuardando] = useState(false);
    const [publicando, setPublicando] = useState(false);
    const [aviso, setAviso] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);

    const [noteText, setNoteText] = useState('');
    const [noteImageFile, setNoteImageFile] = useState<File | null>(null);
    const [noteImagePreview, setNoteImagePreview] = useState<string | null>(null);

    const [cost, setCost] = useState<number | ''>(value.cost ?? '');
    const [responsibleOption, setResponsibleOption] = useState('');
    const [coverage, setCoverage] = useState(value.coverage || '');
    const [caseType, setCaseType] = useState(value.caseType || '');
    const [orderOption, setOrderOption] = useState(value.orderOption || '');
    const [newOrderNumber, setNewOrderNumber] = useState(value.newOrderNumber || '');

    // Personas de la óptica (se excluyen las cuentas de ópticas mayoristas).
    // Sale de los usuarios reales: si mañana entra alguien nuevo, aparece solo.
    useEffect(() => {
        fetch('/api/users')
            .then(res => (res.ok ? res.json() : []))
            .then((data: any[]) => {
                if (Array.isArray(data)) setUsers(data.filter(u => u.role !== 'OPTICA').map(u => ({ id: u.id, name: u.name, role: u.role })));
            })
            .catch(() => setUsers([]));
    }, []);

    useEffect(() => {
        setCost(value.cost ?? '');
        setCoverage(value.coverage || '');
        setCaseType(value.caseType || '');
        setOrderOption(value.orderOption || '');
        setNewOrderNumber(value.newOrderNumber || '');
        setNoteText('');
        setNoteImageFile(null);
        setNoteImagePreview(null);
    }, [value.orderId, value.cost, value.coverage, value.caseType, value.orderOption, value.newOrderNumber, value.notes]);

    // El select de responsable se resuelve recién con los usuarios cargados (un
    // caso viejo puede tener el nombre escrito a mano, sin id). Si lo guardado no
    // es ninguna opción actual queda igual seleccionado, para que se vea qué
    // decía el caso en vez de aparecer vacío.
    useEffect(() => {
        setResponsibleOption(responsibleOptionOf(value, users) || value.responsible || '');
    }, [value.responsible, value.fault, value.faultUserId, users]);

    useEffect(() => { onOrderOptionChange?.(orderOption); }, [orderOption, onOrderOptionChange]);

    // Valor guardado que no coincide con ninguna opción actual (texto libre de
    // los casos viejos): se ofrece aparte para no borrarlo sin querer.
    const legacyResponsible = useMemo(() => {
        if (!value.responsible) return null;
        return responsibleOptionOf(value, users) ? null : value.responsible;
    }, [value, users]);

    const responsableTocado = responsibleOption && responsibleOption !== legacyResponsible;
    const seleccion = parseResponsibleOption(responsableTocado ? responsibleOption : '', users);
    // El administrador es quien absorbe lo que no es de una persona del equipo.
    const adminName = users.find(u => u.role === 'ADMIN')?.name;
    const caja = cajaDestino(responsableTocado ? seleccion : value, users, adminName);

    // ── Qué cambió respecto de lo guardado ───────────────────────────────────
    // El botón de guardar aparece solo si hay algo que guardar, y el aviso dice
    // qué. Antes no había forma de saber que quedaba un cambio a medio hacer.
    const cambios = useMemo(() => {
        const lista: string[] = [];
        const antes = (v: any) => (v === null || v === undefined || v === '' ? '—' : String(v));
        if (isAdmin && !yaImputado && Number(cost || 0) !== Number(value.cost || 0)) {
            lista.push(`Costo: ${antes(value.cost)} → ${antes(cost)}`);
        }
        if (!yaImputado && responsableTocado && (seleccion.responsible || null) !== (value.responsible || null)) {
            lista.push(`Responsable: ${antes(value.responsible)} → ${antes(seleccion.responsible)}`);
        }
        if ((coverage || null) !== (value.coverage || null)) lista.push(`Cobertura: ${antes(value.coverage)} → ${antes(coverage)}`);
        if ((caseType || null) !== (value.caseType || null)) lista.push(`Tipo de caso: ${antes(value.caseType)} → ${antes(caseType)}`);
        if ((orderOption || null) !== (value.orderOption || null)) lista.push('Resolución en laboratorio');
        if ((newOrderNumber.trim() || null) !== (value.newOrderNumber || null)) {
            lista.push(`N° de operación: ${antes(value.newOrderNumber)} → ${antes(newOrderNumber.trim())}`);
        }
        return lista;
    }, [cost, responsibleOption, coverage, caseType, orderOption, newOrderNumber, value, isAdmin, yaImputado, responsableTocado, seleccion.responsible, legacyResponsible]);

    const historial = useMemo(() => {
        // Si están las observaciones estructuradas (autor, fecha, foto) se usan
        // esas; el texto plano es el respaldo de los casos viejos.
        if (value.notesList && value.notesList.length > 0) return value.notesList;
        const lines = (value.notes || '').split('\n').filter(l => l.trim() !== '');
        return lines.map((line, i) => {
            const match = line.match(/^\[(.*?)\]:\s*(.*)$/);
            return { id: `plain-${i}`, content: match ? match[2] : line, createdBy: null, createdAt: match ? match[1] : null, imageUrl: null };
        });
    }, [value.notesList, value.notes]);

    const handleNoteImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setNoteImageFile(file);
        const reader = new FileReader();
        reader.onloadend = () => setNoteImagePreview(reader.result as string);
        reader.readAsDataURL(file);
    };

    const clearNoteImage = () => { setNoteImageFile(null); setNoteImagePreview(null); };

    /** Sube la imagen adjunta. Devuelve `false` si falla (no se guarda nada). */
    const subirAdjunto = async (): Promise<string | null | false> => {
        if (!noteImageFile) return null;
        const formData = new FormData();
        formData.append('file', noteImageFile);
        const up = await fetch('/api/upload', { method: 'POST', body: formData });
        if (!up.ok) {
            const err = await up.json().catch(() => ({}));
            setAviso({ tipo: 'error', texto: `No se pudo subir la imagen: ${err.error || 'error desconocido'}. No se guardó nada.` });
            return false;
        }
        const upData = await up.json();
        return upData.url || upData.fileUrl || null;
    };

    const patch = async (payload: Record<string, any>): Promise<boolean> => {
        const res = await fetch(`/api/orders/${value.orderId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        if (res.ok) return true;
        const data = await res.json().catch(() => ({}));
        setAviso({ tipo: 'error', texto: data.error || 'No se pudo guardar.' });
        return false;
    };

    /**
     * Agregar una observación es su propia acción: no toca ningún otro campo.
     * Antes había que apretar "Guardar Registro", que de paso reescribía todo.
     */
    const agregarObservacion = async () => {
        const texto = noteText.trim() || (noteImageFile ? '📎 Imagen adjunta' : '');
        if (!texto || publicando) return;
        setPublicando(true);
        setAviso(null);
        try {
            const adjunto = await subirAdjunto();
            if (adjunto === false) return;
            // Se manda SOLO la observación nueva: el servidor la estampa y la
            // agrega al historial, sin reescribirlo desde un snapshot viejo.
            const ok = await patch({ postSaleNoteEntry: texto, postSaleNoteImageUrl: adjunto });
            if (ok) {
                setNoteText('');
                clearNoteImage();
                setAviso({ tipo: 'ok', texto: 'Observación agregada.' });
                onRefresh();
            }
        } catch {
            setAviso({ tipo: 'error', texto: 'No se pudo conectar con el servidor.' });
        } finally {
            setPublicando(false);
        }
    };

    /** Guarda los campos del caso. La observación va por su propio botón. */
    const guardarCambios = async () => {
        if (guardando) return;
        setGuardando(true);
        setAviso(null);
        try {
            const payload: Record<string, any> = {
                postSaleCoverage: coverage || null,
                postSaleCaseType: caseType || null,
                postSaleOrderOption: orderOption || null,
                // El nº de operación se puede dejar vacío y cargar después,
                // cuando el laboratorio realmente lo procesó.
                postSaleNewOrderNumber: newOrderNumber.trim() || null,
                ...(extraSavePayload?.(orderOption) || {}),
            };
            // El costo solo lo mueve el administrador; el responsable, cualquiera.
            if (!yaImputado) {
                if (isAdmin) payload.postSaleCost = cost === '' ? 0 : Number(cost);
                if (responsableTocado) {
                    payload.postSaleResponsible = seleccion.responsible;
                    payload.postSaleFault = seleccion.fault;
                    payload.postSaleFaultUserId = seleccion.faultUserId;
                }
            }
            if (await patch(payload)) {
                setAviso({ tipo: 'ok', texto: 'Cambios guardados.' });
                onRefresh();
            }
        } catch {
            setAviso({ tipo: 'error', texto: 'No se pudo conectar con el servidor.' });
        } finally {
            setGuardando(false);
        }
    };

    const fmt = (n: number) => `$${Math.round(n).toLocaleString('es-AR')}`;
    const puedePublicar = Boolean(noteText.trim() || noteImageFile);

    // ── Cabecera de estado: qué caso es, de un vistazo ───────────────────────
    const chips = (
        <div className="flex flex-wrap items-center gap-1.5">
            <span className={`${CHIP} ${caseTypeStyle(value.caseType)}`}>{value.caseType || 'Sin tipificar'}</span>
            <span className={`${CHIP} border-stone-300 dark:border-stone-600 text-stone-700 dark:text-stone-300`}>
                {postSaleColumnLabel({ status: value.status, cost: value.cost, cashEntryId: value.cashEntryId })}
            </span>
            {value.coverage && (
                <span className={`${CHIP} ${value.coverage === 'Con cargo'
                    ? 'bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900/40'
                    : 'bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900/40'}`}>
                    {value.coverage}
                </span>
            )}
            {(value.cost ?? 0) > 0 && (
                <span className={`${CHIP} ${yaImputado
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900/40'
                    : 'bg-stone-100 text-stone-700 border-stone-300 dark:bg-stone-800 dark:text-stone-300 dark:border-stone-600'}`}>
                    {fmt(value.cost!)}{yaImputado ? ' · cobrado' : ''}
                </span>
            )}
            {value.responsible && (
                <span className={`${CHIP} border-stone-300 dark:border-stone-600 text-stone-700 dark:text-stone-300`}>
                    👤 {value.responsible}
                </span>
            )}
        </div>
    );

    const cuerpo = (
        <div className="space-y-6 max-w-2xl">
            {chips}

            {/* ── Qué pasó: el historial es el contenido principal del caso ──── */}
            <Seccion titulo="Qué pasó" icono={<MessageSquarePlus className="w-3.5 h-3.5" />}>
                <div className="rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50/70 dark:bg-stone-900/40 divide-y divide-stone-200/70 dark:divide-stone-800 max-h-[320px] overflow-y-auto custom-scrollbar">
                    {historial.length === 0 ? (
                        <p className="text-[13px] text-stone-600 dark:text-stone-400 italic p-3">Todavía no hay observaciones. La primera contá qué reportó el cliente.</p>
                    ) : (
                        historial.map((n) => (
                            <div key={n.id} className="p-3">
                                <p className="text-[13px] text-stone-800 dark:text-stone-200 leading-relaxed whitespace-pre-wrap">{n.content}</p>
                                {n.imageUrl && (
                                    <a href={resolveStorageUrl(n.imageUrl)} target="_blank" rel="noopener noreferrer" className="inline-block mt-2">
                                        <img src={resolveStorageUrl(n.imageUrl)} alt="Adjunto del caso"
                                            className="w-16 h-16 rounded-lg object-cover border border-stone-300 dark:border-stone-700 hover:opacity-90 transition-opacity" />
                                    </a>
                                )}
                                <p className="mt-1.5 text-[11px] font-semibold text-stone-600 dark:text-stone-400">
                                    {[n.createdBy, n.createdAt ? (typeof n.createdAt === 'string' && !/\d{4}/.test(n.createdAt) ? n.createdAt : formatDateTime(n.createdAt)) : null]
                                        .filter(Boolean).join(' · ')}
                                </p>
                            </div>
                        ))
                    )}
                </div>

                <div>
                    <textarea
                        rows={2}
                        value={noteText}
                        onChange={(e) => setNoteText(e.target.value)}
                        placeholder="Qué pasó, qué se hizo, qué contestó el laboratorio…"
                        className={`${CAMPO} resize-none`}
                    />
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                        <label className="flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-stone-900 border border-dashed border-stone-400 dark:border-stone-600 rounded-xl cursor-pointer hover:border-amber-500 transition-colors">
                            <ImageIcon className="w-4 h-4 text-stone-600 dark:text-stone-400" />
                            <span className="text-[11px] font-bold text-stone-700 dark:text-stone-300">
                                {noteImageFile ? 'Cambiar foto' : 'Adjuntar foto'}
                            </span>
                            <input type="file" accept="image/*" onChange={handleNoteImageSelect} className="hidden" />
                        </label>
                        {noteImagePreview && (
                            <span className="flex items-center gap-1">
                                <img src={noteImagePreview} alt="Vista previa" className="w-9 h-9 rounded-lg object-cover border border-stone-300 dark:border-stone-700" />
                                <button onClick={clearNoteImage} className="p-1 rounded-lg hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-600 transition-colors" title="Quitar foto">
                                    <X className="w-4 h-4" />
                                </button>
                            </span>
                        )}
                        <button
                            onClick={agregarObservacion}
                            disabled={!puedePublicar || publicando}
                            className="ml-auto px-4 py-2 rounded-xl bg-stone-900 text-white dark:bg-white dark:text-stone-900 text-[11px] font-black uppercase tracking-wider shadow-sm hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity flex items-center gap-1.5"
                        >
                            {publicando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MessageSquarePlus className="w-3.5 h-3.5" />}
                            Agregar observación
                        </button>
                    </div>
                </div>
            </Seccion>

            {/* ── De quién fue, y qué caja paga ───────────────────────────────── */}
            <Seccion titulo="Responsabilidad" icono={<Tag className="w-3.5 h-3.5" />}>
                {/* Las tres preguntas de clasificación juntas y en el orden en que se
                    contestan: qué fue, de quién fue, quién lo paga. */}
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div>
                        <label className={LABEL}>Tipo de caso</label>
                        <select value={caseType} onChange={(e) => setCaseType(e.target.value)} className={CAMPO}>
                            <option value="">Sin clasificar</option>
                            {POST_SALE_CASE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className={LABEL}>Responsable · de quién fue</label>
                        <select
                            value={responsibleOption}
                            onChange={(e) => setResponsibleOption(e.target.value)}
                            disabled={yaImputado}
                            className={`${CAMPO} ${yaImputado ? 'opacity-70 cursor-not-allowed' : ''}`}
                        >
                            <option value="">Sin definir</option>
                            {legacyResponsible && <option value={legacyResponsible}>{legacyResponsible} (cargado antes)</option>}
                            <optgroup label="Equipo">
                                {users.map(u => (
                                    <option key={u.id} value={responsibleUserValue(u.id)}>{u.name}</option>
                                ))}
                            </optgroup>
                            <optgroup label="Otras causas">
                                {POST_SALE_RESPONSIBLE_CAUSES.map(c => (
                                    <option key={c} value={c}>{c}</option>
                                ))}
                            </optgroup>
                        </select>
                    </div>
                    <div>
                        <label className={LABEL}>Cobertura</label>
                        <select
                            value={coverage}
                            onChange={(e) => setCoverage(e.target.value)}
                            className={`${CAMPO} ${coverage === 'Con cargo' ? 'border-amber-400 dark:border-amber-800' : coverage === 'Sin cargo' ? 'border-emerald-400 dark:border-emerald-800' : ''}`}
                        >
                            <option value="">Sin definir</option>
                            {POST_SALE_COVERAGE.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>
                </div>

                {/* La caja es consecuencia directa del responsable: va pegada a él. */}
                <div className={`flex items-start gap-2.5 rounded-xl border p-3 ${caja.loCubreLaOptica
                    ? 'border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800/30'
                    : 'border-amber-300 dark:border-amber-900/40 bg-amber-50 dark:bg-amber-950/20'}`}>
                    <Wallet className={`w-4 h-4 mt-0.5 flex-shrink-0 ${caja.loCubreLaOptica ? 'text-stone-600 dark:text-stone-400' : 'text-amber-700 dark:text-amber-500'}`} />
                    <div>
                        <p className="text-[10px] font-bold uppercase tracking-wide text-stone-600 dark:text-stone-400">El costo impacta en</p>
                        <p className="text-sm font-black text-stone-900 dark:text-stone-100">{caja.label}</p>
                        <p className="text-[11px] text-stone-600 dark:text-stone-400 leading-relaxed mt-0.5">
                            {caja.loCubreLaOptica
                                ? 'No es de nadie del equipo: lo absorbe la óptica. El descuento se hace cuando el laboratorio cierra el costo real.'
                                : 'El descuento se hace cuando el laboratorio cierra el costo real, y lo confirma la administración.'}
                        </p>
                    </div>
                </div>

            </Seccion>

            {/* ── Cómo se resuelve ────────────────────────────────────────────── */}
            <Seccion titulo="Resolución en laboratorio" icono={<FlaskConical className="w-3.5 h-3.5" />}>
                <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                        <label className={LABEL}>¿Requiere procesar en laboratorio?</label>
                        <select value={orderOption} onChange={(e) => setOrderOption(e.target.value)} className={CAMPO}>
                            <option value="">No requiere / No aplica</option>
                            <option value="SAME">Mismo número de pedido ({value.labOrderNumber || 'Sin número'})</option>
                            <option value="DIFFERENT">Número de pedido diferente</option>
                        </select>
                    </div>

                    {/* El nº de operación queda SIEMPRE accesible y se puede dejar vacío:
                        se elige "pedido diferente" al abrir el caso y el número recién se
                        carga cuando el laboratorio lo procesó de verdad. Vacío se ve. */}
                    <div>
                        <label className={LABEL}>N° de operación del caso</label>
                        <input
                            type="text"
                            value={newOrderNumber}
                            onChange={(e) => setNewOrderNumber(e.target.value)}
                            placeholder="Todavía sin número"
                            className={`${CAMPO} font-mono ${newOrderNumber.trim()
                                ? 'border-emerald-400 dark:border-emerald-800'
                                : 'border-dashed border-amber-400 dark:border-amber-800 bg-amber-50/60 dark:bg-amber-950/10'}`}
                        />
                        {!newOrderNumber.trim() && (
                            <p className="mt-1.5 text-[11px] font-bold text-amber-800 dark:text-amber-500 leading-relaxed">
                                Pendiente. Se guarda así y se completa cuando el lab lo procese.
                            </p>
                        )}
                    </div>
                </div>

                {orderOption === 'DIFFERENT' && reprocessSlot}
            </Seccion>

            {/* ── Costo: solo lo mueve la administración ──────────────────────── */}
            <Seccion titulo="Costo del caso" icono={<Wallet className="w-3.5 h-3.5" />}>
                <div className="sm:max-w-xs">
                    <label className={LABEL}>
                        Costo adicional {!isAdmin && <span className="font-medium normal-case tracking-normal text-stone-500">· solo administración</span>}
                    </label>
                    <div className="relative">
                        <input
                            type="number"
                            value={cost}
                            onChange={(e) => setCost(e.target.value === '' ? '' : Number(e.target.value))}
                            placeholder={isAdmin ? '0' : 'Sin cargar'}
                            disabled={!isAdmin || yaImputado}
                            className={`${CAMPO} ${!isAdmin || yaImputado ? 'bg-stone-100 dark:bg-stone-800 cursor-not-allowed pr-9' : ''}`}
                        />
                        {(!isAdmin || yaImputado) && (
                            <Lock className="w-3.5 h-3.5 text-stone-600 dark:text-stone-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        )}
                    </div>
                    {!isAdmin && (
                        <p className={AYUDA}>
                            El costo final lo carga la administración: aun cuando el error es del laboratorio, a veces algo nos cobran.
                        </p>
                    )}
                    {yaImputado && (
                        <p className="mt-1.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-400 leading-relaxed">
                            Ya se descontó de caja: el monto y el responsable quedan cerrados. Para corregirlos hay que revertir el movimiento.
                        </p>
                    )}
                </div>
            </Seccion>

            {/* ── Guardar: aparece solo si hay algo que guardar ───────────────── */}
            {cambios.length > 0 && (
                <div className="sticky bottom-0 -mx-1 px-1 pt-3 pb-1 bg-gradient-to-t from-white via-white dark:from-stone-850 dark:via-stone-850">
                    <div className="rounded-xl border-2 border-amber-400 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-3 flex flex-wrap items-center gap-3">
                        <div className="min-w-0 flex-1">
                            <p className="text-[11px] font-black uppercase tracking-wide text-amber-900 dark:text-amber-400">
                                {cambios.length === 1 ? '1 cambio sin guardar' : `${cambios.length} cambios sin guardar`}
                            </p>
                            <p className="text-[11px] text-stone-700 dark:text-stone-300 leading-relaxed truncate" title={cambios.join(' · ')}>
                                {cambios.join(' · ')}
                            </p>
                        </div>
                        <button
                            onClick={guardarCambios}
                            disabled={guardando}
                            className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-[11px] font-black uppercase tracking-wider shadow-sm transition-colors flex items-center gap-2"
                        >
                            {guardando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                            Guardar cambios
                        </button>
                    </div>
                </div>
            )}

            {aviso && (
                <p className={`flex items-center gap-1.5 text-[12px] font-bold ${aviso.tipo === 'ok' ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}`}>
                    {aviso.tipo === 'ok' ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                    {aviso.texto}
                </p>
            )}
        </div>
    );

    if (variant === 'plain') return cuerpo;

    return (
        <div className={open ? 'bg-white dark:bg-stone-850 rounded-2xl border-2 border-amber-300 dark:border-amber-900/50 p-5 shadow-sm space-y-4' : ''}>
            <button
                onClick={() => setOpen(!open)}
                className={open
                    ? 'w-full flex items-center justify-between gap-2 pb-3 border-b border-stone-200 dark:border-stone-700'
                    : 'w-full flex items-center justify-between gap-3 px-4 py-3 bg-white dark:bg-stone-850 rounded-2xl border-2 border-amber-300 dark:border-amber-900/50 shadow-sm hover:bg-amber-50 dark:hover:bg-amber-950/20 transition-colors'}
            >
                <span className="text-[11px] font-black text-amber-700 dark:text-amber-500 uppercase tracking-wider">
                    Servicio de Post Venta
                </span>
                {/* Colapsada, la tarjeta igual dice de qué caso se trata. */}
                {!open && <span className="hidden sm:flex min-w-0">{chips}</span>}
                {open ? <ChevronUp className="w-4 h-4 text-amber-700 dark:text-amber-500 flex-shrink-0" /> : <ChevronRight className="w-4 h-4 text-amber-700 dark:text-amber-500 flex-shrink-0" />}
            </button>
            {open && cuerpo}
        </div>
    );
}
