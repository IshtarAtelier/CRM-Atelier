'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
    ArrowLeft, Loader2, RefreshCw, Mail, Upload, X, FlaskConical,
    AlertTriangle, CheckCircle2, HelpCircle, TrendingDown
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

const LAB_LABELS: Record<string, string> = {
    OPTOVISION: 'Optovision',
    GRUPO_OPTICO: 'Grupo Óptico',
};

const STATUS_META: Record<string, { label: string; badge: string }> = {
    OVERCOST: { label: 'Sobrecosto', badge: 'bg-red-100 text-red-700' },
    UNDERCOST: { label: 'Menor costo', badge: 'bg-emerald-100 text-emerald-700' },
    OK: { label: 'OK', badge: 'bg-green-100 text-green-700' },
    UNMATCHED: { label: 'Sin match', badge: 'bg-amber-100 text-amber-700' },
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
    const [loading, setLoading] = useState(true);
    const [labFilter, setLabFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [busy, setBusy] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);

    // Modal de importación de planilla
    const [showImport, setShowImport] = useState(false);
    const [importLab, setImportLab] = useState('GRUPO_OPTICO');
    const [importText, setImportText] = useState('');

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
                    <div className="flex items-center gap-2 text-amber-600 text-sm font-medium"><HelpCircle size={16} /> Sin match</div>
                    <div className="text-2xl font-bold text-gray-900 mt-1">{countFor('UNMATCHED')}</div>
                    <div className="text-xs text-gray-400">sin venta asociada</div>
                </div>
            </div>

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
                    <option value="UNMATCHED">Sin match</option>
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
                                                <span className="text-gray-400">—</span>
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
