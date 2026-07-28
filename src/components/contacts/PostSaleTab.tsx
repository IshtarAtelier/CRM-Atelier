'use client';

import React, { useState } from 'react';
import { LifeBuoy, ImageIcon, Receipt, Plus, X, Send, Paperclip, ShieldCheck } from 'lucide-react';
import {
    caseTypeStyle, postSaleStatusLabel,
    POST_SALE_CASE_TYPES, POST_SALE_FAULTS, POST_SALE_COVERAGE
} from '@/lib/constants/postSale';
import { formatDate, formatDateTime } from '@/lib/format-date';
import { resolveStorageUrl } from '@/lib/utils/storage';

interface PostSaleNote {
    id: string;
    content: string;
    createdBy?: string | null;
    createdAt?: string | Date | null;
    imageUrl?: string | null;
}

interface PostSaleCase {
    id: string;
    orderId?: string | null;
    orderLabel?: string | null;
    status?: string | null;
    cost?: number | null;
    newOrderNumber?: string | null;
    notes?: string | null;
    orderOption?: string | null;
    responsible?: string | null;
    caseType?: string | null;
    fault?: string | null;
    coverage?: string | null;
    createdAt?: string | Date | null;
    order?: { id: string; total?: number | null; createdAt?: string | Date | null; labOrderNumber?: string | null } | null;
    notesList?: PostSaleNote[];
}

/** Sube una imagen y devuelve su URL/clave de storage (reusa /api/upload). */
async function uploadImage(file: File): Promise<string | null> {
    try {
        const fd = new FormData();
        fd.append('file', file);
        const res = await fetch('/api/upload', { method: 'POST', body: fd });
        if (!res.ok) return null;
        const data = await res.json();
        return data.url || data.fileUrl || null;
    } catch { return null; }
}

/**
 * Solapa de Post Venta en la ficha del cliente.
 * - Lista TODOS los casos del cliente (consultados por clientId: sobreviven aunque
 *   se borre la venta).
 * - Permite AGREGAR: una observación (con foto) a un caso, o abrir un caso nuevo.
 * - Nunca permite ELIMINAR: los casos y sus observaciones son append-only.
 */
export default function PostSaleTab({ contact, onRefresh }: { contact: any; onRefresh: () => void }) {
    const cases: PostSaleCase[] = contact?.postSaleCases || [];
    const [creating, setCreating] = useState(false);

    // Ventas del cliente que todavía no tienen caso (para abrir uno nuevo).
    const casedOrderIds = new Set(cases.map(c => c.orderId).filter(Boolean));
    const salesWithoutCase = (contact?.orders || []).filter(
        (o: any) => (o.orderType === 'SALE' || o.orderType === 'MAYORISTA') && !casedOrderIds.has(o.id)
    );

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            {/* Barra: blindaje + nuevo caso */}
            <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Registro permanente · no se elimina
                </div>
                {salesWithoutCase.length > 0 && !creating && (
                    <button
                        onClick={() => setCreating(true)}
                        className="ml-auto flex items-center gap-2 px-4 py-2 bg-stone-900 text-white dark:bg-primary dark:text-primary-foreground rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg hover:opacity-90 transition-opacity"
                    >
                        <Plus className="w-4 h-4" /> Nuevo caso
                    </button>
                )}
            </div>

            {creating && (
                <NewCaseForm
                    sales={salesWithoutCase}
                    onCancel={() => setCreating(false)}
                    onSaved={() => { setCreating(false); onRefresh(); }}
                />
            )}

            {cases.length === 0 && !creating ? (
                <div className="text-center py-16 border-2 border-dashed border-stone-200 dark:border-stone-800 rounded-[3rem]">
                    <LifeBuoy className="w-12 h-12 text-stone-200 dark:text-stone-700 mx-auto mb-4" />
                    <p className="text-xs font-black text-stone-300 dark:text-stone-600 uppercase tracking-widest">
                        Sin casos de post venta
                    </p>
                    {salesWithoutCase.length > 0 && (
                        <button onClick={() => setCreating(true)} className="mt-4 text-[10px] font-black uppercase tracking-widest text-stone-500 hover:text-stone-800 dark:hover:text-stone-200">
                            + Abrir el primer caso
                        </button>
                    )}
                </div>
            ) : (
                <div className="space-y-8">
                    {cases.map((c) => (
                        <CaseCard key={c.id} c={c} onRefresh={onRefresh} />
                    ))}
                </div>
            )}
        </div>
    );
}

function CaseContext({ c }: { c: PostSaleCase }) {
    // Preferir datos vivos de la venta; si no está (venta borrada), el snapshot.
    const total = c.order?.total;
    const date = c.order?.createdAt;
    const op = c.order?.labOrderNumber;
    return (
        <div className="flex items-center flex-wrap gap-2 text-[10px] font-black uppercase tracking-widest text-stone-500 dark:text-stone-400">
            <Receipt className="w-3.5 h-3.5" />
            {c.order ? (
                <>
                    <span>Venta{date ? ` · ${formatDate(date)}` : ''}</span>
                    {total != null && <span className="text-stone-400">· ${Number(total).toLocaleString('es-AR')}</span>}
                    {op && <span className="text-stone-400">· Op. {op}</span>}
                </>
            ) : (
                <span className="text-stone-400">{c.orderLabel || 'Venta eliminada'} · (venta ya no existe)</span>
            )}
        </div>
    );
}

function CaseCard({ c, onRefresh }: { c: PostSaleCase; onRefresh: () => void }) {
    return (
        <div className="space-y-3">
            <CaseContext c={c} />

            <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900/60 p-4 space-y-3">
                {/* Cabecera: tipo + estado + fecha */}
                <div className="flex flex-wrap items-center gap-2">
                    <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md border ${caseTypeStyle(c.caseType)}`}>
                        {c.caseType || 'Sin tipificar'}
                    </span>
                    <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md border border-stone-200 dark:border-stone-700 text-stone-500 dark:text-stone-400">
                        {postSaleStatusLabel(c.status)}
                    </span>
                    {c.createdAt && (
                        <span className="ml-auto text-[9px] font-bold text-stone-400">{formatDateTime(c.createdAt)}</span>
                    )}
                </div>

                {/* Datos del caso */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <Field label="Culpa" value={c.fault} />
                    <CoverageField coverage={c.coverage} />
                    <Field label="Costo" value={c.cost != null && c.cost > 0 ? `$${c.cost.toLocaleString('es-AR')}` : null} />
                    <Field label="Responsable" value={c.responsible} />
                    <Field label="Resolución" value={resolucionLabel(c)} />
                </div>

                {/* Observaciones (append-only, con autor, fecha e imagen) */}
                <div className="space-y-2 pt-1">
                    <p className="text-[8px] font-black text-stone-400 uppercase tracking-widest">Observaciones</p>
                    {(c.notesList && c.notesList.length > 0) ? (
                        c.notesList.map((n) => (
                            <div key={n.id} className="rounded-xl bg-stone-50 dark:bg-stone-800/50 border border-stone-200/60 dark:border-stone-800 p-3">
                                <p className="text-xs text-stone-700 dark:text-stone-300 whitespace-pre-wrap leading-relaxed">{n.content}</p>
                                {n.imageUrl && (
                                    <a href={resolveStorageUrl(n.imageUrl)} target="_blank" rel="noopener noreferrer"
                                        className="mt-2 inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400 hover:underline">
                                        <ImageIcon className="w-3.5 h-3.5" /> Ver foto
                                    </a>
                                )}
                                <div className="mt-1.5 flex items-center gap-2 text-[9px] font-bold text-stone-400">
                                    {n.createdBy && <span>{n.createdBy}</span>}
                                    {n.createdBy && n.createdAt && <span>·</span>}
                                    {n.createdAt && <span>{formatDateTime(n.createdAt)}</span>}
                                </div>
                            </div>
                        ))
                    ) : (
                        <p className="text-[10px] text-stone-400 italic">Sin observaciones registradas.</p>
                    )}
                </div>

                {/* Agregar observación (solo si la venta sigue existiendo).
                    Misma señal que CaseContext: la relación `order` cargada. */}
                {c.order ? (
                    <AddNote orderId={c.order.id} onSaved={onRefresh} />
                ) : (
                    <p className="text-[9px] font-bold text-stone-400 italic pt-1">
                        La venta original fue eliminada: el caso queda como registro histórico (solo lectura).
                    </p>
                )}
            </div>
        </div>
    );
}

/** Form inline para sumar una observación a un caso existente. */
function AddNote({ orderId, onSaved }: { orderId: string; onSaved: () => void }) {
    const [text, setText] = useState('');
    const [file, setFile] = useState<File | null>(null);
    const [saving, setSaving] = useState(false);

    const submit = async () => {
        if (!text.trim() || saving) return;
        setSaving(true);
        try {
            let imageUrl: string | null = null;
            if (file) {
                imageUrl = await uploadImage(file);
                if (!imageUrl) { alert('No se pudo subir la foto. Reintentá o guardá la observación sin foto.'); return; }
            }

            // Se manda SOLO la observación nueva; el server la estampa y la agrega
            // al historial (append-only, sin reconstruir desde un snapshot viejo).
            const res = await fetch(`/api/orders/${orderId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ postSaleNoteEntry: text.trim(), postSaleNoteImageUrl: imageUrl })
            });
            if (res.ok) { setText(''); setFile(null); onSaved(); }
            else { const d = await res.json().catch(() => ({})); alert(`Error: ${d.error || 'No se pudo guardar'}`); }
        } finally { setSaving(false); }
    };

    return (
        <div className="pt-2 border-t border-stone-100 dark:border-stone-800">
            <div className="flex items-end gap-2">
                <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Agregar observación…"
                    rows={2}
                    className="flex-1 text-xs rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 px-3 py-2 outline-none focus:ring-2 focus:ring-stone-300 dark:focus:ring-stone-600 resize-none"
                />
                <div className="flex flex-col gap-1.5">
                    <label className={`cursor-pointer p-2 rounded-xl border transition-colors ${file ? 'border-amber-300 bg-amber-50 text-amber-600 dark:bg-amber-950/30' : 'border-stone-200 dark:border-stone-700 text-stone-400 hover:text-stone-600'}`} title="Adjuntar foto">
                        <Paperclip className="w-4 h-4" />
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
                    </label>
                    <button
                        onClick={submit}
                        disabled={!text.trim() || saving}
                        className="p-2 rounded-xl bg-stone-900 text-white dark:bg-primary dark:text-primary-foreground disabled:opacity-40 transition-opacity"
                        title="Guardar observación"
                    >
                        <Send className="w-4 h-4" />
                    </button>
                </div>
            </div>
            {file && (
                <p className="mt-1 text-[9px] font-bold text-amber-600 flex items-center gap-1">
                    <ImageIcon className="w-3 h-3" /> {file.name}
                    <button onClick={() => setFile(null)} className="ml-1 text-stone-400 hover:text-stone-600"><X className="w-3 h-3" /></button>
                </p>
            )}
        </div>
    );
}

/** Form para abrir un caso de post venta nuevo sobre una venta del cliente. */
function NewCaseForm({ sales, onCancel, onSaved }: { sales: any[]; onCancel: () => void; onSaved: () => void }) {
    const [orderId, setOrderId] = useState<string>(sales[0]?.id || '');
    const [caseType, setCaseType] = useState<string>('');
    const [fault, setFault] = useState<string>('');
    const [coverage, setCoverage] = useState<string>('');
    const [cost, setCost] = useState<string>('');
    const [responsible, setResponsible] = useState<string>('');
    const [notes, setNotes] = useState<string>('');
    const [file, setFile] = useState<File | null>(null);
    const [saving, setSaving] = useState(false);

    const saleLabel = (o: any) => {
        const d = o.createdAt ? formatDate(o.createdAt) : '';
        const t = o.total != null ? `$${Number(o.total).toLocaleString('es-AR')}` : '';
        return `Venta #${o.id.slice(-4).toUpperCase()}${d ? ` · ${d}` : ''}${t ? ` · ${t}` : ''}`;
    };

    const submit = async () => {
        if (!orderId || !caseType || saving) return;
        setSaving(true);
        try {
            let imageUrl: string | null = null;
            if (file) {
                imageUrl = await uploadImage(file);
                if (!imageUrl) { alert('No se pudo subir la foto. Reintentá o abrí el caso sin foto.'); return; }
            }

            // Si hay foto pero no se escribió observación, se sintetiza una para que
            // la imagen tenga a qué observación adjuntarse (no quede huérfana).
            const entryText = notes.trim() || (imageUrl ? 'Foto adjunta' : '');
            const costNum = Number(cost);

            const res = await fetch(`/api/orders/${orderId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    postSaleCaseType: caseType,
                    postSaleFault: fault || null,
                    postSaleCoverage: coverage || null,
                    postSaleCost: Number.isFinite(costNum) ? costNum : 0,
                    postSaleResponsible: responsible || null,
                    postSaleStatus: 'SENT',
                    postSaleNoteEntry: entryText || null,
                    postSaleNoteImageUrl: imageUrl
                })
            });
            if (res.ok) onSaved();
            else { const d = await res.json().catch(() => ({})); alert(`Error: ${d.error || 'No se pudo abrir el caso'}`); }
        } finally { setSaving(false); }
    };

    const selectCls = "w-full text-xs rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 px-3 py-2 outline-none focus:ring-2 focus:ring-stone-300";

    return (
        <div className="rounded-2xl border-2 border-stone-900/10 dark:border-primary/30 bg-stone-50 dark:bg-stone-900/50 p-5 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="flex items-center justify-between">
                <h4 className="text-[11px] font-black uppercase tracking-widest text-stone-700 dark:text-stone-200">Nuevo caso de post venta</h4>
                <button onClick={onCancel} className="p-1 text-stone-400 hover:text-stone-700"><X className="w-4 h-4" /></button>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                    <Label>Venta</Label>
                    <select value={orderId} onChange={(e) => setOrderId(e.target.value)} className={selectCls}>
                        {sales.map((o) => <option key={o.id} value={o.id}>{saleLabel(o)}</option>)}
                    </select>
                </div>
                <div>
                    <Label>Tipo de caso *</Label>
                    <select value={caseType} onChange={(e) => setCaseType(e.target.value)} className={selectCls}>
                        <option value="">Elegir…</option>
                        {POST_SALE_CASE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                </div>
                <div>
                    <Label>Culpa / origen</Label>
                    <select value={fault} onChange={(e) => setFault(e.target.value)} className={selectCls}>
                        <option value="">—</option>
                        {POST_SALE_FAULTS.map((f) => <option key={f} value={f}>{f}</option>)}
                    </select>
                </div>
                <div>
                    <Label>Cobertura</Label>
                    <select value={coverage} onChange={(e) => setCoverage(e.target.value)} className={selectCls}>
                        <option value="">—</option>
                        {POST_SALE_COVERAGE.map((cv) => <option key={cv} value={cv}>{cv}</option>)}
                    </select>
                </div>
                <div>
                    <Label>Costo</Label>
                    <input type="number" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="0" className={selectCls} />
                </div>
                <div className="sm:col-span-2">
                    <Label>Responsable</Label>
                    <input value={responsible} onChange={(e) => setResponsible(e.target.value)} placeholder="Quién se hace cargo" className={selectCls} />
                </div>
                <div className="sm:col-span-2">
                    <Label>Primera observación</Label>
                    <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Qué reporta el cliente / qué se detectó…" className={`${selectCls} resize-none`} />
                </div>
            </div>

            <div className="flex items-center justify-between gap-2">
                <label className={`cursor-pointer inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-colors ${file ? 'border-amber-300 bg-amber-50 text-amber-600' : 'border-stone-200 dark:border-stone-700 text-stone-400 hover:text-stone-600'}`}>
                    <Paperclip className="w-3.5 h-3.5" /> {file ? file.name.slice(0, 18) : 'Adjuntar foto'}
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
                </label>
                <button
                    onClick={submit}
                    disabled={!orderId || !caseType || saving}
                    className="flex items-center gap-2 px-5 py-2.5 bg-stone-900 text-white dark:bg-primary dark:text-primary-foreground rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg disabled:opacity-40"
                >
                    {saving ? 'Guardando…' : 'Abrir caso'}
                </button>
            </div>
        </div>
    );
}

function Label({ children }: { children: React.ReactNode }) {
    return <p className="text-[8px] font-black text-stone-400 uppercase tracking-widest mb-1">{children}</p>;
}

function Field({ label, value }: { label: string; value?: string | null }) {
    if (!value) return null;
    return (
        <div>
            <p className="text-[8px] font-black text-stone-400 uppercase tracking-widest mb-0.5">{label}</p>
            <p className="text-xs font-bold text-stone-700 dark:text-stone-300 break-words">{value}</p>
        </div>
    );
}

/** Cobertura con color (verde Sin cargo / ámbar Con cargo), igual que el tablero. */
function CoverageField({ coverage }: { coverage?: string | null }) {
    if (!coverage) return null;
    const isCharged = coverage === 'Con cargo';
    return (
        <div>
            <p className="text-[8px] font-black text-stone-400 uppercase tracking-widest mb-0.5">Cobertura</p>
            <span className={`inline-block text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border ${isCharged
                ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900/40'
                : 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900/40'}`}>
                {coverage}
            </span>
        </div>
    );
}

/**
 * Etiqueta de "Resolución" con la MISMA semántica que el tablero de Post Venta:
 * orderOption 'SAME'  → mismo pedido (usa el nº de operación original)
 * orderOption 'DIFFERENT' → pedido nuevo (usa el nº nuevo cargado)
 * Cualquier otro valor (texto libre) se muestra tal cual.
 */
function resolucionLabel(c: PostSaleCase): string | null {
    if (!c.orderOption) return c.newOrderNumber ? `Pedido nuevo (#${c.newOrderNumber})` : null;
    if (c.orderOption === 'SAME') return `Mismo pedido (#${c.order?.labOrderNumber || 'Original'})`;
    if (c.orderOption === 'DIFFERENT') return `Pedido nuevo (#${c.newOrderNumber || '—'})`;
    return c.orderOption;
}
