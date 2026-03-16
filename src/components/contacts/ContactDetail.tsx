'use client';

import React from 'react';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
    X, Heart, Star, Phone, MapPin, Building2,
    History, FileText, Calculator, Plus, Minus,
    Save, Calendar, Clock, ChevronRight,
    Search, User, Mail, Tag, ArrowRight,
    CheckCircle2, AlertCircle, Share2, Pencil, Download,
    CreditCard, Banknote, Receipt, Image as ImageIcon, Eye as EyeIcon,
    MessageCircle, Glasses, Layers, Check, Lock, Shield,
    TrendingUp, ArrowRightLeft
} from 'lucide-react';
import { Contact, Interaction, Prescription, Order } from '@/types/contacts';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface ContactDetailProps {
    contactId: string;
    onClose: () => void;
    onEdit: (initialData: any) => void;
    onToggleFavorite: (id: string) => Promise<boolean>;
    onUpdatePriority: (id: string, stars: number) => Promise<boolean>;
    onAddInteraction: (id: string, type: string, content: string) => Promise<boolean>;
    onAddTask: (id: string, description: string, dueDate?: string) => Promise<boolean>;
    onUpdateTaskStatus: (id: string, taskId: string, status: string) => Promise<boolean>;
    onAddPrescription: (id: string, data: any) => Promise<boolean>;
    onUpdatePrescription: (clientId: string, presId: string, data: any) => Promise<boolean>;
    onDeletePrescription: (clientId: string, presId: string) => Promise<boolean>;
    onAddPayment: (clientId: string, data: any) => Promise<boolean>;
    onCheckCanClose: (id: string) => Promise<{ canClose: boolean; reason?: string; isLabWarning?: boolean }>;
    onStatusChange: (id: string, status: string, userRole?: string) => Promise<boolean>;
    onDeleteOrder: (orderId: string, reason: string, role?: string) => Promise<boolean>;
}

import Tesseract from 'tesseract.js';

export default function ContactDetail({
    contactId,
    onClose,
    onEdit,
    onToggleFavorite,
    onUpdatePriority,
    onAddInteraction,
    onAddTask,
    onUpdateTaskStatus,
    onAddPrescription,
    onUpdatePrescription,
    onDeletePrescription,
    onAddPayment,
    onCheckCanClose,
    onStatusChange,
    onDeleteOrder
}: ContactDetailProps) {
    const [contact, setContact] = useState<Contact | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeSection, setActiveSection] = useState<'history' | 'tasks' | 'prescription' | 'budget' | 'sales'>('history');
    const [newNote, setNewNote] = useState('');
    const [newTask, setNewTask] = useState('');
    const [taskDueDate, setTaskDueDate] = useState('');
    const router = useRouter();

    // Prescription State
    const [isAddingPrescription, setIsAddingPrescription] = useState(false);
    const [editingPresId, setEditingPresId] = useState<string | null>(null);
    const [isScanning, setIsScanning] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [scanProgress, setScanProgress] = useState(0);
    const [presData, setPresData] = useState({
        sphereOD: '', cylinderOD: '', axisOD: '',
        sphereOI: '', cylinderOI: '', axisOI: '',
        addition: '', additionOD: '', additionOI: '',
        pd: '', distanceOD: '', distanceOI: '',
        heightOD: '', heightOI: '',
        notes: '', imageUrl: '',
        prescriptionType: 'ADDITION' as 'ADDITION' | 'NEAR',
        nearSphereOD: '', nearSphereOI: '',
        nearCylinderOD: '', nearAxisOD: '',
        nearCylinderOI: '', nearAxisOI: ''
    });

    // Payment State
    const [isAddingPayment, setIsAddingPayment] = useState<string | null>(null);
    const [paymentAmount, setPaymentAmount] = useState('');
    const [paymentMethod, setPaymentMethod] = useState('EFECTIVO');
    const [paymentNotes, setPaymentNotes] = useState('');
    const [paymentReceiptUrl, setPaymentReceiptUrl] = useState('');
    const [viewingReceipt, setViewingReceipt] = useState<string | null>(null);
    const [savingPayment, setSavingPayment] = useState(false);
    const [paymentWarning, setPaymentWarning] = useState<string | null>(null);
    const [validationError, setValidationError] = useState<string | null>(null);

    // Payment Methods
    const PAYMENT_METHODS = [
        { key: 'PAY_WAY_6_ISH', label: 'Pay Way 6 Ish', icon: CreditCard, color: 'bg-blue-500' },
        { key: 'PAY_WAY_3_ISH', label: 'Pay Way 3 Ish', icon: CreditCard, color: 'bg-blue-400' },
        { key: 'NARANJA_Z_ISH', label: 'Naranja Z Ish', icon: CreditCard, color: 'bg-orange-500' },
        { key: 'PAY_WAY_6_YANI', label: 'Pay Way 6 Yani', icon: CreditCard, color: 'bg-indigo-500' },
        { key: 'PAY_WAY_3_YANI', label: 'Pay Way 3 Yani', icon: CreditCard, color: 'bg-indigo-400' },
        { key: 'NARANJA_Z_YANI', label: 'Naranja Z Yani', icon: CreditCard, color: 'bg-orange-400' },
        { key: 'GO_CUOTAS', label: 'Go Cuotas', icon: CreditCard, color: 'bg-violet-500' },
        { key: 'EFECTIVO', label: 'Efectivo', icon: Banknote, color: 'bg-emerald-500' },
    ];

    const getPaymentLabel = (method: string) => {
        return PAYMENT_METHODS.find(m => m.key === method)?.label || method;
    };

    // Currency formatting helper
    const formatCurrency = (value: string | number): string => {
        const num = typeof value === 'string' ? Number(value.replace(/\D/g, '')) : value;
        if (isNaN(num) || num === 0) return '';
        return '$' + num.toLocaleString('es-AR');
    };

    const handlePaymentAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const raw = e.target.value.replace(/\D/g, '');
        setPaymentAmount(raw);
    };

    // Order Deletion State
    const [isDeletingOrder, setIsDeletingOrder] = useState<string | null>(null);
    const [deletionReason, setDeletionReason] = useState('');

    // Inline Cotizador State
    const [isQuoting, setIsQuoting] = useState(false);
    const [availableProducts, setAvailableProducts] = useState<any[]>([]);
    const [quoteSearch, setQuoteSearch] = useState('');
    const [quoteItems, setQuoteItems] = useState<{ product: any; quantity: number; price: number; eye?: 'OD' | 'OI' }[]>([]);
    const [quoteMarkup, setQuoteMarkup] = useState(0);
    const [quoteDiscountCash, setQuoteDiscountCash] = useState(20);
    const [quoteDiscountTransfer, setQuoteDiscountTransfer] = useState(15);
    const [quoteDiscountCard, setQuoteDiscountCard] = useState(0);
    const [savingQuote, setSavingQuote] = useState(false);

    // Frame State for inline cotizador
    const [quoteFrameSource, setQuoteFrameSource] = useState<'OPTICA' | 'USUARIO' | null>(null);
    const [quoteUserFrame, setQuoteUserFrame] = useState({ brand: '', model: '', notes: '' });
    // Presupuesto - Receta state
    const [quotePrescriptionId, setQuotePrescriptionId] = useState<string | null>(null);

    // Ventas / Tab State
    const [quoteFrameSearch, setQuoteFrameSearch] = useState('');
    const [convertError, setConvertError] = useState<string | null>(null);

    // Expanded order cards (only one expanded at a time)
    const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
    // Price refresh state
    const [priceChanges, setPriceChanges] = useState<{ itemId: string; productName: string; oldPrice: number; newPrice: number }[] | null>(null);
    const [refreshingPrices, setRefreshingPrices] = useState(false);
    const [pendingConvertOrderId, setPendingConvertOrderId] = useState<string | null>(null);

    // Role Simulation (Until full auth is implemented)
    const [currentUserRole, setCurrentUserRole] = useState<'ADMIN' | 'STAFF'>('STAFF');

    useEffect(() => {
        fetchContact();
    }, [contactId]);

    const fetchContact = async () => {
        try {
            const res = await fetch(`/api/contacts/${contactId}`);
            const data = await res.json();
            setContact(data);
        } catch (error) {
            console.error('Error fetching detail:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleAddNote = async () => {
        if (!newNote.trim()) return;
        const success = await onAddInteraction(contactId, 'NOTE', newNote);
        if (success) {
            setNewNote('');
            fetchContact();
        }
    };

    const handleAddTask = async () => {
        if (!newTask.trim()) return;
        const success = await onAddTask(contactId, newTask, taskDueDate);
        if (success) {
            setNewTask('');
            setTaskDueDate('');
            fetchContact();
        }
    };

    const handleToggleTask = async (taskId: string, currentStatus: string) => {
        const newStatus = currentStatus === 'PENDING' ? 'COMPLETED' : 'PENDING';
        const success = await onUpdateTaskStatus(contactId, taskId, newStatus);
        if (success) {
            fetchContact();
        }
    };

    const transposePrescription = (sphere: string, cylinder: string, axis: string) => {
        const s = parseFloat(sphere) || 0;
        const c = parseFloat(cylinder) || 0;
        let a = parseInt(axis) || 0;

        if (c > 0) {
            const newSphere = (s + c).toFixed(2);
            const newCylinder = (-c).toFixed(2);
            let newAxis = (a + 90) % 180;
            if (newAxis === 0) newAxis = 180;
            return {
                sphere: newSphere.startsWith('-') ? newSphere : `+${newSphere}`,
                cylinder: newCylinder,
                axis: newAxis.toString()
            };
        }
        return { sphere, cylinder, axis };
    };

    const handleSavePrescription = async () => {
        setIsSaving(true);
        try {
            // Auto-transpose if needed before saving (Service also handles it, but we can do it here too)
            const od = transposePrescription(presData.sphereOD, presData.cylinderOD, presData.axisOD);
            const oi = transposePrescription(presData.sphereOI, presData.cylinderOI, presData.axisOI);

            const dataToSave = {
                ...presData,
                sphereOD: od.sphere,
                cylinderOD: od.cylinder,
                axisOD: od.axis,
                sphereOI: oi.sphere,
                cylinderOI: oi.cylinder,
                axisOI: oi.axis
            };

            const success = editingPresId
                ? await onUpdatePrescription(contactId, editingPresId, dataToSave)
                : await onAddPrescription(contactId, dataToSave);

            if (success) {
                setIsAddingPrescription(false);
                setEditingPresId(null);
                setPresData({
                    sphereOD: '', cylinderOD: '', axisOD: '',
                    sphereOI: '', cylinderOI: '', axisOI: '',
                    addition: '', additionOD: '', additionOI: '',
                    pd: '', distanceOD: '', distanceOI: '',
                    heightOD: '', heightOI: '',
                    notes: '', imageUrl: '',
                    prescriptionType: 'ADDITION',
                    nearSphereOD: '', nearSphereOI: '',
                    nearCylinderOD: '', nearAxisOD: '',
                    nearCylinderOI: '', nearAxisOI: ''
                });
                fetchContact();
            }
        } finally {
            setIsSaving(false);
        }
    };

    const handleEditPrescription = (pres: any) => {
        setPresData({
            sphereOD: pres.sphereOD?.toString() || '',
            cylinderOD: pres.cylinderOD?.toString() || '',
            axisOD: pres.axisOD?.toString() || '',
            sphereOI: pres.sphereOI?.toString() || '',
            cylinderOI: pres.cylinderOI?.toString() || '',
            axisOI: pres.axisOI?.toString() || '',
            addition: pres.addition?.toString() || '',
            additionOD: pres.additionOD?.toString() || '',
            additionOI: pres.additionOI?.toString() || '',
            pd: pres.pd?.toString() || '',
            distanceOD: pres.distanceOD?.toString() || '',
            distanceOI: pres.distanceOI?.toString() || '',
            heightOD: pres.heightOD?.toString() || '',
            heightOI: pres.heightOI?.toString() || '',
            notes: pres.notes || '',
            imageUrl: pres.imageUrl || '',
            prescriptionType: pres.prescriptionType || 'ADDITION',
            nearSphereOD: pres.nearSphereOD?.toString() || '',
            nearSphereOI: pres.nearSphereOI?.toString() || '',
            nearCylinderOD: pres.nearCylinderOD?.toString() || '',
            nearAxisOD: pres.nearAxisOD?.toString() || '',
            nearCylinderOI: pres.nearCylinderOI?.toString() || '',
            nearAxisOI: pres.nearAxisOI?.toString() || ''
        });
        setEditingPresId(pres.id);
        setIsAddingPrescription(true);
        // Scroll to form? (Assuming it's at the top of the section)
    };

    const handleDeletePrescription = async (presId: string) => {
        if (!confirm('¿Estás seguro de eliminar esta graduación?')) return;
        const success = await onDeletePrescription(contactId, presId);
        if (success) fetchContact();
    };

    const handleAddPayment = async () => {
        const lastOrder = contact?.orders?.find(o => o.id === isAddingPayment) || contact?.orders?.[0];
        if (!lastOrder) return;

        const amount = Number(paymentAmount.replace(/\D/g, ''));
        if (!amount || amount <= 0) return;

        const pendingBalance = (lastOrder.total || 0) - (lastOrder.paid || 0);
        if (amount > pendingBalance && pendingBalance > 0 && !paymentWarning) {
            setPaymentWarning(`El monto ($${amount.toLocaleString('es-AR')}) supera el saldo pendiente de $${pendingBalance.toLocaleString('es-AR')}. Presioná de nuevo para confirmar.`);
            return;
        }

        setSavingPayment(true);
        try {
            const success = await onAddPayment(contactId, {
                orderId: lastOrder.id,
                amount,
                method: paymentMethod,
                notes: paymentNotes,
                receiptUrl: paymentReceiptUrl || undefined
            });

            if (success) {
                setIsAddingPayment(null);
                setPaymentAmount('');
                setPaymentMethod('EFECTIVO');
                setPaymentNotes('');
                setPaymentReceiptUrl('');
                setPaymentWarning(null);
                fetchContact();
            }
        } finally {
            setSavingPayment(false);
        }
    };

    const handlePaymentReceiptUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const compressed = await compressImage(file);
        setPaymentReceiptUrl(compressed);
    };

    const downloadPaidReceipt = (order: any) => {
        const dateStr = new Date(order.createdAt).toLocaleDateString('es-AR', { year: 'numeric', month: 'long', day: 'numeric' });
        const payments = order.payments || [];
        const logoUrl = `${window.location.origin}/assets/logo-atelier-optica.png`;
        const paymentLabelMap: Record<string, string> = {
            PAY_WAY_6_ISH: 'Pay Way 6 Ish', PAY_WAY_3_ISH: 'Pay Way 3 Ish', NARANJA_Z_ISH: 'Naranja Z Ish',
            PAY_WAY_6_YANI: 'Pay Way 6 Yani', PAY_WAY_3_YANI: 'Pay Way 3 Yani', NARANJA_Z_YANI: 'Naranja Z Yani',
            GO_CUOTAS: 'Go Cuotas',
            EFECTIVO: 'Efectivo', CASH: 'Efectivo', DEBIT: 'Débito', CREDIT: 'Crédito', TRANSFER: 'Transferencia',
        };
        const html = `<!DOCTYPE html><html><head><meta charset='utf-8'>
<title>Comprobante de Pago - ${contact?.name}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800;900&display=swap');
  * { margin:0; padding:0; box-sizing:border-box; font-family:'Inter',sans-serif; }
  body { padding:40px 50px; color:#1c1917; line-height:1.5; }
  .letterhead { display:flex; justify-content:space-between; align-items:center; padding-bottom:20px; margin-bottom:8px; border-bottom:3px solid #1c1917; }
  .letterhead-left { display:flex; align-items:center; gap:16px; }
  .letterhead-logo { height:52px; }
  .letterhead-right { text-align:right; font-size:10px; color:#78716c; line-height:1.6; }
  .letterhead-right .address { font-weight:600; color:#57534e; }
  .tagline { text-align:center; font-size:9px; font-weight:800; text-transform:uppercase; letter-spacing:3px; color:#a0845e; padding:10px 0 20px; }
  .meta-row { display:flex; justify-content:space-between; align-items:center; margin-bottom:24px; }
  .meta-row .doc-id { font-size:13px; font-weight:900; color:#16a34a; }
  .meta-row .doc-date { font-size:11px; color:#78716c; }
  .client { background:#fafaf9; border:1px solid #e7e5e4; border-radius:12px; padding:16px 20px; margin-bottom:28px; }
  .client-label { font-size:9px; font-weight:800; text-transform:uppercase; letter-spacing:2px; color:#a8a29e; }
  .client-name { font-size:18px; font-weight:900; color:#1c1917; margin-top:2px; }
  table { width:100%; border-collapse:collapse; margin-bottom:24px; }
  th { background:#1c1917; color:white; font-size:9px; font-weight:800; text-transform:uppercase; letter-spacing:2px; padding:12px 16px; text-align:left; }
  th:last-child, td:last-child { text-align:right; }
  td { padding:12px 16px; font-size:13px; border-bottom:1px solid #f5f5f4; }
  .paid-badge { background:#dcfce7; color:#16a34a; padding:12px 24px; border-radius:16px; text-align:center; font-size:22px; font-weight:900; text-transform:uppercase; letter-spacing:4px; margin:24px 0; }
  .totals { display:flex; justify-content:flex-end; }
  .totals-box { background:#fafaf9; border:2px solid #e7e5e4; border-radius:16px; padding:20px 28px; min-width:260px; }
  .total-row { display:flex; justify-content:space-between; font-size:13px; margin-bottom:6px; color:#57534e; }
  .total-row.final { font-size:22px; font-weight:900; color:#1c1917; border-top:2px solid #1c1917; padding-top:10px; margin-top:8px; }
  .footer { margin-top:48px; padding-top:20px; border-top:1px solid #e7e5e4; font-size:10px; color:#a8a29e; text-align:center; text-transform:uppercase; letter-spacing:2px; }
  @media print { body { padding: 20px; } }
</style></head><body>
<div class='letterhead'>
  <div class='letterhead-left'>
    <img src='${logoUrl}' class='letterhead-logo' alt='Atelier Óptica' />
  </div>
  <div class='letterhead-right'>
    <div class='address'>José Luis de Tejeda 4380</div>
    <div>Cerro de las Rosas, Córdoba</div>
  </div>
</div>
<div class='tagline'>La óptica mejor calificada en Google Business ⭐ 5/5</div>
<div class='meta-row'>
  <span class='doc-id'>✓ CUENTA SALDADA — Comprobante #${order.id.slice(-4).toUpperCase()}</span>
  <span class='doc-date'>${dateStr}</span>
</div>
<div class='client'>
  <div class='client-label'>Cliente</div>
  <div class='client-name'>${contact?.name || ''}</div>
</div>
<div class='paid-badge'>✓ Pagado en su Totalidad</div>
<h3 style="font-size:10px; font-weight:800; text-transform:uppercase; letter-spacing:2px; color:#a8a29e; margin-bottom:12px;">Detalle de Pagos</h3>
<table>
  <thead><tr><th>Fecha</th><th>Método</th><th>Nota</th><th>Monto</th></tr></thead>
  <tbody>${payments.map((p: any) => `<tr><td>${new Date(p.date).toLocaleDateString('es-AR')}</td><td style='font-weight:700'>${paymentLabelMap[p.method] || p.method}</td><td>${p.notes || '—'}</td><td style='font-weight:900'>$${p.amount?.toLocaleString()}</td></tr>`).join('')}</tbody>
</table>
<div class='totals'><div class='totals-box'>
  <div class='total-row'><span>Total Pedido</span><span>$${(order.total || 0).toLocaleString()}</span></div>
  <div class='total-row'><span>Total Pagado</span><span>$${(order.paid || 0).toLocaleString()}</span></div>
  <div class='total-row final'><span>Saldo</span><span>$0</span></div>
</div></div>
<div class='footer'>Comprobante de pago — Atelier Óptica · José Luis de Tejeda 4380, Córdoba · ${new Date().toLocaleDateString('es-AR')}</div>
</body></html>`;
        const printWindow = window.open('', '_blank', 'width=800,height=900');
        if (printWindow) {
            printWindow.document.write(html);
            printWindow.document.close();
            setTimeout(() => printWindow.print(), 400);
        }
    };

    const handleCloseSale = async () => {
        setValidationError(null);
        const validation = await onCheckCanClose(contactId);

        if (!validation.canClose) {
            setValidationError(validation.reason || 'No se cumplen los requisitos');
            return;
        }

        const success = await onStatusChange(contactId, 'CLIENT', currentUserRole);
        if (success) {
            fetchContact();
        }
    };

    const handleDeleteOrder = async () => {
        if (!isDeletingOrder || !deletionReason.trim()) return;
        const success = await onDeleteOrder(isDeletingOrder, deletionReason, currentUserRole);
        if (success) {
            setIsDeletingOrder(null);
            setDeletionReason('');
            fetchContact();
        }
    };

    const handleRevertStatus = async () => {
        const success = await onStatusChange(contactId, 'CONTACT', currentUserRole);
        if (success) {
            fetchContact();
        }
    };

    const compressImage = (file: File): Promise<string> => {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target?.result as string;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let width = img.width;
                    let height = img.height;
                    const MAX_SIZE = 1200;

                    if (width > height) {
                        if (width > MAX_SIZE) {
                            height *= MAX_SIZE / width;
                            width = MAX_SIZE;
                        }
                    } else {
                        if (height > MAX_SIZE) {
                            width *= MAX_SIZE / height;
                            height = MAX_SIZE;
                        }
                    }

                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx?.drawImage(img, 0, 0, width, height);
                    resolve(canvas.toDataURL('image/jpeg', 0.7));
                };
            };
        });
    };

    const handleScanImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsScanning(true);
        setScanProgress(0);

        try {
            const compressedBase64 = await compressImage(file);
            setPresData(prev => ({ ...prev, imageUrl: compressedBase64 }));

            try {
                const result = await (Tesseract as any).recognize(
                    compressedBase64,
                    'eng+spa',
                    {
                        logger: (m: any) => {
                            if (m.status === 'recognizing text') {
                                setScanProgress(Math.floor(m.progress * 100));
                            }
                        }
                    }
                );

                const text = result.data.text.toUpperCase();
                console.log('Detected text:', text);

                // Extracción mejorada por secciones (OD / OI)
                const extractNumbers = (sectionText: string) => {
                    return sectionText.match(/[+-]?\d+\.\d+|[+-]?\d+/g) || [];
                };

                const odMatch = text.match(/O[DO]([\s\S]*?)(?=O[I]|ADD|$)/);
                const oiMatch = text.match(/O[I]([\s\S]*?)(?=ADD|$)/);

                const odNums = odMatch ? extractNumbers(odMatch[0]) : extractNumbers(text).slice(0, 3);
                const oiNums = oiMatch ? extractNumbers(oiMatch[0]) : extractNumbers(text).slice(3, 6);

                if (odNums.length > 0 || oiNums.length > 0) {
                    setPresData(prev => ({
                        ...prev,
                        sphereOD: odNums[0] || prev.sphereOD,
                        cylinderOD: odNums[1] || prev.cylinderOD,
                        axisOD: odNums[2] || prev.axisOD,
                        sphereOI: oiNums[0] || prev.sphereOI,
                        cylinderOI: oiNums[1] || prev.cylinderOI,
                        axisOI: oiNums[2] || prev.axisOI
                    }));
                }
            } catch (ocrErr) {
                console.error('OCR Processing Error:', ocrErr);
            } finally {
                setIsScanning(false);
                setScanProgress(0);
            }
        } catch (err) {
            console.error('Image Processing Error:', err);
            setIsScanning(false);
        }
    };

    if (loading) return (
        <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-xl z-[60] flex items-center justify-center">
            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        </div>
    );

    if (!contact) return null;

    return (
        <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-md z-[60] flex justify-end animate-in fade-in duration-300">
            <div className="bg-white dark:bg-stone-900 w-full max-w-5xl h-full shadow-2xl flex flex-col border-l border-stone-200 dark:border-stone-800 animate-in slide-in-from-right duration-500">

                {/* Header Premium */}
                <header className="p-5 pb-0 border-b border-stone-100 dark:border-stone-800 bg-stone-50/50 dark:bg-stone-800/30 shrink-0">
                    <div className="flex justify-between items-start mb-3">
                        <div className="flex items-center gap-6">
                            <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center text-primary border-2 border-primary/20 shrink-0">
                                <User className="w-7 h-7" />
                            </div>
                            <div>
                                <div className="flex items-center gap-3 mb-1">
                                    <h2 className="text-2xl font-black text-stone-800 dark:text-stone-100 tracking-tighter">{contact.name}</h2>
                                    <div className="flex gap-0.5">
                                        <button
                                            onClick={() => onToggleFavorite(contact.id)}
                                            className={`p-1.5 rounded-lg transition-all ${contact.isFavorite ? 'bg-red-50 text-red-500 shadow-sm border border-red-100' : 'text-stone-300 hover:text-red-400 border border-transparent'}`}
                                        >
                                            <Heart className={`w-5 h-5 ${contact.isFavorite ? 'fill-current' : ''}`} />
                                        </button>

                                        <button
                                            onClick={() => onEdit(contact)}
                                            className="p-1.5 rounded-lg text-stone-300 hover:text-primary hover:bg-stone-50 transition-all"
                                            title="Editar datos"
                                        >
                                            <Pencil className="w-5 h-5" />
                                        </button>

                                        <button
                                            onClick={() => {
                                                onClose();
                                                router.push(`/cotizador?clientName=${encodeURIComponent(contact.name)}`);
                                            }}
                                            className="p-1.5 rounded-lg text-stone-300 hover:text-emerald-500 hover:bg-emerald-50 transition-all"
                                            title="Crear cotización"
                                        >
                                            <Calculator className="w-5 h-5" />
                                        </button>

                                        <div className={`flex items-center px-3 py-1 rounded-xl border text-[10px] font-black uppercase tracking-widest ${contact.status === 'CONTACT' ? 'bg-stone-100 text-stone-500 border-stone-200' :
                                            contact.status === 'CONFIRMED' ? 'bg-emerald-100 text-emerald-600 border-emerald-200' :
                                                'bg-indigo-100 text-indigo-600 border-indigo-200'
                                            }`}>
                                            {contact.status}
                                        </div>

                                        {/* Role Switcher for Testing */}
                                        <button
                                            onClick={() => setCurrentUserRole(prev => prev === 'ADMIN' ? 'STAFF' : 'ADMIN')}
                                            className={`flex items-center px-3 py-1 rounded-xl border text-[8px] font-black uppercase tracking-widest transition-all ${currentUserRole === 'ADMIN' ? 'bg-purple-100 text-purple-600 border-purple-200' : 'bg-stone-50 text-stone-400 border-stone-100'
                                                }`}
                                        >
                                            Rol: {currentUserRole}
                                        </button>

                                        {contact.status === 'CONFIRMED' && (
                                            <button
                                                onClick={handleRevertStatus}
                                                className="px-3 py-1 bg-amber-50 text-amber-600 border border-amber-200 rounded-xl text-[8px] font-black uppercase tracking-widest hover:bg-amber-100"
                                            >
                                                Retroceder
                                            </button>
                                        )}
                                    </div>
                                </div>

                                <div className="flex flex-wrap items-center gap-3">
                                    <a href={`tel:${contact.phone}`} className="flex items-center gap-1.5 text-primary font-black text-xs uppercase tracking-widest hover:underline">
                                        <Phone className="w-4 h-4" /> {contact.phone || 'Sin número'}
                                    </a>
                                    {contact.email && (
                                        <a href={`mailto:${contact.email}`} className="flex items-center gap-1.5 text-stone-500 font-bold text-xs lowercase tracking-tight hover:text-primary">
                                            <Mail className="w-4 h-4" /> {contact.email}
                                        </a>
                                    )}
                                    {contact.dni && (
                                        <div className="flex items-center gap-1.5 text-stone-400 font-black text-[10px] uppercase tracking-widest">
                                            <FileText className="w-3.5 h-3.5" /> DNI: {contact.dni}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="flex gap-1 bg-white dark:bg-stone-900 p-1.5 rounded-xl border border-stone-200 dark:border-stone-700 shadow-sm font-bold text-[10px] uppercase tracking-widest text-stone-400">
                                <div className="mr-1.5 border-r border-stone-200 dark:border-stone-700 pr-1.5">Prioridad</div>
                                {[1, 2, 3, 4, 5].map(star => (
                                    <button
                                        key={star}
                                        onClick={() => onUpdatePriority(contact.id, star)}
                                        className="transition-transform hover:scale-125 focus:outline-none"
                                    >
                                        <Star className={`w-4 h-4 ${star <= contact.priority ? 'fill-primary text-primary' : 'text-stone-200 dark:text-stone-800'}`} />
                                    </button>
                                ))}
                            </div>
                            <button onClick={onClose} className="p-3 bg-white dark:bg-stone-900 hover:bg-stone-50 rounded-xl transition-all border border-stone-200 dark:border-stone-700 shadow-sm group">
                                <X className="w-5 h-5 text-stone-400 group-hover:text-stone-800 dark:group-hover:text-stone-100" />
                            </button>
                        </div>
                    </div>

                    {/* Quick Info Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-6 gap-2 mb-4 mt-1">
                        <div className="bg-white dark:bg-stone-900/50 p-2.5 rounded-xl border border-stone-100 dark:border-stone-800 shadow-sm">
                            <span className="text-[8px] font-black text-stone-400 uppercase tracking-[0.2em] block mb-0.5">DNI / Documento</span>
                            <div className="flex items-center gap-1.5">
                                <FileText className="w-3 h-3 text-primary" />
                                <span className="text-[11px] font-bold text-stone-700 dark:text-stone-300 truncate">{contact.dni || 'No registrado'}</span>
                            </div>
                        </div>
                        <div className="bg-white dark:bg-stone-900/50 p-2.5 rounded-xl border border-stone-100 dark:border-stone-800 shadow-sm">
                            <span className="text-[8px] font-black text-stone-400 uppercase tracking-[0.2em] block mb-0.5">Dirección</span>
                            <div className="flex items-center gap-1.5">
                                <MapPin className="w-3 h-3 text-primary" />
                                <span className="text-[11px] font-bold text-stone-700 dark:text-stone-300 capitalize truncate">{contact.address || 'No registrada'}</span>
                            </div>
                        </div>
                        <div className="bg-white dark:bg-stone-900/50 p-2.5 rounded-xl border border-stone-100 dark:border-stone-800 shadow-sm">
                            <span className="text-[8px] font-black text-stone-400 uppercase tracking-[0.2em] block mb-0.5">Obra Social</span>
                            <div className="flex items-center gap-1.5">
                                <Building2 className="w-3 h-3 text-primary" />
                                <span className="text-[11px] font-bold text-stone-700 dark:text-stone-300 uppercase tracking-tighter truncate">{contact.insurance || 'Sin Obra Social'}</span>
                            </div>
                        </div>
                        <div className="bg-white dark:bg-stone-900/50 p-2.5 rounded-xl border border-stone-100 dark:border-stone-800 shadow-sm">
                            <span className="text-[8px] font-black text-stone-400 uppercase tracking-[0.2em] block mb-0.5">Origen</span>
                            <div className="flex items-center gap-1.5">
                                <Share2 className="w-3 h-3 text-primary" />
                                <span className="text-[11px] font-bold text-stone-700 dark:text-stone-300 truncate">{contact.contactSource || 'No especificado'}</span>
                            </div>
                        </div>
                        <div className="bg-white dark:bg-stone-900/50 p-2.5 rounded-xl border border-stone-100 dark:border-stone-800 shadow-sm">
                            <span className="text-[8px] font-black text-stone-400 uppercase tracking-[0.2em] block mb-0.5">Interés</span>
                            <div className="flex items-center gap-1.5">
                                <Tag className="w-3 h-3 text-primary" />
                                <span className="text-[11px] font-bold text-stone-700 dark:text-stone-300 truncate">{contact.interest || 'General'}</span>
                            </div>
                        </div>
                        <div className="bg-white dark:bg-stone-900/50 p-2.5 rounded-xl border border-stone-100 dark:border-stone-800 shadow-sm">
                            <span className="text-[8px] font-black text-stone-400 uppercase tracking-[0.2em] block mb-0.5">Presupuesto Est.</span>
                            <div className="flex items-center gap-1.5">
                                <Calculator className="w-3 h-3 text-primary" />
                                <span className="text-[11px] font-black text-stone-800 dark:text-stone-100 tracking-tighter truncate">
                                    ${contact.expectedValue?.toLocaleString()}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Navigation Tabs */}
                    <nav className="flex gap-2 pb-3">
                        {[
                            { id: 'history', label: 'Historial', icon: History },
                            { id: 'tasks', label: 'Tareas', icon: CheckCircle2 },
                            { id: 'prescription', label: 'Receta / Clínica', icon: FileText },
                            { id: 'budget', label: 'Presupuestos', icon: Calculator },
                            { id: 'sales', label: 'Ventas', icon: Receipt }
                        ].map(tab => {
                            const Icon = tab.icon;
                            const isActive = activeSection === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveSection(tab.id as any)}
                                    className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${isActive
                                        ? 'bg-stone-900 text-white dark:bg-primary dark:text-primary-foreground shadow-lg'
                                        : 'bg-white dark:bg-stone-800 text-stone-400 hover:text-stone-600 border border-stone-200 dark:border-stone-700'
                                        }`}
                                >
                                    <Icon className="w-4 h-4" />
                                    {tab.label}
                                </button>
                            );
                        })}
                    </nav>
                </header>

                <main className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                    {/* Sección: HISTORIAL */}
                    {activeSection === 'history' && (
                        <div className="space-y-8 animate-in fade-in duration-300">
                            {/* Input para nueva nota */}
                            <div className="bg-stone-50 dark:bg-stone-800/30 p-6 rounded-[2rem] border border-stone-100 dark:border-stone-800">
                                <label className="text-[10px] font-black uppercase tracking-widest text-stone-500 ml-1 mb-2 block">Nueva anotación</label>
                                <div className="flex gap-3">
                                    <textarea
                                        value={newNote}
                                        onChange={(e) => setNewNote(e.target.value)}
                                        placeholder="Registra una llamada, consulta o detalle..."
                                        className="flex-1 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-2xl p-4 text-sm font-medium outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all min-h-[100px]"
                                    />
                                    <button
                                        onClick={handleAddNote}
                                        className="bg-stone-900 text-white dark:bg-primary dark:text-primary-foreground px-6 rounded-2xl hover:scale-105 active:scale-95 transition-all flex flex-col items-center justify-center gap-2 shadow-xl"
                                    >
                                        <Plus className="w-6 h-6" />
                                        <span className="text-[9px] font-black">GUARDAR</span>
                                    </button>
                                </div>
                            </div>

                            {/* Timeline Items */}
                            <div className="space-y-6 relative ml-4 border-l-2 border-stone-100 dark:border-stone-800 pl-8">
                                {contact.interactions?.map((item) => (
                                    <div key={item.id} className="relative">
                                        <div className="absolute -left-[45px] top-4 w-8 h-8 bg-white dark:bg-stone-900 border-2 border-primary/30 rounded-full flex items-center justify-center shadow-sm">
                                            <Clock className="w-4 h-4 text-primary" />
                                        </div>
                                        <div className="bg-white dark:bg-stone-800/50 border border-stone-200/50 dark:border-stone-700/50 p-5 rounded-3xl shadow-sm hover:shadow-md transition-shadow">
                                            <div className="flex justify-between items-start mb-2">
                                                <span className="text-[10px] font-black text-primary uppercase tracking-tighter">Nota de Seguimiento</span>
                                                <span className="text-[10px] font-bold text-stone-400">
                                                    {format(new Date(item.createdAt), "d 'de' MMMM, HH:mm", { locale: es })}
                                                </span>
                                            </div>
                                            <p className="text-sm font-medium text-stone-700 dark:text-stone-300 leading-relaxed italic">
                                                "{item.content}"
                                            </p>
                                        </div>
                                    </div>
                                ))}
                                {(!contact.interactions || contact.interactions.length === 0) && (
                                    <div className="text-center py-12 border-2 border-dashed border-stone-100 dark:border-stone-800 rounded-[3rem]">
                                        <History className="w-12 h-12 text-stone-200 mx-auto mb-4" />
                                        <p className="text-xs font-black text-stone-300 uppercase tracking-widest">Sin historial registrado aún</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Sección: TAREAS ✅ */}
                    {activeSection === 'tasks' && (
                        <div className="space-y-8 animate-in fade-in duration-300">
                            {/* Input para nueva tarea */}
                            <div className="bg-stone-50 dark:bg-stone-800/30 p-6 rounded-[2rem] border border-stone-100 dark:border-stone-800">
                                <label className="text-[10px] font-black uppercase tracking-widest text-stone-500 ml-1 mb-2 block">Nueva tarea pendiente</label>
                                <div className="flex gap-3">
                                    <div className="flex-1 space-y-3">
                                        <input
                                            type="text"
                                            value={newTask}
                                            onChange={(e) => setNewTask(e.target.value)}
                                            placeholder="¿Qué falta hacer con este contacto?"
                                            onKeyDown={(e) => e.key === 'Enter' && handleAddTask()}
                                            className="w-full bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-2xl p-4 text-sm font-bold outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all"
                                        />
                                        <div className="flex items-center gap-4">
                                            <div className="flex items-center gap-2 text-xs font-bold text-stone-400">
                                                <Calendar className="w-3.5 h-3.5" />
                                                <span>Recordatorio opcional:</span>
                                                <input
                                                    type="date"
                                                    value={taskDueDate}
                                                    min={new Date().toISOString().split('T')[0]}
                                                    onChange={(e) => setTaskDueDate(e.target.value)}
                                                    className="bg-transparent border-none outline-none text-primary"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                    <button
                                        onClick={handleAddTask}
                                        className="bg-emerald-500 text-white px-8 rounded-2xl hover:scale-105 active:scale-95 transition-all flex flex-col items-center justify-center gap-2 shadow-xl shadow-emerald-500/20"
                                    >
                                        <Plus className="w-6 h-6" />
                                        <span className="text-[9px] font-black uppercase">AGREGAR</span>
                                    </button>
                                </div>
                            </div>

                            {/* Task List */}
                            <div className="space-y-3">
                                {contact.tasks?.map((task: any) => (
                                    <div
                                        key={task.id}
                                        className={`group bg-white dark:bg-stone-800 border ${task.status === 'COMPLETED' ? 'border-emerald-100 dark:border-emerald-900/30 bg-emerald-50/20' : 'border-stone-200 dark:border-stone-700'} p-5 rounded-3xl flex items-center justify-between transition-all hover:shadow-xl`}
                                    >
                                        <div className="flex items-center gap-4">
                                            <button
                                                onClick={() => handleToggleTask(task.id, task.status)}
                                                className={`w-10 h-10 rounded-2xl border-2 flex items-center justify-center transition-all ${task.status === 'COMPLETED'
                                                    ? 'bg-emerald-500 border-emerald-500 text-white'
                                                    : 'bg-white dark:bg-stone-900 border-stone-200 dark:border-stone-700 text-transparent hover:border-emerald-400 font-black'
                                                    }`}
                                            >
                                                {task.status === 'COMPLETED' ? <CheckCircle2 className="w-5 h-5" /> : '✓'}
                                            </button>
                                            <div>
                                                <p className={`text-sm font-bold ${task.status === 'COMPLETED' ? 'text-stone-400 line-through' : 'text-stone-800 dark:text-stone-100'}`}>
                                                    {task.description}
                                                </p>
                                                {task.dueDate && (
                                                    <div className="flex items-center gap-1.5 text-[10px] font-black text-primary uppercase mt-1">
                                                        <Calendar className="w-3 h-3" />
                                                        Para el {format(new Date(task.dueDate), "d 'de' MMM", { locale: es })}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                                            <a
                                                href={`https://wa.me/${contact.phone?.replace(/\D/g, '')}?text=${encodeURIComponent(task.description)}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="p-2 text-stone-300 hover:text-emerald-500 transition-colors"
                                                title="Enviar seguimiento por WhatsApp"
                                            >
                                                <MessageCircle className="w-4 h-4" />
                                            </a>
                                            <button className="p-2 text-stone-300 hover:text-red-500 transition-colors">
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                                {(!contact.tasks || contact.tasks.length === 0) && (
                                    <div className="text-center py-20 border-2 border-dashed border-stone-100 dark:border-stone-800 rounded-[3rem]">
                                        <CheckCircle2 className="w-16 h-16 text-stone-100 mx-auto mb-4" />
                                        <p className="text-sm font-black text-stone-300 uppercase tracking-widest">No hay tareas pendientes</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                    {activeSection === 'prescription' && (
                        <div className="space-y-8 animate-in fade-in duration-300">
                            {/* Prescription Form / Scanner */}
                            {!isAddingPrescription ? (
                                <div className="bg-stone-50 dark:bg-stone-800/30 p-12 rounded-[3rem] border-2 border-dashed border-stone-200 dark:border-stone-700 text-center flex flex-col items-center justify-center gap-6">
                                    <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center text-primary">
                                        <FileText className="w-10 h-10" />
                                    </div>
                                    <div className="max-w-xs mx-auto">
                                        <h3 className="text-xl font-black text-stone-800 dark:text-stone-100 mb-2">Nueva Receta</h3>
                                        <p className="text-xs font-medium text-stone-500 mb-8 lowercase tracking-tight">Sube una foto de la receta física o carga los datos manualmente con transposición automática.</p>
                                    </div>
                                    <div className="flex gap-4">
                                        <label className="bg-stone-900 text-white dark:bg-primary dark:text-primary-foreground px-8 py-4 rounded-3xl font-black text-xs uppercase tracking-widest cursor-pointer hover:scale-105 active:scale-95 transition-all shadow-xl shadow-stone-900/10">
                                            {isScanning ? `Escaneando ${scanProgress}%...` : 'SUBIR FOTO (OCR)'}
                                            <input type="file" className="hidden" accept="image/*" onChange={handleScanImage} disabled={isScanning} />
                                        </label>
                                        <button
                                            onClick={() => setIsAddingPrescription(true)}
                                            className="bg-white dark:bg-stone-800 text-stone-900 dark:text-white border border-stone-200 dark:border-stone-700 px-8 py-4 rounded-3xl font-black text-xs uppercase tracking-widest hover:bg-stone-50 transition-all shadow-sm"
                                        >
                                            CARGA MANUAL
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="bg-white dark:bg-stone-800 border-2 border-primary/20 rounded-[3rem] p-8 shadow-2xl animate-in zoom-in-95 duration-300">
                                    <div className="flex justify-between items-center mb-8">
                                        <h3 className="text-2xl font-black text-stone-800 dark:text-white tracking-tighter">
                                            {editingPresId ? 'Editar Receta' : 'Cargar Receta'}
                                        </h3>
                                        <button
                                            onClick={() => {
                                                setIsAddingPrescription(false);
                                                setEditingPresId(null);
                                                setPresData({
                                                    sphereOD: '', cylinderOD: '', axisOD: '',
                                                    sphereOI: '', cylinderOI: '', axisOI: '',
                                                    addition: '', additionOD: '', additionOI: '',
                                                    pd: '', distanceOD: '', distanceOI: '',
                                                    heightOD: '', heightOI: '',
                                                    notes: '', imageUrl: '',
                                                    prescriptionType: 'ADDITION',
                                                    nearSphereOD: '', nearSphereOI: '',
                                                    nearCylinderOD: '', nearAxisOD: '',
                                                    nearCylinderOI: '', nearAxisOI: ''
                                                });
                                            }}
                                            className="text-stone-400 hover:text-stone-800 font-bold text-xs uppercase tracking-widest"
                                        >
                                            CANCELAR
                                        </button>
                                    </div>

                                    {/* ═══ SECCIÓN LEJOS ═══ */}
                                    <div className="mb-6">
                                        <div className="text-[10px] font-black text-stone-400 uppercase tracking-[0.3em] mb-4 flex items-center gap-2">
                                            <span className="w-5 h-0.5 bg-stone-200"></span> GRADUACIÓN LEJOS <span className="flex-1 h-0.5 bg-stone-200"></span>
                                        </div>

                                        {/* OD Row */}
                                        <div className="flex items-center gap-3 mb-3">
                                            <div className="px-3 py-2 bg-primary text-white rounded-xl text-[10px] font-black uppercase tracking-widest italic shrink-0 w-[72px] text-center">OD</div>
                                            <div className="flex-1 grid grid-cols-3 gap-3">
                                                <div>
                                                    <label className="text-[8px] font-black text-stone-400 uppercase tracking-widest block mb-0.5">Esfera</label>
                                                    <input type="text" placeholder="±0.00" value={presData.sphereOD} onChange={e => setPresData(prev => ({ ...prev, sphereOD: e.target.value }))} className="w-full bg-stone-50 dark:bg-stone-900 border border-stone-100 dark:border-stone-700 p-3 rounded-xl text-sm font-black text-center" />
                                                </div>
                                                <div>
                                                    <label className="text-[8px] font-black text-stone-400 uppercase tracking-widest block mb-0.5">Cilindro</label>
                                                    <input type="text" placeholder="-0.00" value={presData.cylinderOD} onChange={e => setPresData(prev => ({ ...prev, cylinderOD: e.target.value }))} className="w-full bg-stone-50 dark:bg-stone-900 border border-stone-100 dark:border-stone-700 p-3 rounded-xl text-sm font-black text-center" />
                                                </div>
                                                <div>
                                                    <label className="text-[8px] font-black text-stone-400 uppercase tracking-widest block mb-0.5">Eje</label>
                                                    <input type="text" placeholder="0°" value={presData.axisOD} onChange={e => setPresData(prev => ({ ...prev, axisOD: e.target.value }))} className="w-full bg-stone-50 dark:bg-stone-900 border border-stone-100 dark:border-stone-700 p-3 rounded-xl text-sm font-black text-center" />
                                                </div>
                                            </div>
                                        </div>

                                        {/* OI Row */}
                                        <div className="flex items-center gap-3">
                                            <div className="px-3 py-2 bg-primary text-white rounded-xl text-[10px] font-black uppercase tracking-widest italic shrink-0 w-[72px] text-center">OI</div>
                                            <div className="flex-1 grid grid-cols-3 gap-3">
                                                <div>
                                                    <label className="text-[8px] font-black text-stone-400 uppercase tracking-widest block mb-0.5">Esfera</label>
                                                    <input type="text" placeholder="±0.00" value={presData.sphereOI} onChange={e => setPresData(prev => ({ ...prev, sphereOI: e.target.value }))} className="w-full bg-stone-50 dark:bg-stone-900 border border-stone-100 dark:border-stone-700 p-3 rounded-xl text-sm font-black text-center" />
                                                </div>
                                                <div>
                                                    <label className="text-[8px] font-black text-stone-400 uppercase tracking-widest block mb-0.5">Cilindro</label>
                                                    <input type="text" placeholder="-0.00" value={presData.cylinderOI} onChange={e => setPresData(prev => ({ ...prev, cylinderOI: e.target.value }))} className="w-full bg-stone-50 dark:bg-stone-900 border border-stone-100 dark:border-stone-700 p-3 rounded-xl text-sm font-black text-center" />
                                                </div>
                                                <div>
                                                    <label className="text-[8px] font-black text-stone-400 uppercase tracking-widest block mb-0.5">Eje</label>
                                                    <input type="text" placeholder="0°" value={presData.axisOI} onChange={e => setPresData(prev => ({ ...prev, axisOI: e.target.value }))} className="w-full bg-stone-50 dark:bg-stone-900 border border-stone-100 dark:border-stone-700 p-3 rounded-xl text-sm font-black text-center" />
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* ═══ TOGGLE ADICIÓN / CERCA ═══ */}
                                    <div className="flex items-center gap-3 mb-6">
                                        <span className="text-[9px] font-black text-stone-400 uppercase tracking-widest">Modo:</span>
                                        <div className="flex bg-stone-100 dark:bg-stone-800 rounded-xl p-1 border border-stone-200 dark:border-stone-700">
                                            <button
                                                type="button"
                                                onClick={() => setPresData(prev => ({ ...prev, prescriptionType: 'ADDITION' }))}
                                                className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${presData.prescriptionType === 'ADDITION' ? 'bg-primary text-white shadow-md' : 'text-stone-400 hover:text-stone-600'}`}
                                            >
                                                Adición (ADD)
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setPresData(prev => ({ ...prev, prescriptionType: 'NEAR' }))}
                                                className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${presData.prescriptionType === 'NEAR' ? 'bg-primary text-white shadow-md' : 'text-stone-400 hover:text-stone-600'}`}
                                            >
                                                Cerca
                                            </button>
                                        </div>
                                    </div>

                                    {/* ═══ SECCIÓN ADICIÓN o CERCA ═══ */}
                                    {presData.prescriptionType === 'ADDITION' ? (
                                        <div className="mb-6">
                                            <div className="text-[10px] font-black text-primary uppercase tracking-[0.3em] mb-4 flex items-center gap-2">
                                                <span className="w-5 h-0.5 bg-primary/30"></span> ADICIÓN <span className="flex-1 h-0.5 bg-primary/30"></span>
                                            </div>
                                            <div className="flex items-center gap-3 mb-3">
                                                <div className="px-3 py-2 bg-primary/20 text-primary rounded-xl text-[10px] font-black uppercase tracking-widest italic shrink-0 w-[72px] text-center">OD</div>
                                                <div className="flex-1">
                                                    <input type="text" placeholder="+0.00" value={presData.additionOD} onChange={e => setPresData(prev => ({ ...prev, additionOD: e.target.value }))} className="w-full bg-stone-50 dark:bg-stone-900 border border-primary/20 p-3 rounded-xl text-sm font-black text-center text-primary" />
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <div className="px-3 py-2 bg-primary/20 text-primary rounded-xl text-[10px] font-black uppercase tracking-widest italic shrink-0 w-[72px] text-center">OI</div>
                                                <div className="flex-1">
                                                    <input type="text" placeholder="+0.00" value={presData.additionOI} onChange={e => setPresData(prev => ({ ...prev, additionOI: e.target.value }))} className="w-full bg-stone-50 dark:bg-stone-900 border border-primary/20 p-3 rounded-xl text-sm font-black text-center text-primary" />
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="mb-6">
                                            <div className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.3em] mb-4 flex items-center gap-2">
                                                <span className="w-5 h-0.5 bg-emerald-300"></span> GRADUACIÓN CERCA <span className="flex-1 h-0.5 bg-emerald-300"></span>
                                            </div>

                                            {/* Near OD Row */}
                                            <div className="flex items-center gap-3 mb-3">
                                                <div className="px-3 py-2 bg-emerald-100 text-emerald-700 rounded-xl text-[10px] font-black uppercase tracking-widest italic shrink-0 w-[72px] text-center">OD</div>
                                                <div className="flex-1 grid grid-cols-3 gap-3">
                                                    <div>
                                                        <label className="text-[8px] font-black text-emerald-500 uppercase tracking-widest block mb-0.5">Esfera</label>
                                                        <input type="text" placeholder="±0.00" value={presData.nearSphereOD} onChange={e => setPresData(prev => ({ ...prev, nearSphereOD: e.target.value }))} className="w-full bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 p-3 rounded-xl text-sm font-black text-center text-emerald-700" />
                                                    </div>
                                                    <div>
                                                        <label className="text-[8px] font-black text-emerald-500 uppercase tracking-widest block mb-0.5">Cilindro</label>
                                                        <input type="text" placeholder="-0.00" value={presData.nearCylinderOD} onChange={e => setPresData(prev => ({ ...prev, nearCylinderOD: e.target.value }))} className="w-full bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 p-3 rounded-xl text-sm font-black text-center text-emerald-700" />
                                                    </div>
                                                    <div>
                                                        <label className="text-[8px] font-black text-emerald-500 uppercase tracking-widest block mb-0.5">Eje</label>
                                                        <input type="text" placeholder="0°" value={presData.nearAxisOD} onChange={e => setPresData(prev => ({ ...prev, nearAxisOD: e.target.value }))} className="w-full bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 p-3 rounded-xl text-sm font-black text-center text-emerald-700" />
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Near OI Row */}
                                            <div className="flex items-center gap-3">
                                                <div className="px-3 py-2 bg-emerald-100 text-emerald-700 rounded-xl text-[10px] font-black uppercase tracking-widest italic shrink-0 w-[72px] text-center">OI</div>
                                                <div className="flex-1 grid grid-cols-3 gap-3">
                                                    <div>
                                                        <label className="text-[8px] font-black text-emerald-500 uppercase tracking-widest block mb-0.5">Esfera</label>
                                                        <input type="text" placeholder="±0.00" value={presData.nearSphereOI} onChange={e => setPresData(prev => ({ ...prev, nearSphereOI: e.target.value }))} className="w-full bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 p-3 rounded-xl text-sm font-black text-center text-emerald-700" />
                                                    </div>
                                                    <div>
                                                        <label className="text-[8px] font-black text-emerald-500 uppercase tracking-widest block mb-0.5">Cilindro</label>
                                                        <input type="text" placeholder="-0.00" value={presData.nearCylinderOI} onChange={e => setPresData(prev => ({ ...prev, nearCylinderOI: e.target.value }))} className="w-full bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 p-3 rounded-xl text-sm font-black text-center text-emerald-700" />
                                                    </div>
                                                    <div>
                                                        <label className="text-[8px] font-black text-emerald-500 uppercase tracking-widest block mb-0.5">Eje</label>
                                                        <input type="text" placeholder="0°" value={presData.nearAxisOI} onChange={e => setPresData(prev => ({ ...prev, nearAxisOI: e.target.value }))} className="w-full bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 p-3 rounded-xl text-sm font-black text-center text-emerald-700" />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* ═══ DISTANCIA (DNP) Y ALTURA POR OJO ═══ */}
                                    <div className="mb-6">
                                        <div className="text-[10px] font-black text-stone-400 uppercase tracking-[0.3em] mb-4 flex items-center gap-2">
                                            <span className="w-5 h-0.5 bg-stone-200"></span> DISTANCIA Y ALTURA <span className="flex-1 h-0.5 bg-stone-200"></span>
                                        </div>
                                        <div className="grid grid-cols-2 gap-6">
                                            {/* DNP */}
                                            <div>
                                                <label className="text-[9px] font-black text-stone-400 uppercase tracking-widest block mb-2">DNP (Distancia Pupilar)</label>
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div>
                                                        <label className="text-[8px] font-black text-stone-300 uppercase block mb-0.5 text-center">OD</label>
                                                        <input type="text" placeholder="00" value={presData.distanceOD} onChange={e => setPresData(prev => ({ ...prev, distanceOD: e.target.value }))} className="w-full bg-stone-50 dark:bg-stone-900 border border-stone-100 dark:border-stone-700 p-3 rounded-xl text-sm font-black text-center" />
                                                    </div>
                                                    <div>
                                                        <label className="text-[8px] font-black text-stone-300 uppercase block mb-0.5 text-center">OI</label>
                                                        <input type="text" placeholder="00" value={presData.distanceOI} onChange={e => setPresData(prev => ({ ...prev, distanceOI: e.target.value }))} className="w-full bg-stone-50 dark:bg-stone-900 border border-stone-100 dark:border-stone-700 p-3 rounded-xl text-sm font-black text-center" />
                                                    </div>
                                                </div>
                                            </div>
                                            {/* Altura */}
                                            <div>
                                                <label className="text-[9px] font-black text-stone-400 uppercase tracking-widest block mb-2">Altura</label>
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div>
                                                        <label className="text-[8px] font-black text-stone-300 uppercase block mb-0.5 text-center">OD</label>
                                                        <input type="text" placeholder="00" value={presData.heightOD} onChange={e => setPresData(prev => ({ ...prev, heightOD: e.target.value }))} className="w-full bg-stone-50 dark:bg-stone-900 border border-stone-100 dark:border-stone-700 p-3 rounded-xl text-sm font-black text-center" />
                                                    </div>
                                                    <div>
                                                        <label className="text-[8px] font-black text-stone-300 uppercase block mb-0.5 text-center">OI</label>
                                                        <input type="text" placeholder="00" value={presData.heightOI} onChange={e => setPresData(prev => ({ ...prev, heightOI: e.target.value }))} className="w-full bg-stone-50 dark:bg-stone-900 border border-stone-100 dark:border-stone-700 p-3 rounded-xl text-sm font-black text-center" />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* ═══ OBSERVACIONES ═══ */}
                                    <div className="mb-6">
                                        <label className="text-[9px] font-black text-stone-400 uppercase tracking-widest block mb-1">Observaciones</label>
                                        <input type="text" placeholder="Ej: Multifocal, filtro azul..." value={presData.notes} onChange={e => setPresData(prev => ({ ...prev, notes: e.target.value }))} className="w-full bg-stone-50 dark:bg-stone-900 border border-stone-100 dark:border-stone-700 p-3 rounded-xl text-sm font-bold" />
                                    </div>

                                    {presData.imageUrl && (
                                        <div className="mb-6 p-4 bg-stone-50 dark:bg-stone-900/50 rounded-2xl border border-stone-100 dark:border-stone-800">
                                            <span className="text-[9px] font-black text-stone-400 uppercase tracking-widest block mb-3 italic">Imagen de Receta Escaneada</span>
                                            <img src={presData.imageUrl} alt="Receta" className="max-h-40 rounded-xl mx-auto shadow-lg" />
                                        </div>
                                    )}

                                    <div className="pt-6 border-t border-stone-100 flex justify-between items-center">
                                        <p className="text-[9px] font-black text-stone-400 uppercase tracking-widest flex items-center gap-2">
                                            <Clock className="w-3 h-3" /> transposición automática habilitada
                                        </p>
                                        <button
                                            onClick={handleSavePrescription}
                                            disabled={isSaving || isScanning}
                                            className={`${isSaving || isScanning ? 'bg-stone-200 text-stone-400 cursor-not-allowed' : 'bg-emerald-500 text-white hover:scale-105 active:scale-95 shadow-xl shadow-emerald-500/20'} px-10 py-4 rounded-3xl font-black text-sm uppercase tracking-widest transition-all italic flex items-center gap-2`}
                                        >
                                            {isSaving ? (
                                                <>GUARDANDO <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span></>
                                            ) : (
                                                <>GUARDAR RECETA <ArrowRight className="w-4 h-4 inline not-italic" /></>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Prescription History */}
                            <div className="space-y-6">
                                <h4 className="text-[10px] font-black text-stone-400 uppercase tracking-[0.3em] ml-2">Historial de Recetas</h4>
                                {contact.prescriptions?.map((pres: any) => (
                                    <div key={pres.id} className="bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 p-8 rounded-[2.5rem] shadow-sm hover:shadow-xl transition-all relative overflow-hidden group">
                                        <div className="absolute top-0 right-0 p-6 opacity-0 group-hover:opacity-20 transition-opacity">
                                            <FileText className="w-20 h-20 rotate-12" />
                                        </div>
                                        <div className="flex justify-between items-start mb-6 border-b border-stone-50 pb-4">
                                            <div>
                                                <span className="text-[10px] font-black text-primary uppercase tracking-widest flex items-center gap-2">
                                                    <Calendar className="w-3 h-3" /> Receta Clínica
                                                </span>
                                                <h5 className="text-xl font-black text-stone-800 dark:text-stone-100 tracking-tighter mt-1">
                                                    {format(new Date(pres.date), "d 'de' MMMM, yyyy", { locale: es })}
                                                </h5>
                                            </div>
                                            <div className="flex gap-2">
                                                {pres.imageUrl && (
                                                    <>
                                                        <button onClick={() => window.open(pres.imageUrl, '_blank')} className="p-3 bg-stone-100 text-stone-600 rounded-2xl text-[9px] font-black uppercase tracking-widest hover:bg-stone-200 transition-all">VER FOTO</button>
                                                        <a
                                                            href={pres.imageUrl}
                                                            download={`receta_${contact.name.replace(/\s+/g, '_')}_${format(new Date(pres.date), 'yyyyMMdd')}.jpg`}
                                                            className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl text-[9px] font-black uppercase tracking-widest hover:bg-emerald-100 transition-all"
                                                        >
                                                            DESCARGAR
                                                        </a>
                                                    </>
                                                )}
                                                <button
                                                    onClick={() => handleEditPrescription(pres)}
                                                    className="p-3 bg-stone-50 text-stone-400 rounded-2xl hover:text-stone-800 transition-all"
                                                >
                                                    <Pencil className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDeletePrescription(pres.id)}
                                                    className="p-3 bg-stone-50 text-red-400 rounded-2xl hover:bg-red-50 transition-all"
                                                >
                                                    <X className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                        {/* Lejos: OD on top, OI below */}
                                        <div className="space-y-2 relative z-10">
                                            <div className="flex items-center gap-3">
                                                <span className="px-3 py-1.5 bg-stone-900 text-white rounded-lg text-[9px] font-black uppercase tracking-widest italic w-[52px] text-center shrink-0">OD</span>
                                                <div className="flex-1 flex justify-around font-mono text-sm font-black italic bg-stone-900 text-white p-4 rounded-2xl">
                                                    <div className="text-center"><span className="block text-[8px] opacity-40 not-italic mb-1">ESF</span>{pres.sphereOD > 0 ? '+' : ''}{pres.sphereOD?.toFixed(2)}</div>
                                                    <div className="text-center"><span className="block text-[8px] opacity-40 not-italic mb-1">CIL</span>{pres.cylinderOD?.toFixed(2)}</div>
                                                    <div className="text-center"><span className="block text-[8px] opacity-40 not-italic mb-1">EJE</span>{pres.axisOD}°</div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <span className="px-3 py-1.5 bg-stone-900 text-white rounded-lg text-[9px] font-black uppercase tracking-widest italic w-[52px] text-center shrink-0">OI</span>
                                                <div className="flex-1 flex justify-around font-mono text-sm font-black italic bg-stone-900 text-white p-4 rounded-2xl">
                                                    <div className="text-center"><span className="block text-[8px] opacity-40 not-italic mb-1">ESF</span>{pres.sphereOI > 0 ? '+' : ''}{pres.sphereOI?.toFixed(2)}</div>
                                                    <div className="text-center"><span className="block text-[8px] opacity-40 not-italic mb-1">CIL</span>{pres.cylinderOI?.toFixed(2)}</div>
                                                    <div className="text-center"><span className="block text-[8px] opacity-40 not-italic mb-1">EJE</span>{pres.axisOI}°</div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Near/Addition + DNP + Height info bar */}
                                        <div className="mt-4 flex flex-wrap gap-3">
                                            {/* Addition or Near */}
                                            {pres.prescriptionType === 'NEAR' ? (
                                                <div className="flex-1 bg-emerald-50 dark:bg-emerald-900/20 p-3 rounded-2xl border border-emerald-200 dark:border-emerald-800">
                                                    <span className="text-[8px] text-emerald-500 font-black uppercase tracking-widest block mb-2">Cerca</span>
                                                    <div className="space-y-1 text-xs font-black text-emerald-700">
                                                        <div className="flex justify-between"><span className="text-[8px] text-emerald-400">OD:</span> <span>{pres.nearSphereOD > 0 ? '+' : ''}{pres.nearSphereOD?.toFixed(2)} / {pres.nearCylinderOD?.toFixed(2)} × {pres.nearAxisOD}°</span></div>
                                                        <div className="flex justify-between"><span className="text-[8px] text-emerald-400">OI:</span> <span>{pres.nearSphereOI > 0 ? '+' : ''}{pres.nearSphereOI?.toFixed(2)} / {pres.nearCylinderOI?.toFixed(2)} × {pres.nearAxisOI}°</span></div>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="bg-stone-50 dark:bg-stone-900/50 p-3 rounded-2xl border border-stone-100 dark:border-stone-800">
                                                    <span className="text-[8px] text-stone-400 font-black uppercase tracking-widest block mb-2">Adición</span>
                                                    <div className="space-y-1 text-xs font-black text-primary">
                                                        {pres.additionOD || pres.additionOI ? (
                                                            <>
                                                                <div>OD: +{pres.additionOD?.toFixed(2)}</div>
                                                                <div>OI: +{pres.additionOI?.toFixed(2)}</div>
                                                            </>
                                                        ) : (
                                                            <div>+{pres.addition?.toFixed(2)}</div>
                                                        )}
                                                    </div>
                                                </div>
                                            )}

                                            {/* DNP */}
                                            <div className="bg-stone-50 dark:bg-stone-900/50 p-3 rounded-2xl border border-stone-100 dark:border-stone-800">
                                                <span className="text-[8px] text-stone-400 font-black uppercase tracking-widest block mb-2">DNP</span>
                                                <div className="space-y-1 text-xs font-black text-stone-800 dark:text-stone-300">
                                                    {pres.distanceOD || pres.distanceOI ? (
                                                        <>
                                                            <div>OD: {pres.distanceOD}</div>
                                                            <div>OI: {pres.distanceOI}</div>
                                                        </>
                                                    ) : (
                                                        <div>{pres.pd || '—'}</div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Altura */}
                                            {(pres.heightOD || pres.heightOI) && (
                                                <div className="bg-stone-50 dark:bg-stone-900/50 p-3 rounded-2xl border border-stone-100 dark:border-stone-800">
                                                    <span className="text-[8px] text-stone-400 font-black uppercase tracking-widest block mb-2">Altura</span>
                                                    <div className="space-y-1 text-xs font-black text-stone-800 dark:text-stone-300">
                                                        <div>OD: {pres.heightOD || '—'}</div>
                                                        <div>OI: {pres.heightOI || '—'}</div>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Notes */}
                                            {pres.notes && (
                                                <div className="flex-1 bg-stone-50 dark:bg-stone-900/50 p-3 rounded-2xl border border-stone-100 dark:border-stone-800">
                                                    <span className="text-[8px] text-stone-400 font-black uppercase tracking-widest block mb-2">Obs</span>
                                                    <p className="text-[10px] font-bold text-stone-500 italic leading-tight">"{pres.notes}"</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                                {(!contact.prescriptions || contact.prescriptions.length === 0) && (
                                    <div className="text-center py-10">
                                        <p className="text-[10px] font-black text-stone-300 uppercase tracking-widest">No hay registros clínicos guardados</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Sección: PRESUPUESTOS + COTIZADOR INLINE + LAB */}
                    {(activeSection === 'budget' || activeSection === 'sales') && (
                        <div className="space-y-8 animate-in fade-in duration-300">
                            {/* Botón Nuevo Presupuesto */}
                            {!isQuoting && activeSection === 'budget' && (
                                <button
                                    onClick={() => {
                                        setIsQuoting(true);
                                        setQuoteItems([]);
                                        setQuoteMarkup(0);
                                        setQuoteDiscountCash(20);
                                        setQuoteDiscountTransfer(15);
                                        setQuoteDiscountCard(0);
                                        setQuoteSearch('');
                                        if (availableProducts.length === 0) {
                                            fetch('/api/products').then(r => r.json()).then(setAvailableProducts).catch(console.error);
                                        }
                                    }}
                                    className="w-full py-6 bg-stone-900 text-white dark:bg-primary rounded-[2rem] font-black text-xs uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition-all shadow-xl flex items-center justify-center gap-3"
                                >
                                    <Plus className="w-5 h-5" /> NUEVO PRESUPUESTO
                                </button>
                            )}

                            {/* Cotizador Inline */}
                            {isQuoting && activeSection === 'budget' && (
                                <div className="bg-white dark:bg-stone-800 border-2 border-primary/20 rounded-[2.5rem] p-8 shadow-2xl animate-in zoom-in-95 duration-300">
                                    <div className="flex justify-between items-center mb-6">
                                        <h3 className="text-xl font-black text-stone-800 dark:text-white tracking-tighter">
                                            Cotizar <span className="text-primary italic">— {contact.name}</span>
                                        </h3>
                                        <button onClick={() => setIsQuoting(false)} className="text-stone-400 hover:text-stone-800 font-bold text-xs uppercase tracking-widest">CANCELAR</button>
                                    </div>

                                    {/* Search */}
                                    <div className="relative mb-6">
                                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                                        <input
                                            type="text"
                                            placeholder="Buscar producto..."
                                            value={quoteSearch}
                                            onChange={e => setQuoteSearch(e.target.value)}
                                            className="w-full pl-11 pr-4 py-3 bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-2xl text-sm font-bold outline-none focus:border-primary"
                                        />
                                    </div>

                                    {/* Product Grid */}
                                    {quoteSearch && (
                                        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-6 max-h-48 overflow-y-auto custom-scrollbar">
                                            {availableProducts
                                                .filter(p => {
                                                    const q = quoteSearch.toLowerCase();
                                                    return (p.name?.toLowerCase().includes(q) || p.brand?.toLowerCase().includes(q) || p.model?.toLowerCase().includes(q) || p.type?.toLowerCase().includes(q));
                                                })
                                                .slice(0, 12)
                                                .map(product => {
                                                    const inCart = quoteItems.some(i => i.product.id === product.id);
                                                    return (
                                                        <button
                                                            key={product.id}
                                                            onClick={() => {
                                                                if (inCart) return;
                                                                if (product.type === 'Cristal' || product.category === 'LENS') {
                                                                    const halfPrice = Math.round(product.price / 2);
                                                                    setQuoteItems(prev => [
                                                                        ...prev,
                                                                        { product, quantity: 1, price: halfPrice, eye: 'OD' },
                                                                        { product, quantity: 1, price: halfPrice, eye: 'OI' }
                                                                    ]);
                                                                } else {
                                                                    setQuoteItems(prev => [...prev, { product, quantity: 1, price: product.price }]);
                                                                }
                                                            }}
                                                            className={`p-3 rounded-2xl border text-left transition-all ${inCart ? 'bg-primary/10 border-primary/30 opacity-60' : 'bg-stone-50 dark:bg-stone-900 border-stone-200 dark:border-stone-700 hover:border-primary/40 hover:shadow-md'}`}
                                                        >
                                                            <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest truncate">{product.type || product.category}</p>
                                                            <p className="text-xs font-black text-stone-800 dark:text-white truncate">{product.brand} {product.model || product.name}</p>
                                                            <p className="text-sm font-black text-primary mt-1">${product.price?.toLocaleString()}</p>
                                                        </button>
                                                    );
                                                })}
                                        </div>
                                    )}

                                    {/* Quote Items */}
                                    {quoteItems.length > 0 && (
                                        <div className="space-y-3 mb-6">
                                            <h4 className="text-[10px] font-black text-stone-400 uppercase tracking-widest">Productos seleccionados</h4>
                                            {quoteItems.map((item, idx) => (
                                                <div key={idx} className="flex items-center gap-3 bg-stone-50 dark:bg-stone-900 p-3 rounded-2xl border border-stone-100 dark:border-stone-700">
                                                    {item.eye && (
                                                        <span className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest italic shrink-0 ${item.eye === 'OD' ? 'bg-stone-900 text-white dark:bg-stone-700' : 'bg-stone-200 text-stone-600 dark:bg-stone-800 dark:text-stone-300'}`}>
                                                            {item.eye}
                                                        </span>
                                                    )}
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-xs font-black text-stone-800 dark:text-white truncate">{item.product.brand} {item.product.model || item.product.name}</p>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <button onClick={() => setQuoteItems(prev => prev.map((it, i) => i === idx ? { ...it, quantity: Math.max(1, it.quantity - 1) } : it))} className="w-7 h-7 bg-stone-200 dark:bg-stone-700 rounded-lg flex items-center justify-center text-stone-600 hover:bg-stone-300"><Minus className="w-3 h-3" /></button>
                                                        <span className="text-sm font-black w-6 text-center">{item.quantity}</span>
                                                        {(() => {
                                                            const isCrystalItem = item.product.type === 'Cristal' || item.product.category === 'LENS';
                                                            const atMax = !isCrystalItem && item.quantity >= (item.product.stock || 0);
                                                            return (
                                                                <button
                                                                    onClick={() => {
                                                                        if (atMax) return;
                                                                        setQuoteItems(prev => prev.map((it, i) => i === idx ? { ...it, quantity: it.quantity + 1 } : it));
                                                                    }}
                                                                    disabled={atMax}
                                                                    className={`w-7 h-7 rounded-lg flex items-center justify-center ${atMax ? 'bg-red-100 text-red-400 cursor-not-allowed' : 'bg-stone-200 dark:bg-stone-700 text-stone-600 hover:bg-stone-300'}`}
                                                                    title={atMax ? `Stock máximo: ${item.product.stock}` : ''}
                                                                >
                                                                    <Plus className="w-3 h-3" />
                                                                </button>
                                                            );
                                                        })()}
                                                    </div>
                                                    <div className="w-24 bg-stone-50 dark:bg-stone-900 border border-stone-100 dark:border-stone-800 rounded-xl p-2 text-sm font-black text-right text-stone-500 cursor-not-allowed select-none">
                                                        ${(item.price * (1 + (quoteMarkup || 0) / 100)).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                                    </div>
                                                    <button onClick={() => setQuoteItems(prev => prev.filter((_, i) => i !== idx))} className="text-red-400 hover:text-red-500 p-1"><X className="w-4 h-4" /></button>
                                                </div>
                                            ))}

                                            {/* Frame Section — when crystals are in quote */}
                                            {(() => {
                                                const quoteCrystals = quoteItems.some(i => i.product.type === 'Cristal' || i.product.category === 'LENS');
                                                const quoteHasFrame = quoteItems.some(i => i.product.type === 'Armazón' || i.product.category === 'FRAME');
                                                if (!quoteCrystals) return null;
                                                return (
                                                    <div className="p-4 bg-amber-50 dark:bg-amber-900/10 rounded-2xl border-2 border-amber-200 dark:border-amber-800 mt-3">
                                                        <p className="text-[10px] font-black text-amber-700 dark:text-amber-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                                                            <Glasses className="w-4 h-4" /> Armazón para los cristales
                                                        </p>
                                                        <div className="flex gap-2 mb-3">
                                                            <button
                                                                onClick={() => { setQuoteFrameSource('OPTICA'); setQuoteFrameSearch(''); }}
                                                                className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border ${quoteFrameSource === 'OPTICA'
                                                                    ? 'bg-amber-500 text-white border-amber-500 shadow-md'
                                                                    : 'bg-white dark:bg-stone-800 text-stone-400 border-stone-200 dark:border-stone-700 hover:border-amber-300'
                                                                    }`}
                                                            >
                                                                De la Óptica
                                                            </button>
                                                            <button
                                                                onClick={() => setQuoteFrameSource('USUARIO')}
                                                                className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border flex items-center justify-center gap-1 ${quoteFrameSource === 'USUARIO'
                                                                    ? 'bg-amber-500 text-white border-amber-500 shadow-md'
                                                                    : 'bg-white dark:bg-stone-800 text-stone-400 border-stone-200 dark:border-stone-700 hover:border-amber-300'
                                                                    }`}
                                                            >
                                                                <User className="w-3 h-3" /> Del Usuario
                                                            </button>
                                                        </div>
                                                        {quoteFrameSource === 'OPTICA' && !quoteHasFrame && (
                                                            <div>
                                                                <div className="relative mb-2">
                                                                    <Search className="w-3 h-3 absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-300" />
                                                                    <input
                                                                        type="text"
                                                                        placeholder="Buscar armazón..."
                                                                        value={quoteFrameSearch}
                                                                        onChange={e => setQuoteFrameSearch(e.target.value)}
                                                                        className="w-full bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 py-2 pl-7 pr-3 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-amber-200 placeholder:text-stone-300"
                                                                    />
                                                                </div>
                                                                {quoteFrameSearch && (
                                                                    <div className="space-y-1 max-h-32 overflow-y-auto">
                                                                        {availableProducts
                                                                            .filter(p => (p.type === 'Armazón' || p.category === 'FRAME') && p.stock > 0 && (p.brand?.toLowerCase().includes(quoteFrameSearch.toLowerCase()) || p.model?.toLowerCase().includes(quoteFrameSearch.toLowerCase()) || p.name?.toLowerCase().includes(quoteFrameSearch.toLowerCase())))
                                                                            .slice(0, 6)
                                                                            .map(fr => (
                                                                                <button
                                                                                    key={fr.id}
                                                                                    onClick={() => { setQuoteItems(prev => [...prev, { product: fr, quantity: 1, price: fr.price }]); setQuoteFrameSearch(''); }}
                                                                                    className="w-full flex items-center justify-between p-2 bg-white dark:bg-stone-800 rounded-lg border border-stone-100 dark:border-stone-700 hover:border-amber-300 transition-all text-left"
                                                                                >
                                                                                    <div>
                                                                                        <p className="text-[10px] font-black truncate">{fr.brand} {fr.model || ''}</p>
                                                                                        <p className="text-[8px] text-stone-400 font-bold">${fr.price.toLocaleString()}</p>
                                                                                    </div>
                                                                                    <Plus className="w-3 h-3 text-amber-500" />
                                                                                </button>
                                                                            ))}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                        {quoteFrameSource === 'OPTICA' && quoteHasFrame && (
                                                            <p className="text-[10px] font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                                                                <Check className="w-3 h-3" /> Armazón incluido en el presupuesto
                                                            </p>
                                                        )}
                                                        {quoteFrameSource === 'USUARIO' && (
                                                            <div className="space-y-2">
                                                                <input
                                                                    type="text"
                                                                    placeholder="Marca del armazón"
                                                                    value={quoteUserFrame.brand}
                                                                    onChange={e => setQuoteUserFrame(prev => ({ ...prev, brand: e.target.value }))}
                                                                    className="w-full bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 py-2 px-3 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-amber-200 placeholder:text-stone-300"
                                                                />
                                                                <input
                                                                    type="text"
                                                                    placeholder="Modelo del armazón"
                                                                    value={quoteUserFrame.model}
                                                                    onChange={e => setQuoteUserFrame(prev => ({ ...prev, model: e.target.value }))}
                                                                    className="w-full bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 py-2 px-3 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-amber-200 placeholder:text-stone-300"
                                                                />
                                                                <input
                                                                    type="text"
                                                                    placeholder="Observaciones (color, estado...)"
                                                                    value={quoteUserFrame.notes}
                                                                    onChange={e => setQuoteUserFrame(prev => ({ ...prev, notes: e.target.value }))}
                                                                    className="w-full bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 py-2 px-3 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-amber-200 placeholder:text-stone-300"
                                                                />
                                                            </div>
                                                        )}
                                                        {!quoteFrameSource && (
                                                            <p className="text-[9px] font-black text-amber-600 animate-pulse">⚠️ Seleccioná un armazón para los cristales</p>
                                                        )}
                                                    </div>
                                                );
                                            })()}

                                            {/* Prescription Section — when crystals are in quote */}
                                            {(() => {
                                                const quoteCrystals = quoteItems.some(i => i.product.type === 'Cristal' || i.product.category === 'LENS');
                                                if (!quoteCrystals) return null;
                                                return (
                                                    <div className="p-4 bg-emerald-50 dark:bg-emerald-900/10 rounded-2xl border-2 border-emerald-200 dark:border-emerald-800 mt-3">
                                                        <p className="text-[10px] font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                                                            <FileText className="w-4 h-4" /> Receta para los cristales
                                                        </p>
                                                        {contact.prescriptions && contact.prescriptions.length > 0 ? (
                                                            <div className="space-y-2">
                                                                <select
                                                                    value={quotePrescriptionId || ''}
                                                                    onChange={e => setQuotePrescriptionId(e.target.value || null)}
                                                                    className="w-full bg-white dark:bg-stone-800 border border-emerald-200 dark:border-emerald-800 py-2 px-3 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-300"
                                                                >
                                                                    <option value="">Seleccionar receta guardada...</option>
                                                                    {contact.prescriptions.map((p: any) => (
                                                                        <option key={p.id} value={p.id}>
                                                                            {format(new Date(p.date), 'dd/MM/yyyy')} — OD: {p.sphereOD > 0 ? '+' : ''}{p.sphereOD || 0} / OI: {p.sphereOI > 0 ? '+' : ''}{p.sphereOI || 0}
                                                                        </option>
                                                                    ))}
                                                                </select>
                                                                {!quotePrescriptionId && (
                                                                    <p className="text-[9px] font-black text-emerald-600 animate-pulse">⚠️ Seleccioná una receta para el presupuesto</p>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
                                                                Este contacto no tiene recetas guardadas. Podés guardar el presupuesto y agregar la receta más tarde desde la pestaña "Recetas".
                                                            </p>
                                                        )}
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                    )}

                                    {/* Totals + Markup + Discounts + Save */}
                                    {quoteItems.length > 0 && (() => {
                                        const subtotal = quoteItems.reduce((s, i) => s + i.price * i.quantity, 0);
                                        const markupAmount = subtotal * (quoteMarkup / 100);
                                        const priceWithMarkup = subtotal + markupAmount;
                                        const totalCash = priceWithMarkup * (1 - quoteDiscountCash / 100);
                                        const totalTransfer = priceWithMarkup * (1 - quoteDiscountTransfer / 100);
                                        const totalCard = priceWithMarkup * (1 - quoteDiscountCard / 100);
                                        return (
                                            <div className="border-t border-stone-100 dark:border-stone-700 pt-6 space-y-4">
                                                {/* Markup */}
                                                <div className="flex items-center gap-3">
                                                    <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest flex items-center gap-1"><TrendingUp className="w-3 h-3" /> Markup</span>
                                                    <input
                                                        type="number"
                                                        min={0}
                                                        value={quoteMarkup || ''}
                                                        onChange={e => setQuoteMarkup(Math.abs(Number(e.target.value)))}
                                                        onKeyDown={e => { if (e.key === '-' || e.key === 'e') e.preventDefault(); }}
                                                        placeholder="0"
                                                        className="w-16 bg-white dark:bg-stone-800 border border-blue-200 dark:border-stone-700 rounded-xl p-2 text-xs font-black text-center outline-none focus:ring-2 focus:ring-blue-200"
                                                    />
                                                    <span className="text-[10px] font-bold text-stone-400">%</span>
                                                    {quoteMarkup > 0 && <span className="text-[10px] font-bold text-blue-500">+${Math.round(markupAmount).toLocaleString()}</span>}
                                                </div>
                                                {/* Discounts Row */}
                                                <div className="flex items-center gap-4 flex-wrap">
                                                    <div className="flex items-center gap-2">
                                                        <Banknote className="w-3.5 h-3.5 text-emerald-500" />
                                                        <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">Efvo</span>
                                                        <select
                                                            value={quoteDiscountCash}
                                                            onChange={e => setQuoteDiscountCash(Number(e.target.value))}
                                                            className="w-16 bg-white dark:bg-stone-800 border border-emerald-200 dark:border-stone-700 rounded-md px-1 py-1 text-[10px] font-black outline-none focus:ring-2 focus:ring-emerald-200"
                                                        >
                                                            {Array.from({ length: 5 }, (_, i) => i * 5).map(val => (
                                                                <option key={val} value={val}>{val === 0 ? '0%' : `-${val}%`}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <ArrowRightLeft className="w-3.5 h-3.5 text-violet-500" />
                                                        <span className="text-[9px] font-black text-violet-600 uppercase tracking-widest">Transf</span>
                                                        <select
                                                            value={quoteDiscountTransfer}
                                                            onChange={e => setQuoteDiscountTransfer(Number(e.target.value))}
                                                            className="w-16 bg-white dark:bg-stone-800 border border-violet-200 dark:border-stone-700 rounded-md px-1 py-1 text-[10px] font-black outline-none focus:ring-2 focus:ring-violet-200"
                                                        >
                                                            {Array.from({ length: 4 }, (_, i) => i * 5).map(val => (
                                                                <option key={val} value={val}>{val === 0 ? '0%' : `-${val}%`}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <CreditCard className="w-3.5 h-3.5 text-orange-500" />
                                                        <span className="text-[9px] font-black text-orange-600 uppercase tracking-widest">Cuotas</span>
                                                        <select
                                                            value={quoteDiscountCard}
                                                            onChange={e => setQuoteDiscountCard(Number(e.target.value))}
                                                            className="w-16 bg-white dark:bg-stone-800 border border-orange-200 dark:border-stone-700 rounded-md px-1 py-1 text-[10px] font-black outline-none focus:ring-2 focus:ring-orange-200"
                                                        >
                                                            {[0].map(val => (
                                                                <option key={val} value={val}>{val === 0 ? '0%' : `-${val}%`}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                </div>
                                                {/* Totals */}
                                                <div className="flex justify-between items-end">
                                                    <div>
                                                        <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest">Subtotal: ${subtotal.toLocaleString()}</p>
                                                        {quoteMarkup > 0 && <p className="text-[10px] font-bold text-blue-500">Precio de Lista: ${Math.round(priceWithMarkup).toLocaleString()}</p>}
                                                    </div>
                                                    <div className="flex gap-4 items-end">
                                                        <div className="text-right">
                                                            <p className="text-[8px] font-black text-emerald-600 uppercase tracking-widest">💵 Efvo</p>
                                                            <p className="text-xl font-black text-emerald-600 tracking-tighter">${Math.round(totalCash).toLocaleString()}</p>
                                                        </div>
                                                        <div className="text-right">
                                                            <p className="text-[8px] font-black text-violet-600 uppercase tracking-widest">🏦 Transf</p>
                                                            <p className="text-sm font-black text-violet-600 tracking-tighter">${Math.round(totalTransfer).toLocaleString()}</p>
                                                        </div>
                                                        <div className="text-right">
                                                            <p className="text-[8px] font-black text-orange-600 uppercase tracking-widest">💳 Cuotas</p>
                                                            <p className="text-sm font-black text-orange-500 tracking-tighter">${Math.round(totalCard).toLocaleString()}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={async () => {
                                                        setSavingQuote(true);
                                                        try {
                                                            const quoteCrystals = quoteItems.some(i => i.product.type === 'Cristal' || i.product.category === 'LENS');
                                                            await fetch('/api/orders', {
                                                                method: 'POST',
                                                                headers: { 'Content-Type': 'application/json' },
                                                                body: JSON.stringify({
                                                                    clientId: contactId,
                                                                    items: quoteItems.map(i => ({ productId: i.product.id, quantity: i.quantity, price: i.price, eye: i.eye })),
                                                                    discount: quoteDiscountCash,
                                                                    markup: quoteMarkup,
                                                                    discountCash: quoteDiscountCash,
                                                                    discountTransfer: quoteDiscountTransfer,
                                                                    discountCard: quoteDiscountCard,
                                                                    subtotalWithMarkup: priceWithMarkup,
                                                                    total: Math.round(totalCash),
                                                                    frameSource: quoteCrystals ? quoteFrameSource : null,
                                                                    userFrameBrand: quoteFrameSource === 'USUARIO' ? quoteUserFrame.brand : null,
                                                                    userFrameModel: quoteFrameSource === 'USUARIO' ? quoteUserFrame.model : null,
                                                                    userFrameNotes: quoteFrameSource === 'USUARIO' ? quoteUserFrame.notes : null,
                                                                    prescriptionId: quoteCrystals ? quotePrescriptionId : null,
                                                                })
                                                            });
                                                            setIsQuoting(false);
                                                            setQuoteItems([]);
                                                            setQuoteMarkup(0);
                                                            setQuoteDiscountCash(20);
                                                            setQuoteDiscountTransfer(15);
                                                            setQuoteDiscountCard(0);
                                                            setQuotePrescriptionId(null);
                                                            fetchContact();
                                                        } catch (e) { console.error(e); }
                                                        finally { setSavingQuote(false); }
                                                    }}
                                                    disabled={savingQuote}
                                                    className="w-full py-5 bg-emerald-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition-all shadow-xl flex items-center justify-center gap-2"
                                                >
                                                    {savingQuote ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> GUARDANDO...</> : <><Save className="w-4 h-4" /> GUARDAR PRESUPUESTO</>}
                                                </button>
                                            </div>
                                        );
                                    })()}
                                </div>
                            )}

                            {/* Orders List with Lab Status */}
                            {contact.orders && contact.orders.length > 0 ? (
                                (() => {
                                    const salesOrders = contact.orders.filter((o: any) => o.orderType === 'SALE');
                                    const quoteOrders = contact.orders.filter((o: any) => o.orderType !== 'SALE');
                                    const relevantOrders = activeSection === 'sales' ? salesOrders : quoteOrders;

                                    if (relevantOrders.length === 0) {
                                        return (
                                            <div className="text-center py-16 border-2 border-dashed border-stone-200 rounded-[3rem]">
                                                {activeSection === 'sales' ? <Receipt className="w-12 h-12 text-stone-200 mx-auto mb-4" /> : <Calculator className="w-12 h-12 text-stone-200 mx-auto mb-4" />}
                                                <p className="text-xs font-black text-stone-300 uppercase tracking-widest">
                                                    {activeSection === 'sales' ? 'No hay ventas registradas' : 'No hay presupuestos registrados'}
                                                </p>
                                            </div>
                                        );
                                    }

                                    let salesRendered = false;
                                    let quotesRendered = false;
                                    return relevantOrders.map((order: any, idx: number) => {
                                        const progress = (order.paid / order.total) * 100;
                                        const minRequired = (order.total || 0) * 0.4;
                                        const isConfirmed = contact.status === 'CONFIRMED';
                                        const labStatus = order.labStatus || 'NONE';
                                        const isSale = order.orderType === 'SALE';
                                        const isQuote = !isSale;
                                        const isLockedSale = isSale && currentUserRole !== 'ADMIN';

                                        // Section headers
                                        let sectionHeader = null;
                                        if (isSale && !salesRendered) {
                                            salesRendered = true;
                                            sectionHeader = (
                                                <div key="sales-header" className="flex items-center gap-3 mb-2">
                                                    <div className="h-px flex-1 bg-emerald-200 dark:bg-emerald-800" />
                                                    <span className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.2em] flex items-center gap-1.5">
                                                        <Receipt className="w-3.5 h-3.5" /> Ventas Registradas ({salesOrders.length})
                                                    </span>
                                                    <div className="h-px flex-1 bg-emerald-200 dark:bg-emerald-800" />
                                                </div>
                                            );
                                        }
                                        if (isQuote && !quotesRendered) {
                                            quotesRendered = true;
                                            sectionHeader = (
                                                <div key="quotes-header" className={`flex items-center gap-3 mb-2`}>
                                                    <div className="h-px flex-1 bg-amber-200 dark:bg-amber-800" />
                                                    <span className="text-[10px] font-black text-amber-600 uppercase tracking-[0.2em] flex items-center gap-1.5">
                                                        <Calculator className="w-3.5 h-3.5" /> Presupuestos ({quoteOrders.length})
                                                    </span>
                                                    <div className="h-px flex-1 bg-amber-200 dark:bg-amber-800" />
                                                </div>
                                            );
                                        }

                                        const LAB_LABELS: Record<string, { label: string; color: string; next?: string; nextLabel?: string }> = {
                                            'NONE': { label: 'Sin enviar', color: 'bg-stone-100 text-stone-500', next: 'SENT', nextLabel: 'Enviar a Lab' },
                                            'SENT': { label: 'Enviado', color: 'bg-blue-100 text-blue-600', next: 'IN_PROGRESS', nextLabel: 'En Proceso' },
                                            'IN_PROGRESS': { label: 'En Lab', color: 'bg-amber-100 text-amber-600', next: 'READY', nextLabel: 'Marcar Listo' },
                                            'READY': { label: 'Listo', color: 'bg-emerald-100 text-emerald-600', next: 'DELIVERED', nextLabel: 'Entregado' },
                                            'DELIVERED': { label: 'Entregado', color: 'bg-indigo-100 text-indigo-600' },
                                        };
                                        const labInfo = LAB_LABELS[labStatus] || LAB_LABELS['NONE'];

                                        // Collapsed summary line for quotes
                                        if (isQuote && expandedOrderId !== order.id) {
                                            return (
                                                <React.Fragment key={order.id}>
                                                    {sectionHeader}
                                                    <button
                                                        onClick={() => setExpandedOrderId(order.id)}
                                                        className={`w-full flex items-center justify-between bg-white dark:bg-stone-800 border ${order.isDeleted ? 'border-red-100 opacity-50' : 'border-stone-200 dark:border-stone-700 hover:border-amber-300 dark:hover:border-amber-700'} rounded-2xl px-5 py-4 transition-all hover:shadow-md group text-left`}
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            <span className="text-base">{order.isDeleted ? '🗑️' : '📋'}</span>
                                                            <div>
                                                                <span className="text-xs font-black text-stone-700 dark:text-stone-200 block">
                                                                    #{order.id.slice(-4).toUpperCase()} · ${(order.total || 0).toLocaleString()}
                                                                </span>
                                                                <span className="text-[9px] font-bold text-stone-400 block">
                                                                    {format(new Date(order.createdAt), "d MMM yy", { locale: es })} · {order.items?.length || 0} productos
                                                                    {order.discount > 0 ? ` · ${order.discount}% desc.` : ''}
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            {order.paid > 0 && (
                                                                <span className="text-[9px] font-black text-emerald-500 bg-emerald-50 px-2 py-1 rounded-lg">
                                                                    ${(order.paid || 0).toLocaleString()} pagado
                                                                </span>
                                                            )}
                                                            <ChevronRight className="w-4 h-4 text-stone-300 group-hover:text-amber-500 transition-colors" />
                                                        </div>
                                                    </button>
                                                </React.Fragment>
                                            );
                                        }

                                        return (
                                            <React.Fragment key={order.id}>
                                                {sectionHeader}
                                                <div className={`bg-white dark:bg-stone-800 border-2 ${isSale ? 'border-emerald-200 dark:border-emerald-800 shadow-2xl' : 'border-amber-200 dark:border-amber-800 shadow-xl'} rounded-[2.5rem] p-8 transition-all relative`}>
                                                    {/* Locked sale overlay indicator */}
                                                    {isLockedSale && (
                                                        <div className="absolute top-4 right-4 flex items-center gap-1.5 px-3 py-1.5 bg-stone-100 dark:bg-stone-700 rounded-xl border border-stone-200 dark:border-stone-600">
                                                            <Lock className="w-3 h-3 text-stone-400" />
                                                            <span className="text-[8px] font-black text-stone-400 uppercase tracking-widest">Bloqueado</span>
                                                        </div>
                                                    )}
                                                    {/* Header */}
                                                    <div className="flex justify-between items-start mb-6">
                                                        <div>
                                                            <span className="text-[10px] font-black text-primary uppercase tracking-widest flex items-center gap-2 mb-1">
                                                                <Calculator className="w-3 h-3" /> {isSale ? 'Venta' : 'Presupuesto'} #{order.id.slice(-4).toUpperCase()}
                                                            </span>
                                                            <h3 className="text-2xl font-black text-stone-800 dark:text-white tracking-tighter">
                                                                ${(order.total || 0).toLocaleString()}
                                                            </h3>
                                                        </div>
                                                        <div className="flex items-center gap-2 flex-wrap justify-end">
                                                            {/* Quote/Sale badge */}
                                                            <span className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest ${isSale ? 'bg-emerald-500 text-white' : 'bg-amber-100 text-amber-700'}`}>
                                                                {isSale ? '🛒 VENTA' : '📋 PRESUPUESTO'}
                                                            </span>
                                                            {/* Lab status - only for sales */}
                                                            {isSale && (
                                                                <span className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest ${labInfo.color}`}>
                                                                    {labInfo.label}
                                                                </span>
                                                            )}
                                                            {/* Payment status */}
                                                            {order.paid >= order.total ? (
                                                                <span className="px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest bg-emerald-100 text-emerald-600">PAGADO</span>
                                                            ) : (
                                                                <span className="px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest bg-stone-900 text-white">
                                                                    Saldo: ${((order.total || 0) - (order.paid || 0)).toLocaleString()}
                                                                    {order.discountCash > 0 && ' (efvo)'}
                                                                </span>
                                                            )}
                                                            {/* Collapse button for expanded quotes */}
                                                            {isQuote && (
                                                                <button onClick={() => setExpandedOrderId(null)} className="p-1.5 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-700 transition-colors" title="Colapsar">
                                                                    <X className="w-3.5 h-3.5 text-stone-400" />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Order Items */}
                                                    {order.items && order.items.length > 0 && (
                                                        <div className="mb-6 space-y-2">
                                                            {order.items.map((item: any) => (
                                                                <div key={item.id} className="flex justify-between items-center bg-stone-50 dark:bg-stone-900/50 px-4 py-2 rounded-xl">
                                                                    <span className="text-xs font-bold text-stone-600 dark:text-stone-300">{item.product?.brand} {item.product?.model || item.product?.name} x{item.quantity}</span>
                                                                    <span className="text-xs font-black text-stone-800 dark:text-white">
                                                                        ${((item.price * item.quantity) * (1 + (order.markup || 0) / 100)).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                                                    </span>
                                                                </div>
                                                            ))}
                                                            {(order.discount > 0 || order.discountCash > 0) && (
                                                                <div className="flex justify-end gap-3 flex-wrap">
                                                                    {order.markup > 0 && (
                                                                        <span className="text-[10px] font-bold text-blue-500 italic">+{order.markup}% markup</span>
                                                                    )}
                                                                    {order.discountCash > 0 && (
                                                                        <span className="text-[10px] font-bold text-emerald-500 italic">-{order.discountCash}% efectivo</span>
                                                                    )}
                                                                    {order.discountTransfer > 0 && (
                                                                        <span className="text-[10px] font-bold text-violet-500 italic">-{order.discountTransfer}% transferencia</span>
                                                                    )}
                                                                    {order.discountCard > 0 && (
                                                                        <span className="text-[10px] font-bold text-orange-500 italic">-{order.discountCard}% cuotas</span>
                                                                    )}
                                                                    {!(order.discountCash > 0) && order.discount > 0 && (
                                                                        <span className="text-[10px] font-bold text-red-400 italic">-{order.discount}% descuento aplicado</span>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}

                                                    {/* Frame Info */}
                                                    {order.frameSource && (
                                                        <div className="mb-4 flex items-center gap-3 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-2xl">
                                                            <span className="text-base">🕶️</span>
                                                            <div>
                                                                <p className="text-[9px] font-black text-amber-700 dark:text-amber-400 uppercase tracking-widest">Armazón</p>
                                                                <p className="text-[11px] font-bold text-amber-900 dark:text-amber-300">
                                                                    {order.frameSource === 'OPTICA'
                                                                        ? 'De la óptica (incluido)'
                                                                        : `Del cliente — ${order.userFrameBrand || ''} ${order.userFrameModel || ''}${order.userFrameNotes ? ' · ' + order.userFrameNotes : ''}`
                                                                    }
                                                                </p>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Payment Progress + Dual Saldo */}
                                                    <div className="space-y-3 mb-6">
                                                        <div className="flex justify-between items-end">
                                                            <div>
                                                                <span className="text-[9px] font-black text-stone-400 uppercase tracking-widest block mb-0.5">Pagado</span>
                                                                <span className="text-lg font-black text-emerald-500 tracking-tighter">${(order.paid || 0).toLocaleString()}</span>
                                                            </div>
                                                            {/* Dual/Triple Saldo */}
                                                            {order.subtotalWithMarkup > 0 && (order.discountCash > 0 || order.discountTransfer > 0) ? (
                                                                <div className="flex gap-4 text-right">
                                                                    {order.discountCash > 0 && (() => {
                                                                        const saldoCash = Math.max(0, (order.total || 0) - (order.paid || 0));
                                                                        return (
                                                                            <div>
                                                                                <span className="text-[8px] font-black text-emerald-600 uppercase tracking-widest block mb-0.5 flex items-center gap-0.5 justify-end">💵 Saldo Efvo</span>
                                                                                <span className="text-sm font-black text-emerald-600">${saldoCash.toLocaleString()}</span>
                                                                            </div>
                                                                        );
                                                                    })()}
                                                                    {order.discountTransfer > 0 && (() => {
                                                                        const totalTransfer = (order.subtotalWithMarkup || 0) * (1 - (order.discountTransfer || 0) / 100);
                                                                        const saldoTransfer = Math.max(0, Math.round(totalTransfer) - (order.paid || 0));
                                                                        return (
                                                                            <div>
                                                                                <span className="text-[8px] font-black text-violet-600 uppercase tracking-widest block mb-0.5 flex items-center gap-0.5 justify-end">🏦 Saldo Transf</span>
                                                                                <span className="text-sm font-black text-violet-600">${saldoTransfer.toLocaleString()}</span>
                                                                            </div>
                                                                        );
                                                                    })()}
                                                                    {(() => {
                                                                        const totalCard = (order.subtotalWithMarkup || 0) * (1 - (order.discountCard || 0) / 100);
                                                                        const saldoCard = Math.max(0, Math.round(totalCard) - (order.paid || 0));
                                                                        return (
                                                                            <div>
                                                                                <span className="text-[8px] font-black text-orange-600 uppercase tracking-widest block mb-0.5 flex items-center gap-0.5 justify-end">💳 Saldo Cuotas</span>
                                                                                <span className="text-sm font-black text-orange-500">${saldoCard.toLocaleString()}</span>
                                                                            </div>
                                                                        );
                                                                    })()}
                                                                </div>
                                                            ) : (
                                                                <div className="text-right">
                                                                    <span className="text-[9px] font-black text-stone-400 uppercase tracking-widest block mb-0.5">Saldo</span>
                                                                    <span className="text-sm font-black text-stone-800 dark:text-stone-300">${((order.total || 0) - (order.paid || 0)).toLocaleString()}</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div className="h-4 bg-stone-100 dark:bg-stone-900 rounded-full border border-stone-200 dark:border-stone-700 overflow-hidden relative">
                                                            <div className={`h-full transition-all duration-1000 ${order.paid >= minRequired ? 'bg-emerald-500' : 'bg-amber-500'}`} style={{ width: `${Math.min(progress, 100)}%` }} />
                                                            <div className="absolute top-0 left-[40%] h-full w-0.5 bg-stone-900/10 dark:bg-white/10" />
                                                        </div>
                                                    </div>

                                                    {/* Payments History */}
                                                    {order.payments && order.payments.length > 0 && (
                                                        <div className="mb-6">
                                                            <h4 className="text-[9px] font-black text-stone-400 uppercase tracking-widest mb-3">Pagos Registrados</h4>
                                                            <div className="space-y-2">
                                                                {order.payments.map((p: any) => (
                                                                    <div key={p.id} className="flex items-center justify-between bg-stone-50 dark:bg-stone-900/50 px-4 py-3 rounded-xl">
                                                                        <div className="flex items-center gap-3">
                                                                            <div className="w-8 h-8 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-lg flex items-center justify-center">
                                                                                <Banknote className="w-4 h-4" />
                                                                            </div>
                                                                            <div>
                                                                                <span className="text-xs font-black text-stone-700 dark:text-stone-200 block">{getPaymentLabel(p.method)}</span>
                                                                                <span className="text-[9px] text-stone-400">{new Date(p.date).toLocaleDateString('es-AR')} {p.notes ? `· ${p.notes}` : ''}</span>
                                                                            </div>
                                                                        </div>
                                                                        <div className="flex items-center gap-3">
                                                                            {p.receiptUrl && (
                                                                                <button
                                                                                    onClick={() => setViewingReceipt(p.receiptUrl)}
                                                                                    className="p-1.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg hover:scale-110 transition-all"
                                                                                    title="Ver comprobante"
                                                                                >
                                                                                    <Receipt className="w-3.5 h-3.5" />
                                                                                </button>
                                                                            )}
                                                                            <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">${p.amount?.toLocaleString()}</span>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Download Paid Receipt */}
                                                    {order.paid >= order.total && order.total > 0 && (
                                                        <button
                                                            onClick={() => downloadPaidReceipt(order)}
                                                            className="w-full mb-4 py-3 bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 border-2 border-emerald-200 dark:border-emerald-800 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:scale-[1.02] transition-all flex items-center justify-center gap-2"
                                                        >
                                                            <Download className="w-3.5 h-3.5" /> Descargar Comprobante Saldado
                                                        </button>
                                                    )}

                                                    {/* Lab Status Action — only for sales */}
                                                    {isSale && !order.isDeleted && labInfo.next && (
                                                        <div className="flex gap-3 mb-4">
                                                            <button
                                                                onClick={async () => {
                                                                    await fetch(`/api/orders/${order.id}`, {
                                                                        method: 'PATCH',
                                                                        headers: { 'Content-Type': 'application/json' },
                                                                        body: JSON.stringify({ labStatus: labInfo.next })
                                                                    });
                                                                    fetchContact();
                                                                }}
                                                                className="flex-1 py-3 bg-blue-500 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2"
                                                            >
                                                                <ArrowRight className="w-3.5 h-3.5" /> {labInfo.nextLabel}
                                                            </button>
                                                        </div>
                                                    )}

                                                    {/* Lab Sent Date */}
                                                    {order.labSentAt && (
                                                        <p className="text-[9px] font-bold text-stone-400 italic mb-4">
                                                            Enviado al lab: {format(new Date(order.labSentAt), "d 'de' MMM, HH:mm", { locale: es })}
                                                        </p>
                                                    )}

                                                    {/* Actions */}
                                                    {!order.isDeleted && (
                                                        <div className="pt-4 border-t border-stone-100 dark:border-stone-700 space-y-3">
                                                            {/* Locked sale message for non-admin */}
                                                            {isLockedSale && (
                                                                <div className="flex items-center gap-3 p-4 bg-stone-50 dark:bg-stone-900/50 border-2 border-stone-200 dark:border-stone-700 rounded-2xl">
                                                                    <Lock className="w-5 h-5 text-stone-400 flex-shrink-0" />
                                                                    <div>
                                                                        <p className="text-[10px] font-black text-stone-500 uppercase tracking-widest">Venta Registrada — Solo lectura</p>
                                                                        <p className="text-[9px] font-bold text-stone-400 mt-0.5">Para modificar o eliminar esta venta, solicitá autorización al administrador.</p>
                                                                    </div>
                                                                </div>
                                                            )}
                                                            {isQuote && (
                                                                <>
                                                                    <button
                                                                        onClick={async () => {
                                                                            setConvertError(null);
                                                                            setRefreshingPrices(true);
                                                                            try {
                                                                                // Auto-check for price changes first
                                                                                const refreshRes = await fetch(`/api/orders/${order.id}/refresh-prices`, { method: 'POST' });
                                                                                const refreshData = await refreshRes.json();

                                                                                if (refreshData.updated && refreshData.changes?.length > 0) {
                                                                                    // Prices changed — show confirmation dialog
                                                                                    setPriceChanges(refreshData.changes);
                                                                                    setPendingConvertOrderId(order.id);
                                                                                    setRefreshingPrices(false);
                                                                                    fetchContact();
                                                                                    return;
                                                                                }

                                                                                // No price changes — proceed with conversion
                                                                                const res = await fetch(`/api/orders/${order.id}`, {
                                                                                    method: 'PATCH',
                                                                                    headers: { 'Content-Type': 'application/json' },
                                                                                    body: JSON.stringify({ orderType: 'SALE' })
                                                                                });
                                                                                if (!res.ok) {
                                                                                    const data = await res.json();
                                                                                    setConvertError(data.error || 'Error al convertir en venta');
                                                                                    return;
                                                                                }
                                                                                fetchContact();
                                                                            } catch (e) {
                                                                                setConvertError('Error de conexión');
                                                                            } finally {
                                                                                setRefreshingPrices(false);
                                                                            }
                                                                        }}
                                                                        disabled={refreshingPrices}
                                                                        className="w-full py-4 bg-emerald-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition-all shadow-xl flex items-center justify-center gap-2"
                                                                    >
                                                                        {refreshingPrices
                                                                            ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> VERIFICANDO PRECIOS...</>
                                                                            : <><CheckCircle2 className="w-4 h-4" /> CONVERTIR EN VENTA</>
                                                                        }
                                                                    </button>
                                                                    {convertError && (
                                                                        <p className="mt-2 text-[10px] font-black text-red-500 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-xl text-center">
                                                                            ⚠️ {convertError}
                                                                        </p>
                                                                    )}
                                                                </>
                                                            )}
                                                            <div className={`grid ${isLockedSale ? 'grid-cols-2' : 'grid-cols-3'} gap-3`}>
                                                                <button
                                                                    onClick={() => setIsAddingPayment(order.id)}
                                                                    className="py-3 bg-stone-900 text-white dark:bg-stone-700 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:scale-105 transition-all flex items-center justify-center gap-2"
                                                                >
                                                                    <Plus className="w-3.5 h-3.5" /> REGISTRAR PAGO
                                                                </button>
                                                                {order.paid >= minRequired && contact.status === 'CONFIRMED' && (
                                                                    <button
                                                                        onClick={handleCloseSale}
                                                                        className="py-3 bg-emerald-500 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:scale-105 transition-all flex items-center justify-center gap-2"
                                                                    >
                                                                        <CheckCircle2 className="w-3.5 h-3.5" /> CERRAR VENTA
                                                                    </button>
                                                                )}
                                                                <button
                                                                    onClick={() => {
                                                                        const items = order.items || [];
                                                                        const subtotalBase = items.reduce((s: number, it: any) => s + (it.price * it.quantity), 0);
                                                                        const markupPct = order.markup || 0;
                                                                        const listPrice = subtotalBase * (1 + markupPct / 100);
                                                                        const discountCash = order.discountCash !== null ? order.discountCash : (order.discount || 20);
                                                                        const discountTransfer = order.discountTransfer !== null ? order.discountTransfer : 15;

                                                                        const amtCash = Math.round(listPrice * (1 - discountCash / 100));
                                                                        const amtTransfer = Math.round(listPrice * (1 - discountTransfer / 100));
                                                                        const cuota3 = Math.round(listPrice / 3);
                                                                        const cuota6 = Math.round(listPrice / 6);

                                                                        const dateStr = new Date(order.createdAt).toLocaleDateString('es-AR', { year: 'numeric', month: 'long', day: 'numeric' });
                                                                        const logoUrl = `${window.location.origin}/assets/logo-atelier-optica.png`;

                                                                        const progress = listPrice > 0 ? (order.paid / listPrice) * 100 : 0;
                                                                        const saldoCash = Math.max(0, amtCash - (order.paid || 0));
                                                                        const saldoTransfer = Math.max(0, amtTransfer - (order.paid || 0));
                                                                        const saldoCard = Math.max(0, Math.round(listPrice) - (order.paid || 0));

                                                                        const html = `<!DOCTYPE html><html><head><meta charset='utf-8'>
<title>Presupuesto ${contact.name}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800;900&display=swap');
  * { margin:0; padding:0; box-sizing:border-box; font-family:'Inter',sans-serif; }
  body { padding:40px 50px; color:#1c1917; line-height:1.5; }
  .letterhead { display:flex; justify-content:space-between; align-items:center; padding-bottom:20px; margin-bottom:8px; border-bottom:3px solid #1c1917; }
  .letterhead-left { display:flex; align-items:center; gap:16px; }
  .letterhead-logo { height:52px; }
  .letterhead-right { text-align:right; font-size:10px; color:#78716c; line-height:1.6; }
  .letterhead-right .address { font-weight:600; color:#57534e; }
  .tagline { text-align:center; font-size:9px; font-weight:800; text-transform:uppercase; letter-spacing:3px; color:#a0845e; padding:10px 0 20px; }
  .meta-row { display:flex; justify-content:space-between; align-items:center; margin-bottom:24px; }
  .meta-row .doc-id { font-size:13px; font-weight:900; color:#1c1917; }
  .meta-row .doc-date { font-size:11px; color:#78716c; }
  .client { background:#fafaf9; border:1px solid #e7e5e4; border-radius:12px; padding:16px 20px; margin-bottom:28px; }
  .client-label { font-size:9px; font-weight:800; text-transform:uppercase; letter-spacing:2px; color:#a8a29e; }
  .client-name { font-size:18px; font-weight:900; color:#1c1917; margin-top:2px; }
  table { width:100%; border-collapse:collapse; margin-bottom:24px; }
  th { background:#1c1917; color:white; font-size:9px; font-weight:800; text-transform:uppercase; letter-spacing:2px; padding:12px 16px; text-align:left; }
  th:last-child, td:last-child { text-align:right; }
  td { padding:12px 16px; font-size:13px; border-bottom:1px solid #f5f5f4; }
  td:first-child { font-weight:700; }
  .totals { display:flex; justify-content:flex-end; }
  .totals-box { background:#fafaf9; border:2px solid #e7e5e4; border-radius:16px; padding:20px 28px; min-width:320px; }
  .total-row { display:flex; justify-content:space-between; font-size:13px; margin-bottom:8px; color:#57534e; }
  .total-row.highlight-transf { font-size:15px; font-weight:800; color:#8b5cf6; margin-top:12px; border-top:1px solid #e7e5e4; padding-top:12px; }
  .total-row.final { font-size:22px; font-weight:900; color:#10b981; border-top:2px solid #10b981; padding-top:10px; margin-top:8px; }
  .footer { margin-top:48px; padding-top:20px; border-top:1px solid #e7e5e4; font-size:10px; color:#a8a29e; text-align:center; text-transform:uppercase; letter-spacing:2px; }
  
  /* Progress and Payment Styles */
  .payments-section { border: 2px solid #10b981; border-radius: 16px; padding: 20px; margin-bottom: 24px; }
  .payments-header { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 20px; }
  .payment-stat h4 { font-size: 9px; font-weight: 900; text-transform: uppercase; letter-spacing: 2px; color: #a8a29e; margin-bottom: 4px; }
  .payment-stat .val-paid { font-size: 24px; font-weight: 900; color: #10b981; }
  .saldos-block { display: flex; gap: 24px; text-align: right; }
  .saldo-item .label { font-size: 8px; font-weight: 900; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 4px; display: block; }
  .saldo-item .val { font-size: 14px; font-weight: 900; }
  .s-efvo .label, .s-efvo .val { color: #10b981; }
  .s-transf .label, .s-transf .val { color: #8b5cf6; }
  .s-cuotas .label, .s-cuotas .val { color: #f97316; }
  .progress-bg { height: 16px; background: #f5f5f4; border-radius: 8px; overflow: hidden; position: relative; border: 1px solid #e7e5e4; margin-bottom: 20px; }
  .progress-bar { height: 100%; background: #10b981; transition: width 0.3s; }
  .marker { position: absolute; top: 0; left: 40%; height: 100%; width: 2px; background: rgba(0,0,0,0.1); }
  .payments-list h4 { font-size: 9px; font-weight: 900; text-transform: uppercase; letter-spacing: 2px; color: #a8a29e; margin-bottom: 12px; }
  .payment-row { display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; background: #fafaf9; border-radius: 12px; margin-bottom: 8px; }
  .payment-row .info { display: flex; flex-direction: column; }
  .payment-row .method { font-size: 12px; font-weight: 900; color: #44403c; }
  .payment-row .date { font-size: 9px; color: #a8a29e; margin-top: 2px; }
  .payment-row .amount { font-size: 14px; font-weight: 900; color: #10b981; }
</style></head><body>
<div class='letterhead'>
  <div class='letterhead-left'>
    <img src='${logoUrl}' class='letterhead-logo' alt='Atelier Óptica' />
  </div>
  <div class='letterhead-right'>
    <div class='address'>José Luis de Tejeda 4380</div>
    <div>Cerro de las Rosas, Córdoba</div>
  </div>
</div>
<div class='tagline'>La óptica mejor calificada en Google Business ⭐ 5/5</div>
<div class='meta-row'>
  <span class='doc-id'>Presupuesto #${order.id.slice(-4).toUpperCase()}</span>
  <span class='doc-date'>${dateStr}</span>
</div>
<div class='client'>
  <div class='client-label'>Cliente</div>
  <div class='client-name'>${contact.name}</div>
</div>
<table>
  <thead><tr><th>Producto</th><th>Cant.</th><th>Precio Unit.</th><th>Subtotal</th></tr></thead>
  <tbody>${items.map((it: any) => {
                                                                            const itPriceWithMarkup = it.price * (1 + markupPct / 100);
                                                                            return `<tr><td>${it.product?.brand || ''} ${it.product?.model || it.product?.name || ''}</td><td style='text-align:center'>${it.quantity}</td><td>$${itPriceWithMarkup.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td><td>$${(itPriceWithMarkup * it.quantity).toLocaleString(undefined, { maximumFractionDigits: 2 })}</td></tr>`;
                                                                        }).join('')}</tbody>
</table>
${order.frameSource ? `<div style='background:#fffbeb;border:1px solid #fbbf24;border-radius:12px;padding:12px 16px;margin-bottom:16px;font-size:12px'><strong style='color:#92400e'>🕶️ Armazón:</strong> ${order.frameSource === 'OPTICA' ? 'De la óptica (incluido en el presupuesto)' : `Del cliente — ${order.userFrameBrand || ''} ${order.userFrameModel || ''}${order.userFrameNotes ? ' · ' + order.userFrameNotes : ''}`}</div>` : ''}

${(order.paid > 0 || (order.payments && order.payments.length > 0)) ? `
<div class='payments-section'>
  <div class='payments-header'>
    <div class='payment-stat'>
      <h4>Pagado</h4>
      <div class='val-paid'>$${(order.paid || 0).toLocaleString()}</div>
    </div>
    <div class='saldos-block'>
      ${order.discountCash > 0 ? `<div class='saldo-item s-efvo'><span class='label'>💵 Saldo Efvo</span><span class='val'>$${saldoCash.toLocaleString()}</span></div>` : ''}
      ${order.discountTransfer > 0 ? `<div class='saldo-item s-transf'><span class='label'>🏦 Saldo Transf</span><span class='val'>$${saldoTransfer.toLocaleString()}</span></div>` : ''}
      <div class='saldo-item s-cuotas'><span class='label'>💳 Saldo Cuotas</span><span class='val'>$${saldoCard.toLocaleString()}</span></div>
    </div>
  </div>
  <div class='progress-bg'>
    <div class='progress-bar' style='width: ${Math.min(progress, 100)}%;'></div>
    <div class='marker'></div>
  </div>
  ${(order.payments && order.payments.length > 0) ? `
  <div class='payments-list'>
    <h4>Pagos Registrados</h4>
    ${order.payments.map((p: any) => `
    <div class='payment-row'>
      <div class='info'>
        <span class='method'>${getPaymentLabel(p.method)}</span>
        <span class='date'>${new Date(p.date).toLocaleDateString('es-AR')} ${p.notes ? '· ' + p.notes : ''}</span>
      </div>
      <span class='amount'>$${p.amount?.toLocaleString()}</span>
    </div>
    `).join('')}
  </div>
  ` : ''}
</div>
` : ''}

<div class='totals'><div class='totals-box'>
  <div class='total-row' style='font-size: 15px; font-weight: 800; color: #1c1917'><span>Precio de Lista (Cuotas)</span><span>$${Math.round(listPrice).toLocaleString()}</span></div>
  <div class='total-row' style='font-size:11px; margin-top:-4px; margin-bottom: 2px'><span>↳ 3 cuotas s/interés de</span><span>$${cuota3.toLocaleString()}</span></div>
  <div class='total-row' style='font-size:11px; margin-top:0px'><span>↳ 6 cuotas s/interés de</span><span>$${cuota6.toLocaleString()}</span></div>
  <div class='total-row highlight-transf'><span>Total Transferencia (-${discountTransfer}%)</span><span>$${amtTransfer.toLocaleString()}</span></div>
  <div class='total-row final'><span>Total Efectivo (-${discountCash}%)</span><span>$${amtCash.toLocaleString()}</span></div>
</div></div>

${(() => {
  const hasMultifocal = items.some((it: any) => {
    const n = (it.product?.name || '').toLowerCase();
    const t = (it.product?.type || '').toLowerCase();
    return n.includes('multifocal') || n.includes('progresivo') || t.includes('multifocal');
  });
  const hasMonofocal = items.some((it: any) => {
    const n = (it.product?.name || '').toLowerCase();
    const t = (it.product?.type || '').toLowerCase();
    const cat = (it.product?.category || '').toUpperCase();
    return n.includes('monofocal') || t.includes('monofocal') || cat === 'LENS' || t.includes('cristal');
  });
  if (hasMultifocal || hasMonofocal) {
    const dias = hasMultifocal ? 10 : 5;
    const tipo = hasMultifocal ? 'Multifocal' : 'Monofocal';
    return `<div style='margin-top:20px;padding:14px 20px;background:#eff6ff;border:2px solid #93c5fd;border-radius:14px;display:flex;align-items:center;gap:12px'>
      <span style='font-size:22px'>🕐</span>
      <div>
        <span style='font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:2px;color:#3b82f6;display:block'>Tiempo de confección</span>
        <span style='font-size:14px;font-weight:900;color:#1e40af'>Cristales ${tipo}: ${dias} días hábiles</span>
      </div>
    </div>`;
  }
  return '';
})()}

<div class='footer'>Presupuesto válido por 5 días hábiles · Atelier Óptica · José Luis de Tejeda 4380, Córdoba</div>
</body></html>`;

                                                                        const printWindow = window.open('', '_blank', 'width=800,height=900');
                                                                        if (printWindow) {
                                                                            printWindow.document.write(html);
                                                                            printWindow.document.close();
                                                                            setTimeout(() => printWindow.print(), 400);
                                                                        }
                                                                    }}
                                                                    className="py-3 bg-stone-100 dark:bg-stone-700 text-stone-600 dark:text-stone-300 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:scale-105 transition-all flex items-center justify-center gap-2"
                                                                >
                                                                    <Download className="w-3.5 h-3.5" /> PDF
                                                                </button>
                                                                <button
                                                                    onClick={() => {
                                                                        const items = order.items || [];
                                                                        const subtotalBase = items.reduce((s: number, it: any) => s + (it.price * it.quantity), 0);
                                                                        const markupPct = order.markup || 0;
                                                                        const listPrice = subtotalBase * (1 + markupPct / 100);
                                                                        const discountCash = order.discountCash !== null ? order.discountCash : (order.discount || 20);
                                                                        const discountTransfer = order.discountTransfer !== null ? order.discountTransfer : 15;

                                                                        const amtCash = Math.round(listPrice * (1 - discountCash / 100));
                                                                        const amtTransfer = Math.round(listPrice * (1 - discountTransfer / 100));
                                                                        const cuota3 = Math.round(listPrice / 3);
                                                                        const cuota6 = Math.round(listPrice / 6);

                                                                        const lines = items.map((it: any) => {
                                                                            const itemTotalWithMarkup = (it.price * it.quantity) * (1 + markupPct / 100);
                                                                            return `• ${it.product?.brand || ''} ${it.product?.model || it.product?.name || ''} x${it.quantity} — $${itemTotalWithMarkup.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
                                                                        });
                                                                        let text = `✨ *PRESUPUESTO — ATELIER ÓPTICA* ✨\n`;
                                                                        text += `📍 José Luis de Tejeda 4380, Cerro de las Rosas, Córdoba\n`;
                                                                        text += `🏆 La óptica mejor calificada en Google Business ⭐ 5/5\n`;
                                                                        text += `\n👤 *Cliente:* ${contact.name}\n\n`;
                                                                        text += lines.join('\n');
                                                                        if (order.frameSource) {
                                                                            text += `\n\n🕶️ *Armazón:* ${order.frameSource === 'OPTICA' ? 'De la óptica (incluido)' : `Del cliente — ${order.userFrameBrand || ''} ${order.userFrameModel || ''}${order.userFrameNotes ? ' · ' + order.userFrameNotes : ''}`}`;
                                                                        }
                                                                        text += `\n\n———————————————`;
                                                                        text += `\n*Precio de Lista (Cuotas): $${Math.round(listPrice).toLocaleString()}*`;
                                                                        text += `\n↳ 3 cuotas s/interés de $${cuota3.toLocaleString()}`;
                                                                        text += `\n↳ 6 cuotas s/interés de $${cuota6.toLocaleString()}`;

                                                                        text += `\n\n🏦 *Total Transferencia (-${discountTransfer}%): $${amtTransfer.toLocaleString()}*`;
                                                                        text += `\n💵 *Total Efectivo (-${discountCash}%): $${amtCash.toLocaleString()}*`;
                                                                        text += `\n\n_Presupuesto válido por 5 días hábiles._`;
                                                                        const phone = contact.phone?.replace(/\D/g, '') || '';
                                                                        const waUrl = phone ? `https://wa.me/${phone}?text=${encodeURIComponent(text)}` : `https://wa.me/?text=${encodeURIComponent(text)}`;
                                                                        window.open(waUrl, '_blank');
                                                                    }}
                                                                    className="py-3 bg-emerald-500 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:scale-105 transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"
                                                                >
                                                                    <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )
                                                    }

                                                    {
                                                        order.isDeleted && (
                                                            <div className="mt-4 p-3 bg-red-50 text-red-600 rounded-xl border border-red-100">
                                                                <p className="text-[10px] font-black uppercase tracking-widest italic">Pedido Eliminado — {order.deletedReason}</p>
                                                            </div>
                                                        )
                                                    }

                                                    {!order.isDeleted && !isLockedSale && (
                                                        <button onClick={() => setIsDeletingOrder(order.id)} className="mt-4 text-[9px] font-black text-red-300 uppercase tracking-widest hover:text-red-500 transition-colors">
                                                            Eliminar Pedido
                                                        </button>
                                                    )}
                                                    {!order.isDeleted && isSale && currentUserRole === 'ADMIN' && (
                                                        <button onClick={() => setIsDeletingOrder(order.id)} className="mt-4 text-[9px] font-black text-red-300 uppercase tracking-widest hover:text-red-500 transition-colors flex items-center gap-1">
                                                            <Shield className="w-3 h-3" /> Eliminar Venta (Admin)
                                                        </button>
                                                    )}

                                                    {validationError && contact.status === 'CONFIRMED' && idx === 0 && (
                                                        <p className="mt-3 text-center text-[10px] font-black text-red-500 uppercase tracking-widest animate-bounce">{validationError}</p>
                                                    )}
                                                </div>
                                            </React.Fragment>
                                        );
                                    });
                                })()
                            ) : (!isQuoting && (
                                <div className="text-center py-16 border-2 border-dashed border-stone-200 rounded-[3rem]">
                                    {activeSection === 'sales' ? <Receipt className="w-12 h-12 text-stone-200 mx-auto mb-4" /> : <Calculator className="w-12 h-12 text-stone-200 mx-auto mb-4" />}
                                    <p className="text-xs font-black text-stone-300 uppercase tracking-widest">
                                        {activeSection === 'sales' ? 'No hay ventas registradas' : 'No hay presupuestos registrados'}
                                    </p>
                                </div>
                            ))}

                            {/* Modal de Pago */}
                            {isAddingPayment && (
                                <div className="fixed inset-0 bg-stone-900/80 backdrop-blur-sm z-[100] flex items-center justify-center p-6 animate-in fade-in duration-300">
                                    <div className="bg-white dark:bg-stone-800 w-full max-w-lg rounded-[3rem] p-10 shadow-huge animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
                                        <h3 className="text-2xl font-black text-stone-800 dark:text-white mb-8 tracking-tighter">Registrar Pago</h3>
                                        <div className="space-y-6">
                                            <div>
                                                <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest block mb-1">Monto</label>
                                                <input type="text" inputMode="numeric" value={paymentAmount ? formatCurrency(paymentAmount) : ''} onChange={e => { handlePaymentAmountChange(e); setPaymentWarning(null); }} className="w-full bg-stone-50 dark:bg-stone-900 border border-stone-100 dark:border-stone-700 p-5 rounded-2xl text-2xl font-black text-primary outline-none focus:ring-2 focus:ring-primary/20" placeholder="$0" />
                                                {paymentWarning && (
                                                    <p className="mt-2 text-xs font-black text-red-500 flex items-center gap-1.5 animate-in fade-in duration-300">
                                                        <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" /> {paymentWarning}
                                                    </p>
                                                )}
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest block mb-3">Forma de Pago</label>
                                                <div className="grid grid-cols-2 gap-2">
                                                    {PAYMENT_METHODS.map(m => {
                                                        const MIcon = m.icon;
                                                        const isSelected = paymentMethod === m.key;
                                                        return (
                                                            <button
                                                                key={m.key}
                                                                onClick={() => setPaymentMethod(m.key)}
                                                                className={`flex items-center gap-2.5 px-4 py-3 rounded-xl text-xs font-black transition-all border-2 ${isSelected
                                                                    ? `${m.color} text-white border-transparent shadow-lg scale-[1.02]`
                                                                    : 'bg-stone-50 dark:bg-stone-900 text-stone-600 dark:text-stone-300 border-stone-100 dark:border-stone-700 hover:border-stone-300 dark:hover:border-stone-500'
                                                                    }`}
                                                            >
                                                                <MIcon className="w-4 h-4 flex-shrink-0" />
                                                                <span className="truncate">{m.label}</span>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest block mb-1">Nota Interna</label>
                                                <input type="text" value={paymentNotes} onChange={e => setPaymentNotes(e.target.value)} className="w-full bg-stone-50 dark:bg-stone-900 border border-stone-100 dark:border-stone-700 p-4 rounded-2xl text-sm font-bold outline-none" placeholder="Ej: Seña inicial..." />
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest block mb-3">Comprobante (opcional)</label>
                                                {paymentReceiptUrl ? (
                                                    <div className="relative">
                                                        <img src={paymentReceiptUrl} alt="Comprobante" className="w-full h-40 object-cover rounded-2xl border-2 border-emerald-200 dark:border-emerald-800" />
                                                        <button
                                                            onClick={() => setPaymentReceiptUrl('')}
                                                            className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full hover:scale-110 transition-all shadow-lg"
                                                        >
                                                            <X className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <label className="flex flex-col items-center justify-center w-full h-28 bg-stone-50 dark:bg-stone-900 border-2 border-dashed border-stone-200 dark:border-stone-700 rounded-2xl cursor-pointer hover:border-primary transition-all group">
                                                        <ImageIcon className="w-6 h-6 text-stone-300 group-hover:text-primary transition-colors mb-2" />
                                                        <span className="text-[10px] font-black text-stone-400 group-hover:text-primary uppercase tracking-widest">Subir foto del comprobante</span>
                                                        <input type="file" className="hidden" accept="image/*" onChange={handlePaymentReceiptUpload} />
                                                    </label>
                                                )}
                                            </div>
                                        </div>
                                        <div className="mt-8 flex gap-4">
                                            <button onClick={() => { setIsAddingPayment(null); setPaymentReceiptUrl(''); }} className="flex-1 py-5 bg-stone-100 dark:bg-stone-700 text-stone-500 dark:text-stone-300 rounded-2xl font-black text-xs uppercase tracking-widest">CANCELAR</button>
                                            <button onClick={handleAddPayment} disabled={savingPayment || !paymentAmount} className={`flex-1 py-5 rounded-2xl font-black text-xs uppercase tracking-widest italic transition-all flex items-center justify-center gap-2 ${savingPayment || !paymentAmount ? 'bg-stone-200 text-stone-400 cursor-not-allowed' : 'bg-emerald-500 text-white hover:bg-emerald-600'}`}>{savingPayment ? (<><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> GUARDANDO...</>) : 'GUARDAR PAGO'}</button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Modal de cambios de precios */}
                            {priceChanges && priceChanges.length > 0 && (
                                <div className="fixed inset-0 bg-stone-900/80 backdrop-blur-sm z-[100] flex items-center justify-center p-6 animate-in fade-in duration-300">
                                    <div className="bg-white dark:bg-stone-800 w-full max-w-lg rounded-[3rem] p-10 shadow-huge animate-in zoom-in-95">
                                        <h3 className="text-xl font-black text-stone-800 dark:text-white mb-2 tracking-tighter">⚠️ Precios Actualizados</h3>
                                        <p className="text-xs font-bold text-stone-400 mb-6">Los siguientes precios cambiaron desde que se creó el presupuesto. Ya fueron actualizados automáticamente.</p>
                                        <div className="space-y-3 mb-8">
                                            {priceChanges.map((ch, i) => (
                                                <div key={i} className="flex items-center justify-between bg-stone-50 dark:bg-stone-900/50 px-4 py-3 rounded-xl">
                                                    <span className="text-xs font-bold text-stone-600 dark:text-stone-300">{ch.productName}</span>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs font-bold text-red-400 line-through">${ch.oldPrice.toLocaleString()}</span>
                                                        <ArrowRight className="w-3 h-3 text-stone-400" />
                                                        <span className="text-xs font-black text-emerald-600">${ch.newPrice.toLocaleString()}</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="flex gap-4">
                                            <button
                                                onClick={() => { setPriceChanges(null); setPendingConvertOrderId(null); }}
                                                className="flex-1 py-4 bg-stone-100 dark:bg-stone-700 text-stone-500 dark:text-stone-300 rounded-2xl font-black text-xs uppercase tracking-widest"
                                            >
                                                REVISAR
                                            </button>
                                            <button
                                                onClick={async () => {
                                                    if (!pendingConvertOrderId) return;
                                                    try {
                                                        const res = await fetch(`/api/orders/${pendingConvertOrderId}`, {
                                                            method: 'PATCH',
                                                            headers: { 'Content-Type': 'application/json' },
                                                            body: JSON.stringify({ orderType: 'SALE' })
                                                        });
                                                        if (!res.ok) {
                                                            const data = await res.json();
                                                            setConvertError(data.error || 'Error al convertir');
                                                        }
                                                        fetchContact();
                                                    } catch (e) {
                                                        setConvertError('Error de conexión');
                                                    } finally {
                                                        setPriceChanges(null);
                                                        setPendingConvertOrderId(null);
                                                    }
                                                }}
                                                className="flex-1 py-4 bg-emerald-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-emerald-600 transition-all"
                                            >
                                                CONTINUAR CON VENTA
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Modal ver comprobante */}
                            {viewingReceipt && (
                                <div className="fixed inset-0 bg-stone-900/90 backdrop-blur-md z-[110] flex items-center justify-center p-6 animate-in fade-in duration-300" onClick={() => setViewingReceipt(null)}>
                                    <div className="relative max-w-2xl max-h-[85vh]" onClick={e => e.stopPropagation()}>
                                        <img src={viewingReceipt} alt="Comprobante" className="max-w-full max-h-[80vh] rounded-3xl shadow-2xl border-4 border-white/20" />
                                        <button
                                            onClick={() => setViewingReceipt(null)}
                                            className="absolute -top-3 -right-3 p-3 bg-white text-stone-900 rounded-full shadow-xl hover:scale-110 transition-all"
                                        >
                                            <X className="w-5 h-5" />
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )
                    }
                </main>

                {/* Modal de Eliminación de Pedido */}
                {
                    isDeletingOrder && (
                        <div className="fixed inset-0 bg-stone-900/80 backdrop-blur-sm z-[100] flex items-center justify-center p-6 animate-in fade-in duration-300">
                            <div className="bg-white dark:bg-stone-800 w-full max-w-md rounded-[3rem] p-10 shadow-huge animate-in zoom-in-95">
                                <h3 className="text-2xl font-black text-stone-800 dark:text-white mb-4 tracking-tighter">Eliminar Pedido</h3>
                                <p className="text-xs font-bold text-stone-400 mb-8 lowercase tracking-tight">El pedido seguirá figurando en el sistema, pero no será procesable. Indica el motivo de la cancelación.</p>

                                <div className="space-y-6">
                                    <div>
                                        <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest block mb-1">Motivo de Eliminación</label>
                                        <textarea
                                            value={deletionReason}
                                            onChange={e => setDeletionReason(e.target.value)}
                                            className="w-full bg-stone-50 dark:bg-stone-900 border border-stone-100 p-5 rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-red-500/20"
                                            placeholder="Ej: Error en presupuesto, arrepentimiento del cliente..."
                                            rows={4}
                                        />
                                    </div>
                                </div>

                                <div className="mt-10 flex gap-4">
                                    <button
                                        onClick={() => {
                                            setIsDeletingOrder(null);
                                            setDeletionReason('');
                                        }}
                                        className="flex-1 py-5 bg-stone-100 dark:bg-stone-700 text-stone-500 dark:text-stone-300 rounded-2xl font-black text-xs uppercase tracking-widest"
                                    >
                                        CANCELAR
                                    </button>
                                    <button
                                        onClick={handleDeleteOrder}
                                        disabled={!deletionReason.trim()}
                                        className="flex-1 py-5 bg-red-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest disabled:opacity-50"
                                    >
                                        CONFIRMAR ELIMINACIÓN
                                    </button>
                                </div>
                            </div>
                        </div>
                    )
                }
            </div >
        </div >
    );
}
