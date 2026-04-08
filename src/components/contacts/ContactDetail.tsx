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
import { safePrice } from '@/lib/promo-utils';
import { Contact, Interaction, Prescription, Order } from '@/types/contacts';
import FileDropZone from '@/components/FileDropZone';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import CotizadorCart from '@/components/quotes/CotizadorCart';
import QuoteSummary from '@/components/quotes/QuoteSummary';
import InvoiceModal from '@/components/InvoiceModal';

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
    const [ocrWarning, setOcrWarning] = useState<string | null>(null);
    const [detectedDoctor, setDetectedDoctor] = useState<string | null>(null);
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
    const [invoiceOrder, setInvoiceOrder] = useState<any>(null);

    // Payment Methods
    const PAYMENT_METHODS = [
        { key: 'PAY_WAY_6_ISH', label: 'Pay Way 6 Ish', icon: CreditCard, color: 'bg-blue-500' },
        { key: 'PAY_WAY_3_ISH', label: 'Pay Way 3 Ish', icon: CreditCard, color: 'bg-blue-400' },
        { key: 'NARANJA_Z_ISH', label: 'Naranja Z Ish', icon: CreditCard, color: 'bg-orange-500' },
        { key: 'GO_CUOTAS_ISH', label: 'Go Cuotas Ish', icon: CreditCard, color: 'bg-violet-600' },
        { key: 'PAY_WAY_6_YANI', label: 'Pay Way 6 Yani', icon: CreditCard, color: 'bg-indigo-500' },
        { key: 'PAY_WAY_3_YANI', label: 'Pay Way 3 Yani', icon: CreditCard, color: 'bg-indigo-400' },
        { key: 'NARANJA_Z_YANI', label: 'Naranja Z Yani', icon: CreditCard, color: 'bg-orange-400' },
        { key: 'GO_CUOTAS', label: 'Go Cuotas', icon: CreditCard, color: 'bg-violet-500' },
        { key: 'EFECTIVO', label: 'Efectivo', icon: Banknote, color: 'bg-emerald-500' },
        { key: 'TRANSFERENCIA_ISHTAR', label: 'Transf. Cuenta Ishtar', icon: ArrowRightLeft, color: 'bg-sky-500' },
        { key: 'TRANSFERENCIA_LUCIA', label: 'Transf. Cuenta Lucía', icon: ArrowRightLeft, color: 'bg-sky-400' },
        { key: 'TRANSFERENCIA_ALTERNATIVA', label: 'Transf. Cuenta Alternativa', icon: ArrowRightLeft, color: 'bg-sky-600' },
    ];

    // Compute the correct order total based on the selected payment method
    const getOrderTotalForMethod = (order: any, method: string): number => {
        // Fallback: recalculate subtotalWithMarkup from items when missing (old records)
        const listPrice = (() => {
            if (order.subtotalWithMarkup && order.subtotalWithMarkup > 0) return order.subtotalWithMarkup;
            const subtotal = (order.items || []).reduce((s: number, it: any) => s + (it.price * it.quantity), 0);
            return subtotal * (1 + (order.markup || 0) / 100);
        })();
        // Card / installment methods → cuotas price (list price with card discount)
        if (method.startsWith('PAY_WAY') || method.startsWith('NARANJA') || method.startsWith('GO_CUOTAS')) {
            return Math.round(listPrice * (1 - (order.discountCard || 0) / 100));
        }
        // Transfer methods → transfer price
        if (method.startsWith('TRANSFERENCIA')) {
            return Math.round(listPrice * (1 - (order.discountTransfer || 0) / 100));
        }
        // Cash → existing total (already cash-discounted)
        return order.total || 0;
    };

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
    const [quoteItems, setQuoteItems] = useState<{ product: any; quantity: number; customPrice: number; eye?: 'OD' | 'OI'; uid: number }[]>([]);
    const [quoteMarkup, setQuoteMarkup] = useState(0);
    const [quoteDiscountCash, setQuoteDiscountCash] = useState(20);
    const [quoteDiscountTransfer, setQuoteDiscountTransfer] = useState(15);
    const [quoteDiscountCard, setQuoteDiscountCard] = useState(0);
    const [editingQuoteId, setEditingQuoteId] = useState<string | null>(null);
    const [savingQuote, setSavingQuote] = useState(false);
    const [isQuoteSuccess, setIsQuoteSuccess] = useState(false);

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

    // Prescription modal for sale conversion
    const [rxModalOrderId, setRxModalOrderId] = useState<string | null>(null);
    const [rxForm, setRxForm] = useState({
        sphereOD: '', cylinderOD: '', axisOD: '',
        sphereOI: '', cylinderOI: '', axisOI: '',
        additionOD: '', additionOI: '',
        distanceOD: '', distanceOI: '',
        heightOD: '', heightOI: '',
        notes: '', imageUrl: '',
    });
    const [rxSaving, setRxSaving] = useState(false);
    const [rxError, setRxError] = useState<string | null>(null);
    const [rxUploading, setRxUploading] = useState(false);

    const resetRxForm = () => {
        setRxForm({ sphereOD: '', cylinderOD: '', axisOD: '', sphereOI: '', cylinderOI: '', axisOI: '', additionOD: '', additionOI: '', distanceOD: '', distanceOI: '', heightOD: '', heightOI: '', notes: '', imageUrl: '' });
        setRxError(null);
    };

    const applyPrescriptionToForm = (rx: any) => {
        if (!rx) return;
        setRxForm({
            sphereOD: rx.sphereOD != null ? String(rx.sphereOD) : '',
            cylinderOD: rx.cylinderOD != null ? String(rx.cylinderOD) : '',
            axisOD: rx.axisOD != null ? String(rx.axisOD) : '',
            sphereOI: rx.sphereOI != null ? String(rx.sphereOI) : '',
            cylinderOI: rx.cylinderOI != null ? String(rx.cylinderOI) : '',
            axisOI: rx.axisOI != null ? String(rx.axisOI) : '',
            additionOD: rx.additionOD != null ? String(rx.additionOD) : (rx.addition != null ? String(rx.addition) : ''),
            additionOI: rx.additionOI != null ? String(rx.additionOI) : (rx.addition != null ? String(rx.addition) : ''),
            distanceOD: rx.distanceOD != null ? String(rx.distanceOD) : (rx.pd != null ? String(rx.pd) : ''),
            distanceOI: rx.distanceOI != null ? String(rx.distanceOI) : (rx.pd != null ? String(rx.pd) : ''),
            heightOD: rx.heightOD != null ? String(rx.heightOD) : '',
            heightOI: rx.heightOI != null ? String(rx.heightOI) : '',
            notes: rx.notes || '',
            imageUrl: rx.imageUrl || '',
            // If it's a NEAR type, prioritize those spheres for the form if OD/OI sphere is empty
            ...(rx.prescriptionType === 'NEAR' && !rx.sphereOD && !rx.sphereOI ? {
                sphereOD: rx.nearSphereOD != null ? String(rx.nearSphereOD) : '',
                sphereOI: rx.nearSphereOI != null ? String(rx.nearSphereOI) : '',
            } : {})
        });
    };

    const openRxModal = (orderId: string) => {
        resetRxForm();
        const order: any = contact?.orders?.find((o: any) => o.id === orderId);
        
        let existingRx: any = null;
        if (order?.prescriptionId && contact?.prescriptions) {
            existingRx = contact.prescriptions.find((p: any) => p.id === order.prescriptionId);
        } else if (contact?.prescriptions && contact.prescriptions.length > 0) {
            existingRx = [...contact.prescriptions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
        }

        if (existingRx) {
            applyPrescriptionToForm(existingRx);
        }
        setRxModalOrderId(orderId);
    };

    const handleRxSubmitAndConvert = async (saveOnly: boolean = false) => {
        if (!rxModalOrderId || !contact) return;
        
        // Validate minimum fields only if converting to sale
        if (!saveOnly && !rxForm.sphereOD && !rxForm.sphereOI) {
            setRxError('Completá al menos el esférico de un ojo');
            return;
        }

        setRxSaving(true);
        setRxError(null);
        try {
            // 1. Prepare payload
            const rxPayload: any = { clientId: contact.id };
            if (rxForm.sphereOD) rxPayload.sphereOD = parseFloat(rxForm.sphereOD);
            if (rxForm.cylinderOD) rxPayload.cylinderOD = parseFloat(rxForm.cylinderOD);
            if (rxForm.axisOD) rxPayload.axisOD = parseInt(rxForm.axisOD);
            if (rxForm.sphereOI) rxPayload.sphereOI = parseFloat(rxForm.sphereOI);
            if (rxForm.cylinderOI) rxPayload.cylinderOI = parseFloat(rxForm.cylinderOI);
            if (rxForm.axisOI) rxPayload.axisOI = parseInt(rxForm.axisOI);
            if (rxForm.additionOD) rxPayload.additionOD = parseFloat(rxForm.additionOD);
            if (rxForm.additionOI) rxPayload.additionOI = parseFloat(rxForm.additionOI);
            if (rxForm.distanceOD) rxPayload.distanceOD = parseFloat(rxForm.distanceOD);
            if (rxForm.distanceOI) rxPayload.distanceOI = parseFloat(rxForm.distanceOI);
            if (rxForm.heightOD) rxPayload.heightOD = parseFloat(rxForm.heightOD);
            if (rxForm.heightOI) rxPayload.heightOI = parseFloat(rxForm.heightOI);
            if (rxForm.notes) rxPayload.notes = rxForm.notes;
            if (rxForm.imageUrl) rxPayload.imageUrl = rxForm.imageUrl;

            // 2. Find if there's an EXACT match already to avoid duplicates
            const duplicate = contact.prescriptions?.find((p: any) => 
                p.imageUrl === rxForm.imageUrl &&
                String(p.sphereOD || '') === String(rxForm.sphereOD || '') &&
                String(p.sphereOI || '') === String(rxForm.sphereOI || '') &&
                String(p.cylinderOD || '') === String(rxForm.cylinderOD || '') &&
                String(p.cylinderOI || '') === String(rxForm.cylinderOI || '') &&
                String(p.additionOD || '') === String(rxForm.additionOD || '') &&
                String(p.additionOI || '') === String(rxForm.additionOI || '')
            );

            let rxId = duplicate?.id;

            if (!rxId) {
                // Create new prescription
                const rxRes = await fetch(`/api/contacts/${contact.id}/prescriptions`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(rxPayload),
                });
                if (!rxRes.ok) {
                    const errData = await rxRes.json();
                    throw new Error(errData.error || 'Error al guardar la receta');
                }
                const newRx = await rxRes.json();
                rxId = newRx.id;
            }

            // 3. Link to Order (always, so we don't lose the selection)
            if (rxId) {
                await fetch(`/api/orders/${rxModalOrderId}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        prescriptionId: rxId 
                    }),
                });
            }

            if (!saveOnly) {
                // 4. Convert to SALE
                const saleRes = await fetch(`/api/orders/${rxModalOrderId}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ orderType: 'SALE' }),
                });
                if (!saleRes.ok) {
                    const errData = await saleRes.json();
                    throw new Error(errData.error || 'Error al convertir en venta');
                }
                setRxModalOrderId(null);
                resetRxForm();
            } else {
                // Just notify success
                setRxError('✓ Cambios guardados correctamente');
                setTimeout(() => setRxError(null), 3000);
            }

            fetchContact();
        } catch (e: any) {
            setRxError(e.message || 'Error de conexión');
            setConvertError(e.message || 'Error de conexión');
        } finally {
            setRxSaving(false);
        }
    };

    const handleRxImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setRxUploading(true);
        try {
            const formData = new FormData();
            formData.append('file', file);
            const res = await fetch('/api/upload', { method: 'POST', body: formData });
            const data = await res.json();
            if (data.url) {
                setRxForm(prev => ({ ...prev, imageUrl: data.url }));
            }
        } catch { }
        setRxUploading(false);
    };

    // Role Simulation (Until full auth is implemented)
    const [currentUserRole, setCurrentUserRole] = useState<'ADMIN' | 'STAFF'>('STAFF');

    useEffect(() => {
        const loadUser = async () => {
            const res = await fetch('/api/auth/me');
            if (res.ok) {
                const data = await res.json();
                setCurrentUserRole(data.role);
            }
        };
        loadUser();
        fetchContact();
    }, [contactId]);

    const handleEditQuote = (order: any) => {
        setQuoteItems((order.items || []).map((it: any, idx: number) => ({
            product: it.product,
            quantity: it.quantity,
            customPrice: it.price,  // API returns `price`, map to `customPrice` for CotizadorCart
            eye: it.eye,
            uid: Date.now() + idx
        })));
        setQuoteMarkup(order.markup || 0);
        setQuoteDiscountCash(order.discountCash ?? (order.discount || 20));
        setQuoteDiscountTransfer(order.discountTransfer ?? 15);
        setQuoteDiscountCard(order.discountCard ?? 0);
        setQuoteFrameSource(order.frameSource);
        setQuoteUserFrame({
            brand: order.userFrameBrand || '',
            model: order.userFrameModel || '',
            notes: order.userFrameNotes || ''
        });
        setQuotePrescriptionId(order.prescriptionId || null);
        setEditingQuoteId(order.id);
        setIsQuoting(true);
        setActiveSection('budget');
    };

    const handleCancelEditQuote = () => {
        setEditingQuoteId(null);
        setQuoteItems([]);
        setQuoteMarkup(0);
        setQuoteFrameSource(null);
        setQuoteUserFrame({ brand: '', model: '', notes: '' });
        setQuotePrescriptionId(null);
        setIsQuoting(false);
    };

    const handleSaveQuote = async () => {
        setSavingQuote(true);
        try {
            const hasCrystals = quoteItems.some(i => i.product.type === 'Cristal' || i.product.category === 'LENS');
            const url = editingQuoteId ? `/api/orders/${editingQuoteId}` : '/api/orders';
            const method = editingQuoteId ? 'PATCH' : 'POST';

            const subtotal = quoteItems.reduce((s, i) => s + (safePrice(i.customPrice) * (i.quantity || 1)), 0);
            const markupAmount = subtotal * (quoteMarkup / 100);
            const subtotalWithMarkup = subtotal + markupAmount;
            const total = subtotalWithMarkup * (1 - quoteDiscountCash / 100);

            await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    clientId: contactId,
                    items: quoteItems.map(i => ({ productId: i.product.id, quantity: i.quantity, price: i.customPrice, eye: i.eye })),
                    markup: quoteMarkup,
                    discountCash: quoteDiscountCash,
                    discountTransfer: quoteDiscountTransfer,
                    discountCard: quoteDiscountCard,
                    subtotalWithMarkup,
                    total,
                    frameSource: hasCrystals ? quoteFrameSource : null,
                    userFrameBrand: quoteFrameSource === 'USUARIO' ? quoteUserFrame.brand : null,
                    userFrameModel: quoteFrameSource === 'USUARIO' ? quoteUserFrame.model : null,
                    userFrameNotes: quoteFrameSource === 'USUARIO' ? quoteUserFrame.notes : null,
                    prescriptionId: hasCrystals ? quotePrescriptionId : null,
                })
            });
            setIsQuoteSuccess(true);
            // Don't reset everything yet, show success first
        } catch (e) {
            console.error('Error saving quote:', e);
        } finally {
            setSavingQuote(false);
        }
    };

    const handleConvertQuote = async (orderId: string) => {
        const order = contact?.orders?.find((o: any) => o.id === orderId);
        if (!order) return;
        setConvertError(null);
        const hasCrystals = order.items.some((it: any) => it.product?.type === 'Cristal' || it.product?.category === 'LENS');
        
        // If has crystals but already has a prescription linked, convert directly
        if (hasCrystals && order.prescriptionId) {
            try {
                const res = await fetch(`/api/orders/${orderId}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ orderType: 'SALE' }),
                });
                if (!res.ok) {
                    const errData = await res.json();
                    setConvertError(errData.error || 'Error al convertir en venta');
                    return;
                }
                fetchContact();
            } catch (e: any) {
                console.error(e);
                setConvertError(e.message || 'Error de conexión al convertir');
            }
        } else if (hasCrystals) {
            // No prescription linked — open the Rx modal to add/select one
            openRxModal(orderId);
        } else {
            try {
                const res = await fetch(`/api/orders/${orderId}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ orderType: 'SALE' }),
                });
                if (!res.ok) {
                    const errData = await res.json();
                    setConvertError(errData.error || 'Error al convertir en venta');
                    return;
                }
                fetchContact();
            } catch (e: any) {
                console.error(e);
                setConvertError(e.message || 'Error de conexión al convertir');
            }
        }
    };

    const fetchContact = async () => {
        try {
            const res = await fetch(`/api/contacts/${contactId}`);
            if (!res.ok) {
                const err = await res.json();
                console.error('Error fetching detail:', err.error);
                return;
            }
            const data = await res.json();
            if (data && data.id) {
                setContact(data);
            }
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

        const orderTotalForMethod = getOrderTotalForMethod(lastOrder, paymentMethod);
        const pendingBalance = orderTotalForMethod - (lastOrder.paid || 0);
        if (amount > pendingBalance && pendingBalance > 0 && !paymentWarning) {
            setPaymentWarning(`El monto ($${amount.toLocaleString('es-AR')}) supera el saldo pendiente de $${pendingBalance.toLocaleString('es-AR')} (${getPaymentLabel(paymentMethod)}). Presioná de nuevo para confirmar.`);
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
                // Determine if we should trigger automatic invoicing (Ishtar card/gateway methods)
                const isIshCardMethod = ['PAY_WAY_6_ISH', 'PAY_WAY_3_ISH', 'NARANJA_Z_ISH', 'GO_CUOTAS_ISH'].includes(paymentMethod);

                setIsAddingPayment(null);
                setPaymentAmount('');
                setPaymentMethod('EFECTIVO');
                setPaymentNotes('');
                setPaymentReceiptUrl('');
                setPaymentWarning(null);
                fetchContact();

                if (isIshCardMethod) {
                    // Create the task for the admin
                    onAddTask(contactId, `SOLICITUD FACTURA: ${getPaymentLabel(paymentMethod)} - $${amount.toLocaleString('es-AR')}`);

                    // If Admin, also show the modal directly
                    if (currentUserRole === 'ADMIN') {
                        setInvoiceOrder(lastOrder);
                    }
                }
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
            TRANSFERENCIA_ISHTAR: 'Transf. Cuenta Ishtar', TRANSFERENCIA_LUCIA: 'Transf. Cuenta Lucía', TRANSFERENCIA_ALTERNATIVA: 'Transf. Cuenta Alternativa',
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

    // Known doctors to detect in prescriptions
    const KNOWN_DOCTORS: { patterns: string[]; name: string }[] = [
        { patterns: ['JEMIMA', 'DERMENDIEFF', 'DERMEN'], name: 'Jemima Dermendieff' },
        { patterns: ['RAFAEL', 'ACOSTA'], name: 'Rafael Acosta' },
        { patterns: ['MIRETTI', 'JUAN PABLO'], name: 'Juan Pablo Miretti' }
    ];

    const handleScanImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsScanning(true);
        setScanProgress(0);
        setOcrWarning(null);
        setDetectedDoctor(null);

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
                const confidence = result.data.confidence; // 0-100
                console.log('OCR text:', text, '| Confidence:', confidence);

                // ── Doctor Detection ──
                for (const doc of KNOWN_DOCTORS) {
                    const matchCount = doc.patterns.filter(p => text.includes(p)).length;
                    if (matchCount >= 1) {
                        setDetectedDoctor(doc.name);
                        break;
                    }
                }

                // ── Low confidence → warn user ──
                if (confidence < 40) {
                    setOcrWarning('La imagen es difícil de leer. Se guardó la foto pero los datos deben cargarse manualmente.');
                    // Still open form but don't attempt to parse numbers
                    setIsScanning(false);
                    setScanProgress(0);
                    setIsAddingPrescription(true);
                    return;
                }

                // ── Parse prescription values ──
                const extractNumbers = (sectionText: string) => {
                    const raw = sectionText.match(/[+-]?\d+\.?\d*/g) || [];
                    const filtered = raw.filter(n => n.length > 0 && n.length < 6);
                    
                    let sph = '', cyl = '', axs = '';
                    
                    // Heuristic: Axis is usually an integer 0-180 without a sign (+/-)
                    // Sph/Cyl usually have signs in prescriptions.
                    filtered.forEach(n => {
                        const num = parseFloat(n);
                        const hasSign = n.startsWith('+') || n.startsWith('-');
                        const isInt = !n.includes('.');
                        
                        if (!axs && !hasSign && isInt && num >= 0 && num <= 180) {
                            axs = n;
                        } else if (!sph) {
                            sph = n;
                        } else if (!cyl) {
                            cyl = n;
                        }
                    });

                    const normalize = (v: string, isAxs = false) => {
                        if (!v) return '';
                        const num = parseFloat(v);
                        if (isAxs) return (num >= 0 && num <= 180) ? v : '';
                        
                        if (Math.abs(num) >= 25 && Math.abs(num) < 1000) {
                            const norm = (num / 100).toFixed(2);
                            return num > 0 ? `+${norm}` : norm;
                        }
                        if (Math.abs(num) > 30) return '';
                        return (v.startsWith('+') || num > 0) ? `+${num.toFixed(2)}` : num.toFixed(2);
                    };

                    const result = [];
                    if (sph) result.push(normalize(sph));
                    if (cyl) result.push(normalize(cyl));
                    if (axs) result.push(normalize(axs, true));
                    return result.filter(Boolean);
                };

                const odMatch = text.match(/O\.?\s*D\.?([\s\S]*?)(?=O\.?\s*I|ADD|ADICI|$)/i);
                const oiMatch = text.match(/O\.?\s*I\.?([\s\S]*?)(?=ADD|ADICI|DNP|ALTU|$)/i);
                const addMatch = text.match(/(?:ADD|ADICI[OÓ]N)[:\s]*([+-]?\d+\.?\d*)/i);
                const dnpMatch = text.match(/(?:DNP|DP|DISTANCIA)[:\s]*(\d+[\/\s]?\d*)/i);
                const heightMatch = text.match(/(?:ALTURA|ALT|H)[:\s]*(\d+[\/\s]?\d*)/i);

                const odNums = odMatch ? extractNumbers(odMatch[0]) : [];
                const oiNums = oiMatch ? extractNumbers(oiMatch[0]) : [];

                // DNP parsing (common formats: "64", "32/32", "32 32")
                let distanceOD = '';
                let distanceOI = '';
                if (dnpMatch) {
                    const dnpParts = dnpMatch[1].split(/[\/\s]+/).filter(Boolean);
                    if (dnpParts.length === 1) {
                        const total = parseInt(dnpParts[0]);
                        if (total > 40) {
                            distanceOD = (total / 2).toString();
                            distanceOI = (total / 2).toString();
                        } else {
                            distanceOD = dnpParts[0];
                        }
                    } else if (dnpParts.length >= 2) {
                        distanceOD = dnpParts[0];
                        distanceOI = dnpParts[1];
                    }
                }

                // Height parsing
                let heightOD = '';
                let heightOI = '';
                if (heightMatch) {
                    const hParts = heightMatch[1].split(/[\/\s]+/).filter(Boolean);
                    if (hParts.length === 1) {
                        heightOD = hParts[0];
                        heightOI = hParts[0];
                    } else if (hParts.length >= 2) {
                        heightOD = hParts[0];
                        heightOI = hParts[1];
                    }
                }

                const hasValues = odNums.length > 0 || oiNums.length > 0;

                if (hasValues) {
                    setPresData(prev => ({
                        ...prev,
                        sphereOD: odNums[0] || prev.sphereOD,
                        cylinderOD: odNums[1] || prev.cylinderOD,
                        axisOD: odNums[2] || prev.axisOD,
                        sphereOI: oiNums[0] || prev.sphereOI,
                        cylinderOI: oiNums[1] || prev.cylinderOI,
                        axisOI: oiNums[2] || prev.axisOI,
                        distanceOD: distanceOD || prev.distanceOD,
                        distanceOI: distanceOI || prev.distanceOI,
                        heightOD: heightOD || prev.heightOD,
                        heightOI: heightOI || prev.heightOI,
                        ...(addMatch ? { additionOD: addMatch[1], additionOI: addMatch[1] } : {})
                    }));

                    // Medium confidence → show a soft warning
                    if (confidence < 65) {
                        setOcrWarning('La lectura pudo no ser precisa. Revisá los valores antes de guardar.');
                    }
                } else {
                    setOcrWarning('No se detectaron valores numéricos en la imagen. Cargalos manualmente.');
                }
            } catch (ocrErr) {
                console.error('OCR Processing Error:', ocrErr);
                setOcrWarning('Error al procesar el OCR. Se guardó la imagen, cargá los datos manualmente.');
            } finally {
                setIsScanning(false);
                setScanProgress(0);
                setIsAddingPrescription(true);
            }
        } catch (err) {
            console.error('Image Processing Error:', err);
            setIsScanning(false);
            setOcrWarning('Error al procesar la imagen.');
            setIsAddingPrescription(true);
        }
    };

    if (loading) return (
        <div className="flex-1 flex items-center justify-center bg-stone-50 dark:bg-stone-950">
            <div className="text-center">
                <div className="w-12 h-12 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin mx-auto mb-4" />
                <p className="text-stone-400 font-bold text-sm">Cargando ficha...</p>
            </div>
        </div>
    );

    if (!contact) return (
        <div className="flex-1 flex items-center justify-center bg-stone-50 dark:bg-stone-950">
            <div className="text-center p-12 bg-white dark:bg-stone-900 rounded-[3rem] shadow-xl border border-stone-100 dark:border-stone-800">
                <p className="text-stone-400 font-bold mb-4">No se pudo cargar la información del contacto.</p>
                <button onClick={fetchContact} className="px-6 py-3 bg-emerald-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-emerald-600 transition-all">
                    Reintentar
                </button>
            </div>
        </div>
    );

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
                                    ${safePrice(contact.expectedValue).toLocaleString()}
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
                                    <FileDropZone
                                        accept="image/*"
                                        maxSizeMB={10}
                                        label="Arrastrá la foto de la receta o hacé click"
                                        loading={isScanning}
                                        loadingLabel={`Escaneando ${scanProgress}%...`}
                                        onFile={(file) => {
                                            const fakeEvent = { target: { files: [file] } } as unknown as React.ChangeEvent<HTMLInputElement>;
                                            handleScanImage(fakeEvent);
                                        }}
                                        className="mb-6"
                                    />
                                    <button
                                        onClick={() => setIsAddingPrescription(true)}
                                        className="bg-white dark:bg-stone-800 text-stone-900 dark:text-white border border-stone-200 dark:border-stone-700 px-8 py-4 rounded-3xl font-black text-xs uppercase tracking-widest hover:bg-stone-50 transition-all shadow-sm"
                                    >
                                        CARGA MANUAL
                                    </button>
                                </div>
                            ) : (
                                <div className="bg-white dark:bg-stone-800 border-2 border-primary/20 rounded-[3rem] p-8 shadow-2xl animate-in zoom-in-95 duration-300">
                                    <div className="flex justify-between items-center mb-4">
                                        <h3 className="text-2xl font-black text-stone-800 dark:text-white tracking-tighter">
                                            {editingPresId ? 'Editar Receta' : 'Cargar Receta'}
                                        </h3>
                                        <button
                                            onClick={() => {
                                                setIsAddingPrescription(false);
                                                setEditingPresId(null);
                                                setOcrWarning(null);
                                                setDetectedDoctor(null);
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

                                    {/* ═══ IMAGE PREVIEW AT TOP ═══ */}
                                    {presData.imageUrl && (
                                        <div className="mb-6 p-4 bg-stone-50 dark:bg-stone-900/50 rounded-2xl border border-stone-100 dark:border-stone-800">
                                            <span className="text-[9px] font-black text-stone-400 uppercase tracking-widest block mb-3 italic">📷 Imagen de Receta</span>
                                            <img src={presData.imageUrl} alt="Receta" className="max-h-52 rounded-xl mx-auto shadow-lg cursor-pointer hover:scale-105 transition-transform" onClick={() => window.open(presData.imageUrl, '_blank')} />
                                        </div>
                                    )}

                                    {/* ═══ OCR WARNING ALERT ═══ */}
                                    {ocrWarning && (
                                        <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-950/30 border-2 border-amber-200 dark:border-amber-800 rounded-2xl flex items-start gap-3">
                                            <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                                            <div>
                                                <p className="text-sm font-bold text-amber-700 dark:text-amber-400">{ocrWarning}</p>
                                                <p className="text-[10px] text-amber-500 mt-1">La imagen fue guardada correctamente.</p>
                                            </div>
                                            <button onClick={() => setOcrWarning(null)} className="text-amber-400 hover:text-amber-600 ml-auto flex-shrink-0">✕</button>
                                        </div>
                                    )}

                                    {/* ═══ DOCTOR DETECTION BANNER ═══ */}
                                    {detectedDoctor && (
                                        <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-950/30 border-2 border-blue-200 dark:border-blue-800 rounded-2xl flex items-center gap-3">
                                            <User className="w-5 h-5 text-blue-500 flex-shrink-0" />
                                            <div className="flex-1">
                                                <p className="text-sm font-bold text-blue-700 dark:text-blue-400">🩺 Se detectó al Dr/a. <strong>{detectedDoctor}</strong> en la receta</p>
                                            </div>
                                            <button
                                                onClick={async () => {
                                                    try {
                                                        await fetch(`/api/contacts/${contactId}`, {
                                                            method: 'PATCH',
                                                            headers: { 'Content-Type': 'application/json' },
                                                            body: JSON.stringify({ doctor: detectedDoctor })
                                                        });
                                                        fetchContact();
                                                        setDetectedDoctor(null);
                                                    } catch (e) { console.error(e); }
                                                }}
                                                className="px-4 py-2 bg-blue-500 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-blue-600 transition-all flex-shrink-0"
                                            >
                                                ETIQUETAR
                                            </button>
                                            <button onClick={() => setDetectedDoctor(null)} className="text-blue-400 hover:text-blue-600 flex-shrink-0">✕</button>
                                        </div>
                                    )}

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

                                    {/* Image already shown at the top of the form */}

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
                                            fetch('/api/products')
                                                .then(r => r.json())
                                                .then(data => {
                                                    if (Array.isArray(data)) {
                                                        setAvailableProducts(data);
                                                    } else {
                                                        console.error('Error loading products:', data);
                                                        setAvailableProducts([]);
                                                    }
                                                })
                                                .catch(console.error);
                                        }
                                    }}
                                    className="w-full py-6 bg-stone-900 text-white dark:bg-primary rounded-[2rem] font-black text-xs uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition-all shadow-xl flex items-center justify-center gap-3"
                                >
                                    <Plus className="w-5 h-5" /> NUEVO PRESUPUESTO
                                </button>
                            )}

                            {/* Cotizador Inline */}
                            {isQuoting && activeSection === 'budget' && (
                                <div className="relative">
                                    {isQuoteSuccess ? (
                                        <div className="bg-emerald-50/50 dark:bg-emerald-950/20 border-2 border-emerald-200 dark:border-emerald-800 rounded-[3rem] p-12 text-center animate-in fade-in zoom-in duration-500 my-8">
                                            <div className="w-20 h-20 bg-emerald-500 text-white rounded-[2rem] flex items-center justify-center mx-auto mb-6 shadow-lg shadow-emerald-500/20">
                                                <CheckCircle2 className="w-10 h-10" />
                                            </div>
                                            <h3 className="text-3xl font-black text-stone-800 dark:text-white mb-2 tracking-tighter uppercase italic">¡Presupuesto Guardado!</h3>
                                            <p className="text-stone-500 dark:text-stone-400 font-bold mb-8">El presupuesto ha sido registrado exitosamente en el historial del contacto.</p>
                                            <button 
                                                onClick={() => {
                                                    setIsQuoteSuccess(false);
                                                    setIsQuoting(false);
                                                    setEditingQuoteId(null);
                                                    setQuoteItems([]);
                                                    setQuoteMarkup(0);
                                                    setQuotePrescriptionId(null);
                                                    fetchContact();
                                                }}
                                                className="px-12 py-4 bg-stone-900 text-white dark:bg-emerald-500 rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-xl"
                                            >
                                                CONTINUAR
                                            </button>
                                        </div>
                                    ) : (
                                        <CotizadorCart
                                            items={quoteItems}
                                            setItems={setQuoteItems}
                                            markup={quoteMarkup}
                                            setMarkup={setQuoteMarkup}
                                            discountCash={quoteDiscountCash}
                                            setDiscountCash={setQuoteDiscountCash}
                                            discountTransfer={quoteDiscountTransfer}
                                            setDiscountTransfer={setQuoteDiscountTransfer}
                                            discountCard={quoteDiscountCard}
                                            setDiscountCard={setQuoteDiscountCard}
                                            frameSource={quoteFrameSource}
                                            setFrameSource={setQuoteFrameSource}
                                            userFrameData={quoteUserFrame}
                                            setUserFrameData={setQuoteUserFrame}
                                            prescriptionId={quotePrescriptionId}
                                            setPrescriptionId={setQuotePrescriptionId}
                                            availableProducts={availableProducts}
                                            prescriptions={contact.prescriptions}
                                            onSave={handleSaveQuote}
                                            isSaving={savingQuote}
                                            contactName={contact.name}
                                            onClose={() => setIsQuoting(false)}
                                            editingQuoteId={editingQuoteId}
                                            onCancelEdit={handleCancelEditQuote}
                                        />
                                    )}
                                </div>
                            )}

                            {/* Convert Error Banner */}
                            {convertError && (
                                <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800 rounded-2xl flex items-start gap-3 animate-in slide-in-from-top duration-300">
                                    <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                                    <div className="flex-1">
                                        <p className="text-[10px] font-black text-red-600 uppercase tracking-widest mb-1">No se pudo convertir en venta</p>
                                        <p className="text-xs font-bold text-red-500 whitespace-pre-line">{convertError}</p>
                                    </div>
                                    <button onClick={() => setConvertError(null)} className="p-1 hover:bg-red-100 dark:hover:bg-red-800/30 rounded-lg transition-colors">
                                        <X className="w-4 h-4 text-red-400" />
                                    </button>
                                </div>
                            )}

                            {/* Orders List with Lab Status */}
                            {contact.orders && contact.orders.length > 0 ? (
                                (() => {
                                    const salesOrders = (contact.orders || []).filter((o: any) => o.orderType === 'SALE');
                                    const quoteOrders = (contact.orders || []).filter((o: any) => o.orderType !== 'SALE');
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
                                        const isSale = order.orderType === 'SALE';
                                        const isQuote = !isSale;

                                        // Section headers
                                        let sectionHeader = null;
                                        if (isSale && !salesRendered) {
                                            salesRendered = true;
                                            sectionHeader = (
                                                <div key="sales-header" className="flex items-center gap-3 mb-6">
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
                                                <div key="quotes-header" className={`flex items-center gap-3 mb-6`}>
                                                    <div className="h-px flex-1 bg-amber-200 dark:bg-amber-800" />
                                                    <span className="text-[10px] font-black text-amber-600 uppercase tracking-[0.2em] flex items-center gap-1.5">
                                                        <Calculator className="w-3.5 h-3.5" /> Presupuestos ({quoteOrders.length})
                                                    </span>
                                                    <div className="h-px flex-1 bg-amber-200 dark:bg-amber-800" />
                                                </div>
                                            );
                                        }

                                        return (
                                            <React.Fragment key={order.id}>
                                                {sectionHeader}
                                                <QuoteSummary
                                                    order={order}
                                                    contact={contact}
                                                    currentUserRole={currentUserRole}
                                                    onConvert={handleConvertQuote}
                                                    onEdit={handleEditQuote}
                                                    onDelete={(id) => setIsDeletingOrder(id)}
                                                    onAddPayment={(id) => setIsAddingPayment(id)}
                                                    onStatusChange={async (id, status) => {
                                                        const success = await onStatusChange(id, status);
                                                        if (success) fetchContact();
                                                    }}
                                                    isExpanded={expandedOrderId === order.id}
                                                    onToggleExpand={() => setExpandedOrderId(expandedOrderId === order.id ? null : order.id)}
                                                />
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
                                                                onClick={() => { setPaymentMethod(m.key); setPaymentWarning(null); }}
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
                                                <FileDropZone
                                                    accept="image/*"
                                                    maxSizeMB={10}
                                                    label="Arrastrá el comprobante aquí"
                                                    preview={paymentReceiptUrl || null}
                                                    onClearPreview={() => setPaymentReceiptUrl('')}
                                                    onFile={(file) => {
                                                        const fakeEvent = { target: { files: [file] } } as unknown as React.ChangeEvent<HTMLInputElement>;
                                                        handlePaymentReceiptUpload(fakeEvent);
                                                    }}
                                                    compact
                                                />
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
                                                onClick={() => {
                                                    if (!pendingConvertOrderId) return;
                                                    openRxModal(pendingConvertOrderId);
                                                    setPriceChanges(null);
                                                    setPendingConvertOrderId(null);
                                                }}
                                                className="flex-1 py-4 bg-emerald-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-emerald-600 transition-all"
                                            >
                                                CONTINUAR CON VENTA
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Modal de Receta para Conversión a Venta */}
                            {rxModalOrderId && (
                                <div className="fixed inset-0 bg-stone-900/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
                                    <div className="bg-white dark:bg-stone-800 w-full max-w-xl rounded-[2.5rem] p-8 shadow-huge animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
                                        <h3 className="text-xl font-black text-stone-800 dark:text-white mb-1 tracking-tighter flex items-center gap-2">
                                            📋 Cargar Receta
                                        </h3>
                                        <p className="text-[10px] font-bold text-stone-400 mb-6">Completá los datos de la receta antes de convertir el presupuesto en venta.</p>

                                        {contact?.prescriptions && contact.prescriptions.length > 1 && (
                                            <div className="mb-6 p-4 bg-emerald-50 dark:bg-emerald-900/10 rounded-2xl border border-emerald-100 dark:border-emerald-800/50">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <History className="w-3.5 h-3.5 text-emerald-600" />
                                                    <span className="text-[9px] font-black text-emerald-700 uppercase tracking-widest">Recetas anteriores detectadas</span>
                                                </div>
                                                <div className="flex flex-wrap gap-2">
                                                    {contact.prescriptions.map((rx: any) => (
                                                        <button 
                                                            key={rx.id}
                                                            onClick={() => applyPrescriptionToForm(rx)}
                                                            className="px-3 py-2 bg-white dark:bg-stone-900 hover:bg-emerald-500 hover:text-white border border-emerald-200 dark:border-stone-700 rounded-xl text-[10px] font-bold transition-all shadow-sm"
                                                        >
                                                            {new Date(rx.date).toLocaleDateString('es-AR')} - {rx.sphereOD || '0'}/{rx.sphereOI || '0'}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        <div className="space-y-4">
                                            {/* OD Row */}
                                            <div>
                                                <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest mb-2">👁️ Ojo Derecho (OD)</p>
                                                <div className="grid grid-cols-4 gap-2">
                                                    <div>
                                                        <label className="text-[8px] font-black text-stone-400 uppercase block mb-0.5">Esférico</label>
                                                        <input type="number" step="0.25" value={rxForm.sphereOD} onChange={e => setRxForm(p => ({...p, sphereOD: e.target.value}))} className="w-full bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 p-2.5 rounded-xl text-sm font-bold text-center outline-none focus:ring-2 focus:ring-emerald-300" placeholder="0.00" />
                                                    </div>
                                                    <div>
                                                        <label className="text-[8px] font-black text-stone-400 uppercase block mb-0.5">Cilíndrico</label>
                                                        <input type="number" step="0.25" value={rxForm.cylinderOD} onChange={e => setRxForm(p => ({...p, cylinderOD: e.target.value}))} className="w-full bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 p-2.5 rounded-xl text-sm font-bold text-center outline-none focus:ring-2 focus:ring-emerald-300" placeholder="0.00" />
                                                    </div>
                                                    <div>
                                                        <label className="text-[8px] font-black text-stone-400 uppercase block mb-0.5">Eje</label>
                                                        <input type="number" step="1" min="0" max="180" value={rxForm.axisOD} onChange={e => setRxForm(p => ({...p, axisOD: e.target.value}))} className="w-full bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 p-2.5 rounded-xl text-sm font-bold text-center outline-none focus:ring-2 focus:ring-emerald-300" placeholder="0°" />
                                                    </div>
                                                    <div>
                                                        <label className="text-[8px] font-black text-stone-400 uppercase block mb-0.5">Adición</label>
                                                        <input type="number" step="0.25" value={rxForm.additionOD} onChange={e => setRxForm(p => ({...p, additionOD: e.target.value}))} className="w-full bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 p-2.5 rounded-xl text-sm font-bold text-center outline-none focus:ring-2 focus:ring-emerald-300" placeholder="0.00" />
                                                    </div>
                                                </div>
                                            </div>

                                            {/* OI Row */}
                                            <div>
                                                <p className="text-[9px] font-black text-blue-600 uppercase tracking-widest mb-2">👁️ Ojo Izquierdo (OI)</p>
                                                <div className="grid grid-cols-4 gap-2">
                                                    <div>
                                                        <label className="text-[8px] font-black text-stone-400 uppercase block mb-0.5">Esférico</label>
                                                        <input type="number" step="0.25" value={rxForm.sphereOI} onChange={e => setRxForm(p => ({...p, sphereOI: e.target.value}))} className="w-full bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 p-2.5 rounded-xl text-sm font-bold text-center outline-none focus:ring-2 focus:ring-blue-300" placeholder="0.00" />
                                                    </div>
                                                    <div>
                                                        <label className="text-[8px] font-black text-stone-400 uppercase block mb-0.5">Cilíndrico</label>
                                                        <input type="number" step="0.25" value={rxForm.cylinderOI} onChange={e => setRxForm(p => ({...p, cylinderOI: e.target.value}))} className="w-full bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 p-2.5 rounded-xl text-sm font-bold text-center outline-none focus:ring-2 focus:ring-blue-300" placeholder="0.00" />
                                                    </div>
                                                    <div>
                                                        <label className="text-[8px] font-black text-stone-400 uppercase block mb-0.5">Eje</label>
                                                        <input type="number" step="1" min="0" max="180" value={rxForm.axisOI} onChange={e => setRxForm(p => ({...p, axisOI: e.target.value}))} className="w-full bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 p-2.5 rounded-xl text-sm font-bold text-center outline-none focus:ring-2 focus:ring-blue-300" placeholder="0°" />
                                                    </div>
                                                    <div>
                                                        <label className="text-[8px] font-black text-stone-400 uppercase block mb-0.5">Adición</label>
                                                        <input type="number" step="0.25" value={rxForm.additionOI} onChange={e => setRxForm(p => ({...p, additionOI: e.target.value}))} className="w-full bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 p-2.5 rounded-xl text-sm font-bold text-center outline-none focus:ring-2 focus:ring-blue-300" placeholder="0.00" />
                                                    </div>
                                                </div>
                                            </div>

                                            {/* DNP + Altura */}
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <p className="text-[9px] font-black text-violet-600 uppercase tracking-widest mb-2">📏 DNP (Dist. Pupilar)</p>
                                                    <div className="grid grid-cols-2 gap-2">
                                                        <div>
                                                            <label className="text-[8px] font-black text-stone-400 uppercase block mb-0.5">OD</label>
                                                            <input type="number" step="0.5" value={rxForm.distanceOD} onChange={e => setRxForm(p => ({...p, distanceOD: e.target.value}))} className="w-full bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 p-2.5 rounded-xl text-sm font-bold text-center outline-none focus:ring-2 focus:ring-violet-300" placeholder="mm" />
                                                        </div>
                                                        <div>
                                                            <label className="text-[8px] font-black text-stone-400 uppercase block mb-0.5">OI</label>
                                                            <input type="number" step="0.5" value={rxForm.distanceOI} onChange={e => setRxForm(p => ({...p, distanceOI: e.target.value}))} className="w-full bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 p-2.5 rounded-xl text-sm font-bold text-center outline-none focus:ring-2 focus:ring-violet-300" placeholder="mm" />
                                                        </div>
                                                    </div>
                                                </div>
                                                <div>
                                                    <p className="text-[9px] font-black text-amber-600 uppercase tracking-widest mb-2">📐 Altura</p>
                                                    <div className="grid grid-cols-2 gap-2">
                                                        <div>
                                                            <label className="text-[8px] font-black text-stone-400 uppercase block mb-0.5">OD</label>
                                                            <input type="number" step="0.5" value={rxForm.heightOD} onChange={e => setRxForm(p => ({...p, heightOD: e.target.value}))} className="w-full bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 p-2.5 rounded-xl text-sm font-bold text-center outline-none focus:ring-2 focus:ring-amber-300" placeholder="mm" />
                                                        </div>
                                                        <div>
                                                            <label className="text-[8px] font-black text-stone-400 uppercase block mb-0.5">OI</label>
                                                            <input type="number" step="0.5" value={rxForm.heightOI} onChange={e => setRxForm(p => ({...p, heightOI: e.target.value}))} className="w-full bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 p-2.5 rounded-xl text-sm font-bold text-center outline-none focus:ring-2 focus:ring-amber-300" placeholder="mm" />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Notas */}
                                            <div>
                                                <label className="text-[9px] font-black text-stone-400 uppercase tracking-widest block mb-1">Notas de la receta</label>
                                                <textarea value={rxForm.notes} onChange={e => setRxForm(p => ({...p, notes: e.target.value}))} className="w-full bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 p-3 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-stone-300" placeholder="Observaciones, indicaciones médicas..." rows={2} />
                                            </div>

                                            {/* Foto de la receta */}
                                            <div>
                                                <label className="text-[9px] font-black text-red-500 uppercase tracking-widest block mb-2">📷 Foto de la receta (OBLIGATORIA)</label>
                                                {rxForm.imageUrl ? (
                                                    <div className="relative group">
                                                        <img src={rxForm.imageUrl} alt="Receta" className="w-full max-h-48 object-contain rounded-xl border-2 border-emerald-500 shadow-md transition-all group-hover:brightness-90" />
                                                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                                            <span className="bg-emerald-500 text-white px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg">Imagen Cargada ✓</span>
                                                        </div>
                                                        <button onClick={() => setRxForm(p => ({...p, imageUrl: ''}))} className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-full hover:scale-110 transition-all shadow-lg pointer-events-auto" title="Eliminar imagen">
                                                            <X className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <label className="flex items-center justify-center gap-2 p-4 border-2 border-dashed border-stone-200 dark:border-stone-700 rounded-xl cursor-pointer hover:border-emerald-300 transition-colors">
                                                        <input type="file" accept="image/*" onChange={handleRxImageUpload} className="hidden" />
                                                        {rxUploading ? (
                                                            <span className="text-xs font-bold text-stone-400">Subiendo...</span>
                                                        ) : (
                                                            <span className="text-xs font-bold text-stone-400">Tocar para subir foto de la receta</span>
                                                        )}
                                                    </label>
                                                )}
                                            </div>
                                        </div>

                                        {rxError && (
                                            <p className="mt-4 text-[10px] font-black text-red-500 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-xl text-center">⚠️ {rxError}</p>
                                        )}

                                                                                                                                                                   <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3">



                                            <button
                                                onClick={() => { setRxModalOrderId(null); resetRxForm(); }}
                                                                                                 className="py-4 bg-stone-100 dark:bg-stone-700 text-stone-500 dark:text-stone-300 rounded-2xl font-black text-xs uppercase tracking-widest"

                                            >
                                                CANCELAR
                                            </button>
                                            <button
                                                onClick={handleRxSubmitAndConvert}
                                                disabled={rxSaving || (!rxForm.sphereOD && !rxForm.sphereOI) || !rxForm.imageUrl}
                                                className={`flex-1 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${rxSaving || (!rxForm.sphereOD && !rxForm.sphereOI) || !rxForm.imageUrl ? 'bg-stone-200 text-stone-400 cursor-not-allowed' : 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-lg'}`}
                                            >
                                                {rxSaving ? (<><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> GUARDANDO...</>) : (<><CheckCircle2 className="w-4 h-4" /> GUARDAR Y CONVERTIR EN VENTA</>)}
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

            {invoiceOrder && (
                <InvoiceModal 
                    order={invoiceOrder} 
                    initialAccount="ISH" 
                    onClose={() => setInvoiceOrder(null)} 
                    onSuccess={() => {
                        setInvoiceOrder(null);
                        fetchContact();
                    }}
                />
            )}
        </div >
    );
}
