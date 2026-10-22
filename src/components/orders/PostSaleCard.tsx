import { useState, useEffect } from 'react';
import { Eye, ChevronLeft, ChevronRight, ChevronDown, FlaskConical, Loader2, RotateCcw, X, Upload, FileText, Plus, ClipboardList } from 'lucide-react';
import { Order } from '@/types/orders';
import { resolveStorageUrl } from '@/lib/utils/storage';
import { requiresFrameMeasurements, frameMeasuresForPair, hasFrameMeasures } from '@/lib/utils/lens';
import { PostSaleOperationNumber } from './PostSaleOperationNumber';
import { POST_SALE_MOVABLE_STATUSES, postSaleCerrado } from '@/lib/constants/postSale';
import { PV, caseTypeTone } from './postventa-ui';

interface PostSaleCardProps {
    order: Order;
    onRefresh: () => void;
    onMove: (direction: 'left' | 'right') => void;
    onExpand: () => void;
    onAutoSubmit?: (order: any, pairNum?: number) => void;
    isAutoSubmitting?: boolean;
    userRole?: string;
}

const getRxDefaults = (order: any, pair: 1 | 2 = 1) => {
    const rx = order.prescription || {};
    return {
        ...frameMeasuresForPair(order, pair),
        sphereOD: rx.sphereOD != null ? String(rx.sphereOD) : '',
        cylinderOD: rx.cylinderOD != null ? String(rx.cylinderOD) : '',
        axisOD: rx.axisOD != null ? String(rx.axisOD) : '',
        additionOD: rx.additionOD != null ? String(rx.additionOD) : (rx.addition != null ? String(rx.addition) : ''),
        sphereOI: rx.sphereOI != null ? String(rx.sphereOI) : '',
        cylinderOI: rx.cylinderOI != null ? String(rx.cylinderOI) : '',
        axisOI: rx.axisOI != null ? String(rx.axisOI) : '',
        additionOI: rx.additionOI != null ? String(rx.additionOI) : (rx.addition != null ? String(rx.addition) : ''),
        pdOd: order.labPdOd != null ? String(order.labPdOd) : (rx.distanceOD != null ? String(rx.distanceOD) : ''),
        pdOi: order.labPdOi != null ? String(order.labPdOi) : (rx.distanceOI != null ? String(rx.distanceOI) : ''),
        heightOD: order.labHeightOD != null ? String(order.labHeightOD) : (rx.heightOD != null ? String(rx.heightOD) : ''),
        heightOI: order.labHeightOI != null ? String(order.labHeightOI) : (rx.heightOI != null ? String(rx.heightOI) : ''),
        material: order.labMaterial || '',
        treatment: order.labTreatment || '',
        color: order.labColor || '',
        diameter: order.labDiameter || '',
        notes: rx.notes || '',
        imageUrl: rx.imageUrl || ''
    };
};

export function PostSaleCard({
    order,
    onRefresh,
    onMove,
    onExpand,
    onAutoSubmit,
    isAutoSubmitting = false,
    userRole = 'STAFF'
}: PostSaleCardProps) {
    const isAdmin = userRole === 'ADMIN';
    const [newNote, setNewNote] = useState('');
    const [isSavingNote, setIsSavingNote] = useState(false);
    const [showReprocess, setShowReprocess] = useState(false);
    // La tarjeta arranca colapsada: solo el nombre y los dos datos que se buscan
    // de un vistazo (operación y plata). El resto se abre con un click.
    const [collapsed, setCollapsed] = useState(true);
    const [isSavingRx, setIsSavingRx] = useState(false);

    // Rx state for reprocess form
    const [pair1Faulty, setPair1Faulty] = useState(true);
    const [pair2Faulty, setPair2Faulty] = useState(false);
    const [rx1, setRx1] = useState<any>(() => getRxDefaults(order, 1));
    const [rx2, setRx2] = useState<any>(() => getRxDefaults(order, 2));
    const [clientPrescriptions, setClientPrescriptions] = useState<any[]>([]);
    const [newRxImageFile, setNewRxImageFile] = useState<File | null>(null);
    const [newRxImagePreview, setNewRxImagePreview] = useState<string | null>(null);
    const [isUploadingImage, setIsUploadingImage] = useState(false);
    // Reproceso por cambio de receta: obliga a adjuntar la nueva receta antes de cargar
    const [rxChange, setRxChange] = useState(false);
    // Autorización del administrador para reprocesar sin la nueva receta
    const [reprocessAuthNoRx, setReprocessAuthNoRx] = useState(false);
    const rxChangeMissingImage = rxChange && !newRxImageFile;
    // Bloqueado: falta la nueva receta y ningún administrador autorizó el reproceso
    const reprocessBlocked = rxChangeMissingImage && !reprocessAuthNoRx;

    const is2x1 = order.appliedPromoName?.toLowerCase().includes('2x1') || order.items?.some((it: any) => {
        const str = `${it.product?.name || ''} ${it.productNameSnapshot || ''}`.toLowerCase();
        return str.includes('2x1');
    });
    // Hay un segundo par si es 2x1 o si el pedido tiene datos de armazón/lab del Par 2
    const o = order as any;
    const hasSecondPair = is2x1 || !!(o.frameA2 || o.frameB2 || o.frameDbl2 || o.frameEdc2 || o.labFrameShape2 || o.labFrameDetails2);

    // ¿El lente del pedido requiere cargar las medidas del armazón (multifocal o monofocal de lab)?
    const needsFrameMeasures = requiresFrameMeasurements(order);

    // Trae los datos completos del pedido original al formulario de un par
    const importFullOrder = (pair: 1 | 2) => {
        const full = getRxDefaults(order, pair);
        if (pair === 1) setRx1(full); else setRx2(full);
    };

    const requiresLab = order.postSaleOrderOption === 'SAME' || order.postSaleOrderOption === 'DIFFERENT';

    // Initialize rx data from postSaleRxData if available
    useEffect(() => {
        if (order.postSaleRxData) {
            try {
                const parsed = JSON.parse(order.postSaleRxData);
                setPair1Faulty(parsed.pair1Faulty !== undefined ? parsed.pair1Faulty : true);
                setPair2Faulty(parsed.pair2Faulty !== undefined ? parsed.pair2Faulty : false);
                setRxChange(parsed.rxChange ?? false);
                setReprocessAuthNoRx(parsed.reprocessAuthNoRx ?? false);
                // Rellenar siempre desde el pedido (medidas de armazón, material, etc.);
                // lo guardado tiene prioridad. Así las medidas vienen llenas y editables.
                setRx1({ ...getRxDefaults(order, 1), ...(parsed.rx1 || {}) });
                setRx2({ ...getRxDefaults(order, 2), ...(parsed.rx2 || {}) });
            } catch (e) {
                console.error('Error parsing postSaleRxData:', e);
            }
        } else {
            setPair1Faulty(true);
            setPair2Faulty(false);
            setRxChange(false);
            setReprocessAuthNoRx(false);
            setRx1(getRxDefaults(order, 1));
            setRx2(getRxDefaults(order, 2));
        }
    }, [order.id, order.postSaleRxData]);

    // Load client prescriptions when reprocess panel opens
    useEffect(() => {
        if (showReprocess && order.postSaleOrderOption === 'DIFFERENT' && order.clientId) {
            fetch(`/api/contacts/${order.clientId}/prescriptions`)
                .then(res => res.json())
                .then(data => {
                    if (Array.isArray(data)) setClientPrescriptions(data);
                })
                .catch(err => console.error('Error loading prescriptions:', err));
        }
    }, [showReprocess, order.clientId, order.postSaleOrderOption]);

    const notesHistory = order.postSaleNotes 
        ? order.postSaleNotes.split('\n').filter((line: string) => line.trim() !== '') 
        : [];

    const handleAddNote = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newNote.trim()) return;

        setIsSavingNote(true);
        try {
            const formattedDate = new Date().toLocaleDateString('es-AR', {
                day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
            });
            const newEntry = `[${formattedDate}]: ${newNote.trim()}`;
            const updatedNotes = order.postSaleNotes 
                ? `${order.postSaleNotes}\n${newEntry}` : newEntry;

            const res = await fetch(`/api/orders/${order.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ postSaleNotes: updatedNotes })
            });
            if (res.ok) { setNewNote(''); onRefresh(); }
            else { const data = await res.json(); alert(`Error: ${data.error || 'No se pudo guardar'}`); }
        } catch (err) {
            console.error('Error adding note:', err);
            alert('Error de red al guardar la nota.');
        } finally { setIsSavingNote(false); }
    };

    const handleImportPrescription = (rxId: string, pair: 1 | 2) => {
        const found = clientPrescriptions.find((p: any) => p.id === rxId);
        if (!found) return;
        const imported = {
            sphereOD: found.sphereOD != null ? String(found.sphereOD) : '',
            cylinderOD: found.cylinderOD != null ? String(found.cylinderOD) : '',
            axisOD: found.axisOD != null ? String(found.axisOD) : '',
            additionOD: found.additionOD != null ? String(found.additionOD) : (found.addition != null ? String(found.addition) : ''),
            sphereOI: found.sphereOI != null ? String(found.sphereOI) : '',
            cylinderOI: found.cylinderOI != null ? String(found.cylinderOI) : '',
            axisOI: found.axisOI != null ? String(found.axisOI) : '',
            additionOI: found.additionOI != null ? String(found.additionOI) : (found.addition != null ? String(found.addition) : ''),
            pdOd: found.distanceOD != null ? String(found.distanceOD) : '',
            pdOi: found.distanceOI != null ? String(found.distanceOI) : '',
            heightOD: found.heightOD != null ? String(found.heightOD) : '',
            heightOI: found.heightOI != null ? String(found.heightOI) : '',
            notes: found.notes || '', imageUrl: found.imageUrl || '',
            // Preservar medidas del armazón y datos de lab ya cargados
            ...(() => { const cur = pair === 1 ? rx1 : rx2; return {
                frameA: cur.frameA, frameB: cur.frameB, frameEd: cur.frameEd, framePte: cur.framePte,
                material: cur.material, treatment: cur.treatment, color: cur.color, diameter: cur.diameter
            }; })()
        };
        if (pair === 1) setRx1(imported); else setRx2(imported);
    };

    const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setNewRxImageFile(file);
        const reader = new FileReader();
        reader.onloadend = () => setNewRxImagePreview(reader.result as string);
        reader.readAsDataURL(file);
    };

    const uploadImage = async (): Promise<string | null> => {
        if (!newRxImageFile) return null;
        setIsUploadingImage(true);
        try {
            const formData = new FormData();
            formData.append('file', newRxImageFile);
            const res = await fetch('/api/upload', { method: 'POST', body: formData });
            if (res.ok) { const data = await res.json(); return data.url || data.fileUrl || null; }
            return null;
        } catch { return null; }
        finally { setIsUploadingImage(false); }
    };

    const handleSaveAndLaunch = async (pairNum: number) => {
        if (!onAutoSubmit) return;
        if (reprocessBlocked) {
            alert('Cambio de receta sin la nueva receta adjunta: no se puede enviar el reproceso sin cargo. Pedile a un administrador que autorice el reproceso del pedido.');
            return;
        }
        const pairRx = pairNum === 1 ? rx1 : rx2;
        if (needsFrameMeasures && !hasFrameMeasures(pairRx)) {
            alert('Este lente (multifocal o monofocal de laboratorio) requiere las medidas del armazón (A, B, ED, Puente). Ampliá la ficha (👁️) y cargalas antes de enviar a SmartLab.');
            return;
        }
        setIsSavingRx(true);
        try {
            let newImageUrl: string | null = null;
            if (newRxImageFile) {
                newImageUrl = await uploadImage();
                if (newImageUrl) {
                    if (pairNum === 1) setRx1((prev: any) => ({ ...prev, imageUrl: newImageUrl }));
                    else setRx2((prev: any) => ({ ...prev, imageUrl: newImageUrl }));
                }
            }
            const finalRx1 = { ...rx1, ...(newImageUrl && pairNum === 1 ? { imageUrl: newImageUrl } : {}) };
            const finalRx2 = { ...rx2, ...(newImageUrl && pairNum === 2 ? { imageUrl: newImageUrl } : {}) };
            const payloadRxData = { pair1Faulty, pair2Faulty, rxChange, reprocessAuthNoRx, rx1: finalRx1, rx2: finalRx2 };

            const res = await fetch(`/api/orders/${order.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ postSaleRxData: JSON.stringify(payloadRxData) })
            });
            if (!res.ok) { alert('Error al guardar los datos de receta.'); return; }

            onRefresh();
            const updatedOrder = { ...order, postSaleRxData: JSON.stringify(payloadRxData), postSaleOrderOption: order.postSaleOrderOption };
            onAutoSubmit(updatedOrder, pairNum);
        } catch (err) {
            console.error('Error saving and launching:', err);
            alert('Error al procesar el reproceso.');
        } finally { setIsSavingRx(false); }
    };

    const handleDirectLaunch = (pairNum: number) => {
        if (!onAutoSubmit) return;
        onAutoSubmit(order, pairNum);
    };

    const updateRxField = (pair: 1 | 2, field: string, val: string) => {
        if (pair === 1) setRx1((prev: any) => ({ ...prev, [field]: val }));
        else setRx2((prev: any) => ({ ...prev, [field]: val }));
    };

    // 'Cerrado' no se mueve a mano: entra solo al descontarse de caja. Y un caso
    // ya cerrado no vuelve para atrás desde acá — eso exige revertir el movimiento.
    const cerrado = postSaleCerrado({
        status: order.postSaleStatus,
        cost: order.postSaleCost,
        cashEntryId: (order as any).postSaleCashEntryId,
        clientChargedAt: (order as any).postSaleClientChargedAt,
    });
    const statusKeys: string[] = [...POST_SALE_MOVABLE_STATUSES];
    const currentStatus = order.postSaleStatus === 'FINISHED' ? 'READY' : (order.postSaleStatus || 'SENT');
    let currentIdx = statusKeys.indexOf(currentStatus);
    if (currentIdx === -1) currentIdx = 0;
    const canMoveLeft = !cerrado && currentIdx > 0;
    const canMoveRight = !cerrado && currentIdx < statusKeys.length - 1;

    const renderRxFormInline = (pairRx: any, pairNum: 1 | 2) => {
        const odFields = [
            { key: 'sphereOD', label: 'Esf' }, { key: 'cylinderOD', label: 'Cil' },
            { key: 'axisOD', label: 'Eje' }, { key: 'additionOD', label: 'Add' },
            { key: 'pdOd', label: 'DNP' }, { key: 'heightOD', label: 'Alt' },
        ];
        const oiFields = [
            { key: 'sphereOI', label: 'Esf' }, { key: 'cylinderOI', label: 'Cil' },
            { key: 'axisOI', label: 'Eje' }, { key: 'additionOI', label: 'Add' },
            { key: 'pdOi', label: 'DNP' }, { key: 'heightOI', label: 'Alt' },
        ];

        return (
            <div className={`space-y-2 ${PV.panel} p-3`}>
                <div className="flex flex-wrap items-center justify-between gap-1.5 mb-1">
                    <span className={`${PV.eyebrow} text-amber-700 dark:text-amber-400 flex-shrink-0`}>
                        Receta par {pairNum}
                    </span>
                    <div className="flex items-center gap-1 min-w-0">
                        <button type="button" onClick={() => importFullOrder(pairNum)}
                            className={`${PV.btn.ghost} h-7 px-2 text-[11px] flex-shrink-0`}
                            title="Traer los datos completos del pedido original">
                            <ClipboardList className="w-3.5 h-3.5" /> Traer pedido
                        </button>
                        {clientPrescriptions.length > 0 && (
                            <select
                                onChange={(e) => { if (e.target.value) { handleImportPrescription(e.target.value, pairNum); e.target.value = ''; } }}
                                className="text-[11px] px-2 py-1 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 outline-none min-w-0"
                            >
                                <option value="">Importar Receta...</option>
                                {clientPrescriptions.map((p: any) => (
                                    <option key={p.id} value={p.id}>
                                        {new Date(p.date).toLocaleDateString('es-AR')} - OD: {p.sphereOD != null ? (p.sphereOD > 0 ? '+' : '') + p.sphereOD : '0'}/{p.sphereOI != null ? (p.sphereOI > 0 ? '+' : '') + p.sphereOI : '0'}
                                    </option>
                                ))}
                            </select>
                        )}
                    </div>
                </div>
                {/* OD Row */}
                <div className="flex items-center gap-1">
                    <span className="text-[11px] font-semibold text-stone-500 w-6 flex-shrink-0">OD</span>
                    {odFields.map(f => (
                        <div key={f.key} className="flex-1 min-w-0">
                            <input type="text" value={pairRx[f.key] || ''} onChange={(e) => updateRxField(pairNum, f.key, e.target.value)}
                                placeholder={f.label} title={f.label} aria-label={`${f.label} OD`}
                                className="w-full text-center text-[11px] px-0.5 py-1 border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 rounded-md placeholder-stone-400 focus:outline-none focus:ring-1 focus:ring-amber-500 dark:text-stone-100" />
                        </div>
                    ))}
                </div>
                {/* OI Row */}
                <div className="flex items-center gap-1">
                    <span className="text-[11px] font-semibold text-stone-500 w-6 flex-shrink-0">OI</span>
                    {oiFields.map(f => (
                        <div key={f.key} className="flex-1 min-w-0">
                            <input type="text" value={pairRx[f.key] || ''} onChange={(e) => updateRxField(pairNum, f.key, e.target.value)}
                                placeholder={f.label} title={f.label} aria-label={`${f.label} OI`}
                                className="w-full text-center text-[11px] px-0.5 py-1 border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 rounded-md placeholder-stone-400 focus:outline-none focus:ring-1 focus:ring-amber-500 dark:text-stone-100" />
                        </div>
                    ))}
                </div>
                {/* Current recipe image link */}
                {pairRx.imageUrl && (
                    <div className="flex items-center gap-1.5 pt-1">
                        <FileText className="w-3 h-3 text-stone-600 dark:text-stone-400" />
                        <a href={resolveStorageUrl(pairRx.imageUrl)} target="_blank" rel="noopener noreferrer"
                            className="text-[12px] text-sky-700 dark:text-sky-400 hover:underline font-medium">Ver receta actual</a>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className={`${PV.card} p-4 hover:shadow-md transition-shadow space-y-3 flex flex-col justify-between`}>
            <div className="space-y-2">
                {/* Header: el nombre abre y cierra la tarjeta. Colapsada entra el triple
                    de casos por columna, que es lo que hace usable el tablero. */}
                <div className="flex items-start justify-between gap-1">
                    <button
                        onClick={() => setCollapsed(v => !v)}
                        className="min-w-0 flex-1 text-left group"
                        aria-expanded={!collapsed}
                        title={collapsed ? 'Abrir la tarjeta completa' : 'Colapsar'}
                    >
                        <h4 className="text-[13px] font-semibold text-stone-900 dark:text-stone-50 leading-tight truncate flex items-center gap-1">
                            <ChevronDown className={`w-3 h-3 flex-shrink-0 text-stone-600 dark:text-stone-400 transition-transform ${collapsed ? '-rotate-90' : ''}`} />
                            <span className="truncate group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                                {order.client?.name || 'Cliente'}
                            </span>
                        </h4>
                        <span className="text-[11px] font-medium text-stone-500 dark:text-stone-400 block mt-0.5 pl-4">
                            Venta #{order.id.slice(-4).toUpperCase()}
                        </span>
                    </button>
                    <button onClick={onExpand} className={`${PV.btn.icon} flex-shrink-0`} title="Ver ficha y medidas">
                        <Eye className="w-4 h-4" />
                    </button>
                </div>

                {/* Colapsada: solo lo que se necesita para identificar el caso de un
                    vistazo — la operación (que es lo que más se busca) y la plata. */}
                {collapsed && (
                    <div className="flex flex-wrap gap-1.5 pl-4">
                        {/* El nº de operación se carga y cambia acá mismo (es lo que más
                            se busca y lo que más tarde se completa). */}
                        {order.postSaleOrderOption !== 'SAME' && (
                            <PostSaleOperationNumber compact orderId={order.id} value={order.postSaleNewOrderNumber} history={(order as any).postSaleNewOrderNumberHistory} onSaved={onRefresh} />
                        )}
                        {order.postSaleCost != null && order.postSaleCost > 0 && (
                            <span className={`${PV.chipSm} tabular-nums ${order.postSaleCashEntryId ? PV.tone.emerald : order.postSaleCostSource === 'LAB' ? PV.tone.amber : PV.tone.rose}`}>
                                $ {order.postSaleCost.toLocaleString('es-AR')}
                                {order.postSaleCashEntryId ? ' · cobrado' : order.postSaleCostSource === 'LAB' ? ' · a cobrar' : ''}
                            </span>
                        )}
                    </div>
                )}

                {/* Info badges */}
                <div className={`flex-wrap gap-1.5 pt-0.5 ${collapsed ? 'hidden' : 'flex'}`}>
                    {order.postSaleCaseType && (
                        <span className={`${PV.chipSm} ${caseTypeTone(order.postSaleCaseType)}`}>
                            {order.postSaleCaseType}
                        </span>
                    )}
                    {order.postSaleCoverage && (
                        <span className={`${PV.chipSm} ${order.postSaleCoverage === 'Con cargo' ? PV.tone.amber : PV.tone.emerald}`}>
                            {order.postSaleCoverage}
                        </span>
                    )}
                    {/* Un solo badge: responsable y culpa son la misma respuesta
                        desde que el caso se carga con un campo único. */}
                    {(order.postSaleResponsible || order.postSaleFault) && (
                        <span className={`${PV.chipSm} ${PV.tone.neutral}`}>
                            Resp. {order.postSaleResponsible || order.postSaleFault}
                        </span>
                    )}
                    {order.postSaleCost != null && order.postSaleCost > 0 && (
                        <span className={`${PV.chipSm} tabular-nums ${PV.tone.rose}`}>
                            $ {order.postSaleCost.toLocaleString('es-AR')}
                        </span>
                    )}
                    {order.postSaleOrderOption === 'SAME' ? (
                        <span className={`${PV.chipSm} font-mono ${PV.tone.sky}`}>
                            Misma OP #{order.labOrderNumber || 'original'}
                        </span>
                    ) : (
                        <PostSaleOperationNumber compact orderId={order.id} value={order.postSaleNewOrderNumber} history={(order as any).postSaleNewOrderNumberHistory} onSaved={onRefresh} />
                    )}
                </div>

                {/* SmartLab Progress */}
                {!collapsed && order.smartLabProgress != null && order.smartLabProgress > 0 && requiresLab && (
                    <div className="rounded-xl px-2.5 py-2 border border-sky-200/70 dark:border-sky-900/50 bg-sky-50/60 dark:bg-sky-950/20">
                        <div className="flex items-center justify-between mb-1">
                            <span className={`${PV.eyebrow} text-sky-700 dark:text-sky-300`}>SmartLab</span>
                            <span className={`text-[12px] font-semibold tabular-nums ${order.smartLabProgress >= 100 ? 'text-emerald-600' : 'text-sky-700 dark:text-sky-300'}`}>{order.smartLabProgress}%</span>
                        </div>
                        <div className="h-1 bg-blue-100/70 dark:bg-blue-900/30 rounded-full overflow-hidden mb-1">
                            <div className={`h-full rounded-full transition-all duration-500 ${order.smartLabProgress >= 100 ? 'bg-emerald-500' : 'bg-blue-500'}`}
                                style={{ width: `${Math.min(100, order.smartLabProgress)}%` }} />
                        </div>
                        <div className="flex items-center justify-between text-[11px] font-medium text-stone-500 dark:text-stone-400">
                            <span className="truncate max-w-[120px]">{order.smartLabSector || '—'}</span>
                            {order.smartLabDays != null && <span className="font-bold text-amber-500">{order.smartLabDays}d</span>}
                        </div>
                    </div>
                )}

                {/* Notes History */}
                <div className={`${PV.panel} p-2.5 space-y-2 max-h-[160px] overflow-y-auto custom-scrollbar ${collapsed ? 'hidden' : ''}`}>
                    <p className={`${PV.eyebrow} border-b border-stone-200 dark:border-stone-800 pb-1`}>Historial</p>
                    {notesHistory.length === 0 ? (
                        <p className="text-[12px] text-stone-500 dark:text-stone-400 italic">Sin observaciones registradas.</p>
                    ) : (
                        <div className="space-y-1.5 text-[12px] leading-relaxed">
                            {notesHistory.map((line: string, i: number) => {
                                const match = line.match(/^\[(.*?)\]:\s*(.*)$/);
                                if (match) return (
                                    <div key={i} className="flex flex-col text-stone-600 dark:text-stone-300">
                                        <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-400">{match[1]}</span>
                                        <span className="text-stone-700 dark:text-stone-200">{match[2]}</span>
                                    </div>
                                );
                                return <div key={i} className="text-stone-600 dark:text-stone-300">{line}</div>;
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* ══════════ Reprocess Panel ══════════ */}
            {showReprocess && (
                <div className="space-y-3 pt-3 border-t-2 border-amber-200 dark:border-amber-900/50">
                    <div className="flex items-center justify-between">
                        <span className={`${PV.eyebrow} text-amber-700 dark:text-amber-400 flex items-center gap-1.5`}>
                            <RotateCcw className="w-3.5 h-3.5" /> Reproceso
                        </span>
                        <button onClick={() => setShowReprocess(false)} className={PV.btn.icon} title="Cerrar reproceso">
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    {order.postSaleOrderOption === 'DIFFERENT' ? (
                        <div className="space-y-3">
                            {/* Pair selectors */}
                            <div className={`flex gap-4 p-2.5 ${PV.panel}`}>
                                <label className="flex items-center gap-2 text-[12px] font-medium text-stone-700 dark:text-stone-200 cursor-pointer">
                                    <input type="checkbox" checked={pair1Faulty} onChange={(e) => setPair1Faulty(e.target.checked)}
                                        className="rounded border-stone-300 text-amber-500 focus:ring-amber-500 w-3.5 h-3.5" />
                                    Re-hacer Par 1
                                </label>
                                {hasSecondPair && (
                                    <label className="flex items-center gap-2 text-[12px] font-medium text-stone-700 dark:text-stone-200 cursor-pointer">
                                        <input type="checkbox" checked={pair2Faulty} onChange={(e) => setPair2Faulty(e.target.checked)}
                                            className="rounded border-stone-300 text-amber-500 focus:ring-amber-500 w-3.5 h-3.5" />
                                        Re-hacer Par 2
                                    </label>
                                )}
                            </div>

                            {/* Motivo: cambio de receta → obliga a subir la nueva receta */}
                            <label className="flex items-start gap-2 text-[12px] font-medium text-stone-700 dark:text-stone-200 cursor-pointer px-1">
                                <input type="checkbox" checked={rxChange} onChange={(e) => setRxChange(e.target.checked)}
                                    className="rounded border-stone-300 text-amber-500 focus:ring-amber-500 w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                                <span>Es por <b>cambio de receta</b> <span className="text-amber-700 dark:text-amber-400">(obligatorio adjuntar la nueva receta)</span></span>
                            </label>

                            {pair1Faulty && renderRxFormInline(rx1, 1)}
                            {hasSecondPair && pair2Faulty && renderRxFormInline(rx2, 2)}

                            {/* New Recipe Image Upload */}
                            <div className="space-y-1.5">
                                <label className={PV.label}>
                                    Adjuntar nueva receta{rxChange && <span className="text-rose-600"> · obligatorio</span>}
                                </label>
                                <div className="flex items-center gap-2">
                                    <label className={`flex-1 flex items-center gap-2 px-3 py-2 bg-stone-50 dark:bg-stone-900 border border-dashed rounded-xl cursor-pointer transition-colors ${rxChangeMissingImage ? 'border-red-400 hover:border-red-500' : 'border-stone-300 dark:border-stone-700 hover:border-amber-400'}`}>
                                        <Upload className={`w-3.5 h-3.5 ${rxChangeMissingImage ? 'text-red-400' : 'text-stone-600 dark:text-stone-400'}`} />
                                        <span className="text-[12px] text-stone-600 dark:text-stone-300 truncate">
                                            {newRxImageFile ? newRxImageFile.name : 'Seleccionar imagen…'}
                                        </span>
                                        <input type="file" accept="image/*" onChange={handleImageSelect} className="hidden" />
                                    </label>
                                    {newRxImagePreview && (
                                        <img src={newRxImagePreview} alt="Preview" className="w-10 h-10 rounded-lg object-cover border border-stone-200 dark:border-stone-700" />
                                    )}
                                </div>
                                {rxChangeMissingImage && (
                                    <div className={`mt-1 space-y-1.5 border rounded-xl p-2.5 ${reprocessAuthNoRx ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/40' : 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900/40'}`}>
                                        {reprocessAuthNoRx ? (
                                            <p className="text-[12px] font-medium text-emerald-700 dark:text-emerald-400 leading-snug">
                                                ✓ Reproceso sin receta autorizado por administrador. Podés cargarlo, pero recordá que sin receta no corresponde envío sin cargo.
                                            </p>
                                        ) : (
                                            <p className="text-[12px] font-medium text-rose-700 dark:text-rose-400 leading-snug">
                                                Sin la nueva receta no se puede enviar el reproceso sin cargo. Pedile a un administrador que autorice el reproceso del pedido.
                                            </p>
                                        )}
                                        {isAdmin ? (
                                            <label className="flex items-start gap-2 text-[12px] font-medium text-stone-700 dark:text-stone-200 cursor-pointer">
                                                <input type="checkbox" checked={reprocessAuthNoRx} onChange={(e) => setReprocessAuthNoRx(e.target.checked)}
                                                    className="rounded border-stone-300 text-emerald-500 focus:ring-emerald-500 w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                                                <span>Autorizo el reproceso sin la nueva receta (como administrador).</span>
                                            </label>
                                        ) : !reprocessAuthNoRx && (
                                            <p className="text-[12px] text-rose-700/80 dark:text-rose-400/80 italic">Solo un administrador puede autorizar el reproceso sin receta.</p>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Aviso: faltan medidas del armazón (se cargan en la ficha ampliada) */}
                            {needsFrameMeasures && ((pair1Faulty && !hasFrameMeasures(rx1)) || (hasSecondPair && pair2Faulty && !hasFrameMeasures(rx2))) && (
                                <button type="button" onClick={onExpand}
                                    className={`w-full text-left ${PV.panelRose} p-2.5 hover:bg-rose-100 dark:hover:bg-rose-950/50 transition-colors`}>
                                    <p className="text-[12px] font-medium text-rose-700 dark:text-rose-300 leading-snug">
                                        Este lente (multifocal o monofocal de lab) requiere las <b>medidas del armazón</b> (A, B, ED, Puente). Tocá para <b>ampliar la ficha</b> y cargarlas.
                                    </p>
                                </button>
                            )}

                            {/* Launch buttons */}
                            <div className="flex gap-2">
                                {pair1Faulty && (
                                    <button onClick={() => handleSaveAndLaunch(1)} disabled={isAutoSubmitting || isSavingRx || isUploadingImage || reprocessBlocked || (needsFrameMeasures && !hasFrameMeasures(rx1))}
                                        className={`${PV.btn.accent} flex-1`}
                                        title={needsFrameMeasures && !hasFrameMeasures(rx1) ? 'Faltan las medidas del armazón del Par 1 — ampliá la ficha' : (reprocessBlocked ? 'Falta la nueva receta o la autorización del administrador' : 'Guardar datos y cargar Par 1 en SmartLab')}>
                                        {(isAutoSubmitting || isSavingRx) ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FlaskConical className="w-3.5 h-3.5" />}
                                        Cargar par 1 en SmartLab
                                    </button>
                                )}
                                {hasSecondPair && pair2Faulty && (
                                    <button onClick={() => handleSaveAndLaunch(2)} disabled={isAutoSubmitting || isSavingRx || isUploadingImage || reprocessBlocked || (needsFrameMeasures && !hasFrameMeasures(rx2))}
                                        className={`${PV.btn.accent} flex-1`}
                                        title={needsFrameMeasures && !hasFrameMeasures(rx2) ? 'Faltan las medidas del armazón del Par 2 — ampliá la ficha' : (reprocessBlocked ? 'Falta la nueva receta o la autorización del administrador' : 'Guardar datos y cargar Par 2 en SmartLab')}>
                                        {(isAutoSubmitting || isSavingRx) ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FlaskConical className="w-3.5 h-3.5" />}
                                        Cargar par 2 en SmartLab
                                    </button>
                                )}
                            </div>
                        </div>
                    ) : order.postSaleOrderOption === 'SAME' ? (
                        <div className="space-y-3">
                            <div className={`${PV.panel} p-3`}>
                                <p className={`${PV.eyebrow} mb-2`}>Datos del pedido original</p>
                                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[12px]">
                                    <div className="flex justify-between"><span className="text-stone-600 dark:text-stone-400 font-bold">OP:</span><span className="font-black text-stone-700 dark:text-stone-200">#{order.labOrderNumber || '—'}</span></div>
                                    {order.prescription && (<>
                                        <div className="flex justify-between"><span className="text-stone-600 dark:text-stone-400 font-bold">Esf OD:</span><span className="font-black text-stone-700 dark:text-stone-200">{order.prescription.sphereOD ?? '—'}</span></div>
                                        <div className="flex justify-between"><span className="text-stone-600 dark:text-stone-400 font-bold">Esf OI:</span><span className="font-black text-stone-700 dark:text-stone-200">{order.prescription.sphereOI ?? '—'}</span></div>
                                        <div className="flex justify-between"><span className="text-stone-600 dark:text-stone-400 font-bold">Cil OD:</span><span className="font-black text-stone-700 dark:text-stone-200">{order.prescription.cylinderOD ?? '—'}</span></div>
                                        <div className="flex justify-between"><span className="text-stone-600 dark:text-stone-400 font-bold">Cil OI:</span><span className="font-black text-stone-700 dark:text-stone-200">{order.prescription.cylinderOI ?? '—'}</span></div>
                                    </>)}
                                </div>
                            </div>
                            <button onClick={() => handleDirectLaunch(1)} disabled={isAutoSubmitting}
                                className={`${PV.btn.accent} w-full`}>
                                {isAutoSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FlaskConical className="w-3.5 h-3.5" />}
                                Cargar en SmartLab (misma OP)
                            </button>
                        </div>
                    ) : null}
                </div>
            )}

            {/* ══════════ Note Quick Add & Actions ══════════ */}
            <div className={`space-y-2 pt-2 border-t border-stone-100 dark:border-stone-800 ${collapsed ? 'hidden' : ''}`}>
                <form onSubmit={handleAddNote} className="flex gap-1.5 items-center">
                    <input type="text" placeholder="Comentar..." value={newNote} onChange={e => setNewNote(e.target.value)} disabled={isSavingNote}
                        className={`flex-1 ${PV.fieldSm} disabled:opacity-50`} />
                    <button type="submit" disabled={isSavingNote || !newNote.trim()}
                        className={`${PV.btn.secondary} ${PV.btn.sm} px-2.5 flex-shrink-0`} title="Agregar comentario" aria-label="Agregar comentario">
                        {isSavingNote ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    </button>
                </form>

                <div className="flex items-center justify-between pt-1">
                    <button onClick={() => onMove('left')} disabled={!canMoveLeft}
                        className={PV.btn.icon}
                        title="Mover a la etapa anterior"><ChevronLeft className="w-4 h-4" /></button>

                    {requiresLab && onAutoSubmit && !showReprocess ? (
                        <button onClick={() => setShowReprocess(true)}
                            className={`${PV.btn.accent} ${PV.btn.sm}`}
                            title="Abrir el panel de reproceso SmartLab">
                            <RotateCcw className="w-3.5 h-3.5" /> Reprocesar
                        </button>
                    ) : (
                        <span className={`text-[11px] font-medium ${showReprocess ? 'text-amber-700 dark:text-amber-400' : 'text-stone-400'} select-none`}>
                            {showReprocess ? 'Reproceso' : 'Mover'}
                        </span>
                    )}

                    <button onClick={() => onMove('right')} disabled={!canMoveRight}
                        className={PV.btn.icon}
                        title="Mover a la etapa siguiente"><ChevronRight className="w-4 h-4" /></button>
                </div>
            </div>
        </div>
    );
}
