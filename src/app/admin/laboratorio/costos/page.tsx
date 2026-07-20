'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
    ArrowLeft, Loader2, RefreshCw, Mail, Upload, X, FlaskConical,
    AlertTriangle, CheckCircle2, HelpCircle, TrendingDown, CalendarDays, Download, History
} from 'lucide-react';

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
    order: {
        id: string;
        clientId: string;
        createdAt: string;
        client: { name: string } | null;
    } | null;
}

interface StatusTotal {
    status: string;
    _count: { _all: number };
    _sum: { difference: number | null };
}

interface ReportRow {
    orderId: string;
    clientId: string;
    cliente: string;
    fecha: string;
    labOrderNumber: string | null;
    lab: string;
    systemCost: number;
    items: string[];
    billed: number | null;
    difference: number | null;
    invoicesFound: number;
    status: string;
    daysWaiting: number | null;
}

interface AccountStatement {
    id: string;
    lab: string;
    statementDate: string;
    totalDebt: number;
    invoiceCount: number;
    rows: Array<{ invoiceNumber: string; fecha: string | null; importe: number; saldo: number; enSistema?: boolean }>;
    createdAt: string;
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
    const [entries, setEntries] = useState<LabCostEntry[]>([]);
    const [totals, setTotals] = useState<StatusTotal[]>([]);
    const [auditRuns, setAuditRuns] = useState<AuditRun[]>([]);
    const [statements, setStatements] = useState<AccountStatement[]>([]);
    const [loading, setLoading] = useState(true);
    const [labFilter, setLabFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [busy, setBusy] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);

    // Modal de importación de planilla
    const [showImport, setShowImport] = useState(false);
    const [importLab, setImportLab] = useState('GRUPO_OPTICO');
    const [importText, setImportText] = useState('');

    // Reporte mensual
    const [reportMonth, setReportMonth] = useState(previousMonth());
    const [report, setReport] = useState<MonthlyReport | null>(null);
    const [reportLoading, setReportLoading] = useState(false);

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

    const fetchReport = useCallback(async (month: string) => {
        setReportLoading(true);
        try {
            const res = await fetch(`/api/lab-costs/report?month=${month}`);
            if (res.ok) setReport(await res.json());
        } catch (e) {
            console.error('Error cargando reporte mensual', e);
        } finally {
            setReportLoading(false);
        }
    }, []);

    useEffect(() => { fetchReport(reportMonth); }, [reportMonth, fetchReport]);

    const downloadReportCsv = () => {
        if (!report) return;
        const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
        const lines = [
            'nro_operacion;cliente;fecha;laboratorio;costo_sistema;costo_real;diferencia;estado;dias_sin_factura;items',
            ...report.rows.map(r => [
                esc(r.labOrderNumber || 'SIN NÚMERO'),
                esc(r.cliente),
                fmtDateAR(r.fecha),
                LAB_LABELS[r.lab] || r.lab,
                r.systemCost,
                r.billed ?? '',
                r.difference ?? '',
                REPORT_STATUS_META[r.status]?.label || r.status,
                r.daysWaiting ?? '',
                esc(r.items.join(' | ')),
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

            {/* Cuenta corriente por lab (último resumen de cuenta recibido) */}
            {statements.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
                    {statements.map(s => {
                        const sinVenta = (s.rows || []).filter(r => r.enSistema === false).length;
                        return (
                            <div key={s.id} className="bg-white rounded-xl border border-indigo-200 p-4">
                                <div className="flex items-center gap-2 text-indigo-700 text-sm font-medium">
                                    <FlaskConical size={16} /> Cuenta corriente {LAB_LABELS[s.lab] || s.lab}
                                </div>
                                <div className="text-2xl font-bold text-gray-900 mt-1">{fmt(s.totalDebt)}</div>
                                <div className="text-xs text-gray-400">
                                    deuda al {fmtDate(s.statementDate)} · {s.invoiceCount} facturas
                                    {sinVenta > 0 && <span className="text-amber-600"> · {sinVenta} sin venta en el sistema</span>}
                                </div>
                            </div>
                        );
                    })}
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
                        className="px-3 py-1.5 rounded-lg border border-gray-300 text-sm bg-white"
                    />
                    {report && report.rows.length > 0 && (
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
                            {report.totals.operaciones} operaciones · sistema <strong className="text-gray-900">{fmt(report.totals.costoSistema)}</strong>
                            {report.totals.conFactura > 0 && <> · real <strong className="text-gray-900">{fmt(report.totals.costoReal)}</strong> ({report.totals.conFactura} con factura)</>}
                            {report.totals.sinFactura > 0 && <> · {report.totals.sinFactura} sin factura</>}
                            {report.totals.sinNumero > 0 && <span className="text-orange-600"> · {report.totals.sinNumero} sin nº</span>}
                        </div>
                    )}
                </div>
                <div className="overflow-x-auto">
                    {reportLoading ? (
                        <div className="flex items-center justify-center py-10 text-gray-400">
                            <Loader2 className="animate-spin mr-2" size={18} /> Generando reporte…
                        </div>
                    ) : !report || report.rows.length === 0 ? (
                        <div className="text-center py-10 text-gray-400 text-sm">Sin operaciones de laboratorio en este mes.</div>
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
                                {report.rows.map(r => {
                                    const meta = REPORT_STATUS_META[r.status] || { label: r.status, badge: 'bg-gray-100 text-gray-600' };
                                    // Sin factura hace más de 30 días: ya debería estar facturada — resaltar.
                                    const overdue = r.status === 'SIN_FACTURA' && (r.daysWaiting ?? 0) > 30;
                                    return (
                                        <tr key={r.orderId} className="border-b border-gray-100 hover:bg-gray-50">
                                            <td className="px-4 py-2.5 font-mono text-gray-900" title={r.items.join(' | ')}>
                                                {r.labOrderNumber || <span className="text-orange-600 font-sans">sin número</span>}
                                            </td>
                                            <td className="px-4 py-2.5">
                                                <Link href={`/admin/contactos?clientId=${r.clientId}`} className="text-indigo-600 hover:underline">{r.cliente}</Link>
                                            </td>
                                            <td className="px-4 py-2.5 text-gray-600">{fmtDateAR(r.fecha)}</td>
                                            <td className="px-4 py-2.5 text-gray-600">{LAB_LABELS[r.lab] || r.lab}</td>
                                            <td className="px-4 py-2.5 text-right text-gray-900">{fmt(r.systemCost)}</td>
                                            <td className="px-4 py-2.5 text-right text-gray-900">{fmt(r.billed)}</td>
                                            <td className={`px-4 py-2.5 text-right font-semibold ${
                                                r.difference === null ? 'text-gray-400'
                                                    : r.difference > 100 ? 'text-red-600'
                                                        : r.difference < -100 ? 'text-emerald-600' : 'text-gray-500'
                                            }`}>
                                                {r.difference === null ? '—' : (r.difference > 0 ? '+' : '') + fmt(r.difference)}
                                            </td>
                                            <td className="px-4 py-2.5 whitespace-nowrap">
                                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${overdue ? 'bg-red-100 text-red-700' : meta.badge}`}>
                                                    {meta.label}
                                                    {r.daysWaiting !== null && ` · ${r.daysWaiting}d`}
                                                </span>
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
                                <th className="px-4 py-3">Fecha factura</th>
                                <th className="px-4 py-3 text-right">Costo sistema</th>
                                <th className="px-4 py-3 text-right">Costo facturado</th>
                                <th className="px-4 py-3 text-right">Diferencia</th>
                                <th className="px-4 py-3">Estado</th>
                                <th className="px-4 py-3">Origen</th>
                            </tr>
                        </thead>
                        <tbody>
                            {entries.map(entry => {
                                const meta = STATUS_META[entry.status] || { label: entry.status, badge: 'bg-gray-100 text-gray-600' };
                                const billed = entry.billedNet ?? entry.billedTotal;
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
                                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${meta.badge}`}>{meta.label}</span>
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
