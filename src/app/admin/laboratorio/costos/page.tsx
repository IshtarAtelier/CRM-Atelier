'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
    ArrowLeft, Loader2, RefreshCw, Mail, Upload, X, FlaskConical,
    AlertTriangle, CheckCircle2, HelpCircle, TrendingDown, CalendarDays, Download, History, Search,
    ChevronDown, ChevronUp
} from 'lucide-react';
import { syncUrlParams, getUrlParam } from '@/lib/url-filters';

interface LabCostEntry {
    id: string;
    lab: string;
    labOrderNumber: string;
    systemCost: number | null;
    billedNet: number | null;
    billedTotal: number | null;
    difference: number | null;
    source: string;
    sourceFile: string | null;
    invoiceDate: string | null;
    status: string;
    notes: string | null;
    createdAt: string;
    alertedAt: string | null;
    alertedStatus: string | null;
    order: {
        id: string;
        clientId: string;
        createdAt: string;
        labStatus: string | null;
        client: { name: string } | null;
    } | null;
    productos?: { productId: string | null; nombre: string; marca: string; costo: number | null }[];
}

// Estado del pedido en el laboratorio, visto desde la conciliación. Para
// Optovision, la factura llega ~5 días hábiles ANTES de que el pedido esté
// terminado: "facturado" = en camino, con fecha estimada de listo.
const ORDER_LAB_LABELS: Record<string, { label: string; cls: string }> = {
    NONE: { label: 'Sin enviar', cls: 'bg-gray-100 text-gray-500' },
    SENT: { label: 'En laboratorio', cls: 'bg-amber-100 text-amber-700' },
    IN_PROGRESS: { label: 'Procesado', cls: 'bg-blue-100 text-blue-700' },
    FINISHED: { label: 'Terminado', cls: 'bg-emerald-100 text-emerald-700' },
    READY: { label: 'Listo p/ retirar', cls: 'bg-emerald-100 text-emerald-700' },
    DELIVERED: { label: 'Entregado', cls: 'bg-indigo-100 text-indigo-700' },
};

// Suma N días hábiles (lun-vie) a una fecha.
function addBusinessDays(from: Date, days: number): Date {
    const d = new Date(from);
    let left = days;
    while (left > 0) {
        d.setDate(d.getDate() + 1);
        const dow = d.getDay();
        if (dow !== 0 && dow !== 6) left--;
    }
    return d;
}

interface StatusTotal {
    status: string;
    _count: { _all: number };
    _sum: { difference: number | null };
}

// Una fila POR PEDIDO. En un 2x1 la venta aporta varias filas seguidas: la
// primera trae el costo de la venta y el veredicto, las siguientes solo su
// propia factura (sumarlas escondía los casos donde falta una).
interface ReportRow {
    orderId: string;
    clientId: string;
    cliente: string;
    fecha: string;
    labOrderNumber: string | null;
    lab: string;
    items: string[];
    // De ESTE pedido
    pedido: string | null;
    billed: number | null;
    pedidoFacturado: boolean;
    // De la VENTA (solo con valor en la primera fila del grupo)
    primeraDeLaVenta: boolean;
    multiPedido: boolean;
    ventaPedidos: string[];
    ventaCompleta: boolean;
    systemCost: number | null;
    saleBilled: number | null;
    difference: number | null;
    invoicesFound: number;
    status: string;
    daysWaiting: number | null;
}

// Gemelo de una factura de la cuenta corriente en nuestro sistema: la venta o
// el caso de postventa que la respalda (regla: TODA operación debe tener uno).
interface StatementGemelo {
    pedido: string;
    tipo: 'VENTA' | 'POSTVENTA' | 'SIN_VENTA';
    cliente: string | null;
    ventaPedidos: string | null;
}

interface AccountStatement {
    id: string;
    lab: string;
    statementDate: string;
    totalDebt: number;
    invoiceCount: number;
    rows: Array<{ invoiceNumber: string; fecha: string | null; importe: number; saldo: number; enSistema?: boolean; gemelo?: StatementGemelo | null }>;
    conVenta?: number;
    conPostventa?: number;
    sinGemelo?: number;
    createdAt: string;
}

// Cobertura de un lab: cuántos de sus pedidos registrados tienen gemelo.
interface LabCobertura {
    total: number;
    conVenta: number;
    postventa: number;
    sinVenta: number;
    esperandoFactura: number;
}

interface AuditRun {
    id: string;
    runAt: string;
    trigger: string;
    staleSources: string[];
    totalEntries: number;
    conVenta: number;
    postventa: number;
    sinVenta: number;
    esperandoFact: number;
    ok: number;
    overcost: number;
    undercost: number;
    nuevosSinVenta: number;
}

interface MonthlyReport {
    month: string;
    rows: ReportRow[];
    totals: {
        operaciones: number;
        costoSistema: number;
        costoReal: number;
        conFactura: number;
        sinFactura: number;
        parciales?: number;
        sinNumero: number;
        sobrecostos: number;
    };
}

const REPORT_STATUS_META: Record<string, { label: string; badge: string }> = {
    ...{
        OVERCOST: { label: 'Sobrecosto', badge: 'bg-red-100 text-red-700' },
        UNDERCOST: { label: 'Menor costo', badge: 'bg-emerald-100 text-emerald-700' },
        OK: { label: 'OK', badge: 'bg-green-100 text-green-700' },
    },
    SIN_FACTURA: { label: 'Sin factura', badge: 'bg-gray-100 text-gray-600' },
    PARCIAL: { label: 'Falta una factura del 2x1', badge: 'bg-blue-100 text-blue-700' },
    SIN_NUMERO: { label: 'Sin nº pedido', badge: 'bg-orange-100 text-orange-700' },
};

// Mes anterior al actual en formato AAAA-MM (para el valor inicial del selector)
const previousMonth = () => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const LAB_LABELS: Record<string, string> = {
    OPTOVISION: 'Optovision',
    GRUPO_OPTICO: 'Grupo Óptico',
};

const STATUS_META: Record<string, { label: string; badge: string }> = {
    OVERCOST: { label: 'Sobrecosto', badge: 'bg-red-100 text-red-700' },
    UNDERCOST: { label: 'Menor costo', badge: 'bg-emerald-100 text-emerald-700' },
    OK: { label: 'OK', badge: 'bg-green-100 text-green-700' },
    UNMATCHED: { label: 'Sin venta', badge: 'bg-amber-100 text-amber-700' },
    PENDING: { label: 'Esperando factura', badge: 'bg-blue-100 text-blue-700' },
};

const SOURCE_LABELS: Record<string, string> = {
    IMAP_PDF: 'Factura PDF (email)',
    CSV: 'Planilla',
    SCRAPER: 'Portal lab',
    MANUAL: 'Manual',
};

const fmt = (val: number | null | undefined) =>
    val === null || val === undefined
        ? '—'
        : new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(val);

// Para fechas con hora (ventas): formatear en hora argentina.
const fmtDateAR = (iso: string) =>
    new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Argentina/Buenos_Aires' }).format(new Date(iso));

const fmtDate = (iso: string | null) => {
    if (!iso) return '—';
    // Las fechas de factura son date-only (medianoche UTC): formatear en UTC
    // para no mostrar el día anterior en Argentina.
    const d = new Date(iso);
    return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`;
};

export default function LabCostosPage() {
    const searchParams = useSearchParams();
    const [entries, setEntries] = useState<LabCostEntry[]>([]);
    const [totals, setTotals] = useState<StatusTotal[]>([]);
    const [auditRuns, setAuditRuns] = useState<AuditRun[]>([]);
    const [statements, setStatements] = useState<AccountStatement[]>([]);
    const [cobertura, setCobertura] = useState<Record<string, LabCobertura>>({});
    const [openStatement, setOpenStatement] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [labFilter, setLabFilter] = useState(() => getUrlParam(searchParams, 'lab', ''));
    const [statusFilter, setStatusFilter] = useState(() => getUrlParam(searchParams, 'estado', ''));
    const [busy, setBusy] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);

    // Modal de importación de planilla
    const [showImport, setShowImport] = useState(false);
    const [importLab, setImportLab] = useState('GRUPO_OPTICO');
    const [importText, setImportText] = useState('');

    // Reporte mensual
    const [reportMonth, setReportMonth] = useState(() => getUrlParam(searchParams, 'mes', previousMonth()));
    const [report, setReport] = useState<MonthlyReport | null>(null);
    const [reportLoading, setReportLoading] = useState(false);
    // Filtros del reporte: búsqueda por cliente / nº de operación y día puntual
    const [reportSearch, setReportSearch] = useState(() => getUrlParam(searchParams, 'q', ''));
    const [reportDay, setReportDay] = useState(() => getUrlParam(searchParams, 'dia', ''));

    // Números de operación de la venta, POR SEPARADO (regla del administrador):
    // una venta 2x1 lleva varios ("580841-580844") y cada uno se muestra como
    // chip propio; el resaltado es el pedido de ESTA factura. En postventa, el
    // pedido del caso va resaltado y los de la venta original en gris.
    const opChips = (g: StatementGemelo) => {
        const nums = g.ventaPedidos?.match(/\d{4,}/g) || [];
        const todos = nums.length ? nums : [g.pedido];
        const chip = (n: string, actual: boolean) => (
            <span
                key={n}
                className={`ml-1 px-1 py-0.5 rounded font-mono text-[11px] ${actual
                    ? 'bg-indigo-100 text-indigo-800 font-semibold'
                    : 'bg-gray-100 text-gray-500'}`}
                title={actual ? 'Pedido de esta factura' : 'Otro pedido de la misma venta'}
            >{n}</span>
        );
        return (
            <>
                {todos.map(n => chip(n, n === g.pedido))}
                {!todos.includes(g.pedido) && chip(g.pedido, true)}
            </>
        );
    };

    const fetchEntries = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (labFilter) params.set('lab', labFilter);
            if (statusFilter) params.set('status', statusFilter);
            const res = await fetch(`/api/lab-costs?${params.toString()}`);
            if (res.ok) {
                const data = await res.json();
                setEntries(data.entries || []);
                setTotals(data.totals || []);
                setAuditRuns(data.auditRuns || []);
                setStatements(data.statements || []);
                setCobertura(data.cobertura || {});
            }
        } catch (e) {
            console.error('Error cargando conciliación', e);
        } finally {
            setLoading(false);
        }
    }, [labFilter, statusFilter]);

    useEffect(() => { fetchEntries(); }, [fetchEntries]);

    const runAction = async (action: string, label: string) => {
        setBusy(action);
        setMessage(null);
        try {
            const res = await fetch('/api/lab-costs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Error');
            setMessage(`${label}: ${JSON.stringify(data)}`);
            await fetchEntries();
        } catch (e: any) {
            setMessage(`Error en ${label.toLowerCase()}: ${e.message}`);
        } finally {
            setBusy(null);
        }
    };

    const handleImport = async () => {
        // Formato por línea: numeroPedido ; importe [; fecha dd/mm/aaaa]
        // Acepta separadores ; , o tab. Ignora líneas sin número+importe.
        const rows = importText
            .split('\n')
            .map(line => line.trim())
            .filter(Boolean)
            .map(line => {
                const parts = line.split(/[;,\t]+/).map(p => p.trim());
                const [num, imp, fecha] = parts;
                const billed = parseFloat((imp || '').replace(/\$|\./g, '').replace(',', '.'));
                let invoiceDate: string | undefined;
                const m = (fecha || '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
                if (m) invoiceDate = `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
                return { lab: importLab, labOrderNumber: num, billed, invoiceDate };
            })
            .filter(r => r.labOrderNumber && Number.isFinite(r.billed) && r.billed > 0);

        if (rows.length === 0) {
            setMessage('No se reconoció ninguna fila válida (formato: pedido ; importe ; fecha).');
            return;
        }

        setBusy('import');
        try {
            const res = await fetch('/api/lab-costs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rows }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Error');
            setMessage(`Importadas ${data.imported} filas (${data.overcost} sobrecostos, ${data.unmatched} sin match, ${data.skipped} salteadas).`);
            setShowImport(false);
            setImportText('');
            await fetchEntries();
        } catch (e: any) {
            setMessage(`Error importando: ${e.message}`);
        } finally {
            setBusy(null);
        }
    };

    const fetchReport = useCallback(async () => {
        setReportLoading(true);
        try {
            const q = reportSearch.trim();
            // Con búsqueda o día → todo el histórico; sin filtros → el mes elegido.
            const url = (q || reportDay)
                ? `/api/lab-costs/report?${new URLSearchParams({ ...(q && { search: q }), ...(reportDay && { day: reportDay }) }).toString()}`
                : `/api/lab-costs/report?month=${reportMonth}`;
            const res = await fetch(url);
            if (res.ok) setReport(await res.json());
        } catch (e) {
            console.error('Error cargando reporte', e);
        } finally {
            setReportLoading(false);
        }
    }, [reportMonth, reportSearch, reportDay]);

    // Debounce solo cuando se está tipeando la búsqueda (evita un fetch por tecla).
    useEffect(() => {
        const t = setTimeout(fetchReport, reportSearch.trim() ? 350 : 0);
        return () => clearTimeout(t);
    }, [fetchReport, reportSearch]);

    // Cualquier combinación de filtros queda reflejada en la URL (link compartible).
    useEffect(() => {
        syncUrlParams('/admin/laboratorio/costos', {
            lab: labFilter,
            estado: statusFilter,
            mes: reportMonth !== previousMonth() ? reportMonth : undefined,
            q: reportSearch.trim() || undefined,
            dia: reportDay || undefined,
        });
    }, [labFilter, statusFilter, reportMonth, reportSearch, reportDay]);

    // El filtrado lo hace el servidor (mes o histórico); acá solo mostramos lo que vino.
    const reportFiltered = Boolean(reportSearch.trim() || reportDay);
    const rows = report?.rows || [];

    const downloadReportCsv = () => {
        if (!report) return;
        const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
        const lines = [
            'nro_operacion;cliente;fecha;laboratorio;costo_sistema_venta;costo_real_pedido;diferencia_venta;estado;dias_sin_factura;operaciones_de_la_venta;items',
            ...rows.map(r => [
                esc(r.pedido || 'SIN NÚMERO'),
                esc(r.primeraDeLaVenta ? r.cliente : `↳ ${r.cliente}`),
                r.primeraDeLaVenta ? fmtDateAR(r.fecha) : '',
                r.primeraDeLaVenta ? (LAB_LABELS[r.lab] || r.lab) : '',
                r.systemCost ?? '',
                r.pedidoFacturado ? r.billed : 'SIN FACTURA',
                r.primeraDeLaVenta ? (r.difference ?? '') : '',
                r.primeraDeLaVenta ? (REPORT_STATUS_META[r.status]?.label || r.status) : '',
                r.primeraDeLaVenta ? (r.daysWaiting ?? '') : '',
                r.multiPedido ? esc(r.ventaPedidos.join(' + ')) : '',
                r.primeraDeLaVenta ? esc(r.items.join(' | ')) : '',
            ].join(';')),
        ];
        // BOM para que Excel abra el CSV con acentos bien.
        const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `costos-laboratorio-${report.month}.csv`;
        a.click();
        URL.revokeObjectURL(a.href);
    };

    const countFor = (status: string) => totals.find(t => t.status === status)?._count._all || 0;
    const overcostSum = totals.find(t => t.status === 'OVERCOST')?._sum.difference || 0;

    return (
        <div className="p-4 lg:p-8 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex flex-wrap items-center gap-3 mb-6">
                <Link href="/admin" className="p-2 rounded-lg hover:bg-gray-100 text-gray-500">
                    <ArrowLeft size={20} />
                </Link>
                <FlaskConical className="text-indigo-600" size={26} />
                <div>
                    <h1 className="text-xl lg:text-2xl font-bold text-gray-900">Costos de laboratorio</h1>
                    <p className="text-sm text-gray-500">Cruce por nº de pedido: costo de lista del sistema vs. lo que facturó el lab</p>
                </div>
            </div>

            {/* Cuenta corriente por lab: cada factura del resumen con su GEMELO en
                el sistema (venta o postventa que la respalda). Para el lab sin
                resumen (Grupo Óptico) la cobertura sale del barrido del portal,
                que trae TODOS los pedidos. */}
            {(statements.length > 0 || Object.keys(cobertura).length > 0) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
                    {statements.map(s => {
                        const conVenta = s.conVenta ?? (s.rows || []).filter(r => r.gemelo?.tipo === 'VENTA').length;
                        const conPostventa = s.conPostventa ?? (s.rows || []).filter(r => r.gemelo?.tipo === 'POSTVENTA').length;
                        const sinGemelo = s.sinGemelo ?? ((s.rows || []).length - conVenta - conPostventa);
                        const abierto = openStatement === s.id;
                        return (
                            <div key={s.id} className={`bg-white rounded-xl border border-indigo-200 p-4 ${abierto ? 'sm:col-span-2' : ''}`}>
                                <div className="flex items-center gap-2 text-indigo-700 text-sm font-medium">
                                    <FlaskConical size={16} /> Cuenta corriente {LAB_LABELS[s.lab] || s.lab}
                                    <button
                                        onClick={() => setOpenStatement(abierto ? null : s.id)}
                                        className="ml-auto flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-indigo-600 hover:bg-indigo-50"
                                    >
                                        {abierto ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                        {abierto ? 'Cerrar' : 'Cuadro completo'}
                                    </button>
                                </div>
                                <div className="text-2xl font-bold text-gray-900 mt-1">{fmt(s.totalDebt)}</div>
                                <div className="text-xs text-gray-400">
                                    deuda al {fmtDate(s.statementDate)} · {s.invoiceCount} facturas
                                </div>
                                <div className="text-xs mt-1">
                                    <span className="text-green-700">{conVenta} con venta</span>
                                    <span className="text-gray-400"> · </span>
                                    <span className="text-purple-700">{conPostventa} postventa</span>
                                    <span className="text-gray-400"> · </span>
                                    {sinGemelo > 0
                                        ? <span className="text-red-600 font-semibold">{sinGemelo} SIN gemelo en el sistema</span>
                                        : <span className="text-green-700 font-medium">todo cubierto ✓</span>}
                                </div>
                                {abierto && (
                                    <div className="mt-3 overflow-x-auto max-h-96 overflow-y-auto border-t border-gray-100 pt-2">
                                        <table className="w-full text-xs">
                                            <thead>
                                                <tr className="text-left text-gray-400">
                                                    <th className="py-1 pr-3 font-medium">Factura</th>
                                                    <th className="py-1 pr-3 font-medium">Fecha</th>
                                                    <th className="py-1 pr-3 font-medium text-right">Saldo</th>
                                                    <th className="py-1 font-medium">Gemelo en el sistema</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {(s.rows || []).map(r => (
                                                    <tr key={r.invoiceNumber} className="border-t border-gray-50">
                                                        <td className="py-1.5 pr-3 font-mono text-gray-700">{r.invoiceNumber}</td>
                                                        <td className="py-1.5 pr-3 text-gray-500">{r.fecha || '—'}</td>
                                                        <td className="py-1.5 pr-3 text-right text-gray-700">{fmt(r.saldo)}</td>
                                                        <td className="py-1.5">
                                                            {r.gemelo?.tipo === 'VENTA' && (
                                                                <span>
                                                                    <span className="px-1.5 py-0.5 rounded bg-green-100 text-green-700 font-medium">Venta</span>
                                                                    <span className="text-gray-600"> {r.gemelo.cliente || ''}</span>
                                                                    <span className="text-gray-400"> ·</span>
                                                                    {opChips(r.gemelo)}
                                                                </span>
                                                            )}
                                                            {r.gemelo?.tipo === 'POSTVENTA' && (
                                                                <span>
                                                                    <span className="px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 font-medium">Postventa</span>
                                                                    <span className="text-gray-600"> {r.gemelo.cliente || ''}</span>
                                                                    <span className="text-gray-400"> ·</span>
                                                                    {opChips(r.gemelo)}
                                                                </span>
                                                            )}
                                                            {r.gemelo?.tipo === 'SIN_VENTA' && (
                                                                <span>
                                                                    <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-medium">Factura sin venta</span>
                                                                    <span className="text-gray-400"> pedido {r.gemelo.pedido}</span>
                                                                </span>
                                                            )}
                                                            {!r.gemelo && (
                                                                <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-700 font-semibold">Sin gemelo — factura nunca ingresada</span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                    {Object.entries(cobertura)
                        .filter(([labName]) => !statements.some(s => s.lab === labName))
                        .map(([labName, c]) => (
                            <div key={labName} className="bg-white rounded-xl border border-indigo-200 p-4">
                                <div className="flex items-center gap-2 text-indigo-700 text-sm font-medium">
                                    <FlaskConical size={16} /> Cobertura {LAB_LABELS[labName] || labName} (portal)
                                </div>
                                <div className="text-2xl font-bold text-gray-900 mt-1">{c.total} pedidos</div>
                                <div className="text-xs text-gray-400">el barrido del portal trae todos los pedidos: esta es su cuenta corriente</div>
                                <div className="text-xs mt-1">
                                    <span className="text-green-700">{c.conVenta} con venta</span>
                                    <span className="text-gray-400"> · </span>
                                    <span className="text-purple-700">{c.postventa} postventa</span>
                                    <span className="text-gray-400"> · </span>
                                    {c.sinVenta > 0
                                        ? <span className="text-red-600 font-semibold">{c.sinVenta} SIN venta en el sistema</span>
                                        : <span className="text-green-700 font-medium">todo cubierto ✓</span>}
                                    {c.esperandoFactura > 0 && <span className="text-blue-600"> · {c.esperandoFactura} esperando factura</span>}
                                </div>
                            </div>
                        ))}
                </div>
            )}

            {/* Resumen */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
                <div className="bg-white rounded-xl border border-red-200 p-4">
                    <div className="flex items-center gap-2 text-red-600 text-sm font-medium"><AlertTriangle size={16} /> Sobrecostos</div>
                    <div className="text-2xl font-bold text-gray-900 mt-1">{countFor('OVERCOST')}</div>
                    <div className="text-xs text-red-600 font-medium">{fmt(overcostSum)} de más</div>
                </div>
                <div className="bg-white rounded-xl border border-green-200 p-4">
                    <div className="flex items-center gap-2 text-green-600 text-sm font-medium"><CheckCircle2 size={16} /> OK</div>
                    <div className="text-2xl font-bold text-gray-900 mt-1">{countFor('OK')}</div>
                    <div className="text-xs text-gray-400">dentro de tolerancia</div>
                </div>
                <div className="bg-white rounded-xl border border-emerald-200 p-4">
                    <div className="flex items-center gap-2 text-emerald-600 text-sm font-medium"><TrendingDown size={16} /> Menor costo</div>
                    <div className="text-2xl font-bold text-gray-900 mt-1">{countFor('UNDERCOST')}</div>
                    <div className="text-xs text-gray-400">el lab cobró menos</div>
                </div>
                <div className="bg-white rounded-xl border border-amber-200 p-4">
                    <div className="flex items-center gap-2 text-amber-600 text-sm font-medium"><HelpCircle size={16} /> Sin venta</div>
                    <div className="text-2xl font-bold text-gray-900 mt-1">{countFor('UNMATCHED')}</div>
                    <div className="text-xs text-gray-400">pedidos/facturas sin venta en el sistema</div>
                </div>
            </div>

            {/* Reporte mensual */}
            <div className="bg-white rounded-xl border border-gray-200 mb-6">
                <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-b border-gray-100">
                    <CalendarDays size={18} className="text-indigo-600" />
                    <h2 className="font-semibold text-gray-900">Reporte mensual</h2>
                    <input
                        type="month"
                        value={reportMonth}
                        onChange={e => e.target.value && setReportMonth(e.target.value)}
                        disabled={reportFiltered}
                        title={reportFiltered ? 'Con búsqueda activa se muestra todo el histórico; limpiá los filtros para volver al mes' : undefined}
                        className="px-3 py-1.5 rounded-lg border border-gray-300 text-sm bg-white disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                    <div className="relative">
                        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                        <input
                            type="search"
                            value={reportSearch}
                            onChange={e => setReportSearch(e.target.value)}
                            placeholder="Cliente o nº de operación…"
                            className="pl-8 pr-3 py-1.5 rounded-lg border border-gray-300 text-sm bg-white w-56"
                        />
                    </div>
                    <input
                        type="date"
                        value={reportDay}
                        onChange={e => setReportDay(e.target.value)}
                        title="Filtrar por día"
                        className="px-3 py-1.5 rounded-lg border border-gray-300 text-sm bg-white"
                    />
                    {reportFiltered && (
                        <button
                            onClick={() => { setReportSearch(''); setReportDay(''); }}
                            className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-sm text-gray-500 hover:bg-gray-100"
                            title="Limpiar filtros"
                        >
                            <X size={14} /> Limpiar
                        </button>
                    )}
                    {report && rows.length > 0 && (
                        <button
                            onClick={downloadReportCsv}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50"
                        >
                            <Download size={14} /> CSV
                        </button>
                    )}
                    <div className="flex-1" />
                    {report && (
                        <div className="text-sm text-gray-500">
                            {reportFiltered && <span className="text-indigo-600 font-medium">todo el histórico · </span>}
                            {report.totals.operaciones} ventas ({rows.length} operaciones de lab) · sistema <strong className="text-gray-900">{fmt(report.totals.costoSistema)}</strong>
                            {report.totals.conFactura > 0 && <> · real <strong className="text-gray-900">{fmt(report.totals.costoReal)}</strong> ({report.totals.conFactura} con factura)</>}
                            {report.totals.sinFactura > 0 && <> · {report.totals.sinFactura} sin factura</>}
                            {(report.totals.parciales ?? 0) > 0 && <span className="text-blue-600"> · {report.totals.parciales} con una factura pendiente del 2x1</span>}
                            {report.totals.sinNumero > 0 && <span className="text-orange-600"> · {report.totals.sinNumero} sin nº</span>}
                        </div>
                    )}
                </div>
                <div className="overflow-x-auto">
                    {reportLoading ? (
                        <div className="flex items-center justify-center py-10 text-gray-400">
                            <Loader2 className="animate-spin mr-2" size={18} /> Generando reporte…
                        </div>
                    ) : !report || rows.length === 0 ? (
                        <div className="text-center py-10 text-gray-400 text-sm">
                            {reportFiltered
                                ? 'Ninguna operación de laboratorio coincide con la búsqueda en todo el histórico.'
                                : 'Sin operaciones de laboratorio en este mes.'}
                        </div>
                    ) : (
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-left text-xs text-gray-500 uppercase border-b border-gray-200">
                                    <th className="px-4 py-2.5">Nº operación</th>
                                    <th className="px-4 py-2.5">Cliente</th>
                                    <th className="px-4 py-2.5">Fecha</th>
                                    <th className="px-4 py-2.5">Lab</th>
                                    <th className="px-4 py-2.5 text-right">Costo sistema</th>
                                    <th className="px-4 py-2.5 text-right">Costo real</th>
                                    <th className="px-4 py-2.5 text-right">Diferencia</th>
                                    <th className="px-4 py-2.5">Estado</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((r, idx) => {
                                    const meta = REPORT_STATUS_META[r.status] || { label: r.status, badge: 'bg-gray-100 text-gray-600' };
                                    // Sin factura hace más de 30 días: ya debería estar facturada — resaltar.
                                    const overdue = (r.status === 'SIN_FACTURA' || r.status === 'PARCIAL') && (r.daysWaiting ?? 0) > 30;
                                    // Las filas de una misma venta (2x1) van pegadas: la primera abre el
                                    // grupo con el costo de la venta, las siguientes solo su propio pedido.
                                    const ultimaDelGrupo = !rows[idx + 1] || rows[idx + 1].primeraDeLaVenta;
                                    return (
                                        <tr
                                            key={`${r.orderId}-${r.pedido ?? 'sn'}`}
                                            className={`hover:bg-gray-50 ${ultimaDelGrupo ? 'border-b border-gray-200' : ''} ${
                                                r.multiPedido ? (r.primeraDeLaVenta ? 'bg-indigo-50/40' : 'bg-indigo-50/20') : ''}`}
                                        >
                                            <td className="px-4 py-2.5 font-mono text-gray-900" title={r.items.join(' | ')}>
                                                {r.multiPedido && !r.primeraDeLaVenta && <span className="text-gray-300 mr-1">↳</span>}
                                                {r.pedido || <span className="text-orange-600 font-sans">sin número</span>}
                                                {r.multiPedido && r.primeraDeLaVenta && (
                                                    <span className="ml-2 text-[10px] font-sans font-semibold text-indigo-600 bg-indigo-100 px-1.5 py-0.5 rounded">
                                                        2x1 · {r.ventaPedidos.length} operaciones
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-4 py-2.5">
                                                {r.primeraDeLaVenta
                                                    ? <Link href={`/admin/contactos?clientId=${r.clientId}`} className="text-indigo-600 hover:underline">{r.cliente}</Link>
                                                    : <span className="text-gray-300">↳ misma venta</span>}
                                            </td>
                                            <td className="px-4 py-2.5 text-gray-600">{r.primeraDeLaVenta ? fmtDateAR(r.fecha) : ''}</td>
                                            <td className="px-4 py-2.5 text-gray-600">{r.primeraDeLaVenta ? (LAB_LABELS[r.lab] || r.lab) : ''}</td>
                                            <td className="px-4 py-2.5 text-right text-gray-900">
                                                {r.primeraDeLaVenta ? fmt(r.systemCost) : <span className="text-gray-300">—</span>}
                                                {r.multiPedido && r.primeraDeLaVenta && (
                                                    <span className="block text-[10px] text-gray-400 font-normal">de la venta</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-2.5 text-right text-gray-900">
                                                {r.pedidoFacturado
                                                    ? fmt(r.billed)
                                                    : <span className="text-orange-500 text-xs">sin factura</span>}
                                            </td>
                                            <td className={`px-4 py-2.5 text-right font-semibold ${
                                                r.difference === null ? 'text-gray-400'
                                                    : r.difference > 100 ? 'text-red-600'
                                                        : r.difference < -100 ? 'text-emerald-600' : 'text-gray-500'
                                            }`}>
                                                {!r.primeraDeLaVenta ? '' : r.difference === null
                                                    ? <span className="text-gray-400" title="La diferencia se calcula recién cuando llegaron TODAS las facturas de la venta">—</span>
                                                    : (r.difference > 0 ? '+' : '') + fmt(r.difference)}
                                            </td>
                                            <td className="px-4 py-2.5 whitespace-nowrap">
                                                {r.primeraDeLaVenta && (
                                                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${overdue ? 'bg-red-100 text-red-700' : meta.badge}`}>
                                                        {meta.label}
                                                        {r.daysWaiting !== null && ` · ${r.daysWaiting}d`}
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {/* Registro de revisiones diarias (libro de auditoría) */}
            <div className="bg-white rounded-xl border border-gray-200 mb-6">
                <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
                    <History size={18} className="text-indigo-600" />
                    <h2 className="font-semibold text-gray-900">Registro de revisiones diarias</h2>
                    <span className="text-xs text-gray-400">— constancia de que el control se ejecuta y cruza contra ventas y postventa</span>
                </div>
                <div className="overflow-x-auto">
                    {auditRuns.length === 0 ? (
                        <div className="text-center py-8 text-gray-400 text-sm px-6">
                            Todavía no corrió ninguna revisión. Cuando el cron diario se dé de alta, cada corrida deja acá su constancia.
                        </div>
                    ) : (
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-left text-xs text-gray-500 uppercase border-b border-gray-200">
                                    <th className="px-4 py-2.5">Fecha/hora</th>
                                    <th className="px-4 py-2.5">Origen</th>
                                    <th className="px-4 py-2.5 text-right">Total</th>
                                    <th className="px-4 py-2.5 text-right">Con venta</th>
                                    <th className="px-4 py-2.5 text-right">Postventa</th>
                                    <th className="px-4 py-2.5 text-right">Esperando factura</th>
                                    <th className="px-4 py-2.5 text-right">Sin venta</th>
                                    <th className="px-4 py-2.5 text-right">Sobrecostos</th>
                                    <th className="px-4 py-2.5">Fuentes</th>
                                </tr>
                            </thead>
                            <tbody>
                                {auditRuns.map(r => (
                                    <tr key={r.id} className="border-b border-gray-100 hover:bg-gray-50">
                                        <td className="px-4 py-2.5 whitespace-nowrap text-gray-700">
                                            {new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'America/Argentina/Buenos_Aires' }).format(new Date(r.runAt))}
                                            {r.trigger === 'MANUAL' && <span className="ml-1 text-xs text-gray-400">(manual)</span>}
                                        </td>
                                        <td className="px-4 py-2.5 text-gray-500 text-xs">{r.trigger === 'CRON' ? 'Automático' : 'Manual'}</td>
                                        <td className="px-4 py-2.5 text-right text-gray-900">{r.totalEntries}</td>
                                        <td className="px-4 py-2.5 text-right text-green-700">{r.conVenta}</td>
                                        <td className="px-4 py-2.5 text-right text-blue-700">{r.postventa}</td>
                                        <td className="px-4 py-2.5 text-right text-gray-500">{r.esperandoFact}</td>
                                        <td className={`px-4 py-2.5 text-right font-semibold ${r.sinVenta > 0 ? 'text-amber-600' : 'text-gray-400'}`}>
                                            {r.sinVenta}{r.nuevosSinVenta > 0 && <span className="text-red-600 text-xs"> (+{r.nuevosSinVenta})</span>}
                                        </td>
                                        <td className={`px-4 py-2.5 text-right ${r.overcost > 0 ? 'text-red-600 font-semibold' : 'text-gray-400'}`}>{r.overcost}</td>
                                        <td className="px-4 py-2.5">
                                            {r.staleSources.length === 0
                                                ? <span className="text-green-600 text-xs">✓ OK</span>
                                                : <span className="text-red-600 text-xs" title={r.staleSources.join(', ')}>⚠ {r.staleSources.length} caída(s)</span>}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            <h2 className="font-semibold text-gray-900 mb-3">Facturas y planillas cargadas</h2>

            {/* Acciones + filtros */}
            <div className="flex flex-wrap items-center gap-2 mb-4">
                <button
                    onClick={() => runAction('scan-optovision', 'Escaneo Optovision')}
                    disabled={busy !== null}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
                >
                    {busy === 'scan-optovision' ? <Loader2 size={16} className="animate-spin" /> : <Mail size={16} />}
                    Escanear facturas Optovision
                </button>
                <button
                    onClick={() => runAction('scan-grupo-optico', 'Barrido SmartLab')}
                    disabled={busy !== null}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-700 text-white text-sm font-medium hover:bg-emerald-800 disabled:opacity-50"
                >
                    {busy === 'scan-grupo-optico' ? <Loader2 size={16} className="animate-spin" /> : <FlaskConical size={16} />}
                    Barrer portal Grupo Óptico
                </button>
                <button
                    onClick={() => setShowImport(true)}
                    disabled={busy !== null}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 disabled:opacity-50"
                >
                    <Upload size={16} /> Importar planilla
                </button>
                <button
                    onClick={() => runAction('recheck', 'Re-cruce')}
                    disabled={busy !== null}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
                >
                    {busy === 'recheck' ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                    Re-cruzar sin match
                </button>

                <div className="flex-1" />

                <select value={labFilter} onChange={e => setLabFilter(e.target.value)} className="px-3 py-2 rounded-lg border border-gray-300 text-sm bg-white">
                    <option value="">Todos los labs</option>
                    <option value="OPTOVISION">Optovision</option>
                    <option value="GRUPO_OPTICO">Grupo Óptico</option>
                </select>
                <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="px-3 py-2 rounded-lg border border-gray-300 text-sm bg-white">
                    <option value="">Todos los estados</option>
                    <option value="OVERCOST">Sobrecosto</option>
                    <option value="UNDERCOST">Menor costo</option>
                    <option value="OK">OK</option>
                    <option value="UNMATCHED">Sin venta</option>
                    <option value="PENDING">Esperando factura</option>
                </select>
            </div>

            {message && (
                <div className="mb-4 px-4 py-3 rounded-lg bg-blue-50 border border-blue-200 text-sm text-blue-800 flex items-start justify-between gap-3">
                    <span className="break-all">{message}</span>
                    <button onClick={() => setMessage(null)} className="text-blue-400 hover:text-blue-600"><X size={16} /></button>
                </div>
            )}

            {/* Tabla */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
                {loading ? (
                    <div className="flex items-center justify-center py-16 text-gray-400">
                        <Loader2 className="animate-spin mr-2" size={20} /> Cargando…
                    </div>
                ) : entries.length === 0 ? (
                    <div className="text-center py-16 text-gray-400 text-sm px-6">
                        Sin registros todavía. Escaneá las facturas de Optovision o importá la planilla del laboratorio para empezar el cruce.
                    </div>
                ) : (
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-left text-xs text-gray-500 uppercase border-b border-gray-200">
                                <th className="px-4 py-3">Nº pedido</th>
                                <th className="px-4 py-3">Lab</th>
                                <th className="px-4 py-3">Cliente</th>
                                <th className="px-4 py-3">Producto (ver/ajustar costo)</th>
                                <th className="px-4 py-3">Fecha factura</th>
                                <th className="px-4 py-3 text-right">Costo sistema</th>
                                <th className="px-4 py-3 text-right">Costo facturado</th>
                                <th className="px-4 py-3 text-right">Diferencia</th>
                                <th className="px-4 py-3">Estado</th>
                                <th className="px-4 py-3">Pedido</th>
                                <th className="px-4 py-3">Origen</th>
                            </tr>
                        </thead>
                        <tbody>
                            {entries.map(entry => {
                                const meta = STATUS_META[entry.status] || { label: entry.status, badge: 'bg-gray-100 text-gray-600' };
                                const billed = entry.billedNet ?? entry.billedTotal;
                                // Optovision facturado pero todavía no terminado: la
                                // factura llega ~5 días hábiles antes → mostrar la
                                // fecha estimada de "listo".
                                const labSt = entry.order?.labStatus || 'NONE';
                                const orderMeta = ORDER_LAB_LABELS[labSt] || ORDER_LAB_LABELS.NONE;
                                const enCamino = entry.lab === 'OPTOVISION' && entry.order && billed != null
                                    && !['FINISHED', 'READY', 'DELIVERED'].includes(labSt);
                                const estimadoListo = enCamino
                                    ? addBusinessDays(new Date(entry.invoiceDate || entry.createdAt), 5)
                                    : null;
                                return (
                                    <tr key={entry.id} className="border-b border-gray-100 hover:bg-gray-50">
                                        <td className="px-4 py-3 font-mono font-medium text-gray-900" title={entry.notes || undefined}>
                                            {entry.labOrderNumber}{entry.notes && <span className="text-amber-500 ml-1" aria-hidden>*</span>}
                                        </td>
                                        <td className="px-4 py-3 text-gray-600">{LAB_LABELS[entry.lab] || entry.lab}</td>
                                        <td className="px-4 py-3">
                                            {entry.order ? (
                                                <Link href={`/admin/contactos?clientId=${entry.order.clientId}`} className="text-indigo-600 hover:underline">
                                                    {entry.order.client?.name || 'Ver venta'}
                                                </Link>
                                            ) : (
                                                <span className="text-gray-400" title={entry.notes || undefined}>sin venta</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-xs">
                                            {entry.productos && entry.productos.length > 0 ? (
                                                <div className="flex flex-col gap-0.5">
                                                    {entry.productos.map((p, i) => (
                                                        p.productId ? (
                                                            <Link key={i} href={`/admin/inventario?edit=${p.productId}`} target="_blank"
                                                                className="text-indigo-600 hover:underline" title={`Costo cargado: ${fmt(p.costo)} — clic para ver/ajustar`}>
                                                                {p.marca ? `${p.marca} ` : ''}{p.nombre}
                                                                {p.costo != null && <span className="text-gray-400"> · {fmt(p.costo)}</span>}
                                                            </Link>
                                                        ) : (
                                                            <span key={i} className="text-gray-500">{p.marca ? `${p.marca} ` : ''}{p.nombre}</span>
                                                        )
                                                    ))}
                                                </div>
                                            ) : <span className="text-gray-300">—</span>}
                                        </td>
                                        <td className="px-4 py-3 text-gray-600">{fmtDate(entry.invoiceDate)}</td>
                                        <td className="px-4 py-3 text-right text-gray-900">{fmt(entry.systemCost)}</td>
                                        <td className="px-4 py-3 text-right text-gray-900">{fmt(billed)}</td>
                                        <td className={`px-4 py-3 text-right font-semibold ${
                                            entry.difference === null ? 'text-gray-400'
                                                : entry.difference > 100 ? 'text-red-600'
                                                    : entry.difference < -100 ? 'text-emerald-600' : 'text-gray-500'
                                        }`}>
                                            {entry.difference === null ? '—' : (entry.difference > 0 ? '+' : '') + fmt(entry.difference)}
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex flex-col gap-1 items-start">
                                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${meta.badge}`}>{meta.label}</span>
                                                {entry.alertedAt && ['UNMATCHED', 'OVERCOST', 'UNDERCOST'].includes(entry.alertedStatus || '') && (
                                                    <span className="text-[10px] text-gray-400" title={`Avisado por email el ${fmtDate(entry.alertedAt)}`}>
                                                        ✉️ avisado {fmtDate(entry.alertedAt)}
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            {entry.order ? (
                                                <div className="flex flex-col gap-1 items-start">
                                                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${orderMeta.cls}`}>{orderMeta.label}</span>
                                                    {enCamino && estimadoListo && (
                                                        estimadoListo <= new Date() ? (
                                                            <span className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5 font-semibold" title="Pasaron 5+ días hábiles desde la factura: el pedido ya debería estar terminado — corroborar con el laboratorio y actualizar el estado">
                                                                ⚠️ ya debería estar terminado · corroborar
                                                            </span>
                                                        ) : (
                                                            <span className="text-[10px] text-blue-600 font-medium" title="La factura de Optovision llega ~5 días hábiles antes de que el pedido esté terminado">
                                                                🚚 en camino · listo ~{estimadoListo.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })}
                                                            </span>
                                                        )
                                                    )}
                                                </div>
                                            ) : <span className="text-gray-300">—</span>}
                                        </td>
                                        <td className="px-4 py-3 text-xs text-gray-500" title={entry.sourceFile || ''}>
                                            {SOURCE_LABELS[entry.source] || entry.source}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Modal importar planilla */}
            {showImport && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-bold text-gray-900">Importar planilla del laboratorio</h2>
                            <button onClick={() => setShowImport(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
                        </div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Laboratorio</label>
                        <select value={importLab} onChange={e => setImportLab(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm mb-4 bg-white">
                            <option value="GRUPO_OPTICO">Grupo Óptico</option>
                            <option value="OPTOVISION">Optovision</option>
                        </select>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Filas (una por línea: <span className="font-mono">pedido ; importe ; fecha</span>)
                        </label>
                        <textarea
                            value={importText}
                            onChange={e => setImportText(e.target.value)}
                            placeholder={'580841 ; 45000 ; 10/07/2026\n580912 ; 38.500,50'}
                            rows={8}
                            className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm font-mono mb-4"
                        />
                        <p className="text-xs text-gray-400 mb-4">La fecha es opcional. Se aceptan importes con $ y separadores de miles.</p>
                        <div className="flex justify-end gap-2">
                            <button onClick={() => setShowImport(false)} className="px-4 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50">Cancelar</button>
                            <button
                                onClick={handleImport}
                                disabled={busy === 'import' || !importText.trim()}
                                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
                            >
                                {busy === 'import' ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                                Importar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
