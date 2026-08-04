'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { ChevronUp, ChevronRight, ImageIcon, Loader2, X, Wallet, Lock } from 'lucide-react';
import {
    POST_SALE_CASE_TYPES, POST_SALE_COVERAGE, POST_SALE_RESPONSIBLE_CAUSES,
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

const inputCls = 'w-full text-xs p-2.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 placeholder-stone-400 transition-all dark:text-stone-200';
const labelCls = 'text-[8px] font-black text-stone-400 dark:text-stone-500 uppercase tracking-widest block mb-1';

/**
 * Tarjeta "Servicio de Post Venta": el historial del caso y los campos que lo
 * definen. Es la MISMA tarjeta en la ficha del cliente, en ventas y en el
 * cotizador — antes eran dos copias distintas que fueron divergiendo.
 *
 * Dos reglas de negocio viven acá:
 * - El costo lo carga SOLO el administrador. Aunque el error sea del
 *   laboratorio, muchas veces algo nos terminan cobrando: el número final no lo
 *   define quien vende.
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
    const [saving, setSaving] = useState(false);

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

    const seleccion = parseResponsibleOption(
        responsibleOption === legacyResponsible ? '' : responsibleOption,
        users
    );
    // El administrador es quien absorbe lo que no es de una persona del equipo.
    const adminName = users.find(u => u.role === 'ADMIN')?.name;
    const caja = cajaDestino(
        responsibleOption && responsibleOption !== legacyResponsible ? seleccion : value,
        users,
        adminName
    );

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

    const handleSave = async () => {
        setSaving(true);
        try {
            const texto = noteText.trim() || (noteImageFile ? '📎 Imagen adjunta' : '');

            // La imagen se sube recién acá; si falla, no se guarda nada.
            let uploadedNoteImage: string | null = null;
            if (noteImageFile) {
                const formData = new FormData();
                formData.append('file', noteImageFile);
                const up = await fetch('/api/upload', { method: 'POST', body: formData });
                if (!up.ok) {
                    const err = await up.json().catch(() => ({}));
                    alert(`⚠️ No se pudo subir la imagen: ${err.error || 'error desconocido'}. No se guardaron los cambios.`);
                    return;
                }
                const upData = await up.json();
                uploadedNoteImage = upData.url || upData.fileUrl || null;
            }

            const payload: Record<string, any> = {
                // Se manda SOLO la observación nueva: el servidor la estampa y la
                // agrega al historial, sin reescribirlo desde un snapshot viejo.
                postSaleNoteEntry: texto || null,
                postSaleNoteImageUrl: uploadedNoteImage,
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
                if (responsibleOption && responsibleOption !== legacyResponsible) {
                    payload.postSaleResponsible = seleccion.responsible;
                    payload.postSaleFault = seleccion.fault;
                    payload.postSaleFaultUserId = seleccion.faultUserId;
                }
            }

            const res = await fetch(`/api/orders/${value.orderId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            if (res.ok) {
                setNoteText('');
                clearNoteImage();
                onRefresh();
                alert('✓ Cambios de post venta guardados.');
            } else {
                const data = await res.json().catch(() => ({}));
                alert(`⚠️ ${data.error || 'Error al guardar cambios de post venta'}`);
            }
        } catch (error) {
            console.error('Error saving post sale fields:', error);
            alert('⚠️ Error al conectar con el servidor.');
        } finally {
            setSaving(false);
        }
    };

    const cuerpo = (
        <div className="space-y-3">
            {/* ── Historial de observaciones ───────────────────────────────── */}
            <div>
                <div className="bg-stone-50 dark:bg-stone-900/40 rounded-xl p-3 border border-stone-200/50 dark:border-stone-800 space-y-2 max-h-[200px] overflow-y-auto custom-scrollbar mb-3">
                    <p className="text-[7.5px] font-black text-stone-400 dark:text-stone-500 uppercase tracking-widest border-b border-stone-200/20 pb-1">
                        Historial de Observaciones
                    </p>
                    {historial.length === 0 ? (
                        <p className="text-[10px] text-stone-400 italic">Sin observaciones registradas.</p>
                    ) : (
                        <div className="space-y-2 text-[10px] leading-relaxed">
                            {historial.map((n) => (
                                <div key={n.id} className="flex flex-col text-stone-600 dark:text-stone-300">
                                    <span className="text-[7.5px] font-black text-amber-600 dark:text-amber-500">
                                        {[n.createdBy, n.createdAt ? (typeof n.createdAt === 'string' && !/\d{4}/.test(n.createdAt) ? n.createdAt : formatDateTime(n.createdAt)) : null]
                                            .filter(Boolean).join(' · ')}
                                    </span>
                                    <span className="font-semibold whitespace-pre-wrap">{n.content}</span>
                                    {n.imageUrl && (
                                        <a href={resolveStorageUrl(n.imageUrl)} target="_blank" rel="noopener noreferrer" className="mt-1">
                                            <img src={resolveStorageUrl(n.imageUrl)} alt="Adjunto del caso"
                                                className="w-14 h-14 rounded-lg object-cover border border-stone-200 dark:border-stone-700 hover:opacity-90 transition-opacity" />
                                        </a>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <label className={labelCls}>Agregar Nueva Observación / Actualización</label>
                <textarea
                    rows={2}
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    placeholder="Escribir un comentario o actualización de estado de garantía..."
                    className={`${inputCls} resize-none`}
                />

                <div className="flex items-center gap-2 mt-2">
                    <label className="flex items-center gap-1.5 px-2.5 py-1.5 bg-stone-50 dark:bg-stone-900 border border-dashed border-stone-300 dark:border-stone-700 rounded-xl cursor-pointer hover:border-amber-400 transition-colors">
                        <ImageIcon className="w-3.5 h-3.5 text-stone-400" />
                        <span className="text-[9px] font-black uppercase tracking-widest text-stone-500">
                            {noteImageFile ? 'Cambiar imagen' : 'Adjuntar imagen'}
                        </span>
                        <input type="file" accept="image/*" onChange={handleNoteImageSelect} className="hidden" />
                    </label>
                    {noteImagePreview && (
                        <>
                            <img src={noteImagePreview} alt="Vista previa" className="w-9 h-9 rounded-lg object-cover border border-stone-200 dark:border-stone-700" />
                            <button onClick={clearNoteImage} className="p-1 rounded-lg hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-400 transition-colors" title="Quitar imagen">
                                <X className="w-3.5 h-3.5" />
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* ── Costo (solo administración) y Responsable ────────────────── */}
            <div className="grid grid-cols-2 gap-3">
                <div>
                    <label className={labelCls}>
                        Costo Adicional ($) {!isAdmin && <span className="text-stone-300">· solo administración</span>}
                    </label>
                    <div className="relative">
                        <input
                            type="number"
                            value={cost}
                            onChange={(e) => setCost(e.target.value === '' ? '' : Number(e.target.value))}
                            placeholder={isAdmin ? '0' : 'Sin cargar'}
                            disabled={!isAdmin || yaImputado}
                            className={`${inputCls} ${!isAdmin || yaImputado ? 'opacity-70 cursor-not-allowed pr-8' : ''}`}
                        />
                        {(!isAdmin || yaImputado) && (
                            <Lock className="w-3 h-3 text-stone-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        )}
                    </div>
                    {!isAdmin && (
                        <p className="mt-1 text-[9px] text-stone-400 leading-relaxed">
                            El costo final lo carga la administración: aun cuando el error es del laboratorio, a veces algo nos cobran.
                        </p>
                    )}
                </div>

                <div>
                    <label className={labelCls}>Responsable · de quién fue</label>
                    <select
                        value={responsibleOption}
                        onChange={(e) => setResponsibleOption(e.target.value)}
                        disabled={yaImputado}
                        className={`${inputCls} ${yaImputado ? 'opacity-70 cursor-not-allowed' : ''}`}
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
            </div>

            {/* ── A qué caja impacta el costo ──────────────────────────────── */}
            <div className={`flex items-start gap-2 rounded-xl border p-2.5 ${caja.loCubreLaOptica
                ? 'border-stone-200 dark:border-stone-700 bg-stone-50/60 dark:bg-stone-800/30'
                : 'border-amber-200 dark:border-amber-900/40 bg-amber-50/60 dark:bg-amber-950/20'}`}>
                <Wallet className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 ${caja.loCubreLaOptica ? 'text-stone-400' : 'text-amber-500'}`} />
                <div>
                    <p className="text-[8px] font-black text-stone-400 uppercase tracking-widest">Impacta en</p>
                    <p className="text-xs font-black text-stone-700 dark:text-stone-200">{caja.label}</p>
                    <p className="text-[9px] text-stone-500 dark:text-stone-400 leading-relaxed mt-0.5">
                        {caja.loCubreLaOptica
                            ? 'No es de nadie del equipo: lo absorbe la óptica. El descuento se hace cuando el laboratorio cierra el costo real.'
                            : 'El descuento se hace cuando el laboratorio cierra el costo real, y lo confirma la administración.'}
                    </p>
                </div>
            </div>

            {/* ── Cobertura y tipo de caso ─────────────────────────────────── */}
            <div className="grid grid-cols-2 gap-3">
                <div>
                    <label className={labelCls}>Cobertura</label>
                    <select
                        value={coverage}
                        onChange={(e) => setCoverage(e.target.value)}
                        className={`${inputCls} ${coverage === 'Con cargo' ? 'border-amber-300 dark:border-amber-800' : coverage === 'Sin cargo' ? 'border-emerald-300 dark:border-emerald-800' : ''}`}
                    >
                        <option value="">Sin definir</option>
                        {POST_SALE_COVERAGE.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                </div>
                <div>
                    <label className={labelCls}>Tipo de caso</label>
                    <select value={caseType} onChange={(e) => setCaseType(e.target.value)} className={inputCls}>
                        <option value="">Sin clasificar</option>
                        {POST_SALE_CASE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                </div>
            </div>

            {/* ── Laboratorio y nº de operación ────────────────────────────── */}
            <div>
                <label className={labelCls}>¿Requiere procesar en laboratorio?</label>
                <select value={orderOption} onChange={(e) => setOrderOption(e.target.value)} className={inputCls}>
                    <option value="">No requiere / No aplica</option>
                    <option value="SAME">Mismo número de pedido ({value.labOrderNumber || 'Sin número'})</option>
                    <option value="DIFFERENT">Número de pedido diferente</option>
                </select>
            </div>

            {/* El nº de operación queda SIEMPRE accesible y se puede dejar vacío:
                se elige "pedido diferente" al abrir el caso y el número recién se
                carga cuando el laboratorio lo procesó de verdad. Vacío se ve. */}
            <div>
                <label className={labelCls}>N° de operación del caso</label>
                <input
                    type="text"
                    value={newOrderNumber}
                    onChange={(e) => setNewOrderNumber(e.target.value)}
                    placeholder="Todavía sin número — cargalo cuando el lab lo procese"
                    className={`${inputCls} font-mono ${newOrderNumber.trim()
                        ? 'border-emerald-300 dark:border-emerald-800'
                        : 'border-dashed border-amber-300 dark:border-amber-800 bg-amber-50/40 dark:bg-amber-950/10 placeholder-amber-600/60 dark:placeholder-amber-500/50'}`}
                />
                {!newOrderNumber.trim() && (
                    <p className="mt-1 text-[9px] font-bold text-amber-600 dark:text-amber-500 leading-relaxed">
                        Pendiente de cargar. Se puede guardar el caso así y completarlo después.
                    </p>
                )}
            </div>

            {orderOption === 'DIFFERENT' && reprocessSlot}

            <button
                onClick={handleSave}
                disabled={saving}
                className="w-full py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2"
            >
                {saving ? (<><Loader2 className="w-3.5 h-3.5 animate-spin" /> Guardando...</>) : 'Guardar Registro'}
            </button>

            {yaImputado && (
                <p className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 leading-relaxed">
                    El costo de este caso ya se descontó de caja: el monto y el responsable quedan cerrados. Para corregirlos hay que revertir el movimiento de caja.
                </p>
            )}
        </div>
    );

    if (variant === 'plain') return cuerpo;

    return (
        <div className={open ? 'bg-white dark:bg-stone-850 rounded-2xl border border-stone-100 dark:border-stone-700/50 p-5 shadow-sm space-y-4' : ''}>
            <button
                onClick={() => setOpen(!open)}
                className={open
                    ? 'w-full flex items-center justify-between gap-2 mb-2 pb-2 border-b border-stone-100 dark:border-stone-700/50'
                    : 'w-full flex items-center justify-between gap-2 px-4 py-3 bg-white dark:bg-stone-850 rounded-2xl border border-stone-100 dark:border-stone-700/50 shadow-sm hover:bg-amber-50/50 dark:hover:bg-amber-950/20 transition-all'}
            >
                <span className="text-[10px] font-black text-amber-600 dark:text-amber-500 uppercase tracking-widest">
                    Servicio de Post Venta
                </span>
                {open ? <ChevronUp className="w-4 h-4 text-amber-500" /> : <ChevronRight className="w-4 h-4 text-amber-500" />}
            </button>
            {open && cuerpo}
        </div>
    );
}
