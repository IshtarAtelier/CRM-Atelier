'use client';

import { useState, useEffect } from 'react';
import {
    Cog, Users, Plus, Pencil, Trash2, Save, X, Eye, EyeOff,
    Shield, ShieldCheck, Loader2, Lock, UserPlus, AlertTriangle,
    CheckCircle2, Stethoscope,
    Sparkles, Download, Database, RefreshCw, UploadCloud, Clock, HardDrive, Calendar
} from 'lucide-react';

// ── Types ─────────────────────────────────────

interface BackupStatus {
    storageConfigured: boolean;
    totalBackups: number;
    latestBackup: any | null;
    cronEnabled: boolean;
    history: any[];
}

interface User {
    id: string;
    name: string;
    email: string;
    role: string;
    notificationEmail?: string | null;
    createdAt: string;
}

interface Doctor {
    id: string;
    name: string;
    createdAt: string;
}

interface LaboratoryConfig {
    id: string;
    name: string;
    calibrado: number;
    iva: number;
    deliveryTime?: string | null;
}

interface BillingConfig {
    account: string;
    label: string;
    cuit: number;
    puntoDeVenta: number;
    connected?: boolean;
    error?: string;
    lastVoucherNumber?: number | null;
}

interface ServicePricing {
    id: string;
    name: string;
    description?: string | null;
    category: string;
    subcategory?: string | null;
    priceCash: number;
    priceCredit: number;
    creditMonths: number;
    active: boolean;
    notes?: string | null;
}

// ── Page ──────────────────────────────────

export default function ConfiguracionPage() {
    const [activeTab, setActiveTab] = useState<'usuarios' | 'laboratorios' | 'finanzas' | 'sistema'>('usuarios');
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [changingPasswordId, setChangingPasswordId] = useState<string | null>(null);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const [doctors, setDoctors] = useState<Doctor[]>([]);
    const [newDoctorName, setNewDoctorName] = useState('');
    const [addingDoctor, setAddingDoctor] = useState(false);
    const [deletingDoctorId, setDeletingDoctorId] = useState<string | null>(null);


    // Tags state
    interface TagConfig {
        id: string; name: string; color: string; botAction: string; notifyPhone: string | null;
    }
    const [tags, setTags] = useState<TagConfig[]>([]);
    const [newTagName, setNewTagName] = useState('');
    const [newTagColor, setNewTagColor] = useState('#9e7f65');
    const [newTagBotAction, setNewTagBotAction] = useState('NONE');
    const [newTagNotifyPhone, setNewTagNotifyPhone] = useState('');
    const [addingTag, setAddingTag] = useState(false);
    const [editingTagId, setEditingTagId] = useState<string | null>(null);
    const [editTagData, setEditTagData] = useState<Partial<TagConfig>>({});

    // Labs state
    const [labs, setLabs] = useState<LaboratoryConfig[]>([]);
    const [newLabName, setNewLabName] = useState('');
    const [addingLab, setAddingLab] = useState(false);
    const [editingLabId, setEditingLabId] = useState<string | null>(null);
    const [editLabCalibrado, setEditLabCalibrado] = useState(0);
    const [editLabIva, setEditLabIva] = useState(0);
    const [editLabDeliveryTime, setEditLabDeliveryTime] = useState('');

    // Service Pricing state
    const [services, setServices] = useState<ServicePricing[]>([]);
    const [addingService, setAddingService] = useState(false);
    const [newServiceName, setNewServiceName] = useState('');
    const [newServiceCategory, setNewServiceCategory] = useState('CRISTALES');
    const [newServicePriceCash, setNewServicePriceCash] = useState<number | ''>('');
    const [newServicePriceCredit, setNewServicePriceCredit] = useState<number | ''>('');
    const [editingServiceId, setEditingServiceId] = useState<string | null>(null);

    const [agentPrompt, setAgentPrompt] = useState('');
    const [agentEnabled, setAgentEnabled] = useState(false);
    const [agentSaving, setAgentSaving] = useState(false);
    const [agentSaved, setAgentSaved] = useState(false);
    const [waConnected, setWaConnected] = useState(false);
    const [agentConfigured, setAgentConfigured] = useState(false);

    // Backup state
    const [backupStatus, setBackupStatus] = useState<BackupStatus | null>(null);
    const [loadingBackup, setLoadingBackup] = useState(false);
    const [forcingBackup, setForcingBackup] = useState(false);
    const [selectedTemplate, setSelectedTemplate] = useState<{ label: string; prompt: string } | null>(null);

    // Create form
    const [newName, setNewName] = useState('');
    const [newEmail, setNewEmail] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [newRole, setNewRole] = useState('STAFF');
    const [showPassword, setShowPassword] = useState(false);
    const [creating, setCreating] = useState(false);
    
    // Billing state
    const [billingConfig, setBillingConfig] = useState<BillingConfig[] | null>(null);
    const [loadingBilling, setLoadingBilling] = useState(false);

    // Edit form
    const [editName, setEditName] = useState('');
    const [editRole, setEditRole] = useState('');
    const [editNotificationEmail, setEditNotificationEmail] = useState('');

    // Change password
    const [newPass, setNewPass] = useState('');
    const [showNewPass, setShowNewPass] = useState(false);

    useEffect(() => {
        fetchUsers();
        fetchDoctors();
        fetchLabs();
        fetchServices();
        fetchTags();
        fetchAgentConfig();
        fetchWaStatus();
        fetchBillingConfig();
        fetchBackupStatus();
         
    }, []);

    const fetchLabs = async () => {
        try {
            const res = await fetch('/api/laboratories');
            if (res.ok) {
                const data = await res.json();
                setLabs(data.laboratories || []);
            }
        } catch (error) {
            console.error('Error fetching labs:', error);
        }
    };


    const fetchTags = async () => {
        try {
            const res = await fetch('/api/tags');
            if (res.ok) {
                const data = await res.json();
                setTags(data || []);
            }
        } catch (error) {
            console.error('Error fetching tags:', error);
        }
    };
    
    const handleAddTag = async () => {
        if (!newTagName.trim()) return;
        setAddingTag(true);
        try {
            const res = await fetch('/api/tags', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newTagName.trim(), color: newTagColor, botAction: newTagBotAction, notifyPhone: newTagNotifyPhone || null })
            });
            if (res.ok) {
                setMessage({ type: 'success', text: `Etiqueta agregada` });
                setNewTagName(''); setNewTagBotAction('NONE'); setNewTagNotifyPhone('');
                await fetchTags();
            } else {
                setMessage({ type: 'error', text: 'Error al agregar etiqueta' });
            }
        } catch {
            setMessage({ type: 'error', text: 'Error de conexión' });
        }
        setAddingTag(false);
    };

    const handleSaveTag = async (id: string) => {
        try {
            const res = await fetch(`/api/tags/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(editTagData)
            });
            if (res.ok) {
                setMessage({ type: 'success', text: 'Etiqueta actualizada' });
                setEditingTagId(null);
                await fetchTags();
            } else {
                setMessage({ type: 'error', text: 'Error al actualizar' });
            }
        } catch {
            setMessage({ type: 'error', text: 'Error de conexión' });
        }
    };

    const handleDeleteTag = async (id: string) => {
        if (!confirm('¿Eliminar etiqueta?')) return;
        try {
            const res = await fetch(`/api/tags/${id}`, { method: 'DELETE' });
            if (res.ok) {
                setMessage({ type: 'success', text: 'Etiqueta eliminada' });
                await fetchTags();
            }
        } catch {
            setMessage({ type: 'error', text: 'Error' });
        }
    };

    const fetchServices = async () => {
        try {
            const res = await fetch('/api/service-pricing');
            if (res.ok) {
                const data = await res.json();
                setServices(data || []);
            }
        } catch (error) {
            console.error('Error fetching services:', error);
        }
    };

    const handleAddLab = async () => {
        if (!newLabName.trim()) return;
        setAddingLab(true);
        try {
            const res = await fetch('/api/laboratories', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newLabName.trim(), calibrado: 0, iva: 0, deliveryTime: null })
            });
            if (!res.ok) {
                const data = await res.json();
                setMessage({ type: 'error', text: data.error || 'Error al agregar laboratorio' });
            } else {
                setMessage({ type: 'success', text: `Laboratorio "${newLabName.trim()}" agregado` });
                setNewLabName('');
                await fetchLabs();
            }
        } catch {
            setMessage({ type: 'error', text: 'Error de conexión' });
        }
        setAddingLab(false);
    };

    const handleSaveLab = async (id: string) => {
        try {
            const res = await fetch(`/api/laboratories/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ calibrado: editLabCalibrado, iva: editLabIva, deliveryTime: editLabDeliveryTime || null })
            });
            if (res.ok) {
                setMessage({ type: 'success', text: 'Laboratorio actualizado' });
                setEditingLabId(null);
                await fetchLabs();
            } else {
                setMessage({ type: 'error', text: 'Error al actualizar laboratorio' });
            }
        } catch {
            setMessage({ type: 'error', text: 'Error de conexión' });
        }
    };

    const handleDeleteLab = async (id: string, name: string) => {
        if (!confirm(`¿Eliminar el laboratorio "${name}"?`)) return;
        try {
            const res = await fetch(`/api/laboratories/${id}`, { method: 'DELETE' });
            if (res.ok) {
                setMessage({ type: 'success', text: 'Laboratorio eliminado' });
                await fetchLabs();
            } else {
                setMessage({ type: 'error', text: 'Error al eliminar laboratorio' });
            }
        } catch {
            setMessage({ type: 'error', text: 'Error de conexión' });
        }
    };

    const handleAddService = async () => {
        if (!newServiceName.trim()) return;
        setAddingService(true);
        try {
            const res = await fetch('/api/service-pricing', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newServiceName.trim(), category: newServiceCategory, priceCash: newServicePriceCash || 0, priceCredit: newServicePriceCredit || 0, creditMonths: 6, active: true })
            });
            if (!res.ok) {
                const data = await res.json();
                setMessage({ type: 'error', text: data.error || 'Error al agregar servicio' });
            } else {
                setMessage({ type: 'success', text: `Servicio "${newServiceName.trim()}" agregado` });
                setNewServiceName(''); setNewServicePriceCash(''); setNewServicePriceCredit('');
                await fetchServices();
        fetchTags();
            }
        } catch {
            setMessage({ type: 'error', text: 'Error de conexión' });
        }
        setAddingService(false);
    };

    const handleDeleteService = async (id: string, name: string) => {
        if (!confirm(`¿Eliminar el servicio "${name}"?`)) return;
        try {
            const res = await fetch(`/api/service-pricing/${id}`, { method: 'DELETE' });
            if (res.ok) {
                setMessage({ type: 'success', text: 'Servicio eliminado' });
                await fetchServices();
        fetchTags();
            } else {
                setMessage({ type: 'error', text: 'Error al eliminar servicio' });
            }
        } catch {
            setMessage({ type: 'error', text: 'Error de conexión' });
        }
    };

    const fetchBillingConfig = async () => {
        setLoadingBilling(true);
        try {
            const res = await fetch('/api/billing/config');
            if (res.ok) {
                const data = await res.json();
                setBillingConfig(data);
            }
        } catch (error) {
            console.error('Error fetching billing config:', error);
        } finally {
            setLoadingBilling(false);
        }
    };

    const fetchBackupStatus = async () => {
        setLoadingBackup(true);
        try {
            const res = await fetch('/api/backup/status');
            if (res.ok) {
                const data = await res.json();
                setBackupStatus(data);
            }
        } catch (error) {
            console.error('Error fetching backup status:', error);
        } finally {
            setLoadingBackup(false);
        }
    };

    const fetchAgentConfig = async () => {
        try {
            const res = await fetch('/api/whatsapp/agent');
            const data = await res.json();
            setAgentPrompt(data.prompt || '');
            setAgentEnabled(data.enabled || false);
            setAgentConfigured(data.configured || false);
        } catch { }
    };

    const saveAgentConfig = async (fields: Record<string, any>) => {
        try {
            const res = await fetch('/api/whatsapp/agent', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(fields),
            });
            const data = await res.json();
            if (data.configured !== undefined) setAgentConfigured(data.configured);
        } catch { }
    };

    const fetchWaStatus = async () => {
        try {
            const res = await fetch('/api/whatsapp/status');
            const data = await res.json();
            setWaConnected(data.connected || false);
        } catch { }
    };

    useEffect(() => {
        if (message) {
            const timer = setTimeout(() => setMessage(null), 4000);
            return () => clearTimeout(timer);
        }
    }, [message]);

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/users');
            const data = await res.json();
            setUsers(data);
        } catch (error) {
            console.error('Error fetching users:', error);
        }
        setLoading(false);
    };

    // ── Create User ──────────────────────

    const handleCreate = async () => {
        if (!newName || !newEmail || !newPassword) {
            setMessage({ type: 'error', text: 'Todos los campos son requeridos' });
            return;
        }
        setCreating(true);
        try {
            const res = await fetch('/api/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newName, email: newEmail, password: newPassword, role: newRole }),
            });
            const data = await res.json();
            if (!res.ok) {
                setMessage({ type: 'error', text: data.error || 'Error al crear usuario' });
            } else {
                setMessage({ type: 'success', text: `Usuario "${data.name}" creado exitosamente` });
                setShowCreateForm(false);
                setNewName(''); setNewEmail(''); setNewPassword(''); setNewRole('STAFF');
                fetchUsers();
            }
        } catch (error) {
            setMessage({ type: 'error', text: 'Error de conexión' });
        }
        setCreating(false);
    };

    // ── Edit User ───────────────────────

    const startEdit = (user: User) => {
        setEditingId(user.id);
        setEditName(user.name);
        setEditRole(user.role);
        setEditNotificationEmail(user.notificationEmail || '');
    };

    const saveEdit = async (userId: string) => {
        try {
            const res = await fetch(`/api/users/${userId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: editName, role: editRole, notificationEmail: editNotificationEmail }),
            });
            if (res.ok) {
                setMessage({ type: 'success', text: 'Usuario actualizado' });
                setEditingId(null);
                fetchUsers();
            } else {
                const data = await res.json();
                setMessage({ type: 'error', text: data.error || 'Error al actualizar' });
            }
        } catch (error) {
            setMessage({ type: 'error', text: 'Error de conexión' });
        }
    };

    // ── Change Password ─────────────────

    const savePassword = async (userId: string) => {
        if (!newPass || newPass.length < 4) {
            setMessage({ type: 'error', text: 'La contraseña debe tener al menos 4 caracteres' });
            return;
        }
        try {
            const res = await fetch(`/api/users/${userId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password: newPass }),
            });
            if (res.ok) {
                setMessage({ type: 'success', text: 'Contraseña actualizada' });
                setChangingPasswordId(null);
                setNewPass('');
            } else {
                const data = await res.json();
                setMessage({ type: 'error', text: data.error || 'Error al cambiar contraseña' });
            }
        } catch (error) {
            setMessage({ type: 'error', text: 'Error de conexión' });
        }
    };

    // ── Delete User ─────────────────────

    const handleDelete = async (user: User) => {
        if (!confirm(`¿Eliminar al usuario "${user.name}"? Esta acción no se puede deshacer.`)) return;
        try {
            const res = await fetch(`/api/users/${user.id}`, { method: 'DELETE' });
            if (res.ok) {
                setMessage({ type: 'success', text: 'Usuario eliminado' });
                fetchUsers();
            } else {
                const data = await res.json();
                setMessage({ type: 'error', text: data.error || 'Error al eliminar' });
            }
        } catch (error) {
            setMessage({ type: 'error', text: 'Error de conexión' });
        }
    };

    // ── Doctors CRUD ────────────────────

    const fetchDoctors = async () => {
        try {
            const res = await fetch('/api/doctors');
            const data = await res.json();
            if (Array.isArray(data)) setDoctors(data);
        } catch (error) {
            console.error('Error fetching doctors:', error);
        }
    };

    const handleAddDoctor = async () => {
        if (!newDoctorName.trim()) return;
        setAddingDoctor(true);
        try {
            const res = await fetch('/api/doctors', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newDoctorName.trim() })
            });
            if (!res.ok) {
                const data = await res.json();
                setMessage({ type: 'error', text: data.error || 'Error al agregar médico' });
            } else {
                setMessage({ type: 'success', text: `Médico "${newDoctorName.trim()}" agregado` });
                setNewDoctorName('');
                await fetchDoctors();
            }
        } catch {
            setMessage({ type: 'error', text: 'Error de conexión' });
        }
        setAddingDoctor(false);
    };

    const handleDeleteDoctor = async (doc: Doctor) => {
        if (!confirm(`¿Eliminar al médico "${doc.name}"?`)) return;
        setDeletingDoctorId(doc.id);
        try {
            const res = await fetch(`/api/doctors?id=${doc.id}`, { method: 'DELETE' });
            if (res.ok) {
                setMessage({ type: 'success', text: 'Médico eliminado' });
                await fetchDoctors();
            } else {
                setMessage({ type: 'error', text: 'Error al eliminar médico' });
            }
        } catch {
            setMessage({ type: 'error', text: 'Error de conexión' });
        }
        setDeletingDoctorId(null);
    };

    // ── Render ──────────────────────────

    return (
        <main className="p-4 lg:p-8 max-w-5xl mx-auto animate-in fade-in duration-500 pb-20">
            {/* Header */}
            <div className="flex items-center justify-between mb-10">
                <div>
                    <h1 className="text-4xl font-black text-stone-800 dark:text-white tracking-tight flex items-center gap-3">
                        <Cog className="w-9 h-9 text-primary" /> Configuración
                    </h1>
                    <p className="text-stone-400 text-sm mt-1 font-medium">
                        Gestión de usuarios y ajustes del sistema
                    </p>
                </div>
            </div>

            {/* Toast Message */}
            {message && (
                <div className={`mb-6 p-4 rounded-2xl flex items-center gap-3 text-sm font-bold animate-in slide-in-from-top duration-300 ${message.type === 'success'
                    ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 border-2 border-emerald-200 dark:border-emerald-800'
                    : 'bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400 border-2 border-red-200 dark:border-red-800'
                    }`}>
                    {message.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
                    {message.text}
                </div>
            )}

            {/* Tabs Navigation */}
            <div className="flex flex-wrap items-center gap-2 mb-8 bg-stone-100 dark:bg-stone-800/50 p-2 rounded-2xl">
                <button
                    onClick={() => setActiveTab('usuarios')}
                    className={`flex-1 min-w-[120px] py-2.5 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${
                        activeTab === 'usuarios' 
                            ? 'bg-white dark:bg-stone-700 text-stone-800 dark:text-white shadow-sm' 
                            : 'text-stone-500 hover:bg-white/50 dark:hover:bg-stone-700/50'
                    }`}
                >
                    <Users className="w-4 h-4" /> Usuarios
                </button>
                <button
                    onClick={() => setActiveTab('laboratorios')}
                    className={`flex-1 min-w-[120px] py-2.5 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${
                        activeTab === 'laboratorios' 
                            ? 'bg-white dark:bg-stone-700 text-stone-800 dark:text-white shadow-sm' 
                            : 'text-stone-500 hover:bg-white/50 dark:hover:bg-stone-700/50'
                    }`}
                >
                    <Database className="w-4 h-4" /> Laboratorios
                </button>
                <button
                    onClick={() => setActiveTab('finanzas')}
                    className={`flex-1 min-w-[120px] py-2.5 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${
                        activeTab === 'finanzas' 
                            ? 'bg-white dark:bg-stone-700 text-stone-800 dark:text-white shadow-sm' 
                            : 'text-stone-500 hover:bg-white/50 dark:hover:bg-stone-700/50'
                    }`}
                >
                    <Sparkles className="w-4 h-4" /> Finanzas
                </button>
                <button
                    onClick={() => setActiveTab('sistema')}
                    className={`flex-1 min-w-[120px] py-2.5 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${
                        activeTab === 'sistema' 
                            ? 'bg-white dark:bg-stone-700 text-stone-800 dark:text-white shadow-sm' 
                            : 'text-stone-500 hover:bg-white/50 dark:hover:bg-stone-700/50'
                    }`}
                >
                    <HardDrive className="w-4 h-4" /> Sistema
                </button>
            </div>

            {/* Users Section */}
            {activeTab === 'usuarios' && (
            <section className="bg-white dark:bg-stone-800 border-2 border-stone-100 dark:border-stone-700 rounded-2xl overflow-hidden">
                <div className="p-6 flex items-center justify-between border-b-2 border-stone-100 dark:border-stone-700">
                    <div className="flex items-center gap-2">
                        <Users className="w-5 h-5 text-primary" />
                        <h2 className="text-xs font-black uppercase tracking-widest text-stone-400">Usuarios del Sistema</h2>
                        <span className="ml-2 px-2.5 py-0.5 bg-stone-100 dark:bg-stone-700 rounded-full text-[10px] font-black text-stone-500">
                            {users.length}
                        </span>
                    </div>
                    <button
                        onClick={() => setShowCreateForm(!showCreateForm)}
                        className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 hover:scale-105 ${showCreateForm
                            ? 'bg-stone-200 dark:bg-stone-600 text-stone-500 dark:text-stone-300'
                            : 'bg-primary text-primary-foreground shadow-lg shadow-primary/20'
                            }`}
                    >
                        {showCreateForm ? <X className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
                        {showCreateForm ? 'Cancelar' : 'Nuevo Usuario'}
                    </button>
                </div>

                {/* Create User Form */}
                {showCreateForm && (
                    <div className="p-6 bg-stone-50 dark:bg-stone-900 border-b-2 border-stone-100 dark:border-stone-700">
                        <h3 className="text-xs font-black text-stone-400 uppercase tracking-widest mb-4">Crear Nuevo Usuario</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest block mb-1.5">Nombre</label>
                                <input
                                    type="text"
                                    value={newName}
                                    onChange={e => setNewName(e.target.value)}
                                    placeholder="Nombre completo"
                                    className="w-full px-4 py-3 bg-white dark:bg-stone-800 border-2 border-stone-200 dark:border-stone-600 rounded-xl text-sm font-bold outline-none focus:border-primary transition-all"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest block mb-1.5">Email</label>
                                <input
                                    type="email"
                                    value={newEmail}
                                    onChange={e => setNewEmail(e.target.value)}
                                    placeholder="usuario@email.com"
                                    className="w-full px-4 py-3 bg-white dark:bg-stone-800 border-2 border-stone-200 dark:border-stone-600 rounded-xl text-sm font-bold outline-none focus:border-primary transition-all"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest block mb-1.5">Contraseña</label>
                                <div className="relative">
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        value={newPassword}
                                        onChange={e => setNewPassword(e.target.value)}
                                        placeholder="••••••••"
                                        className="w-full px-4 py-3 bg-white dark:bg-stone-800 border-2 border-stone-200 dark:border-stone-600 rounded-xl text-sm font-bold outline-none focus:border-primary transition-all pr-12"
                                    />
                                    <button
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
                                    >
                                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest block mb-1.5">Rol</label>
                                <select
                                    value={newRole}
                                    onChange={e => setNewRole(e.target.value)}
                                    className="w-full px-4 py-3 bg-white dark:bg-stone-800 border-2 border-stone-200 dark:border-stone-600 rounded-xl text-sm font-bold outline-none focus:border-primary transition-all"
                                >
                                    <option value="STAFF">Vendedor (STAFF)</option>
                                    <option value="ADMIN">Administrador (ADMIN)</option>
                                    <option value="OPTICA">Óptica (OPTICA)</option>
                                </select>
                            </div>
                        </div>
                        <div className="flex justify-end mt-4">
                            <button
                                onClick={handleCreate}
                                disabled={creating}
                                className="px-6 py-3 bg-emerald-500 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:scale-105 transition-all shadow-lg shadow-emerald-500/20 flex items-center gap-2 disabled:opacity-50"
                            >
                                {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                                Crear Usuario
                            </button>
                        </div>
                    </div>
                )}

                {/* Users List */}
                {loading ? (
                    <div className="p-12 text-center">
                        <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto mb-3" />
                        <p className="text-xs font-bold text-stone-400">Cargando usuarios...</p>
                    </div>
                ) : users.length === 0 ? (
                    <div className="p-12 text-center">
                        <Users className="w-12 h-12 text-stone-200 dark:text-stone-700 mx-auto mb-3" />
                        <p className="text-xs font-black text-stone-300 dark:text-stone-600 uppercase tracking-widest">No hay usuarios</p>
                    </div>
                ) : (
                    <div className="divide-y-2 divide-stone-50 dark:divide-stone-700/50">
                        {users.map(user => {
                            const isEditing = editingId === user.id;
                            const isChangingPass = changingPasswordId === user.id;

                            return (
                                <div key={user.id} className="p-5 hover:bg-stone-50/50 dark:hover:bg-stone-900/50 transition-all">
                                    <div className="flex items-center gap-5">
                                        {/* Avatar */}
                                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-lg font-black flex-shrink-0 ${user.role === 'ADMIN'
                                            ? 'bg-amber-100 dark:bg-amber-950 text-amber-600 dark:text-amber-400'
                                            : user.role === 'OPTICA'
                                            ? 'bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400'
                                            : 'bg-stone-100 dark:bg-stone-700 text-stone-500 dark:text-stone-400'
                                            }`}>
                                            {user.name.charAt(0).toUpperCase()}
                                        </div>

                                        {/* Info */}
                                        <div className="flex-1 min-w-0">
                                            {isEditing ? (
                                                <div className="space-y-2">
                                                    <div className="flex items-center gap-3">
                                                        <input
                                                            type="text"
                                                            value={editName}
                                                            onChange={e => setEditName(e.target.value)}
                                                            className="px-3 py-1.5 border-2 border-primary rounded-lg text-sm font-bold outline-none bg-white dark:bg-stone-900 w-48"
                                                            autoFocus
                                                        />
                                                        <select
                                                            value={editRole}
                                                            onChange={e => setEditRole(e.target.value)}
                                                            className="px-3 py-1.5 border-2 border-primary rounded-lg text-sm font-bold outline-none bg-white dark:bg-stone-900"
                                                        >
                                                            <option value="STAFF">STAFF</option>
                                                            <option value="ADMIN">ADMIN</option>
                                                            <option value="OPTICA">OPTICA</option>
                                                        </select>
                                                        <button onClick={() => saveEdit(user.id)} className="p-2 bg-emerald-500 text-white rounded-lg hover:scale-105 transition-all">
                                                            <Save className="w-4 h-4" />
                                                        </button>
                                                        <button onClick={() => setEditingId(null)} className="p-2 bg-stone-200 dark:bg-stone-600 text-stone-500 dark:text-stone-300 rounded-lg hover:scale-105 transition-all">
                                                            <X className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                    <input
                                                        type="email"
                                                        value={editNotificationEmail}
                                                        onChange={e => setEditNotificationEmail(e.target.value)}
                                                        placeholder="Email de avisos (vacío = casilla del local)"
                                                        className="px-3 py-1.5 border-2 border-primary rounded-lg text-xs font-medium outline-none bg-white dark:bg-stone-900 w-80"
                                                    />
                                                </div>
                                            ) : (
                                                <>
                                                    <div className="flex items-center gap-2">
                                                        <h3 className="text-sm font-black text-stone-800 dark:text-white">{user.name}</h3>
                                                        <span className={`px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-widest ${user.role === 'ADMIN'
                                                            ? 'bg-amber-100 dark:bg-amber-950 text-amber-600 dark:text-amber-400'
                                                            : user.role === 'OPTICA'
                                                            ? 'bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400'
                                                            : 'bg-stone-100 dark:bg-stone-700 text-stone-500 dark:text-stone-400'
                                                            }`}>
                                                            {user.role === 'ADMIN' ? '🛡️ Admin' : user.role === 'OPTICA' ? '🏪 Óptica' : '👤 Vendedor'}
                                                        </span>
                                                    </div>
                                                    <p className="text-xs text-stone-400 font-medium">
                                                        {user.email}
                                                        {user.role !== 'OPTICA' && (
                                                            <span className="ml-2 text-stone-400/80">
                                                                ✉️ {user.notificationEmail || 'casilla del local'}
                                                            </span>
                                                        )}
                                                    </p>
                                                </>
                                            )}
                                        </div>

                                        {/* Actions */}
                                        {!isEditing && (
                                            <div className="flex items-center gap-2 flex-shrink-0">
                                                <button
                                                    onClick={() => startEdit(user)}
                                                    className="p-2.5 bg-stone-50 dark:bg-stone-700 text-stone-400 rounded-xl hover:bg-blue-50 hover:text-blue-500 dark:hover:bg-blue-950 dark:hover:text-blue-400 transition-all hover:scale-110"
                                                    title="Editar"
                                                >
                                                    <Pencil className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        setChangingPasswordId(isChangingPass ? null : user.id);
                                                        setNewPass('');
                                                    }}
                                                    className={`p-2.5 rounded-xl transition-all hover:scale-110 ${isChangingPass
                                                        ? 'bg-amber-500 text-white'
                                                        : 'bg-stone-50 dark:bg-stone-700 text-stone-400 hover:bg-amber-50 hover:text-amber-500 dark:hover:bg-amber-950 dark:hover:text-amber-400'
                                                        }`}
                                                    title="Cambiar contraseña"
                                                >
                                                    <Lock className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(user)}
                                                    className="p-2.5 bg-stone-50 dark:bg-stone-700 text-stone-400 rounded-xl hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950 dark:hover:text-red-400 transition-all hover:scale-110"
                                                    title="Eliminar"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    {/* Change Password Form */}
                                    {isChangingPass && (
                                        <div className="mt-4 ml-17 flex items-center gap-3 animate-in slide-in-from-top duration-200">
                                            <Lock className="w-4 h-4 text-amber-500 flex-shrink-0" />
                                            <div className="relative flex-1 max-w-xs">
                                                <input
                                                    type={showNewPass ? 'text' : 'password'}
                                                    value={newPass}
                                                    onChange={e => setNewPass(e.target.value)}
                                                    placeholder="Nueva contraseña"
                                                    className="w-full px-4 py-2.5 border-2 border-amber-300 dark:border-amber-700 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-amber-500/20 bg-white dark:bg-stone-900 pr-10"
                                                    autoFocus
                                                    onKeyDown={e => e.key === 'Enter' && savePassword(user.id)}
                                                />
                                                <button
                                                    onClick={() => setShowNewPass(!showNewPass)}
                                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
                                                >
                                                    {showNewPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                                </button>
                                            </div>
                                            <button
                                                onClick={() => savePassword(user.id)}
                                                className="px-4 py-2.5 bg-amber-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-all flex items-center gap-1.5"
                                            >
                                                <Save className="w-3.5 h-3.5" /> Guardar
                                            </button>
                                            <button
                                                onClick={() => { setChangingPasswordId(null); setNewPass(''); }}
                                                className="p-2.5 bg-stone-200 dark:bg-stone-600 text-stone-500 dark:text-stone-300 rounded-xl hover:scale-105 transition-all"
                                            >
                                                <X className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </section>
            )}

            {/* Doctors Section */}
            {activeTab === 'usuarios' && (
            <section className="mt-8 bg-white dark:bg-stone-800 border-2 border-stone-100 dark:border-stone-700 rounded-2xl overflow-hidden">
                <div className="p-6 flex items-center justify-between border-b-2 border-stone-100 dark:border-stone-700">
                    <div className="flex items-center gap-2">
                        <Stethoscope className="w-5 h-5 text-primary" />
                        <h2 className="text-xs font-black uppercase tracking-widest text-stone-400">Médicos</h2>
                        <span className="ml-2 px-2.5 py-0.5 bg-stone-100 dark:bg-stone-700 rounded-full text-[10px] font-black text-stone-500">
                            {doctors.length}
                        </span>
                    </div>
                </div>

                {/* Add Doctor */}
                <div className="p-6 bg-stone-50 dark:bg-stone-900 border-b-2 border-stone-100 dark:border-stone-700">
                    <div className="flex gap-3">
                        <div className="relative flex-1 group">
                            <Stethoscope className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-300 group-focus-within:text-primary transition-colors" />
                            <input
                                type="text"
                                className="w-full pl-12 pr-4 py-3 bg-white dark:bg-stone-800 border-2 border-stone-200 dark:border-stone-600 rounded-xl text-sm font-bold outline-none focus:border-primary transition-all"
                                placeholder="Nombre del médico..."
                                value={newDoctorName}
                                onChange={(e) => setNewDoctorName(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleAddDoctor()}
                            />
                        </div>
                        <button
                            onClick={handleAddDoctor}
                            disabled={addingDoctor || !newDoctorName.trim()}
                            className="px-5 py-2.5 bg-primary text-primary-foreground rounded-xl text-xs font-black uppercase tracking-widest hover:scale-105 transition-all shadow-lg shadow-primary/20 flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            {addingDoctor ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" strokeWidth={3} />}
                            Agregar
                        </button>
                    </div>
                    <p className="text-[10px] text-stone-400 mt-2 ml-1">Estos médicos aparecen como opciones en el formulario de contacto</p>
                </div>

                {/* Doctors List */}
                {doctors.length === 0 ? (
                    <div className="p-12 text-center">
                        <Stethoscope className="w-12 h-12 text-stone-200 dark:text-stone-700 mx-auto mb-3" />
                        <p className="text-xs font-black text-stone-300 dark:text-stone-600 uppercase tracking-widest">No hay médicos</p>
                    </div>
                ) : (
                    <div className="divide-y-2 divide-stone-50 dark:divide-stone-700/50">
                        {doctors.map(doc => (
                            <div key={doc.id} className="p-5 hover:bg-stone-50/50 dark:hover:bg-stone-900/50 transition-all flex items-center justify-between group">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                                        <Stethoscope className="w-5 h-5 text-primary" />
                                    </div>
                                    <span className="font-bold text-sm text-stone-700 dark:text-stone-200">{doc.name}</span>
                                </div>
                                <button
                                    onClick={() => handleDeleteDoctor(doc)}
                                    disabled={deletingDoctorId === doc.id}
                                    className="p-2.5 bg-stone-50 dark:bg-stone-700 text-stone-400 rounded-xl hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950 dark:hover:text-red-400 transition-all hover:scale-110 opacity-0 group-hover:opacity-100 disabled:opacity-50"
                                    title="Eliminar médico"
                                >
                                    {deletingDoctorId === doc.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </section>
            )}

            {/* Laboratories Section */}
            {activeTab === 'laboratorios' && (
            <section className="mt-8 bg-white dark:bg-stone-800 border-2 border-stone-100 dark:border-stone-700 rounded-2xl overflow-hidden">
                <div className="p-6 flex items-center justify-between border-b-2 border-stone-100 dark:border-stone-700">
                    <div className="flex items-center gap-2">
                        <Database className="w-5 h-5 text-primary" />
                        <h2 className="text-xs font-black uppercase tracking-widest text-stone-400">Configuración de Laboratorios</h2>
                        <span className="ml-2 px-2.5 py-0.5 bg-stone-100 dark:bg-stone-700 rounded-full text-[10px] font-black text-stone-500">
                            {labs.length}
                        </span>
                    </div>
                </div>

                {/* Add Lab */}
                <div className="p-6 bg-stone-50 dark:bg-stone-900 border-b-2 border-stone-100 dark:border-stone-700">
                    <div className="flex gap-3">
                        <div className="relative flex-1 group">
                            <Database className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-300 group-focus-within:text-primary transition-colors" />
                            <input
                                type="text"
                                className="w-full pl-12 pr-4 py-3 bg-white dark:bg-stone-800 border-2 border-stone-200 dark:border-stone-600 rounded-xl text-sm font-bold outline-none focus:border-primary transition-all uppercase"
                                placeholder="Nombre del laboratorio..."
                                value={newLabName}
                                onChange={(e) => setNewLabName(e.target.value.toUpperCase())}
                                onKeyDown={(e) => e.key === 'Enter' && handleAddLab()}
                            />
                        </div>
                        <button
                            onClick={handleAddLab}
                            disabled={addingLab || !newLabName.trim()}
                            className="px-5 py-2.5 bg-primary text-primary-foreground rounded-xl text-xs font-black uppercase tracking-widest hover:scale-105 transition-all shadow-lg shadow-primary/20 flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            {addingLab ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" strokeWidth={3} />}
                            Agregar
                        </button>
                    </div>
                    <p className="text-[10px] text-stone-400 mt-2 ml-1">Configura el valor del Calibrado e IVA (para sumar automáticamente al Costo de Lista).</p>
                </div>

                {/* Labs List */}
                {labs.length === 0 ? (
                    <div className="p-12 text-center">
                        <Database className="w-12 h-12 text-stone-200 dark:text-stone-700 mx-auto mb-3" />
                        <p className="text-xs font-black text-stone-300 dark:text-stone-600 uppercase tracking-widest">No hay laboratorios</p>
                    </div>
                ) : (
                    <div className="divide-y-2 divide-stone-50 dark:divide-stone-700/50">
                        {labs.map(lab => {
                            const isEditing = editingLabId === lab.id;
                            return (
                                <div key={lab.id} className="p-5 hover:bg-stone-50/50 dark:hover:bg-stone-900/50 transition-all group">
                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                                                <Database className="w-5 h-5 text-primary" />
                                            </div>
                                            <span className="font-bold text-sm text-stone-700 dark:text-stone-200 uppercase">{lab.name}</span>
                                        </div>
                                        
                                        <div className="flex items-center gap-4 flex-wrap">
                                            {isEditing ? (
                                                <>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[10px] font-black uppercase text-stone-400">Calibrado $</span>
                                                        <input 
                                                            type="number" 
                                                            value={editLabCalibrado} 
                                                            onChange={e => setEditLabCalibrado(Number(e.target.value))}
                                                            className="w-24 px-3 py-1.5 border-2 border-primary rounded-lg text-sm font-bold outline-none bg-white dark:bg-stone-900"
                                                        />
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[10px] font-black uppercase text-stone-400">IVA %</span>
                                                        <input 
                                                            type="number" 
                                                            value={editLabIva} 
                                                            onChange={e => setEditLabIva(Number(e.target.value))}
                                                            className="w-20 px-3 py-1.5 border-2 border-primary rounded-lg text-sm font-bold outline-none bg-white dark:bg-stone-900"
                                                        />
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[10px] font-black uppercase text-stone-400">T. Entrega</span>
                                                        <input 
                                                            type="text" 
                                                            value={editLabDeliveryTime} 
                                                            onChange={e => setEditLabDeliveryTime(e.target.value)}
                                                            className="w-32 px-3 py-1.5 border-2 border-primary rounded-lg text-sm font-bold outline-none bg-white dark:bg-stone-900"
                                                            placeholder="Ej: 7 a 10 días"
                                                        />
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <button onClick={() => handleSaveLab(lab.id)} className="p-2 bg-emerald-500 text-white rounded-lg hover:scale-105 transition-all">
                                                            <Save className="w-4 h-4" />
                                                        </button>
                                                        <button onClick={() => setEditingLabId(null)} className="p-2 bg-stone-200 dark:bg-stone-600 text-stone-500 dark:text-stone-300 rounded-lg hover:scale-105 transition-all">
                                                            <X className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </>
                                            ) : (
                                                <>
                                                    <div className="flex gap-6 mr-4">
                                                        <div className="text-right">
                                                            <p className="text-[9px] font-black uppercase tracking-widest text-stone-400">Calibrado</p>
                                                            <p className="text-sm font-black text-stone-800 dark:text-stone-200">${lab.calibrado.toLocaleString()}</p>
                                                        </div>
                                                        <div className="text-right">
                                                            <p className="text-[9px] font-black uppercase tracking-widest text-stone-400">IVA</p>
                                                            <p className="text-sm font-black text-stone-800 dark:text-stone-200">{lab.iva}%</p>
                                                        </div>
                                                        <div className="text-right">
                                                            <p className="text-[9px] font-black uppercase tracking-widest text-stone-400">Entrega</p>
                                                            <p className="text-sm font-black text-stone-800 dark:text-stone-200">{lab.deliveryTime || '-'}</p>
                                                        </div>
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <button
                                                            onClick={() => {
                                                                setEditingLabId(lab.id);
                                                                setEditLabCalibrado(lab.calibrado);
                                                                setEditLabIva(lab.iva);
                                                                setEditLabDeliveryTime(lab.deliveryTime || '');
                                                            }}
                                                            className="p-2.5 bg-stone-50 dark:bg-stone-700 text-stone-400 rounded-xl hover:bg-blue-50 hover:text-blue-500 transition-all opacity-0 group-hover:opacity-100"
                                                        >
                                                            <Pencil className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteLab(lab.id, lab.name)}
                                                            className="p-2.5 bg-stone-50 dark:bg-stone-700 text-stone-400 rounded-xl hover:bg-red-50 hover:text-red-500 transition-all opacity-0 group-hover:opacity-100"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </section>
            )}

            {/* Configuración de Precios del Bot */}
            {/* Services Pricing Section */}
            {activeTab === 'finanzas' && (
            <section className="mt-8 bg-white dark:bg-stone-800 border-2 border-stone-100 dark:border-stone-700 rounded-2xl overflow-hidden">
                <div className="p-6 flex items-center justify-between border-b-2 border-stone-100 dark:border-stone-700">
                    <div className="flex items-center gap-2">
                        <Cog className="w-5 h-5 text-primary" />
                        <h2 className="text-xs font-black uppercase tracking-widest text-stone-400">Precios de Servicios</h2>
                        <span className="ml-2 px-2.5 py-0.5 bg-stone-100 dark:bg-stone-700 rounded-full text-[10px] font-black text-stone-500">
                            {services.length}
                        </span>
                    </div>
                </div>

                <div className="p-6 bg-stone-50 dark:bg-stone-900 border-b-2 border-stone-100 dark:border-stone-700">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                        <div className="relative md:col-span-1">
                            <input
                                type="text"
                                className="w-full px-4 py-3 bg-white dark:bg-stone-800 border-2 border-stone-200 dark:border-stone-600 rounded-xl text-sm font-bold outline-none focus:border-primary transition-all uppercase"
                                placeholder="Nombre del servicio..."
                                value={newServiceName}
                                onChange={(e) => setNewServiceName(e.target.value.toUpperCase())}
                            />
                        </div>
                        <div className="relative md:col-span-1">
                            <select
                                className="w-full px-4 py-3 bg-white dark:bg-stone-800 border-2 border-stone-200 dark:border-stone-600 rounded-xl text-sm font-bold outline-none focus:border-primary transition-all"
                                value={newServiceCategory}
                                onChange={(e) => setNewServiceCategory(e.target.value)}
                            >
                                <option value="CRISTALES">CRISTALES</option>
                                <option value="ARMAZON">ARMAZÓN</option>
                                <option value="CONTACTOLOGIA">CONTACTOLOGÍA</option>
                                <option value="ACCESORIO">ACCESORIO</option>
                                <option value="OTRO">OTRO</option>
                            </select>
                        </div>
                        <div className="relative md:col-span-1 flex gap-2">
                            <input
                                type="number"
                                className="w-1/2 px-4 py-3 bg-white dark:bg-stone-800 border-2 border-stone-200 dark:border-stone-600 rounded-xl text-sm font-bold outline-none focus:border-primary transition-all"
                                placeholder="Cash $"
                                value={newServicePriceCash}
                                onChange={(e) => setNewServicePriceCash(e.target.value ? Number(e.target.value) : '')}
                            />
                            <input
                                type="number"
                                className="w-1/2 px-4 py-3 bg-white dark:bg-stone-800 border-2 border-stone-200 dark:border-stone-600 rounded-xl text-sm font-bold outline-none focus:border-primary transition-all"
                                placeholder="Tarjeta $"
                                value={newServicePriceCredit}
                                onChange={(e) => setNewServicePriceCredit(e.target.value ? Number(e.target.value) : '')}
                            />
                        </div>
                        <div className="relative md:col-span-1">
                            <button
                                onClick={handleAddService}
                                disabled={addingService || !newServiceName.trim() || newServicePriceCash === ''}
                                className="w-full px-5 py-3 bg-primary text-primary-foreground rounded-xl text-xs font-black uppercase tracking-widest hover:scale-105 transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                {addingService ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" strokeWidth={3} />}
                                Agregar
                            </button>
                        </div>
                    </div>
                </div>

                {services.length === 0 ? (
                    <div className="p-12 text-center">
                        <Cog className="w-12 h-12 text-stone-200 dark:text-stone-700 mx-auto mb-3" />
                        <p className="text-xs font-black text-stone-300 dark:text-stone-600 uppercase tracking-widest">No hay servicios configurados</p>
                    </div>
                ) : (
                    <div className="divide-y-2 divide-stone-50 dark:divide-stone-700/50">
                        {services.map(svc => (
                            <div key={svc.id} className="p-5 hover:bg-stone-50/50 dark:hover:bg-stone-900/50 transition-all flex items-center justify-between group">
                                <div className="flex flex-col">
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold text-sm text-stone-800 dark:text-stone-200">{svc.name}</span>
                                        <span className="px-2 py-0.5 bg-stone-100 dark:bg-stone-700 rounded-md text-[10px] font-black text-stone-500 uppercase">{svc.category}</span>
                                    </div>
                                    <div className="text-xs font-medium text-stone-400 mt-1">
                                        Efectivo: ${svc.priceCash.toLocaleString('es-AR')} | Tarjeta: ${svc.priceCredit.toLocaleString('es-AR')}
                                    </div>
                                </div>
                                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={() => handleDeleteService(svc.id, svc.name)}
                                        className="p-2.5 bg-stone-50 dark:bg-stone-700 text-stone-400 rounded-xl hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950 dark:hover:text-red-400 transition-all hover:scale-110"
                                        title="Eliminar servicio"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </section>
            )}

            {/* ARCA Billing Section */}
            {activeTab === 'finanzas' && (
            <section className="mt-8 bg-white dark:bg-stone-800 border-2 border-stone-100 dark:border-stone-700 rounded-2xl overflow-hidden">
                <div className="p-6 flex items-center justify-between border-b-2 border-stone-100 dark:border-stone-700">
                    <div className="flex items-center gap-2">
                        <Shield className="w-5 h-5 text-blue-500" />
                        <h2 className="text-xs font-black uppercase tracking-widest text-stone-400">Facturación Electrónica ARCA</h2>
                    </div>
                    <button
                        onClick={async () => {
                            setLoadingBilling(true);
                            try {
                                const res = await fetch('/api/billing/config');
                                const data = await res.json();
                                setBillingConfig(data);
                                setMessage({ type: 'success', text: 'Estados de facturación actualizados' });
                            } catch {
                                setMessage({ type: 'error', text: 'Error al actualizar configuración de ARCA' });
                            } finally {
                                setLoadingBilling(false);
                            }
                        }}
                        disabled={loadingBilling}
                        className="p-2 text-stone-400 hover:text-blue-500 transition-all hover:rotate-180"
                        title="Refrescar estados"
                    >
                        <RefreshCw className={`w-4 h-4 ${loadingBilling ? 'animate-spin' : ''}`} />
                    </button>
                </div>
                <div className="p-6">
                    <div className="bg-blue-50 dark:bg-blue-950/30 rounded-2xl p-4 mb-6 border border-blue-200 dark:border-blue-800">
                        <div className="flex items-start gap-3">
                            <ShieldCheck className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                            <div>
                                <p className="text-sm font-bold text-blue-700 dark:text-blue-300 mb-1">Múltiples Puntos de Facturación</p>
                                <p className="text-xs text-blue-600/70 dark:text-blue-400/70 leading-relaxed">
                                    El sistema soporta facturar desde diferentes CUITs según la cuenta (Ishtar, Yani).
                                    Asegurate de tener los certificados configurados en Railway para cada cuenta.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {(billingConfig || [
                            { account: 'ISH', label: 'Ishtar Pissano', cuit: 23386152314, puntoDeVenta: 1 },
                            { account: 'YANI', label: 'Yani Pissano', cuit: 20409378472, puntoDeVenta: 1 }
                        ]).map((cfg: BillingConfig) => (
                            <div key={cfg.account} className="bg-stone-50 dark:bg-stone-900 rounded-3xl p-6 border border-stone-100 dark:border-stone-800 flex flex-col gap-4">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h3 className="text-sm font-black text-stone-800 dark:text-white uppercase tracking-tight">{cfg.label}</h3>
                                        <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mt-0.5">{cfg.account} ACCOUNT</p>
                                    </div>
                                    {cfg.connected !== undefined && (
                                        <span className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${cfg.connected ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
                                            {cfg.connected ? '● Online' : '○ Offline'}
                                        </span>
                                    )}
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div className="p-3 bg-white dark:bg-stone-800 rounded-2xl shadow-sm">
                                        <p className="text-[8px] font-black text-stone-400 uppercase tracking-widest mb-0.5">CUIT</p>
                                        <p className="text-xs font-mono font-bold text-stone-700 dark:text-stone-300">{cfg.cuit}</p>
                                    </div>
                                    <div className="p-3 bg-white dark:bg-stone-800 rounded-2xl shadow-sm">
                                        <p className="text-[8px] font-black text-stone-400 uppercase tracking-widest mb-0.5">Pto Venta</p>
                                        <p className="text-xs font-bold text-stone-700 dark:text-stone-300">{cfg.puntoDeVenta}</p>
                                    </div>
                                </div>

                                {cfg.connected && (
                                    <div className="bg-emerald-50 dark:bg-emerald-950/20 p-3 rounded-2xl flex flex-col gap-1 border border-emerald-100 dark:border-emerald-900/30">
                                        <div className="flex justify-between items-center text-[10px] font-bold">
                                            <span className="text-emerald-600/70">Última FC emitida:</span>
                                            <span className="text-emerald-600 uppercase font-black">N° {cfg.lastVoucherNumber || '---'}</span>
                                        </div>
                                    </div>
                                )}
                                
                                {cfg.error && (
                                    <div className="bg-red-50 dark:bg-red-950/20 p-3 rounded-2xl flex flex-col gap-1 border border-red-100 dark:border-red-900/30">
                                        <p className="text-[9px] font-bold text-red-600 leading-tight">
                                           ⚠️ Error: {cfg.error}
                                        </p>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    <div className="mt-6 p-4 bg-stone-50 dark:bg-stone-900 rounded-2xl border border-stone-100 dark:border-stone-700">
                        <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-2">📋 Configuración para Producción</p>
                        <ul className="text-xs text-stone-400 space-y-1.5 leading-relaxed">
                            <li className="flex items-start gap-2">
                                <span className="text-blue-500 font-black">•</span>
                                <span>Configurá <code>AFIP_CERT_ISH</code> y <code>AFIP_KEY_ISH</code> en Railway para Ishtar.</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-indigo-500 font-black">•</span>
                                <span>Configurá <code>AFIP_CERT_YANI</code> y <code>AFIP_KEY_YANI</code> en Railway para Yani.</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-amber-500 font-black">•</span>
                                <span><b>Importante:</b> Si tu punto de venta en AFIP no es el 1, agregá la variable <code>AFIP_PUNTO_VENTA_ISH</code> o <code>AFIP_PUNTO_VENTA_YANI</code> en Railway.</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-stone-500 font-black">•</span>
                                <span>Asegurate que el Punto de Venta esté habilitado para Factura Electrónica (WebService) en la web de AFIP.</span>
                            </li>
                        </ul>
                    </div>
                </div>
            </section>
            )}

            {/* Database Backup */}
            {activeTab === 'sistema' && (
            <section className="mt-8 bg-white dark:bg-stone-800 border-2 border-stone-100 dark:border-stone-700 rounded-2xl overflow-hidden">
                <div className="p-6 flex items-center justify-between border-b-2 border-stone-100 dark:border-stone-700">
                    <div className="flex items-center gap-2">
                        <Database className="w-5 h-5 text-primary" />
                        <h2 className="text-xs font-black uppercase tracking-widest text-stone-400">Respaldo de Datos (Backup)</h2>
                    </div>
                    {loadingBackup && <Loader2 className="w-4 h-4 text-stone-400 animate-spin" />}
                </div>
                
                <div className="p-6 grid gap-6 md:grid-cols-2">
                    {/* Status panel */}
                    <div className="space-y-4">
                        <div className="p-4 rounded-xl border border-stone-100 dark:border-stone-700 bg-stone-50 dark:bg-stone-800/50">
                            <h3 className="text-sm font-bold mb-3 flex items-center gap-2">
                                <Database className="w-4 h-4 text-stone-500" />
                                Estado del Sistema
                            </h3>
                            <div className="space-y-3">
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-stone-500 flex items-center gap-2"><UploadCloud className="w-4 h-4" /> Almacenamiento Externo (S3)</span>
                                    {backupStatus?.storageConfigured ? 
                                        <span className="text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30 px-2 py-0.5 rounded text-xs font-bold">Activo</span> : 
                                        <span className="text-amber-600 bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 rounded text-xs font-bold">Local (Sin S3)</span>
                                    }
                                </div>
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-stone-500 flex items-center gap-2"><Clock className="w-4 h-4" /> Cron Automático</span>
                                    {backupStatus?.cronEnabled ? 
                                        <span className="text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30 px-2 py-0.5 rounded text-xs font-bold">Configurado</span> : 
                                        <span className="text-red-500 bg-red-100 dark:bg-red-900/30 px-2 py-0.5 rounded text-xs font-bold">Sin CRON_SECRET</span>
                                    }
                                </div>
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-stone-500 flex items-center gap-2"><HardDrive className="w-4 h-4" /> Total Backups</span>
                                    <span className="font-mono text-stone-700 dark:text-stone-300">{backupStatus?.totalBackups || 0}</span>
                                </div>
                            </div>
                        </div>

                        {backupStatus?.latestBackup && (
                            <div className="p-4 rounded-xl border border-stone-100 dark:border-stone-700 bg-stone-50 dark:bg-stone-800/50">
                                <h3 className="text-sm font-bold mb-3 flex items-center gap-2">
                                    <Calendar className="w-4 h-4 text-stone-500" />
                                    Último Backup
                                </h3>
                                <div className="space-y-2 text-sm">
                                    <p className="flex justify-between"><span className="text-stone-500">Fecha:</span> <span className="font-mono">{new Date(backupStatus.latestBackup.lastModified).toLocaleString()}</span></p>
                                    <p className="flex justify-between"><span className="text-stone-500">Tamaño:</span> <span className="font-mono">{(backupStatus.latestBackup.size / 1024 / 1024).toFixed(2)} MB</span></p>
                                    <p className="flex justify-between"><span className="text-stone-500">Archivo:</span> <span className="font-mono text-[10px] text-stone-400 truncate ml-2 max-w-[150px]">{backupStatus.latestBackup.key.split('/').pop()}</span></p>
                                </div>
                            </div>
                        )}
                        
                        {!backupStatus?.storageConfigured && (
                            <div className="p-3 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 rounded-lg text-xs flex items-start gap-2">
                                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                                <p>S3 no está configurado. Los backups se guardan temporalmente en el servidor local. <b>Agregá STORAGE_BUCKET_NAME y credenciales para mayor seguridad.</b></p>
                            </div>
                        )}
                    </div>

                    {/* Actions panel */}
                    <div className="flex flex-col gap-3 justify-center border-t md:border-t-0 md:border-l border-stone-100 dark:border-stone-700 pt-6 md:pt-0 md:pl-6">
                        <button
                            onClick={async () => {
                                try {
                                    const res = await fetch('/api/backup');
                                    if (!res.ok) throw new Error('Error al generar backup');
                                    const blob = await res.blob();
                                    const url = URL.createObjectURL(blob);
                                    const a = document.createElement('a');
                                    a.href = url;
                                    const cd = res.headers.get('Content-Disposition');
                                    const match = cd?.match(/filename="(.+)"/);
                                    a.download = match ? match[1] : `atelier-backup-${Date.now()}.json.gz`;
                                    document.body.appendChild(a);
                                    a.click();
                                    document.body.removeChild(a);
                                    URL.revokeObjectURL(url);
                                    setMessage({ type: 'success', text: 'Backup descargado exitosamente' });
                                } catch (e) {
                                    setMessage({ type: 'error', text: 'Error al descargar el backup' });
                                }
                            }}
                            className="w-full py-3 bg-primary text-primary-foreground rounded-xl text-xs font-black uppercase tracking-widest hover:scale-[1.02] transition-all shadow-lg flex items-center justify-center gap-2"
                        >
                            <Download className="w-4 h-4" /> Descargar Backup JSON
                        </button>
                        
                        <button
                            onClick={async () => {
                                setForcingBackup(true);
                                try {
                                    const res = await fetch('/api/backup', { method: 'POST' });
                                    const data = await res.json();
                                    if (res.ok) {
                                        setMessage({ type: 'success', text: 'Backup generado correctamente' });
                                        fetchBackupStatus(); // reload status
                                    } else {
                                        throw new Error(data.error);
                                    }
                                } catch (e: any) {
                                    setMessage({ type: 'error', text: e.message || 'Error al generar backup' });
                                } finally {
                                    setForcingBackup(false);
                                }
                            }}
                            disabled={forcingBackup}
                            className="w-full py-3 bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-stone-700 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-stone-200 dark:hover:bg-stone-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            {forcingBackup ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                            Forzar Backup Ahora
                        </button>

                        <div className="mt-auto text-center text-[10px] text-stone-400 pt-4">
                            La descarga genera un archivo JSON comprimido (<i>.json.gz</i>) con todas las tablas.
                        </div>
                    </div>
                </div>
            </section>
            )}

            {/* System Info */}
            {activeTab === 'sistema' && (
            <section className="mt-8 bg-white dark:bg-stone-800 border-2 border-stone-100 dark:border-stone-700 rounded-2xl p-6">
                <div className="flex items-center gap-2 mb-4">
                    <Shield className="w-5 h-5 text-stone-400" />
                    <h2 className="text-xs font-black uppercase tracking-widest text-stone-400">Información del Sistema</h2>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <InfoItem label="Aplicación" value="Atelier Óptica CRM" />
                    <InfoItem label="Versión" value="1.0.0" />
                    <InfoItem label="Framework" value="Next.js 16" />
                    <InfoItem label="Base de Datos" value="PostgreSQL (Railway)" />
                </div>
            </section>
            )}
        </main>
    );
}



function InfoItem({ label, value }: { label: string; value: string }) {
    return (
        <div className="p-3 bg-stone-50 dark:bg-stone-900 rounded-xl">
            <p className="text-[9px] font-black text-stone-400 uppercase tracking-widest mb-1">{label}</p>
            <p className="text-sm font-bold text-stone-700 dark:text-stone-200">{value}</p>
        </div>
    );
}
