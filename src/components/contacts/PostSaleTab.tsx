'use client';

import React, { useState, useEffect } from 'react';
import { LifeBuoy, ImageIcon, Receipt, Plus, X, Paperclip, ShieldCheck, ChevronDown, Wallet } from 'lucide-react';
import {
    caseTypeStyle, postSaleColumnLabel,
    POST_SALE_CASE_TYPES, POST_SALE_COVERAGE, POST_SALE_RESPONSIBLE_CAUSES,
    parseResponsibleOption, responsibleUserValue, type PostSaleUser
} from '@/lib/constants/postSale';
import { PostSaleServiceForm, postSaleValueFromCase } from '@/components/orders/PostSaleServiceForm';
import { PostSaleOperationNumber, operationNumbersOf } from '@/components/orders/PostSaleOperationNumber';
import { formatDate, formatDateTime } from '@/lib/format-date';
import { resolveStorageUrl } from '@/lib/utils/storage';
import { PricingService } from '@/services/PricingService';
import AddPaymentModal from '@/components/quotes/AddPaymentModal';

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
    newOrderNumberHistory?: string | null;
    notes?: string | null;
    orderOption?: string | null;
    responsible?: string | null;
    caseType?: string | null;
    fault?: string | null;
    coverage?: string | null;
    rxData?: string | null;
    createdAt?: string | Date | null;
    // Cierre económico del caso (ver /api/post-sale/[id]/cost).
    costEstimated?: number | null;
    costSource?: string | null;
    costConfirmedAt?: string | Date | null;
    costConfirmedBy?: string | null;
    faultUserId?: string | null;
    cashEntryId?: string | null;
    // Alternativa a la caja: lo paga el cliente; se carga acá y suma al saldo de la venta.
    clientCharge?: number | null;
    clientChargedAt?: string | Date | null;
    clientChargedBy?: string | null;
    /** Reparto vigente del costo (lo arma contact.service.getById). */
    reparto?: { cajaMonto: number; cajaVendorId: string | null; cajaVendorName: string | null; clienteMonto: number } | null;
    order?: { id: string; total?: number | null; createdAt?: string | Date | null; labOrderNumber?: string | null; [k: string]: any } | null;
    notesList?: PostSaleNote[];
}


/**
 * En qué etapa está el costo del caso. Es lo que decide si se puede cobrar:
 * el costo real lo cierra el laboratorio al facturar TODAS las operaciones, y
 * hasta entonces lo que hay es la estimación que cargó el vendedor.
 */
type CostStage = 'SIN_COSTO' | 'ESTIMADO' | 'CERRADO' | 'REPARTIDO';
/** Texto corto del chip del caso: a dónde fue el costo. */
function repartoCorto(c: PostSaleCase): string {
    const r = c.reparto;
    if (!r) return 'Repartido';
    if (r.cajaMonto > 0 && r.clienteMonto > 0) return 'Caja + cliente';
    if (r.clienteMonto > 0) return 'Lo paga el cliente';
    return `Cobrado a caja${r.cajaVendorName ? ` · ${r.cajaVendorName}` : ''}`;
}

function costStage(c: PostSaleCase): CostStage {
    if (c.cashEntryId || c.clientChargedAt) return 'REPARTIDO';
    if (c.costSource === 'LAB') return 'CERRADO';
    if ((c.cost ?? 0) > 0) return 'ESTIMADO';
    return 'SIN_COSTO';
}

const COST_STAGE_UI: Record<CostStage, { label: string; cls: string }> = {
    SIN_COSTO: { label: 'Sin costo', cls: 'bg-stone-100 text-stone-500 border-stone-200 dark:bg-stone-800 dark:text-stone-400 dark:border-stone-700' },
    ESTIMADO: { label: 'Estimado · esperando laboratorio', cls: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/30 dark:text-sky-400 dark:border-sky-900/40' },
    CERRADO: { label: 'Costo cerrado · listo para repartir', cls: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900/40' },
    REPARTIDO: { label: 'Costo repartido', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900/40' },
};

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
export default function PostSaleTab({ contact, onRefresh, userRole }: { contact: any; onRefresh: () => void; userRole?: string }) {
    const cases: PostSaleCase[] = contact?.postSaleCases || [];
    const [creating, setCreating] = useState(false);
    const isAdmin = userRole === 'ADMIN';

    // Caso puntual al que apunta el link del email de costo: se abre solo y
    // queda resaltado, para no tener que buscarlo entre los casos del cliente.
    const [highlightId, setHighlightId] = useState<string | null>(null);
    useEffect(() => {
        const id = new URLSearchParams(window.location.search).get('postSaleCaseId');
        if (id) setHighlightId(id);
    }, []);

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
                    isAdmin={isAdmin}
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
                    {/* El caso señalado por el email va primero: es a lo que viniste. */}
                    {[...cases]
                        .sort((a, b) => (a.id === highlightId ? -1 : b.id === highlightId ? 1 : 0))
                        .map((c) => (
                            <CaseCard
                                key={c.id}
                                c={c}
                                isAdmin={isAdmin}
                                userRole={userRole}
                                highlighted={c.id === highlightId}
                                onRefresh={onRefresh}
                            />
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

/** Nº de operación en grande y copiable: es el dato que más se copia y pega. */
/**
 * Cierre económico del caso: muestra en qué etapa está el costo y, cuando el
 * laboratorio ya lo cerró, permite descontarlo de la caja del responsable.
 * Solo el administrador ve el disparo (la API además lo exige).
 */
function CashPanel({ c, isAdmin, onRefresh }: { c: PostSaleCase; isAdmin: boolean; onRefresh: () => void }) {
    const stage = costStage(c);
    const costo = Math.round(c.cost ?? 0);
    const vigente = c.reparto || { cajaMonto: 0, cajaVendorId: null, cajaVendorName: null, clienteMonto: 0 };
    const hayReparto = vigente.cajaMonto > 0 || vigente.clienteMonto > 0;
    const [vendors, setVendors] = useState<{ id: string; name: string }[]>([]);

    // El reparto que se está editando. Arranca en lo vigente; si no hay nada
    // todavía, propone según el caso: "Con cargo" o culpa del cliente ⇒ todo al
    // cliente; culpa de una persona de la óptica ⇒ todo a su caja; si no, Ishtar.
    const propuestaInicial = () => {
        if (hayReparto) return { cajaVendorId: vigente.cajaVendorId || '', caja: vigente.cajaMonto, cliente: vigente.clienteMonto };
        if (c.fault === 'Cliente' || c.coverage === 'Con cargo') return { cajaVendorId: '', caja: 0, cliente: costo };
        return { cajaVendorId: c.faultUserId || '', caja: costo, cliente: 0 };
    };
    const [cajaVendorId, setCajaVendorId] = useState<string>(propuestaInicial().cajaVendorId);
    const [caja, setCaja] = useState<number>(propuestaInicial().caja);
    const [cliente, setCliente] = useState<number>(propuestaInicial().cliente);
    const [working, setWorking] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [pagando, setPagando] = useState(false);

    useEffect(() => {
        if (!isAdmin || stage === 'SIN_COSTO' || stage === 'ESTIMADO') return;
        fetch('/api/users')
            .then(r => (r.ok ? r.json() : []))
            .then((d: any[]) => Array.isArray(d) && setVendors(d.filter(u => u.role !== 'OPTICA').map(u => ({ id: u.id, name: u.name }))))
            .catch(() => setVendors([]));
    }, [isAdmin, stage]);

    // Si el caso se refresca (se aplicó un reparto), la edición vuelve a lo vigente.
    useEffect(() => {
        const p = propuestaInicial();
        setCajaVendorId(p.cajaVendorId); setCaja(p.caja); setCliente(p.cliente);
    }, [vigente.cajaMonto, vigente.clienteMonto, vigente.cajaVendorId, costo]);

    const fmt = (n: number) => `$${Math.round(n).toLocaleString('es-AR')}`;
    const clamp = (n: number) => Math.max(0, Math.min(costo, Math.round(Number(n) || 0)));
    // Los dos renglones siempre suman el costo: tocar uno acomoda al otro.
    const ponerCaja = (n: number) => { const v = clamp(n); setCaja(v); setCliente(costo - v); };
    const ponerCliente = (n: number) => { const v = clamp(n); setCliente(v); setCaja(costo - v); };

    const nombreCaja = (id: string) => (id ? (vendors.find(v => v.id === id)?.name || 'esa caja') : 'caja Ishtar');
    const sinCambios = hayReparto
        && caja === vigente.cajaMonto && cliente === vigente.clienteMonto
        && (cajaVendorId || '') === (vigente.cajaVendorId || '');

    const llamar = async (body: Record<string, unknown>): Promise<boolean> => {
        if (working) return false;
        setWorking(true);
        setError(null);
        try {
            const res = await fetch(`/api/post-sale/${c.id}/cost`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            const d = await res.json().catch(() => ({}));
            if (!res.ok) { setError(d.error || 'No se pudo completar la operación'); return false; }
            onRefresh();
            return true;
        } catch {
            setError('No se pudo conectar con el servidor.');
            return false;
        } finally { setWorking(false); }
    };
    const aplicar = () => llamar({ action: 'repartir', cajaVendorId: cajaVendorId || undefined, cajaMonto: caja, clienteMonto: cliente });
    const deshacer = () => {
        if (window.confirm('¿Deshacer el reparto? El descuento de caja se revierte con un contraasiento (nada se borra) y se quita el saldo del cliente. Los pagos que el cliente ya hizo no se tocan.')) {
            llamar({ action: 'anular_reparto' });
        }
    };

    // Saldo de la VENTA (incluye el cargo al cliente): el pago es el pago normal
    // de la venta, con comprobante, y por eso entra a caja y a la lista de saldos.
    const finVenta = c.order ? PricingService.calculateOrderFinancials(c.order) : null;
    const saldoVenta = finVenta?.remainingCard ?? 0;

    // Después de TODOS los hooks: un return antes cambiaría su orden entre renders.
    if (stage === 'SIN_COSTO') return null;

    const CAMPO_MONTO = 'w-28 text-xs text-right rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 px-3 py-2 outline-none focus:ring-2 focus:ring-stone-300';
    const ATAJO = 'px-2.5 py-1 rounded-lg border border-stone-200 dark:border-stone-700 text-[9px] font-black uppercase tracking-widest text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800';

    return (
        <div className="rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50/60 dark:bg-stone-800/30 p-3 space-y-3">
            <div className="flex items-center flex-wrap gap-2">
                <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md border ${COST_STAGE_UI[stage].cls}`}>
                    {COST_STAGE_UI[stage].label}
                </span>
                <span className="text-sm font-black text-stone-800 dark:text-stone-100">{fmt(costo)}</span>
                {stage !== 'ESTIMADO' && c.costEstimated != null && Math.abs(c.costEstimated - costo) >= 1 && (
                    <span className="text-[9px] font-bold text-stone-400">
                        estimado: {fmt(c.costEstimated)} · {costo > c.costEstimated ? '+' : '−'}{fmt(Math.abs(costo - c.costEstimated))}
                    </span>
                )}
            </div>

            {stage === 'ESTIMADO' && (
                <p className="text-[10px] text-stone-500 dark:text-stone-400 leading-relaxed">
                    Es la estimación cargada a mano. El costo real lo cierra el laboratorio cuando factura
                    {operationNumbersOf(c.newOrderNumber).length > 1 ? ' las dos operaciones' : ' la operación'} del caso. Recién ahí se puede repartir.
                </p>
            )}

            {/* ── Reparto vigente ──────────────────────────────────────────── */}
            {hayReparto && (
                <div className="grid grid-cols-2 gap-2 text-center">
                    <div className="rounded-lg bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 py-1.5 px-2">
                        <p className="text-[8px] font-black uppercase tracking-widest text-stone-400">De caja{vigente.cajaVendorName ? ` · ${vigente.cajaVendorName}` : ''}</p>
                        <p className="text-sm font-black text-stone-800 dark:text-stone-100">{fmt(vigente.cajaMonto)}</p>
                    </div>
                    <div className="rounded-lg bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 py-1.5 px-2">
                        <p className="text-[8px] font-black uppercase tracking-widest text-stone-400">Al cliente · saldo de la venta</p>
                        <p className={`text-sm font-black ${vigente.clienteMonto > 0 && saldoVenta > 1000 ? 'text-violet-700 dark:text-violet-400' : 'text-stone-800 dark:text-stone-100'}`}>
                            {fmt(vigente.clienteMonto)}
                            {vigente.clienteMonto > 0 && <span className="block text-[9px] font-bold text-stone-400">saldo hoy: {fmt(saldoVenta)}</span>}
                        </p>
                    </div>
                </div>
            )}
            {hayReparto && (
                <p className="text-[10px] text-stone-500 dark:text-stone-400 leading-relaxed">
                    Repartido{c.costConfirmedBy ? ` por ${c.costConfirmedBy}` : ''}{c.costConfirmedAt ? ` · ${formatDateTime(c.costConfirmedAt)}` : ''}.
                    {vigente.clienteMonto > 0 && ' La parte del cliente figura en la lista de saldos y se cobra con comprobante desde acá.'}
                </p>
            )}

            {/* ── Cobro al cliente ─────────────────────────────────────────── */}
            {vigente.clienteMonto > 0 && c.order?.id && (
                <>
                    {saldoVenta > 1000 ? (
                        <button
                            onClick={() => setPagando(true)}
                            className="w-full px-4 py-2.5 rounded-xl bg-violet-700 text-white text-[10px] font-black uppercase tracking-widest hover:opacity-90"
                        >
                            Registrar pago del cliente (efectivo o transferencia)
                        </button>
                    ) : (
                        <p className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400">La venta no tiene saldo: el cliente ya pagó su parte.</p>
                    )}
                    {pagando && (
                        <AddPaymentModal
                            orderId={c.order.id}
                            totalAmount={finVenta?.listPrice ?? 0}
                            paidAmount={finVenta?.paidReal ?? 0}
                            soloEfectivoYTransferencia
                            onClose={() => setPagando(false)}
                            onSuccess={() => { setPagando(false); onRefresh(); }}
                        />
                    )}
                </>
            )}

            {/* ── Editor del reparto (solo admin, con el costo cerrado) ─────── */}
            {stage !== 'ESTIMADO' && (isAdmin ? (
                <div className="space-y-2 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900/40 p-3">
                    <p className="text-[8px] font-black text-stone-400 uppercase tracking-widest">{hayReparto ? 'Cambiar el reparto' : 'Quién paga el costo'}</p>
                    <div className="flex flex-wrap gap-1.5">
                        <button type="button" className={ATAJO} onClick={() => ponerCaja(costo)}>Todo a caja</button>
                        <button type="button" className={ATAJO} onClick={() => ponerCliente(costo)}>Todo al cliente</button>
                        <button type="button" className={ATAJO} onClick={() => ponerCaja(Math.round(costo / 2))}>Mitad y mitad</button>
                    </div>
                    <div className="flex items-center gap-2">
                        <select
                            value={cajaVendorId}
                            onChange={(e) => setCajaVendorId(e.target.value)}
                            className="flex-1 min-w-0 text-xs rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 px-3 py-2 outline-none focus:ring-2 focus:ring-stone-300"
                        >
                            <option value="">Caja Ishtar — lo cubre Atelier</option>
                            {vendors.map(v => <option key={v.id} value={v.id}>Caja de {v.name}</option>)}
                        </select>
                        <input type="number" inputMode="numeric" min={0} max={costo} value={caja} onChange={(e) => ponerCaja(Number(e.target.value))} className={CAMPO_MONTO} aria-label="Monto a caja" />
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="flex-1 text-xs font-bold text-stone-700 dark:text-stone-300 px-3">El cliente — se suma al saldo de la venta</span>
                        <input type="number" inputMode="numeric" min={0} max={costo} value={cliente} onChange={(e) => ponerCliente(Number(e.target.value))} className={CAMPO_MONTO} aria-label="Monto al cliente" />
                    </div>
                    {cliente > 0 && (
                        <p className="text-[9px] text-violet-600 dark:text-violet-400">
                            La parte del cliente aparece en la lista de saldos y se cobra con comprobante (efectivo o transferencia). No se descuenta de ninguna caja.
                        </p>
                    )}
                    <button
                        onClick={aplicar}
                        disabled={working || sinCambios}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-stone-900 text-white dark:bg-primary dark:text-primary-foreground text-[10px] font-black uppercase tracking-widest shadow-lg disabled:opacity-40 hover:opacity-90 transition-opacity"
                    >
                        <Wallet className="w-3.5 h-3.5" />
                        {working ? 'Aplicando…'
                            : caja > 0 && cliente > 0 ? `${fmt(caja)} de ${nombreCaja(cajaVendorId)} · ${fmt(cliente)} al cliente`
                            : cliente > 0 ? `Cobrarle ${fmt(cliente)} al cliente`
                            : `Descontar ${fmt(caja)} de ${nombreCaja(cajaVendorId)}`}
                    </button>
                    {hayReparto && (
                        <button onClick={deshacer} disabled={working} className="text-[9px] font-black uppercase tracking-widest text-stone-500 underline disabled:opacity-40">
                            Deshacer el reparto
                        </button>
                    )}
                    {error && <p className="text-[10px] font-bold text-rose-600">{error}</p>}
                </div>
            ) : (
                !hayReparto && (
                    <p className="text-[10px] text-stone-500 dark:text-stone-400 leading-relaxed">
                        El costo ya está cerrado por el laboratorio. Lo revisa y lo reparte el administrador.
                    </p>
                )
            ))}
        </div>
    );
}

function CaseCard({ c, isAdmin, userRole, highlighted, onRefresh }: {
    c: PostSaleCase; isAdmin: boolean; userRole?: string; highlighted?: boolean; onRefresh: () => void;
}) {
    // La tarjeta arranca colapsada (resumen). Se abre la ficha completa con un
    // click en el encabezado — o sola, si vino resaltada desde el link del email.
    const [open, setOpen] = useState(!!highlighted);
    const stage = costStage(c);
    const notesCount = c.notesList?.length || 0;
    const ultimaObservacion = c.notesList?.[c.notesList.length - 1];

    return (
        <div className={`space-y-3 ${highlighted ? 'rounded-[1.75rem] ring-2 ring-amber-400/70 dark:ring-amber-500/50 p-3 -m-1' : ''}`}>
            <CaseContext c={c} />

            <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900/60 overflow-hidden">
                {/* ── RESUMEN (siempre visible) ───────────────────────────────────
                    El toggle es un <button> propio y NO envuelve a los números de
                    operación: esos son botones de copiar, y un botón dentro de otro
                    botón es HTML inválido. */}
                <div className="p-4 space-y-2.5">
                    <button
                        onClick={() => setOpen(o => !o)}
                        className="w-full text-left group"
                        aria-expanded={open}
                    >
                        <div className="flex flex-wrap items-center gap-2">
                            <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-md border ${caseTypeStyle(c.caseType)}`}>
                                {c.caseType || 'Sin tipificar'}
                            </span>
                            <span className="text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-md border border-stone-300 dark:border-stone-600 text-stone-700 dark:text-stone-300">
                                {postSaleColumnLabel(c)}
                            </span>
                            {stage !== 'SIN_COSTO' && (
                                <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-md border ${COST_STAGE_UI[stage].cls}`}>
                                    {stage === 'REPARTIDO' ? repartoCorto(c) : stage === 'CERRADO' ? 'Listo para repartir' : 'Estimado'}
                                    {(c.cost ?? 0) > 0 ? ` · $${Math.round(c.cost!).toLocaleString('es-AR')}` : ''}
                                </span>
                            )}
                            {c.responsible && (
                                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-md border border-stone-300 dark:border-stone-600 text-stone-700 dark:text-stone-300">
                                    👤 {c.responsible}
                                </span>
                            )}
                            {c.createdAt && (
                                <span className="ml-auto text-[10px] font-bold text-stone-600 dark:text-stone-400">{formatDateTime(c.createdAt)}</span>
                            )}
                            <ChevronDown className={`w-4 h-4 text-stone-600 dark:text-stone-400 transition-transform ${open ? 'rotate-180' : ''}`} />
                        </div>

                        {/* Cerrada, la tarjeta tiene que decir en qué anda el caso. Antes
                            decía "4 observaciones · Doctor": el conteo no es la noticia,
                            la última observación sí. */}
                        {!open && (
                            <div className="mt-2">
                                {ultimaObservacion ? (
                                    <p className="text-[13px] text-stone-700 dark:text-stone-300 leading-relaxed line-clamp-2">
                                        {ultimaObservacion.content}
                                    </p>
                                ) : (
                                    <p className="text-[13px] text-stone-600 dark:text-stone-400 italic">Sin observaciones registradas.</p>
                                )}
                                <p className="mt-1 text-[11px] font-bold text-stone-600 dark:text-stone-400 group-hover:text-stone-900 dark:group-hover:text-stone-200 transition-colors">
                                    {notesCount > 0 && `${notesCount} observación${notesCount === 1 ? '' : 'es'} · `}
                                    Abrir la ficha del caso
                                </p>
                            </div>
                        )}
                    </button>

                    {/* El nº de operación queda SIEMPRE afuera del desplegable, y se carga acá mismo */}
                    <PostSaleOperationNumber
                        orderId={c.order?.id ?? c.orderId}
                        value={c.newOrderNumber}
                        history={c.newOrderNumberHistory}
                        onSaved={onRefresh}
                    />
                </div>

                {/* ── FICHA COMPLETA (desplegable) ────────────────────────────── */}
                {open && (
                    <div className="px-4 pb-4 space-y-3 border-t border-stone-100 dark:border-stone-800 pt-3 animate-in fade-in duration-200">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <Field label="Resolución" value={resolucionLabel(c)} />
                        </div>

                        <CashPanel c={c} isAdmin={isAdmin} onRefresh={onRefresh} />

                        {/* La tarjeta completa del caso: es LA MISMA que en ventas y en
                            el cotizador. Solo se puede editar mientras la venta exista;
                            si la borraron, el caso queda como registro histórico. */}
                        {c.order ? (
                            <PostSaleServiceForm
                                value={postSaleValueFromCase(c)}
                                onRefresh={onRefresh}
                                userRole={userRole}
                                variant="plain"
                            />
                        ) : (
                            <>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                    <Field label="Responsable" value={c.responsible} />
                                    <CoverageField coverage={c.coverage} />
                                    <Field label="Costo" value={c.cost != null && c.cost > 0 ? `$${c.cost.toLocaleString('es-AR')}` : null} />
                                </div>
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
                                <p className="text-[9px] font-bold text-stone-400 italic pt-1">
                                    La venta original fue eliminada: el caso queda como registro histórico (solo lectura).
                                </p>
                            </>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

/** Form para abrir un caso de post venta nuevo sobre una venta del cliente. */
function NewCaseForm({ sales, isAdmin, onCancel, onSaved }: { sales: any[]; isAdmin: boolean; onCancel: () => void; onSaved: () => void }) {
    const [orderId, setOrderId] = useState<string>(sales[0]?.id || '');
    const [caseType, setCaseType] = useState<string>('');
    const [coverage, setCoverage] = useState<string>('');
    const [cost, setCost] = useState<string>('');
    const [responsibleOption, setResponsibleOption] = useState<string>('');
    const [users, setUsers] = useState<PostSaleUser[]>([]);
    const [notes, setNotes] = useState<string>('');
    const [file, setFile] = useState<File | null>(null);
    const [saving, setSaving] = useState(false);

    // Mismo criterio que la tarjeta: el equipo sale de los usuarios del sistema.
    useEffect(() => {
        fetch('/api/users')
            .then(r => (r.ok ? r.json() : []))
            .then((d: any[]) => { if (Array.isArray(d)) setUsers(d.filter(u => u.role !== 'OPTICA').map(u => ({ id: u.id, name: u.name, role: u.role }))); })
            .catch(() => setUsers([]));
    }, []);

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
            const seleccion = parseResponsibleOption(responsibleOption, users);

            const res = await fetch(`/api/orders/${orderId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    postSaleCaseType: caseType,
                    postSaleFault: seleccion.fault,
                    postSaleFaultUserId: seleccion.faultUserId,
                    postSaleCoverage: coverage || null,
                    // El costo lo carga solo la administración.
                    ...(isAdmin ? { postSaleCost: Number.isFinite(costNum) ? costNum : 0 } : {}),
                    postSaleResponsible: seleccion.responsible,
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
                    <Label>Responsable · de quién fue</Label>
                    <select value={responsibleOption} onChange={(e) => setResponsibleOption(e.target.value)} className={selectCls}>
                        <option value="">—</option>
                        <optgroup label="Equipo">
                            {users.map((u) => <option key={u.id} value={responsibleUserValue(u.id)}>{u.name}</option>)}
                        </optgroup>
                        <optgroup label="Otras causas">
                            {POST_SALE_RESPONSIBLE_CAUSES.map((c) => <option key={c} value={c}>{c}</option>)}
                        </optgroup>
                    </select>
                </div>
                <div>
                    <Label>Cobertura</Label>
                    <select value={coverage} onChange={(e) => setCoverage(e.target.value)} className={selectCls}>
                        <option value="">—</option>
                        {POST_SALE_COVERAGE.map((cv) => <option key={cv} value={cv}>{cv}</option>)}
                    </select>
                </div>
                {/* El costo lo carga solo la administración: aun cuando el error es
                    del laboratorio, muchas veces algo nos terminan cobrando. */}
                {isAdmin && (
                    <div className="sm:col-span-2">
                        <Label>Costo</Label>
                        <input type="number" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="0" className={selectCls} />
                    </div>
                )}
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
