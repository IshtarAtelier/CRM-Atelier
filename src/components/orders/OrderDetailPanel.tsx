'use client';

import React, { useState } from 'react';
import {
    FlaskConical,
    Eye,
    Package,
    Loader2,
    CheckCircle2,
    Truck,
    Clock,
    Maximize2,
    X,
    Calendar,
    Activity,
    Layers,
    Search,
    ChevronRight,
    ChevronUp
} from 'lucide-react';
import type { Order } from '@/types/orders';
import { resolveStorageUrl } from '@/lib/utils/storage';
import { requiresFrameMeasurements, frameMeasuresForPair, hasFrameMeasures } from '@/lib/utils/lens';
import { POST_SALE_CASE_TYPES, POST_SALE_RESPONSIBLES, POST_SALE_COVERAGE } from '@/lib/constants/postSale';

export const LAB_STEPS = [
    { key: 'NONE', label: 'Pendiente', icon: Clock, color: 'stone', bg: 'bg-stone-100 dark:bg-stone-800', text: 'text-stone-500 dark:text-stone-400', ring: 'ring-stone-200 dark:ring-stone-700' },
    { key: 'SENT', label: 'Falta procesar', icon: Clock, color: 'amber', bg: 'bg-amber-50 dark:bg-amber-950', text: 'text-amber-600 dark:text-amber-400', ring: 'ring-amber-200 dark:ring-amber-800' },
    { key: 'IN_PROGRESS', label: 'Procesado', icon: Package, color: 'blue', bg: 'bg-blue-50 dark:bg-blue-950', text: 'text-blue-600 dark:text-blue-400', ring: 'ring-blue-200 dark:ring-blue-800' },
    { key: 'FINISHED', label: 'Finalizado (Lab)', icon: Package, color: 'fuchsia', bg: 'bg-fuchsia-50 dark:bg-fuchsia-950', text: 'text-fuchsia-600 dark:text-fuchsia-400', ring: 'ring-fuchsia-200 dark:ring-fuchsia-800' },
    { key: 'READY', label: 'Listo p/ Retirar', icon: CheckCircle2, color: 'emerald', bg: 'bg-emerald-50 dark:bg-emerald-950', text: 'text-emerald-600 dark:text-emerald-400', ring: 'ring-emerald-200 dark:ring-emerald-800' },
    { key: 'DELIVERED', label: 'Entregado', icon: Truck, color: 'indigo', bg: 'bg-indigo-50 dark:bg-indigo-950', text: 'text-indigo-600 dark:text-indigo-400', ring: 'ring-indigo-200 dark:ring-indigo-800' },
];

interface OrderDetailPanelProps {
    order: Order & { authorizedByAdmin?: boolean };
    context?: 'ventas' | 'pedidos';
    financials?: {
        totalCash: number;
        totalTransfer: number;
        totalCard: number;
        paidReal: number;
    };
    onAutoSubmit?: (order: any, pairNum?: number) => void;
    isAutoSubmitting?: boolean;
    userRole?: string;
    onRefresh?: () => void;
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

export function OrderDetailPanel({ 
    order, 
    context = 'ventas', 
    financials, 
    onAutoSubmit, 
    isAutoSubmitting,
    userRole = 'STAFF',
    onRefresh
}: OrderDetailPanelProps) {
    const is2x1 = order.appliedPromoName?.toLowerCase().includes('2x1') || order.items?.some((it: any) => {
        const str = `${it.product?.name || ''} ${it.productNameSnapshot || ''}`.toLowerCase();
        return str.includes('2x1');
    });
    // Hay un segundo par si es 2x1 o si el pedido tiene datos de armazón/lab del Par 2
    const oAny = order as any;
    const hasSecondPair = is2x1 || !!(oAny.frameA2 || oAny.frameB2 || oAny.frameDbl2 || oAny.frameEdc2 || order.labFrameShape2 || order.labFrameDetails2);

    // ¿El lente del pedido requiere cargar las medidas del armazón (multifocal o monofocal de lab)?
    const needsFrameMeasures = requiresFrameMeasurements(order);

    // Trae los datos completos del pedido original al formulario de un par
    const importFullOrder = (pair: 1 | 2) => {
        const full = getRxDefaults(order, pair);
        if (pair === 1) setRx1(full); else setRx2(full);
    };

    const isOptovision = order.items?.some((it: any) => {
        const labName = (it.laboratorySnapshot || it.product?.laboratory || '').toUpperCase();
        return labName.includes('OPTOVISION');
    }) || false;

    const [fullImageOpen, setFullImageOpen] = useState(false);
    const [postSaleNotes, setPostSaleNotes] = useState(order.postSaleNotes || '');
    const [postSaleCost, setPostSaleCost] = useState<number | ''>(order.postSaleCost ?? '');
    const [postSaleResponsible, setPostSaleResponsible] = useState(order.postSaleResponsible || '');
    const [postSaleCaseType, setPostSaleCaseType] = useState(order.postSaleCaseType || '');
    const [postSaleFault, setPostSaleFault] = useState(order.postSaleFault || '');
    const [postSaleCoverage, setPostSaleCoverage] = useState(order.postSaleCoverage || '');
    const [postSaleOrderOption, setPostSaleOrderOption] = useState(order.postSaleOrderOption || '');
    const [postSaleNewOrderNumber, setPostSaleNewOrderNumber] = useState(order.postSaleNewOrderNumber || '');
    const [newNoteText, setNewNoteText] = useState('');
    const [isSavingPostSale, setIsSavingPostSale] = useState(false);
    const [showPostSaleForm, setShowPostSaleForm] = useState(false);

    const [pair1Faulty, setPair1Faulty] = useState(true);
    const [pair2Faulty, setPair2Faulty] = useState(false);
    const [rx1, setRx1] = useState<any>(() => getRxDefaults(order, 1));
    const [rx2, setRx2] = useState<any>(() => getRxDefaults(order, 2));
    const [clientPrescriptions, setClientPrescriptions] = useState<any[]>([]);
    // Reproceso por cambio de receta: obliga a subir una nueva receta en esta sesión antes de cargar
    const [rxChange, setRxChange] = useState(false);
    const [rxUploaded1, setRxUploaded1] = useState(false);
    const [rxUploaded2, setRxUploaded2] = useState(false);
    // Autorización del administrador para reprocesar sin la nueva receta
    const [reprocessAuthNoRx, setReprocessAuthNoRx] = useState(false);
    const isReprocessAdmin = userRole === 'ADMIN';

    React.useEffect(() => {
        setPostSaleNotes(order.postSaleNotes || '');
        setPostSaleCost(order.postSaleCost ?? '');
        setPostSaleResponsible(order.postSaleResponsible || '');
        setPostSaleCaseType(order.postSaleCaseType || '');
        setPostSaleFault(order.postSaleFault || '');
        setPostSaleCoverage(order.postSaleCoverage || '');
        setPostSaleOrderOption(order.postSaleOrderOption || '');
        setPostSaleNewOrderNumber(order.postSaleNewOrderNumber || '');
        setNewNoteText('');

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
                console.error('Error parsing postSaleRxData in useEffect:', e);
            }
        } else {
            setPair1Faulty(true);
            setPair2Faulty(false);
            setRxChange(false);
            setReprocessAuthNoRx(false);
            setRx1(getRxDefaults(order, 1));
            setRx2(getRxDefaults(order, 2));
        }
        // Al cambiar de orden se reinician las subidas frescas de esta sesión
        setRxUploaded1(false);
        setRxUploaded2(false);
    }, [order.id, order.postSaleNotes, order.postSaleCost, order.postSaleResponsible, order.postSaleCaseType, order.postSaleFault, order.postSaleCoverage, order.postSaleOrderOption, order.postSaleNewOrderNumber, order.postSaleRxData]);

    React.useEffect(() => {
        if (postSaleOrderOption === 'DIFFERENT' && order.clientId) {
            fetch(`/api/contacts/${order.clientId}/prescriptions`)
                .then(res => res.json())
                .then(data => {
                    if (Array.isArray(data)) {
                        setClientPrescriptions(data);
                    }
                })
                .catch(err => console.error('Error loading client prescriptions:', err));
        }
    }, [postSaleOrderOption, order.clientId]);

    const handleImportPrescription = (rxId: string, pair: 1 | 2) => {
        const found = clientPrescriptions.find(p => p.id === rxId);
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
            notes: found.notes || '',
            imageUrl: found.imageUrl || '',
            material: pair === 1 ? rx1.material : rx2.material,
            treatment: pair === 1 ? rx1.treatment : rx2.treatment,
            color: pair === 1 ? rx1.color : rx2.color,
            diameter: pair === 1 ? rx1.diameter : rx2.diameter,
            // Preservar las medidas del armazón ya cargadas
            frameA: pair === 1 ? rx1.frameA : rx2.frameA,
            frameB: pair === 1 ? rx1.frameB : rx2.frameB,
            frameEd: pair === 1 ? rx1.frameEd : rx2.frameEd,
            framePte: pair === 1 ? rx1.framePte : rx2.framePte
        };

        if (pair === 1) setRx1(imported);
        else setRx2(imported);
    };

    const handleImageUpload = async (file: File, pair: 1 | 2) => {
        const formData = new FormData();
        formData.append('file', file);
        try {
            const res = await fetch('/api/upload', { method: 'POST', body: formData });
            if (res.ok) {
                const data = await res.json();
                if (pair === 1) {
                    setRx1((prev: any) => ({ ...prev, imageUrl: data.url }));
                    setRxUploaded1(true);
                } else {
                    setRx2((prev: any) => ({ ...prev, imageUrl: data.url }));
                    setRxUploaded2(true);
                }
            } else {
                alert('Error al subir la receta.');
            }
        } catch (e) {
            console.error('Error uploading recipe image:', e);
            alert('Error de red al subir la receta.');
        }
    };

    const handleSavePostSale = async () => {
        setIsSavingPostSale(true);
        try {
            let finalNotes = order.postSaleNotes;
            if (newNoteText.trim()) {
                const formattedDate = new Date().toLocaleDateString('es-AR', {
                    day: '2-digit',
                    month: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit'
                });
                const newEntry = `[${formattedDate}]: ${newNoteText.trim()}`;
                finalNotes = order.postSaleNotes ? `${order.postSaleNotes}\n${newEntry}` : newEntry;
            }

            const payloadRxData = {
                pair1Faulty,
                pair2Faulty,
                rxChange,
                reprocessAuthNoRx,
                rx1,
                rx2
            };

            const res = await fetch(`/api/orders/${order.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    postSaleNotes: finalNotes || null,
                    postSaleCost: postSaleCost === '' ? 0 : Number(postSaleCost),
                    postSaleResponsible: postSaleResponsible || null,
                    postSaleCaseType: postSaleCaseType || null,
                    postSaleFault: postSaleFault || null,
                    postSaleCoverage: postSaleCoverage || null,
                    postSaleOrderOption: postSaleOrderOption || null,
                    postSaleNewOrderNumber: postSaleOrderOption === 'DIFFERENT' ? (postSaleNewOrderNumber || null) : null,
                    postSaleRxData: postSaleOrderOption === 'DIFFERENT' ? JSON.stringify(payloadRxData) : null,
                }),
            });
            if (res.ok) {
                setNewNoteText('');
                if (onRefresh) onRefresh();
                alert('✓ Cambios de post venta guardados.');
            } else {
                const data = await res.json();
                alert(`⚠️ ${data.error || 'Error al guardar cambios de post venta'}`);
            }
        } catch (error) {
            console.error('Error saving post sale fields:', error);
            alert('⚠️ Error al conectar con el servidor.');
        } finally {
            setIsSavingPostSale(false);
        }
    };

    const imageUrl = resolveStorageUrl(order.prescription?.imageUrl);

    const renderRxForm = (pairRx: any, setPairRx: any, pairNum: 1 | 2) => {
        const updateField = (field: string, val: string) => {
            setPairRx((prev: any) => ({ ...prev, [field]: val }));
        };

        return (
            <div className="space-y-4 bg-stone-50 dark:bg-stone-900/35 border border-stone-200/50 dark:border-stone-800 p-4 rounded-2xl">
                <div className="flex items-center justify-between gap-2 border-b border-stone-250/20 dark:border-stone-800 pb-2 mb-2">
                    <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest flex-shrink-0">
                        Especificación del Par {pairNum}
                    </span>

                    <div className="flex items-center gap-2 min-w-0">
                        <button type="button" onClick={() => importFullOrder(pairNum)}
                            className="text-[9px] font-black uppercase tracking-wider px-2.5 py-1.5 rounded-lg border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-950/40 transition-colors flex-shrink-0"
                            title="Traer los datos completos del pedido original (graduación, material, tratamiento, color, diámetro, DNP, altura)">
                            📋 Traer pedido completo
                        </button>
                        {clientPrescriptions.length > 0 && (
                            <div className="flex items-center gap-2 min-w-0">
                                <span className="text-[9px] text-stone-400 font-bold uppercase tracking-wider flex-shrink-0">Cargar Receta:</span>
                                <select
                                    onChange={(e) => {
                                        if (e.target.value) {
                                            handleImportPrescription(e.target.value, pairNum);
                                            e.target.value = '';
                                        }
                                    }}
                                    className="text-[10px] p-1.5 rounded-lg border border-stone-200 dark:border-stone-750 bg-white dark:bg-stone-800 outline-none min-w-0"
                                >
                                    <option value="">Seleccionar...</option>
                                    {clientPrescriptions.map(p => (
                                        <option key={p.id} value={p.id}>
                                            {new Date(p.date).toLocaleDateString('es-AR')} - OD: {p.sphereOD != null ? (p.sphereOD > 0 ? '+' : '') + p.sphereOD : '0'}/{p.sphereOI != null ? (p.sphereOI > 0 ? '+' : '') + p.sphereOI : '0'}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </div>
                </div>

                {/* Grid Table for Graduation */}
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-[10px]">
                        <thead>
                            <tr className="border-b border-stone-200/50 dark:border-stone-800 text-[8px] font-black text-stone-400 dark:text-stone-500 uppercase tracking-widest">
                                <th className="pb-1.5">Ojo</th>
                                <th className="pb-1.5 text-center">Esfera</th>
                                <th className="pb-1.5 text-center">Cilindro</th>
                                <th className="pb-1.5 text-center">Eje</th>
                                <th className="pb-1.5 text-center">Adición</th>
                                <th className="pb-1.5 text-center">DNP</th>
                                <th className="pb-1.5 text-center">Altura</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr className="border-b border-stone-100 dark:border-stone-850/50">
                                <td className="py-2 font-black text-stone-700 dark:text-stone-300">OD (Der)</td>
                                <td className="py-1 px-1">
                                    <input
                                        type="text"
                                        value={pairRx.sphereOD}
                                        onChange={(e) => updateField('sphereOD', e.target.value)}
                                        placeholder="Esf"
                                        className="w-12 text-center p-1.5 border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 rounded-lg focus:outline-none"
                                    />
                                </td>
                                <td className="py-1 px-1">
                                    <input
                                        type="text"
                                        value={pairRx.cylinderOD}
                                        onChange={(e) => updateField('cylinderOD', e.target.value)}
                                        placeholder="Cil"
                                        className="w-12 text-center p-1.5 border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 rounded-lg focus:outline-none"
                                    />
                                </td>
                                <td className="py-1 px-1">
                                    <input
                                        type="text"
                                        value={pairRx.axisOD}
                                        onChange={(e) => updateField('axisOD', e.target.value)}
                                        placeholder="Eje"
                                        className="w-12 text-center p-1.5 border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 rounded-lg focus:outline-none"
                                    />
                                </td>
                                <td className="py-1 px-1">
                                    <input
                                        type="text"
                                        value={pairRx.additionOD}
                                        onChange={(e) => updateField('additionOD', e.target.value)}
                                        placeholder="Add"
                                        className="w-12 text-center p-1.5 border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 rounded-lg focus:outline-none"
                                    />
                                </td>
                                <td className="py-1 px-1">
                                    <input
                                        type="text"
                                        value={pairRx.pdOd}
                                        onChange={(e) => updateField('pdOd', e.target.value)}
                                        placeholder="DNP"
                                        className="w-12 text-center p-1.5 border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 rounded-lg focus:outline-none"
                                    />
                                </td>
                                <td className="py-1 px-1">
                                    <input
                                        type="text"
                                        value={pairRx.heightOD}
                                        onChange={(e) => updateField('heightOD', e.target.value)}
                                        placeholder="Alt"
                                        className="w-12 text-center p-1.5 border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 rounded-lg focus:outline-none"
                                    />
                                </td>
                            </tr>
                            <tr>
                                <td className="py-2 font-black text-stone-700 dark:text-stone-300">OI (Izq)</td>
                                <td className="py-1 px-1">
                                    <input
                                        type="text"
                                        value={pairRx.sphereOI}
                                        onChange={(e) => updateField('sphereOI', e.target.value)}
                                        placeholder="Esf"
                                        className="w-12 text-center p-1.5 border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 rounded-lg focus:outline-none"
                                    />
                                </td>
                                <td className="py-1 px-1">
                                    <input
                                        type="text"
                                        value={pairRx.cylinderOI}
                                        onChange={(e) => updateField('cylinderOI', e.target.value)}
                                        placeholder="Cil"
                                        className="w-12 text-center p-1.5 border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 rounded-lg focus:outline-none"
                                    />
                                </td>
                                <td className="py-1 px-1">
                                    <input
                                        type="text"
                                        value={pairRx.axisOI}
                                        onChange={(e) => updateField('axisOI', e.target.value)}
                                        placeholder="Eje"
                                        className="w-12 text-center p-1.5 border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 rounded-lg focus:outline-none"
                                    />
                                </td>
                                <td className="py-1 px-1">
                                    <input
                                        type="text"
                                        value={pairRx.additionOI}
                                        onChange={(e) => updateField('additionOI', e.target.value)}
                                        placeholder="Add"
                                        className="w-12 text-center p-1.5 border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 rounded-lg focus:outline-none"
                                    />
                                </td>
                                <td className="py-1 px-1">
                                    <input
                                        type="text"
                                        value={pairRx.pdOi}
                                        onChange={(e) => updateField('pdOi', e.target.value)}
                                        placeholder="DNP"
                                        className="w-12 text-center p-1.5 border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 rounded-lg focus:outline-none"
                                    />
                                </td>
                                <td className="py-1 px-1">
                                    <input
                                        type="text"
                                        value={pairRx.heightOI}
                                        onChange={(e) => updateField('heightOI', e.target.value)}
                                        placeholder="Alt"
                                        className="w-12 text-center p-1.5 border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 rounded-lg focus:outline-none"
                                    />
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                {/* Lab Details Fields */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2 border-t border-stone-200/50 dark:border-stone-800">
                    <div>
                        <label className="text-[8px] font-black text-stone-400 dark:text-stone-500 uppercase tracking-widest block mb-0.5">Material</label>
                        <input
                            type="text"
                            value={pairRx.material}
                            onChange={(e) => updateField('material', e.target.value)}
                            placeholder="ej. Orgánico"
                            className="w-full text-[10px] p-2 border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-amber-500"
                        />
                    </div>
                    <div>
                        <label className="text-[8px] font-black text-stone-400 dark:text-stone-500 uppercase tracking-widest block mb-0.5">Tratamiento</label>
                        <input
                            type="text"
                            value={pairRx.treatment}
                            onChange={(e) => updateField('treatment', e.target.value)}
                            placeholder="ej. Antirreflejo"
                            className="w-full text-[10px] p-2 border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-amber-500"
                        />
                    </div>
                    <div>
                        <label className="text-[8px] font-black text-stone-400 dark:text-stone-500 uppercase tracking-widest block mb-0.5">Color / Tinte</label>
                        <input
                            type="text"
                            value={pairRx.color}
                            onChange={(e) => updateField('color', e.target.value)}
                            placeholder="ej. Gris"
                            className="w-full text-[10px] p-2 border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-amber-500"
                        />
                    </div>
                    <div>
                        <label className="text-[8px] font-black text-stone-400 dark:text-stone-500 uppercase tracking-widest block mb-0.5">Diámetro</label>
                        <input
                            type="text"
                            value={pairRx.diameter}
                            onChange={(e) => updateField('diameter', e.target.value)}
                            placeholder="ej. 65"
                            className="w-full text-[10px] p-2 border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-amber-500"
                        />
                    </div>
                </div>

                {/* Medidas del Armazón — obligatorias para multifocal / monofocal de laboratorio */}
                {needsFrameMeasures && (() => {
                    const frameFields = [
                        { key: 'frameA', label: 'A' },
                        { key: 'frameB', label: 'B' },
                        { key: 'frameEd', label: 'ED' },
                        { key: 'framePte', label: 'Puente' },
                    ];
                    const frameComplete = hasFrameMeasures(pairRx);
                    return (
                        <div className={`pt-2 border-t ${frameComplete ? 'border-stone-200/50 dark:border-stone-800' : 'border-red-200 dark:border-red-900/40'}`}>
                            <label className="text-[8px] font-black text-stone-400 dark:text-stone-500 uppercase tracking-widest block mb-1">
                                Medidas del Armazón <span className="text-red-500">* obligatorio</span>
                            </label>
                            <div className="grid grid-cols-4 gap-2">
                                {frameFields.map(f => (
                                    <div key={f.key}>
                                        <label className="text-[7px] font-bold text-stone-400 uppercase block mb-0.5 text-center">{f.label}</label>
                                        <input
                                            type="text"
                                            value={pairRx[f.key] || ''}
                                            onChange={(e) => updateField(f.key, e.target.value)}
                                            className={`w-full text-center text-[10px] p-2 border bg-white dark:bg-stone-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-amber-500 dark:text-stone-200 ${!pairRx[f.key] ? 'border-red-300 dark:border-red-900/50' : 'border-stone-200 dark:border-stone-700'}`}
                                        />
                                    </div>
                                ))}
                            </div>
                            {!frameComplete && (
                                <p className="text-[9px] font-bold text-red-500 mt-1">Completá A, B, ED y Puente: este lente (multifocal o monofocal de lab) requiere las medidas del armazón.</p>
                            )}
                        </div>
                    );
                })()}

                {/* Recipe Image Attachment */}
                <div className="pt-2 border-t border-stone-200/50 dark:border-stone-800">
                    <label className="text-[8px] font-black text-stone-400 dark:text-stone-500 uppercase tracking-widest block mb-1">
                        Adjuntar Foto de Nueva Receta{rxChange && <span className="text-red-500"> * obligatorio</span>}
                    </label>
                    <div className="flex items-center gap-3">
                        <input
                            type="file"
                            accept="image/*"
                            onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                    updateField('isUploadingRx', 'true');
                                    await handleImageUpload(file, pairNum);
                                    updateField('isUploadingRx', '');
                                }
                            }}
                            className="text-[10px] text-stone-500 file:mr-4 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-[10px] file:font-black file:bg-indigo-50 dark:file:bg-indigo-950/20 file:text-indigo-600 dark:file:text-indigo-400 hover:file:bg-indigo-100 cursor-pointer"
                        />
                        {pairRx.imageUrl && (
                            <a
                                href={pairRx.imageUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[9px] font-black text-indigo-500 hover:underline uppercase tracking-widest flex items-center gap-1"
                            >
                                👁️ Ver Adjunto
                            </a>
                        )}
                        {pairRx.isUploadingRx && (
                            <span className="text-[9px] text-amber-500 font-bold animate-pulse">Subiendo...</span>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    const handleToggleAuth = async (checked: boolean) => {
        try {
            const res = await fetch(`/api/orders/${order.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ authorizedByAdmin: checked }),
            });
            if (res.ok) {
                if (onRefresh) onRefresh();
            } else {
                const data = await res.json();
                alert(`⚠️ ${data.error || 'Error al actualizar autorización'}`);
            }
        } catch (error) {
            console.error('Error toggling admin authorization:', error);
        }
    };

    return (
        <div className="border-t-2 border-stone-100 dark:border-stone-700/50 px-4 md:px-6 pb-6 pt-5 bg-stone-50/50 dark:bg-stone-900/30 animate-in slide-in-from-top-2 fade-in duration-200">
            {/* Full Screen Image Modal */}
            {fullImageOpen && imageUrl && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4 animate-in zoom-in-95 fade-in">
                    <button 
                        onClick={() => setFullImageOpen(false)}
                        className="absolute top-6 right-6 p-3 bg-white/10 hover:bg-white/20 text-white rounded-full transition-all"
                    >
                        <X className="w-6 h-6" />
                    </button>
                    <img 
                        src={imageUrl} 
                        alt="Receta médica" 
                        className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
                    />
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* 🔴 COLUMNA IZQUIERDA: SISTEMA ATELIER */}
                <div className="space-y-6">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="w-8 h-8 rounded-xl bg-stone-200 dark:bg-stone-800 flex items-center justify-center text-stone-600 dark:text-stone-300">
                            <Eye className="w-4 h-4" />
                        </div>
                        <span className="text-[11px] font-black text-stone-500 uppercase tracking-widest">Información del Pedido</span>
                    </div>

                    {/* Receta */}
                    <div className="bg-white dark:bg-stone-800 rounded-2xl border border-stone-100 dark:border-stone-700 overflow-hidden shadow-sm">
                        <div className="px-5 py-3 border-b border-stone-100 dark:border-stone-700 flex justify-between items-center bg-stone-50 dark:bg-stone-800/50">
                            <h4 className="text-[10px] font-black text-stone-500 uppercase tracking-widest flex items-center gap-2">
                                <Search className="w-3.5 h-3.5" /> Valores de Receta
                            </h4>
                        </div>
                        <div className="p-4 bg-white dark:bg-stone-800">
                            {order.prescription ? (
                                <div className="space-y-4">
                                    <table className="w-full text-xs">
                                        <thead>
                                            <tr className="text-[8px] font-black text-stone-400 uppercase tracking-widest border-b border-stone-100 dark:border-stone-700/50">
                                                <th className="text-left py-2">Ojo</th>
                                                <th className="text-center py-2">Esf</th>
                                                <th className="text-center py-2">Cil</th>
                                                <th className="text-center py-2">Eje</th>
                                                <th className="text-center py-2">Add</th>
                                                <th className="text-center py-2 border-l border-stone-100 dark:border-stone-700/50 pl-2 text-emerald-500">DNP</th>
                                                <th className="text-center py-2 text-teal-500">Alt</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <tr className="border-b border-stone-50 dark:border-stone-800/50">
                                                <td className="py-2.5 font-black text-stone-800 dark:text-stone-200">OD</td>
                                                <td className="py-2.5 text-center font-bold text-stone-600 dark:text-stone-400">{order.prescription.sphereOD != null ? (order.prescription.sphereOD > 0 ? '+' : '') + order.prescription.sphereOD.toFixed(2) : '—'}</td>
                                                <td className="py-2.5 text-center font-bold text-stone-600 dark:text-stone-400">{order.prescription.cylinderOD != null ? order.prescription.cylinderOD.toFixed(2) : '—'}</td>
                                                <td className="py-2.5 text-center font-bold text-stone-600 dark:text-stone-400">{order.prescription.axisOD != null ? order.prescription.axisOD + '°' : '—'}</td>
                                                <td className="py-2.5 text-center font-bold text-stone-600 dark:text-stone-400">{order.prescription.additionOD != null ? '+' + order.prescription.additionOD.toFixed(2) : (order.prescription.addition != null ? '+' + order.prescription.addition.toFixed(2) : '—')}</td>
                                                <td className="py-2.5 text-center font-bold text-emerald-600 border-l border-stone-100 dark:border-stone-700/50 pl-2">{order.prescription.distanceOD != null ? order.prescription.distanceOD : (order.labPdOd || '—')}</td>
                                                <td className="py-2.5 text-center font-bold text-teal-600">{order.prescription.heightOD != null ? order.prescription.heightOD : '—'}</td>
                                            </tr>
                                            <tr>
                                                <td className="py-2.5 font-black text-stone-800 dark:text-stone-200">OI</td>
                                                <td className="py-2.5 text-center font-bold text-stone-600 dark:text-stone-400">{order.prescription.sphereOI != null ? (order.prescription.sphereOI > 0 ? '+' : '') + order.prescription.sphereOI.toFixed(2) : '—'}</td>
                                                <td className="py-2.5 text-center font-bold text-stone-600 dark:text-stone-400">{order.prescription.cylinderOI != null ? order.prescription.cylinderOI.toFixed(2) : '—'}</td>
                                                <td className="py-2.5 text-center font-bold text-stone-600 dark:text-stone-400">{order.prescription.axisOI != null ? order.prescription.axisOI + '°' : '—'}</td>
                                                <td className="py-2.5 text-center font-bold text-stone-600 dark:text-stone-400">{order.prescription.additionOI != null ? '+' + order.prescription.additionOI.toFixed(2) : (order.prescription.addition != null ? '+' + order.prescription.addition.toFixed(2) : '—')}</td>
                                                <td className="py-2.5 text-center font-bold text-emerald-600 border-l border-stone-100 dark:border-stone-700/50 pl-2">{order.prescription.distanceOI != null ? order.prescription.distanceOI : (order.labPdOi || '—')}</td>
                                                <td className="py-2.5 text-center font-bold text-teal-600">{order.prescription.heightOI != null ? order.prescription.heightOI : '—'}</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <p className="text-xs text-stone-400 italic text-center py-4">Sin receta cargada</p>
                            )}
                        </div>

                        {/* Imágen de Receta */}
                        {imageUrl && (
                            <div className="border-t border-stone-100 dark:border-stone-700 bg-stone-50/50 dark:bg-stone-900/50 p-4 flex flex-col items-center justify-center">
                                <span className="text-[9px] font-black text-stone-400 uppercase tracking-widest mb-3 block w-full text-left">Foto de la Receta Médica</span>
                                <div 
                                    className="relative group cursor-pointer w-full max-w-sm rounded-xl overflow-hidden border-2 border-stone-200 dark:border-stone-700 shadow-sm transition-all hover:border-indigo-400 hover:shadow-indigo-500/20 hover:shadow-lg"
                                    onClick={() => setFullImageOpen(true)}
                                >
                                    <div className="aspect-[4/3] w-full bg-white dark:bg-black">
                                        <img 
                                            src={imageUrl} 
                                            alt="Receta" 
                                            className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity"
                                        />
                                    </div>
                                    <div className="absolute inset-0 bg-indigo-900/0 group-hover:bg-indigo-900/20 transition-all flex items-center justify-center">
                                        <div className="opacity-0 group-hover:opacity-100 bg-white/90 dark:bg-black/80 p-3 rounded-full shadow-xl transform scale-75 group-hover:scale-100 transition-all duration-300 backdrop-blur-sm">
                                            <Maximize2 className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Productos */}
                    <div className="bg-white dark:bg-stone-800 rounded-2xl border border-stone-100 dark:border-stone-700 overflow-hidden shadow-sm">
                        <div className="px-5 py-3 border-b border-stone-100 dark:border-stone-700 flex justify-between items-center bg-stone-50 dark:bg-stone-800/50">
                            <h4 className="text-[10px] font-black text-stone-500 uppercase tracking-widest">Productos</h4>
                        </div>
                        <table className="w-full">
                            <tbody>
                                {order.items.map(item => (
                                    <tr key={item.id} className="border-b border-stone-50 dark:border-stone-700/50 last:border-0">
                                        <td className="px-5 py-3 text-sm font-bold text-stone-800 dark:text-white">
                                            {item.product?.brand || item.productBrandSnapshot || '—'} · {item.product?.name || item.productNameSnapshot || '—'}
                                        </td>
                                        <td className="px-5 py-3 text-xs text-stone-500">
                                            {item.product?.type || item.product?.category || item.productCategorySnapshot || '—'}
                                        </td>
                                        <td className="px-5 py-3 text-sm font-bold text-stone-600 dark:text-stone-300 text-center">
                                            {item.quantity}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        
                        {/* Frame Info */}
                        {order.frameSource && (
                            <div className="px-5 py-3 bg-amber-50 dark:bg-amber-950/20 border-t border-amber-100 dark:border-amber-900/50">
                                <div className="flex items-center gap-3">
                                    <span className="text-lg">🕶️</span>
                                    <div>
                                        <p className="text-[8px] font-black text-amber-700 dark:text-amber-500 uppercase tracking-widest">Armazón provisto</p>
                                        <p className="text-xs font-bold text-amber-900 dark:text-amber-300 mt-0.5">
                                            {order.frameSource === 'OPTICA'
                                                ? 'De la óptica (incluido en el pedido)'
                                                : `Del cliente — ${order.userFrameBrand || ''} ${order.userFrameModel || ''}${order.userFrameNotes ? ' · ' + order.userFrameNotes : ''}`
                                            }
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Control de Pago y Autorización */}
                    <div className="bg-white dark:bg-stone-800 rounded-2xl border border-stone-100 dark:border-stone-700 p-5 shadow-sm space-y-4">
                        <div className="flex justify-between items-center">
                            <span className="text-[10px] font-black text-stone-500 uppercase tracking-widest block">Cobertura de Seña</span>
                            <span className="text-[9px] font-bold text-stone-400 italic">Mínimo para enviar: 50%</span>
                        </div>
                        
                        <div className="flex items-center gap-3">
                            <div className="flex-1">
                                <div className="h-2 bg-stone-100 dark:bg-stone-900 rounded-full overflow-hidden border border-stone-200 dark:border-stone-700">
                                    <div 
                                        className={`h-full transition-all duration-700 ${order.paid >= (order.total * 0.5) || order.authorizedByAdmin ? 'bg-emerald-500' : 'bg-amber-500'}`} 
                                        style={{ width: `${Math.min((order.paid / (order.total || 1)) * 100, 100)}%` }} 
                                    />
                                </div>
                                <div className="flex justify-between text-[10px] font-bold mt-1 text-stone-500">
                                    <span>Pagado: ${order.paid.toLocaleString()}</span>
                                    <span>Total: ${order.total.toLocaleString()}</span>
                                </div>
                            </div>
                        </div>

                        {order.paid < (order.total * 0.5) ? (
                            <div className="space-y-3">
                                {order.authorizedByAdmin ? (
                                    <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center gap-2">
                                        <span className="text-emerald-500 text-sm">✓</span>
                                        <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">
                                            Autorizado por Administrador
                                        </span>
                                    </div>
                                ) : (
                                    <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center gap-2">
                                        <span className="text-amber-500 text-sm">⚠️</span>
                                        <span className="text-[10px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-widest">
                                            Seña menor al 50% - Envío Bloqueado
                                        </span>
                                    </div>
                                )}

                                {userRole === 'ADMIN' ? (
                                    <div className="flex items-center gap-3 p-3 bg-stone-50 dark:bg-stone-900/50 border border-stone-200 dark:border-stone-700 rounded-xl">
                                        <input 
                                            type="checkbox" 
                                            id={`auth-check-${order.id}`}
                                            checked={order.authorizedByAdmin || false}
                                            onChange={(e) => handleToggleAuth(e.target.checked)}
                                            className="w-4 h-4 text-indigo-600 border-stone-300 rounded focus:ring-indigo-500 cursor-pointer"
                                        />
                                        <label htmlFor={`auth-check-${order.id}`} className="text-xs font-black text-stone-600 dark:text-stone-300 uppercase tracking-widest cursor-pointer select-none">
                                            Autorizar envío con menos del 50%
                                        </label>
                                    </div>
                                ) : (
                                    !order.authorizedByAdmin && (
                                        <p className="text-[9px] font-bold text-stone-400 italic text-center">
                                            Solo un administrador puede autorizar este envío.
                                        </p>
                                    )
                                )}
                            </div>
                        ) : (
                            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center gap-2">
                                <span className="text-emerald-500 text-sm">✓</span>
                                <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">
                                    Pago cubre el 50% mínimo
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Lab Measurements and Details */}
                    {(order.frameA || order.frameB || order.frameDbl || order.frameEdc || order.labColor || order.labTreatment || order.labFrameShape || order.labFrameDetails || order.labNotes) && (
                        <div className="bg-white dark:bg-stone-800 rounded-2xl border border-stone-100 dark:border-stone-700 overflow-hidden shadow-sm">
                            <div className="px-5 py-3 border-b border-stone-100 dark:border-stone-700 bg-stone-50 dark:bg-stone-800/50">
                                <h4 className="text-[10px] font-black text-stone-500 uppercase tracking-widest flex items-center gap-2">
                                    <FlaskConical className="w-3.5 h-3.5" /> Detalles de Laboratorio
                                </h4>
                            </div>
                            <div className="p-4 grid grid-cols-2 gap-4">
                                {order.labFrameShape && (
                                    <div>
                                        <p className="text-[8px] font-black text-stone-400 uppercase tracking-widest">Forma / Aro</p>
                                        <p className="text-xs font-bold text-stone-800 dark:text-stone-200 mt-1 uppercase">{order.labFrameShape}</p>
                                    </div>
                                )}
                                {(order.frameA || order.frameB || order.frameEdc || order.frameDbl) && (
                                    <div>
                                        <p className="text-[8px] font-black text-stone-400 uppercase tracking-widest">Medidas del Armazón</p>
                                        <p className="text-xs font-bold text-stone-800 dark:text-stone-200 mt-1">
                                            {order.frameA && `A: ${order.frameA} `}
                                            {order.frameB && `B: ${order.frameB} `}
                                            {order.frameEdc && `ED: ${order.frameEdc} `}
                                            {order.frameDbl && `Pte: ${order.frameDbl}`}
                                        </p>
                                    </div>
                                )}
                                {(order.labTreatment || order.labColor) && (
                                    <div className="col-span-2">
                                        <p className="text-[8px] font-black text-stone-400 uppercase tracking-widest">Tratamiento / Teñido</p>
                                        <p className="text-xs font-bold text-stone-800 dark:text-stone-200 mt-1">
                                            {order.labTreatment && `${order.labTreatment} `}
                                            {order.labColor && `- ${order.labColor}`}
                                        </p>
                                    </div>
                                )}
                                {order.labFrameDetails && (
                                    <div className="col-span-2">
                                        <p className="text-[8px] font-black text-stone-400 uppercase tracking-widest">Detalles del Armazón</p>
                                        <p className="text-xs font-bold text-stone-800 dark:text-stone-200 mt-1">{order.labFrameDetails}</p>
                                    </div>
                                )}
                                {order.labFrameShape2 && (
                                    <div>
                                        <p className="text-[8px] font-black text-orange-500 uppercase tracking-widest">Forma / Aro (Par 2)</p>
                                        <p className="text-xs font-bold text-stone-800 dark:text-stone-200 mt-1 uppercase">{order.labFrameShape2}</p>
                                    </div>
                                )}
                                {(order.frameA2 || order.frameB2 || order.frameEdc2 || order.frameDbl2) && (
                                    <div>
                                        <p className="text-[8px] font-black text-orange-500 uppercase tracking-widest">Medidas (Par 2)</p>
                                        <p className="text-xs font-bold text-stone-800 dark:text-stone-200 mt-1">
                                            {order.frameA2 && `A: ${order.frameA2} `}
                                            {order.frameB2 && `B: ${order.frameB2} `}
                                            {order.frameEdc2 && `ED: ${order.frameEdc2} `}
                                            {order.frameDbl2 && `Pte: ${order.frameDbl2}`}
                                        </p>
                                    </div>
                                )}
                                {order.labFrameDetails2 && (
                                    <div className="col-span-2 border-t border-dashed border-stone-100 dark:border-stone-700/50 pt-2 mt-1">
                                        <p className="text-[8px] font-black text-orange-500 uppercase tracking-widest">Detalles del Armazón (Par 2)</p>
                                        <p className="text-xs font-bold text-stone-800 dark:text-stone-200 mt-1">{order.labFrameDetails2}</p>
                                    </div>
                                )}
                                {order.labNotes && (
                                    <div className="col-span-2">
                                        <p className="text-[8px] font-black text-stone-400 uppercase tracking-widest">Observaciones Lab</p>
                                        <p className="text-xs font-bold text-stone-800 dark:text-stone-200 mt-1">{order.labNotes}</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Financials (If present) */}
                    {financials && (
                        <div className="p-5 rounded-2xl bg-stone-900 dark:bg-black text-white flex justify-between items-center shadow-md">
                            <div className="flex gap-6">
                                <div>
                                    <span className="text-[7px] font-black text-emerald-400 uppercase tracking-widest block mb-1">Efectivo</span>
                                    <span className="text-lg font-black text-emerald-400">${financials.totalCash.toLocaleString()}</span>
                                </div>
                                <div>
                                    <span className="text-[7px] font-black text-purple-400 uppercase tracking-widest block mb-1">Transferencia</span>
                                    <span className="text-lg font-black text-purple-400">${financials.totalTransfer.toLocaleString()}</span>
                                </div>
                                <div>
                                    <span className="text-[7px] font-black text-orange-400 uppercase tracking-widest block mb-1">Tarjeta</span>
                                    <span className="text-lg font-black text-orange-400">${financials.totalCard.toLocaleString()}</span>
                                </div>
                            </div>
                            <div className="text-right border-l border-stone-800 pl-6">
                                <span className="text-[8px] font-black text-stone-400 uppercase tracking-widest block mb-1">Abonado Real</span>
                                <span className="text-2xl font-black text-amber-400">${financials.paidReal.toLocaleString()}</span>
                            </div>
                        </div>
                    )}
                </div>

                {/* 🔵 COLUMNA DERECHA: LABORATORIO SMARTLAB */}
                <div className="space-y-6">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-xl bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                                <FlaskConical className="w-4 h-4" />
                            </div>
                            <span className="text-[11px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">Estado en Laboratorio</span>
                        </div>
                        
                        {onAutoSubmit && (() => {
                            const is2x1 = order.appliedPromoName?.toLowerCase().includes('2x1') || order.items?.some((it: any) => {
                                const str = `${it.product?.name || ''} ${it.productNameSnapshot || ''}`.toLowerCase();
                                return str.includes('2x1');
                            });
                            return is2x1 ? (
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => onAutoSubmit(order, 1)}
                                        disabled={isAutoSubmitting}
                                        className="px-2.5 py-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white rounded-lg text-[9px] font-black flex items-center gap-1 transition-all shadow-md disabled:opacity-50"
                                        title="Copiar Par 1 y abrir SmartLab"
                                    >
                                        {isAutoSubmitting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Package className="w-3 h-3" />}
                                        <span>Par 1</span>
                                    </button>
                                    <button
                                        onClick={() => onAutoSubmit(order, 2)}
                                        disabled={isAutoSubmitting}
                                        className="px-2.5 py-1.5 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white rounded-lg text-[9px] font-black flex items-center gap-1 transition-all shadow-md disabled:opacity-50"
                                        title="Copiar Par 2 (Bonificado) y abrir SmartLab"
                                    >
                                        {isAutoSubmitting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Package className="w-3 h-3" />}
                                        <span>Par 2</span>
                                    </button>
                                </div>
                            ) : (
                                <button
                                    onClick={() => onAutoSubmit(order, 1)}
                                    disabled={isAutoSubmitting}
                                    className="px-3 py-1.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-[9px] font-black flex items-center gap-2 transition-all shadow-md disabled:opacity-50"
                                >
                                    {isAutoSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Package className="w-3.5 h-3.5" />}
                                    {isAutoSubmitting ? 'Copiando...' : 'Autocompletar Form'}
                                </button>
                            );
                        })()}
                    </div>

                    {/* Progress Pipeline */}
                    <div className="bg-white dark:bg-stone-800 rounded-2xl border border-stone-100 dark:border-stone-700 p-5 shadow-sm">
                        <h4 className="text-[9px] font-black text-stone-400 uppercase tracking-widest mb-4">Línea de Tiempo</h4>
                        <div className="flex flex-col gap-2">
                            {LAB_STEPS.map((s, i) => {
                                const currentIdx = LAB_STEPS.findIndex(x => x.key === (order.labStatus || 'NONE'));
                                const isPast = i <= currentIdx;
                                const isCurrent = i === currentIdx;
                                const SIcon = s.icon;
                                
                                return (
                                    <div key={s.key} className="flex items-center gap-3">
                                        <div className="flex flex-col items-center">
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                                                isCurrent ? `${s.bg} ${s.text} ring-4 ${s.ring} z-10` : 
                                                isPast ? `${s.bg} ${s.text} opacity-60` : 
                                                'bg-stone-100 dark:bg-stone-800 text-stone-300 dark:text-stone-600'
                                            }`}>
                                                <SIcon className="w-3.5 h-3.5" />
                                            </div>
                                            {i < LAB_STEPS.length - 1 && (
                                                <div className={`w-0.5 h-4 my-1 ${isPast ? 'bg-indigo-200 dark:bg-indigo-900/50' : 'bg-stone-100 dark:bg-stone-800'}`} />
                                            )}
                                        </div>
                                        <div className={`flex-1 pb-4 ${isCurrent ? 'font-black' : 'font-bold'} ${isPast ? 'text-stone-800 dark:text-stone-200' : 'text-stone-400'}`}>
                                            <span className="text-sm">{s.label}</span>
                                            {isCurrent && s.key === 'FINISHED' && (
                                                <p className="text-[10px] text-fuchsia-500 font-bold mt-1">Esperando recepción física en local.</p>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* SmartLab Live Status */}
                    {!isOptovision && (
                        <div className="bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-950/30 dark:to-blue-950/30 rounded-2xl border border-indigo-100 dark:border-indigo-900/50 p-5 shadow-sm">
                            <div className="flex items-center justify-between mb-4">
                                <h4 className="text-[10px] font-black text-indigo-500 uppercase tracking-widest flex items-center gap-1.5">
                                    <Activity className="w-3.5 h-3.5" /> SmartLab Digital Tracker
                                </h4>
                                {order.labOrderNumber && (
                                    <span className="bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300 px-2 py-1 rounded text-[9px] font-black uppercase tracking-wider">
                                        OP: {order.labOrderNumber}
                                    </span>
                                )}
                            </div>

                            {order.smartLabProgress != null ? (
                                <div className="space-y-5">
                                    {/* Progress Bar */}
                                    <div>
                                        <div className="flex justify-between text-[10px] font-black mb-2 uppercase tracking-widest">
                                            <span className="text-indigo-600 dark:text-indigo-400">Progreso de Fabricación</span>
                                            <span className={order.smartLabProgress === 100 ? 'text-emerald-500' : 'text-indigo-500'}>{order.smartLabProgress}%</span>
                                        </div>
                                        <div className="h-3 w-full bg-indigo-100 dark:bg-indigo-950/50 rounded-full overflow-hidden">
                                            <div 
                                                className={`h-full transition-all duration-1000 ${order.smartLabProgress === 100 ? 'bg-emerald-500' : 'bg-indigo-500'}`}
                                                style={{ width: `${order.smartLabProgress}%` }}
                                            />
                                        </div>
                                    </div>

                                    {/* Stats Grid */}
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="bg-white/60 dark:bg-black/20 p-3 rounded-xl border border-indigo-50 dark:border-indigo-900/30">
                                            <Layers className="w-4 h-4 text-indigo-400 mb-2" />
                                            <p className="text-[8px] font-black text-stone-400 uppercase tracking-widest">Sector Actual</p>
                                            <p className="text-xs font-bold text-stone-800 dark:text-stone-200 truncate mt-0.5" title={order.smartLabSector || 'Desconocido'}>
                                                {order.smartLabSector || '—'}
                                            </p>
                                        </div>
                                        <div className="bg-white/60 dark:bg-black/20 p-3 rounded-xl border border-indigo-50 dark:border-indigo-900/30">
                                            <Calendar className="w-4 h-4 text-indigo-400 mb-2" />
                                            <p className="text-[8px] font-black text-stone-400 uppercase tracking-widest">Días en Lab</p>
                                            <p className="text-xs font-bold text-stone-800 dark:text-stone-200 mt-0.5">
                                                {order.smartLabDays != null ? `${order.smartLabDays} días` : '—'}
                                            </p>
                                        </div>
                                    </div>

                                    {order.smartLabEntryDate && (
                                        <p className="text-[9px] text-stone-500 text-center font-medium">
                                            Ingresado: {order.smartLabEntryDate}
                                        </p>
                                    )}
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-6 text-center">
                                    <div className="w-10 h-10 rounded-full bg-indigo-100/50 dark:bg-indigo-900/30 flex items-center justify-center mb-3">
                                        <Activity className="w-4 h-4 text-indigo-300 dark:text-indigo-700" />
                                    </div>
                                    <p className="text-xs text-stone-400 max-w-[200px]">Sin datos de fabricación sincronizados todavía.</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Post Venta Form — only after sent to factory */}
                    {order.orderType === 'SALE' && (order.labStatus && order.labStatus !== 'NONE' || order.postSaleNotes || (order.postSaleCost ?? 0) > 0 || order.postSaleOrderOption) && (
                        <div className={showPostSaleForm ? "bg-white dark:bg-stone-850 rounded-2xl border border-stone-100 dark:border-stone-700/50 p-5 shadow-sm space-y-4" : ""}>
                            <button
                                onClick={() => setShowPostSaleForm(!showPostSaleForm)}
                                className={showPostSaleForm
                                    ? "w-full flex items-center justify-between gap-2 mb-2 pb-2 border-b border-stone-100 dark:border-stone-700/50"
                                    : "w-full flex items-center justify-between gap-2 px-4 py-3 bg-white dark:bg-stone-850 rounded-2xl border border-stone-100 dark:border-stone-700/50 shadow-sm hover:bg-amber-50/50 dark:hover:bg-amber-950/20 transition-all"}
                            >
                                <span className="text-[10px] font-black text-amber-600 dark:text-amber-500 uppercase tracking-widest">
                                    Servicio de Post Venta
                                </span>
                                {showPostSaleForm
                                    ? <ChevronUp className="w-4 h-4 text-amber-500" />
                                    : <ChevronRight className="w-4 h-4 text-amber-500" />}
                            </button>

                            {showPostSaleForm && (
                            <div className="space-y-3">
                                <div>
                                    {/* Timeline de notas */}
                                    <div className="bg-stone-50 dark:bg-stone-900/40 rounded-xl p-3 border border-stone-200/50 dark:border-stone-800 space-y-2 max-h-[150px] overflow-y-auto custom-scrollbar mb-3">
                                        <p className="text-[7.5px] font-black text-stone-400 dark:text-stone-500 uppercase tracking-widest border-b border-stone-200/20 pb-1">
                                            Historial de Observaciones
                                        </p>
                                        {(() => {
                                            const lines = order.postSaleNotes
                                                ? order.postSaleNotes.split('\n').filter((l: string) => l.trim() !== '')
                                                : [];
                                            if (lines.length === 0) {
                                                return <p className="text-[10px] text-stone-400 italic">Sin observaciones registradas.</p>;
                                            }
                                            return (
                                                <div className="space-y-2 text-[10px] leading-relaxed">
                                                    {lines.map((line: string, i: number) => {
                                                        const match = line.match(/^\[(.*?)\]:\s*(.*)$/);
                                                        if (match) {
                                                            return (
                                                                <div key={i} className="flex flex-col text-stone-600 dark:text-stone-300">
                                                                    <span className="text-[7.5px] font-black text-amber-600 dark:text-amber-500">{match[1]}</span>
                                                                    <span className="font-semibold">{match[2]}</span>
                                                                </div>
                                                            );
                                                        }
                                                        return (
                                                            <div key={i} className="text-stone-500 dark:text-stone-400 font-semibold">
                                                                {line}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            );
                                        })()}
                                    </div>

                                    <label className="text-[8px] font-black text-stone-400 dark:text-stone-500 uppercase tracking-widest block mb-1">
                                        Agregar Nueva Observación / Actualización
                                    </label>
                                    <textarea
                                        rows={2}
                                        value={newNoteText}
                                        onChange={(e) => setNewNoteText(e.target.value)}
                                        placeholder="Escribir un comentario o actualización de estado de garantía..."
                                        className="w-full text-xs p-2.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 placeholder-stone-400 transition-all resize-none dark:text-stone-200"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-[8px] font-black text-stone-400 dark:text-stone-500 uppercase tracking-widest block mb-1">
                                            Costo Adicional ($)
                                        </label>
                                        <input
                                            type="number"
                                            value={postSaleCost}
                                            onChange={(e) => setPostSaleCost(e.target.value === '' ? '' : Number(e.target.value))}
                                            placeholder="0"
                                            className="w-full text-xs p-2.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 placeholder-stone-400 transition-all dark:text-stone-200"
                                        />
                                    </div>

                                    <div>
                                        <label className="text-[8px] font-black text-stone-400 dark:text-stone-500 uppercase tracking-widest block mb-1">
                                            Responsable
                                        </label>
                                        <select
                                            value={postSaleResponsible}
                                            onChange={(e) => setPostSaleResponsible(e.target.value)}
                                            className="w-full text-xs p-2.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all dark:text-stone-200"
                                        >
                                            <option value="">Sin definir</option>
                                            {POST_SALE_RESPONSIBLES.map(r => (
                                                <option key={r} value={r}>{r}</option>
                                            ))}
                                            {/* Preserva un valor viejo que no esté en la lista actual */}
                                            {postSaleResponsible && !(POST_SALE_RESPONSIBLES as readonly string[]).includes(postSaleResponsible) && (
                                                <option value={postSaleResponsible}>{postSaleResponsible} (histórico)</option>
                                            )}
                                        </select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-[8px] font-black text-stone-400 dark:text-stone-500 uppercase tracking-widest block mb-1">
                                            Cobertura
                                        </label>
                                        <select
                                            value={postSaleCoverage}
                                            onChange={(e) => setPostSaleCoverage(e.target.value)}
                                            className={`w-full text-xs p-2.5 rounded-xl border bg-stone-50 dark:bg-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all dark:text-stone-200 ${postSaleCoverage === 'Con cargo' ? 'border-amber-300 dark:border-amber-800' : postSaleCoverage === 'Sin cargo' ? 'border-emerald-300 dark:border-emerald-800' : 'border-stone-200 dark:border-stone-700'}`}
                                        >
                                            <option value="">Sin definir</option>
                                            {POST_SALE_COVERAGE.map(c => (
                                                <option key={c} value={c}>{c}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <label className="text-[8px] font-black text-stone-400 dark:text-stone-500 uppercase tracking-widest block mb-1">
                                        Tipo de caso
                                    </label>
                                    <select
                                        value={postSaleCaseType}
                                        onChange={(e) => setPostSaleCaseType(e.target.value)}
                                        className="w-full text-xs p-2.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all dark:text-stone-200"
                                    >
                                        <option value="">Sin clasificar</option>
                                        {POST_SALE_CASE_TYPES.map(t => (
                                            <option key={t} value={t}>{t}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="text-[8px] font-black text-stone-400 dark:text-stone-500 uppercase tracking-widest block mb-1">
                                        ¿Requiere procesar en laboratorio?
                                    </label>
                                    <select
                                        value={postSaleOrderOption}
                                        onChange={(e) => setPostSaleOrderOption(e.target.value)}
                                        className="w-full text-xs p-2.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all dark:text-stone-200"
                                    >
                                        <option value="">No requiere / No aplica</option>
                                        <option value="SAME">Mismo número de pedido ({order.labOrderNumber || 'Sin número'})</option>
                                        <option value="DIFFERENT">Número de pedido diferente</option>
                                    </select>
                                </div>

                                {postSaleOrderOption === 'DIFFERENT' && (
                                    <div className="space-y-4 pt-2 border-t border-stone-150 dark:border-stone-850">
                                        <div>
                                            <label className="text-[8px] font-black text-stone-400 dark:text-stone-500 uppercase tracking-widest block mb-1">
                                                Nuevo Número de Pedido / OP
                                            </label>
                                            <input
                                                type="text"
                                                value={postSaleNewOrderNumber}
                                                onChange={(e) => setPostSaleNewOrderNumber(e.target.value)}
                                                placeholder="Ingresar nuevo número de OP en lab..."
                                                className="w-full text-xs p-2.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 placeholder-stone-400 transition-all dark:text-stone-200"
                                            />
                                        </div>

                                        {/* Pair Selectors */}
                                        <div className="flex gap-4 p-2 bg-stone-50/50 dark:bg-stone-900/30 rounded-xl border border-stone-200/50 dark:border-stone-850">
                                            <label className="flex items-center gap-2 text-xs font-bold text-stone-700 dark:text-stone-300 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={pair1Faulty}
                                                    onChange={(e) => setPair1Faulty(e.target.checked)}
                                                    className="rounded border-stone-300 text-amber-500 focus:ring-amber-500"
                                                />
                                                <span>Re-hacer Par 1</span>
                                            </label>
                                            {hasSecondPair && (
                                                <label className="flex items-center gap-2 text-xs font-bold text-stone-700 dark:text-stone-300 cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        checked={pair2Faulty}
                                                        onChange={(e) => setPair2Faulty(e.target.checked)}
                                                        className="rounded border-stone-300 text-amber-500 focus:ring-amber-500"
                                                    />
                                                    <span>Re-hacer Par 2</span>
                                                </label>
                                            )}
                                        </div>

                                        {/* Motivo: cambio de receta → obliga a subir la nueva receta */}
                                        <label className="flex items-start gap-2 text-xs font-bold text-stone-700 dark:text-stone-300 cursor-pointer px-1">
                                            <input
                                                type="checkbox"
                                                checked={rxChange}
                                                onChange={(e) => setRxChange(e.target.checked)}
                                                className="rounded border-stone-300 text-amber-500 focus:ring-amber-500 mt-0.5 flex-shrink-0"
                                            />
                                            <span>Es por <b>cambio de receta</b> <span className="text-amber-600 dark:text-amber-500 font-semibold">(obligatorio adjuntar la nueva receta de cada par a rehacer)</span></span>
                                        </label>

                                        {/* Prescription Forms */}
                                        {pair1Faulty && renderRxForm(rx1, setRx1, 1)}
                                        {hasSecondPair && pair2Faulty && renderRxForm(rx2, setRx2, 2)}

                                        {rxChange && ((pair1Faulty && !rxUploaded1) || (hasSecondPair && pair2Faulty && !rxUploaded2)) && (
                                            <div className={`space-y-2 border rounded-xl p-3 ${reprocessAuthNoRx ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/40' : 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900/40'}`}>
                                                {reprocessAuthNoRx ? (
                                                    <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 leading-snug">
                                                        ✓ Reproceso sin receta autorizado por administrador. Se puede cargar, pero sin la receta no corresponde envío sin cargo.
                                                    </p>
                                                ) : (
                                                    <p className="text-[10px] font-bold text-red-600 dark:text-red-400 leading-snug">
                                                        ⚠️ Sin la nueva receta no se puede enviar el reproceso sin cargo. Adjuntá la nueva receta (campo &ldquo;Adjuntar Foto de Nueva Receta&rdquo;) de cada par a rehacer, o pedile a un administrador que autorice el reproceso del pedido.
                                                    </p>
                                                )}
                                                {isReprocessAdmin ? (
                                                    <label className="flex items-start gap-2 text-[10px] font-bold text-stone-700 dark:text-stone-300 cursor-pointer">
                                                        <input
                                                            type="checkbox"
                                                            checked={reprocessAuthNoRx}
                                                            onChange={(e) => setReprocessAuthNoRx(e.target.checked)}
                                                            className="rounded border-stone-300 text-emerald-500 focus:ring-emerald-500 mt-0.5 flex-shrink-0"
                                                        />
                                                        <span>Autorizo el reproceso sin la nueva receta (como administrador).</span>
                                                    </label>
                                                ) : !reprocessAuthNoRx && (
                                                    <p className="text-[10px] font-semibold text-red-500/80 italic">Solo un administrador puede autorizar el reproceso sin receta.</p>
                                                )}
                                            </div>
                                        )}

                                        {/* Dynamic SmartLab Buttons from Post-Venta form */}
                                        <div className="flex gap-2">
                                            {pair1Faulty && onAutoSubmit && (
                                                <button
                                                    onClick={() => onAutoSubmit(order, 1)}
                                                    disabled={isAutoSubmitting || (rxChange && !rxUploaded1 && !reprocessAuthNoRx) || (needsFrameMeasures && !hasFrameMeasures(rx1))}
                                                    className="flex-1 py-2 bg-gradient-to-r from-amber-500 to-amber-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-1 shadow-md hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                                                    title={needsFrameMeasures && !hasFrameMeasures(rx1) ? 'Faltan las medidas del armazón del Par 1 (A, B, ED, Puente)' : (rxChange && !rxUploaded1 && !reprocessAuthNoRx ? 'Falta la nueva receta del Par 1 o la autorización del administrador' : 'Cargar Par 1 en SmartLab con nuevos datos')}
                                                >
                                                    {isAutoSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FlaskConical className="w-3.5 h-3.5" />}
                                                    <span>Cargar Par 1</span>
                                                </button>
                                            )}
                                            {hasSecondPair && pair2Faulty && onAutoSubmit && (
                                                <button
                                                    onClick={() => onAutoSubmit(order, 2)}
                                                    disabled={isAutoSubmitting || (rxChange && !rxUploaded2 && !reprocessAuthNoRx) || (needsFrameMeasures && !hasFrameMeasures(rx2))}
                                                    className="flex-1 py-2 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-1 shadow-md hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                                                    title={needsFrameMeasures && !hasFrameMeasures(rx2) ? 'Faltan las medidas del armazón del Par 2 (A, B, ED, Puente)' : (rxChange && !rxUploaded2 && !reprocessAuthNoRx ? 'Falta la nueva receta del Par 2 o la autorización del administrador' : 'Cargar Par 2 en SmartLab con nuevos datos')}
                                                >
                                                    {isAutoSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FlaskConical className="w-3.5 h-3.5" />}
                                                    <span>Cargar Par 2</span>
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                )}

                                <button
                                    onClick={handleSavePostSale}
                                    disabled={isSavingPostSale}
                                    className="w-full py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2"
                                >
                                    {isSavingPostSale ? (
                                        <>
                                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                            Guardando...
                                        </>
                                    ) : (
                                        'Guardar Registro'
                                    )}
                                </button>
                            </div>
                            )}
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
}
