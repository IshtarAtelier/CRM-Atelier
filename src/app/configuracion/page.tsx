'use client';

import { useState, useEffect } from 'react';
import {
    Cog, Users, Plus, Pencil, Trash2, Save, X, Eye, EyeOff,
    Shield, ShieldCheck, Loader2, Lock, UserPlus, AlertTriangle,
    CheckCircle2, Stethoscope, Bot, MessageCircle, Wifi, WifiOff,
    Sparkles, RotateCcw, Copy, Download, Database, RefreshCw
} from 'lucide-react';

// ── Types ─────────────────────────────────────

interface User {
    id: string;
    name: string;
    email: string;
    role: string;
    createdAt: string;
}

interface Doctor {
    id: string;
    name: string;
    createdAt: string;
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

// ── Page ──────────────────────────────────

export default function ConfiguracionPage() {
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [changingPasswordId, setChangingPasswordId] = useState<string | null>(null);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // Doctors state
    const [doctors, setDoctors] = useState<Doctor[]>([]);
    const [newDoctorName, setNewDoctorName] = useState('');
    const [addingDoctor, setAddingDoctor] = useState(false);
    const [deletingDoctorId, setDeletingDoctorId] = useState<string | null>(null);

    // Agent state
    const [agentPrompt, setAgentPrompt] = useState('');
    const [agentEnabled, setAgentEnabled] = useState(false);
    const [agentSaving, setAgentSaving] = useState(false);
    const [agentSaved, setAgentSaved] = useState(false);
    const [waConnected, setWaConnected] = useState(false);
    const [agentApiKey, setAgentApiKey] = useState('');
    const [agentModel, setAgentModel] = useState('gpt-4o-mini');
    const [agentConfigured, setAgentConfigured] = useState(false);
    const [showApiKey, setShowApiKey] = useState(false);

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

    // Change password
    const [newPass, setNewPass] = useState('');
    const [showNewPass, setShowNewPass] = useState(false);

    useEffect(() => {
        fetchUsers();
        fetchDoctors();
        fetchAgentConfig();
        fetchWaStatus();
        fetchBillingConfig();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

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

    const fetchAgentConfig = async () => {
        try {
            const res = await fetch('/api/whatsapp/agent');
            const data = await res.json();
            setAgentPrompt(data.prompt || '');
            setAgentEnabled(data.enabled || false);
            setAgentApiKey(data.apiKey || '');
            setAgentModel(data.model || 'gpt-4o-mini');
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
            if (data.apiKey !== undefined) setAgentApiKey(data.apiKey);
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
    };

    const saveEdit = async (userId: string) => {
        try {
            const res = await fetch(`/api/users/${userId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: editName, role: editRole }),
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

            {/* Users Section */}
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
                                            : 'bg-stone-100 dark:bg-stone-700 text-stone-500 dark:text-stone-400'
                                            }`}>
                                            {user.name.charAt(0).toUpperCase()}
                                        </div>

                                        {/* Info */}
                                        <div className="flex-1 min-w-0">
                                            {isEditing ? (
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
                                                    </select>
                                                    <button onClick={() => saveEdit(user.id)} className="p-2 bg-emerald-500 text-white rounded-lg hover:scale-105 transition-all">
                                                        <Save className="w-4 h-4" />
                                                    </button>
                                                    <button onClick={() => setEditingId(null)} className="p-2 bg-stone-200 dark:bg-stone-600 text-stone-500 dark:text-stone-300 rounded-lg hover:scale-105 transition-all">
                                                        <X className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            ) : (
                                                <>
                                                    <div className="flex items-center gap-2">
                                                        <h3 className="text-sm font-black text-stone-800 dark:text-white">{user.name}</h3>
                                                        <span className={`px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-widest ${user.role === 'ADMIN'
                                                            ? 'bg-amber-100 dark:bg-amber-950 text-amber-600 dark:text-amber-400'
                                                            : 'bg-stone-100 dark:bg-stone-700 text-stone-500 dark:text-stone-400'
                                                            }`}>
                                                            {user.role === 'ADMIN' ? '🛡️ Admin' : '👤 Vendedor'}
                                                        </span>
                                                    </div>
                                                    <p className="text-xs text-stone-400 font-medium">{user.email}</p>
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

            {/* Doctors Section */}
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

            {/* WhatsApp Agent Section */}
            <section className="mt-8 bg-white dark:bg-stone-800 border-2 border-stone-100 dark:border-stone-700 rounded-2xl overflow-hidden">
                <div className="p-6 flex items-center justify-between border-b-2 border-stone-100 dark:border-stone-700">
                    <div className="flex items-center gap-2">
                        <Bot className="w-5 h-5 text-violet-500" />
                        <h2 className="text-xs font-black uppercase tracking-widest text-stone-400">Agente WhatsApp IA</h2>
                        <span className={`ml-2 px-2.5 py-0.5 rounded-full text-[10px] font-black flex items-center gap-1 ${waConnected
                            ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400'
                            : 'bg-stone-100 dark:bg-stone-700 text-stone-500'
                            }`}>
                            {waConnected ? <><Wifi className="w-3 h-3" /> Conectado</> : <><WifiOff className="w-3 h-3" /> Desconectado</>}
                        </span>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="text-[10px] font-black text-stone-400 uppercase tracking-widest">
                            {agentEnabled ? 'Activado' : 'Desactivado'}
                        </span>
                        <button
                            onClick={() => {
                                const next = !agentEnabled;
                                setAgentEnabled(next);
                                saveAgentConfig({ enabled: next });
                            }}
                            className={`w-14 h-7 rounded-full transition-all relative flex-shrink-0 ${agentEnabled ? 'bg-violet-500' : 'bg-stone-300 dark:bg-stone-600'}`}
                        >
                            <div className={`w-6 h-6 rounded-full bg-white shadow-md absolute top-0.5 transition-all ${agentEnabled ? 'left-7' : 'left-0.5'}`} />
                        </button>
                    </div>
                </div>

                <div className="p-6">
                    {/* Info */}
                    <div className="bg-violet-50 dark:bg-violet-950/30 rounded-2xl p-4 mb-6 border border-violet-200 dark:border-violet-800">
                        <div className="flex items-start gap-3">
                            <Sparkles className="w-5 h-5 text-violet-500 flex-shrink-0 mt-0.5" />
                            <div className="flex-1">
                                <p className="text-sm font-bold text-violet-700 dark:text-violet-300 mb-1">Agente de Ventas IA</p>
                                <p className="text-xs text-violet-600/70 dark:text-violet-400/70">
                                    El agente responde automáticamente a los clientes por WhatsApp usando IA. Crea contactos, detecta interés, y guarda resúmenes en el historial.
                                </p>
                            </div>
                            <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest flex-shrink-0 ${agentConfigured
                                ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400'
                                : 'bg-red-100 dark:bg-red-950 text-red-600 dark:text-red-400'
                                }`}>
                                {agentConfigured ? '✓ Listo' : '✗ Sin API Key'}
                            </span>
                        </div>
                    </div>

                    {/* API Key & Model */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                        <div>
                            <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest block mb-1.5">
                                🔑 API Key OpenAI
                            </label>
                            <div className="relative">
                                <input
                                    type={showApiKey ? 'text' : 'password'}
                                    value={agentApiKey}
                                    onChange={e => setAgentApiKey(e.target.value)}
                                    onBlur={() => {
                                        if (agentApiKey && !agentApiKey.startsWith('••••')) {
                                            saveAgentConfig({ apiKey: agentApiKey });
                                        }
                                    }}
                                    placeholder="sk-..."
                                    className="w-full px-4 py-3 bg-stone-50 dark:bg-stone-900 border-2 border-stone-200 dark:border-stone-600 rounded-xl text-sm font-mono outline-none focus:border-violet-500 transition-all pr-12"
                                />
                                <button
                                    onClick={() => setShowApiKey(!showApiKey)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
                                >
                                    {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>
                        <div>
                            <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest block mb-1.5">
                                🧠 Modelo de IA
                            </label>
                            <select
                                value={agentModel}
                                onChange={e => {
                                    setAgentModel(e.target.value);
                                    saveAgentConfig({ model: e.target.value });
                                }}
                                className="w-full px-4 py-3 bg-stone-50 dark:bg-stone-900 border-2 border-stone-200 dark:border-stone-600 rounded-xl text-sm font-bold outline-none focus:border-violet-500 transition-all"
                            >
                                <option value="gpt-4o-mini">GPT-4o Mini (rápido y económico)</option>
                                <option value="gpt-4o">GPT-4o (más inteligente, más caro)</option>
                                <option value="gpt-4.1-mini">GPT-4.1 Mini (último modelo)</option>
                                <option value="gpt-4.1">GPT-4.1 (premium)</option>
                            </select>
                        </div>
                    </div>

                    {/* Prompt Editor */}
                    <div className="mb-4">
                        <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest block mb-2">
                            Prompt / Instrucciones del Agente
                        </label>
                        <textarea
                            value={agentPrompt}
                            onChange={e => { setAgentPrompt(e.target.value); setAgentSaved(false); }}
                            rows={10}
                            placeholder={`Sos *Sol*, la asistente virtual de Atelier Óptica.\n\n══ DATOS DEL NEGOCIO ══\n• Dirección: José Luis de Tejeda 4380, Cerro de las Rosas, Córdoba\n• Horarios: Lunes a Viernes 9:00 a 18:00 | Sábados 9:00 a 13:00\n\n══ TU PERSONALIDAD ══\n- Tono: cálido, profesional, cercano\n- Respondé siempre en español argentino\n- Mensajes cortos, máximo 2-3 párrafos\n\n══ REGLAS DE COTIZACIÓN ══\n- Usá los precios del catálogo (se inyectan automáticamente)\n- Mencioná contado Y cuotas\n- Para presupuestos completos, invitá al local\n\n══ CUÁNDO DERIVAR A UN HUMANO ══\n- Reclamos o problemas\n- Cierre de ventas\n- Recetas y diagnósticos`}
                            className="w-full px-4 py-3 bg-stone-50 dark:bg-stone-900 border-2 border-stone-200 dark:border-stone-600 rounded-xl text-sm font-medium outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 transition-all resize-y min-h-[200px] font-mono leading-relaxed"
                        />
                        <div className="flex items-center justify-between mt-2">
                            <span className="text-[10px] text-stone-400">
                                {agentPrompt.length} caracteres
                            </span>
                            {agentSaved && (
                                <span className="text-[10px] font-bold text-emerald-500 flex items-center gap-1">
                                    <CheckCircle2 className="w-3 h-3" /> Guardado
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Preset Templates */}
                    <div className="mb-6">
                        <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest block mb-2">
                            Plantillas rápidas
                        </label>
                        <div className="flex flex-wrap gap-2">
                            {[
                                {
                                    label: '⭐ Completo',
                                    prompt: `Sos *Sol*, la asistente virtual de **Atelier Óptica**, la óptica mejor calificada de Córdoba (⭐ 5/5 en Google Business).\n\n══ DATOS DEL NEGOCIO ══\n• Dirección: José Luis de Tejeda 4380, Cerro de las Rosas, Córdoba\n• Horarios: Lunes a Viernes 9:00 a 18:00 | Sábados 9:00 a 13:00 | Domingos cerrado\n• Instagram: @atelieroptica\n\n══ TU PERSONALIDAD ══\n- Tono: cálido, profesional, cercano — como una amiga que sabe mucho de lentes\n- Usá emojis con moderación (👓 🌟 ✨ 😊)\n- Voseá según hable el cliente\n- Respondé en español argentino\n- Mensajes cortos: máximo 3-4 párrafos, ideal 2\n- Si es la primera vez, saludá con su nombre\n\n══ QUÉ PODÉS HACER ══\n1. Cotizar lentes y armazones con precios del catálogo\n2. Informar sobre tipos de cristales y sus diferencias\n3. Agendar visitas al local\n4. Consultar pedidos existentes del contacto\n5. Responder sobre garantías, tiempos, obras sociales\n\n══ REGLAS DE COTIZACIÓN ══\n- Usá SIEMPRE los precios del catálogo. Nunca inventes precios.\n- Mencioná precio de contado Y cuotas (6 cuotas sin interés, 25% recargo financiero)\n- Obra social: aceptamos, pero el descuento varía según cobertura — invitá a consultarlo en el local\n- Graduaciones altas: el precio puede variar, ofrecé presupuesto personalizado\n- Presupuesto completo (armazón + cristales) siempre es personalizado\n\n══ TIEMPOS DE ENTREGA ══\n- Stock: 24-48 hs hábiles\n- Laboratorio / Multifocales: 7 a 10 días hábiles\n\n══ RECOLECCIÓN DE DATOS ══\nCuando hay interés, pedí naturalmente: nombre completo, si tiene receta (fecha), obra social (cuál), qué tipo de lentes busca.\n\n══ DERIVAR A HUMANO cuando: ══\n- Pide hablar con persona | Reclamo | Consulta técnica/receta | Quiere confirmar compra | Turno oftalmólogo\n\n══ NO PODÉS: ══\n- Cerrar ventas ni confirmar pedidos\n- Inventar info que no esté en el catálogo\n- Dar diagnósticos visuales\n- Prometer descuentos específicos por OS`
                                },
                                {
                                    label: '🛍️ Ventas',
                                    prompt: `Sos *Sol*, la asistente de ventas de **Atelier Óptica** — la óptica mejor calificada de Córdoba ⭐ 5/5.\n📍 José Luis de Tejeda 4380, Cerro de las Rosas\n🕐 Lun-Vie 9-18 | Sáb 9-13\n\n══ TU OBJETIVO ══\nAyudá a los clientes a encontrar los lentes ideales y guialos hacia una visita al local o un presupuesto.\n\n══ PERSONALIDAD ══\n- Cálida, entusiasta, profesional\n- Mensajes cortos (2-3 párrafos máx)\n- Español argentino, voseo\n- Emojis con moderación: 👓 ✨ 😊\n\n══ COTIZACIÓN ══\n- Usá precios del catálogo (se inyectan automáticamente)\n- Siempre mencioná contado Y cuotas (6 cuotas sin interés, +25%)\n- Para armazones: rangos por marca\n- Presupuesto completo = personalizado en el local\n- Obras sociales: aceptamos, descuento varía. Invitá a consultar\n\n══ DATOS A RECOLECTAR ══\n- Nombre | Receta (fecha) | Obra social | Tipo de lente\n\n══ DERIVAR A HUMANO ══\n- Quiere cerrar compra\n- Reclamo o problema\n- Consulta de receta\n- Pide hablar con persona\n\n══ NO HACER ══\n- No cerrar ventas\n- No inventar precios\n- No dar diagnósticos`
                                },
                                {
                                    label: '🔧 Soporte',
                                    prompt: `Sos *Sol*, la asistente de atención al cliente de **Atelier Óptica**.\n📍 José Luis de Tejeda 4380, Cerro de las Rosas, Córdoba\n🕐 Lun-Vie 9-18 | Sáb 9-13\n\n══ TU OBJETIVO ══\nAyudá a los clientes con dudas sobre sus pedidos, garantías, ajustes y reparaciones.\n\n══ PERSONALIDAD ══\n- Empática, solucionadora, paciente\n- Si hay un problema, transmití calma y confianza\n\n══ POLÍTICAS ══\n- Garantía: 6 meses por defectos de fabricación\n- Ajustes y reparaciones menores: sin cargo\n- Adaptación de multifocales: acompañamiento gratuito\n- Cambios de armazón: dentro de los 7 días\n\n══ PEDIDOS ══\n- Para consultar estado: pedí nombre completo\n- Stock: listo en 24-48 hs\n- Laboratorio: 7-10 días hábiles\n- Si hay demora, ofrecé disculpas y seguimiento\n\n══ DERIVAR A HUMANO ══\n- Reclamo serio o insatisfacción\n- Rotura o defecto del producto\n- Pide hablar con encargado\n\n══ NO HACER ══\n- No autorizar reembolsos\n- No prometer plazos exactos\n- No inventar información`
                                },
                                {
                                    label: '📅 Turnos',
                                    prompt: `Sos *Sol*, la asistente de turnos de **Atelier Óptica**.\n📍 José Luis de Tejeda 4380, Cerro de las Rosas, Córdoba\n\n══ HORARIOS DISPONIBLES ══\n- Lunes a Viernes: 9:00 a 18:00\n- Sábados: 9:00 a 13:00\n- Domingos: Cerrado\n\n══ TU OBJETIVO ══\nCoordinar citas para: asesoramiento en lentes, mediciones, control de adaptación, retiro de pedidos.\n\n══ PERSONALIDAD ══\n- Organizada, amable, eficiente\n- Mensajes concisos y claros\n\n══ DATOS PARA TURNO ══\n1. Nombre completo\n2. Motivo de la visita\n3. Preferencia de día y horario\n4. Si tiene receta (que la traiga)\n\n══ CONFIRMACIÓN ══\nConfirmá con un resumen: "📋 Turno confirmado para [nombre], [día] a las [hora]. Recordá traer tu receta si la tenés. ¡Te esperamos! 😊"\n\n══ DERIVAR A HUMANO ══\n- Turno con oftalmólogo (no lo manejamos nosotros)\n- Urgencias\n- Cancelaciones de último momento`
                                },
                            ].map(t => (
                                <button
                                    key={t.label}
                                    onClick={() => {
                                        if (agentPrompt && !confirm('¿Reemplazar el prompt actual con esta plantilla?')) return;
                                        setAgentPrompt(t.prompt);
                                        setAgentSaved(false);
                                    }}
                                    className="px-4 py-2 bg-stone-100 dark:bg-stone-700 text-stone-600 dark:text-stone-300 rounded-xl text-xs font-bold hover:bg-violet-100 hover:text-violet-600 dark:hover:bg-violet-950 dark:hover:text-violet-400 transition-all hover:scale-105"
                                >
                                    {t.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-between">
                        <button
                            onClick={() => {
                                if (confirm('¿Limpiar todo el prompt?')) {
                                    setAgentPrompt('');
                                    setAgentSaved(false);
                                }
                            }}
                            className="px-4 py-2.5 bg-stone-100 dark:bg-stone-700 text-stone-500 rounded-xl text-xs font-bold hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950 dark:hover:text-red-400 transition-all flex items-center gap-2"
                        >
                            <RotateCcw className="w-3.5 h-3.5" /> Limpiar
                        </button>
                        <button
                            onClick={async () => {
                                setAgentSaving(true);
                                await saveAgentConfig({ prompt: agentPrompt, enabled: agentEnabled });
                                setAgentSaving(false);
                                setAgentSaved(true);
                                setMessage({ type: 'success', text: 'Configuración del agente guardada' });
                            }}
                            disabled={agentSaving}
                            className="px-6 py-3 bg-violet-500 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:scale-105 transition-all shadow-lg shadow-violet-500/20 flex items-center gap-2 disabled:opacity-50"
                        >
                            {agentSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            Guardar Configuración
                        </button>
                    </div>

                    {/* Tips */}
                    <div className="mt-6 p-4 bg-stone-50 dark:bg-stone-900 rounded-xl border border-stone-100 dark:border-stone-700">
                        <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-2">💡 Tips para un buen prompt</p>
                        <ul className="text-xs text-stone-400 space-y-1">
                            <li>• Los precios se inyectan automáticamente desde el inventario</li>
                            <li>• Especificá el tono: formal, cercano, profesional</li>
                            <li>• Definí qué puede y qué NO puede responder el agente</li>
                            <li>• Indicá las reglas de obra social y promociones</li>
                            <li>• Definí cuándo debe derivar a un humano</li>
                        </ul>
                    </div>
                </div>
            </section>

            {/* ARCA Billing Section */}
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

            {/* Database Backup */}
            <section className="mt-8 bg-white dark:bg-stone-800 border-2 border-stone-100 dark:border-stone-700 rounded-2xl overflow-hidden">
                <div className="p-6 flex items-center justify-between border-b-2 border-stone-100 dark:border-stone-700">
                    <div className="flex items-center gap-2">
                        <Database className="w-5 h-5 text-primary" />
                        <h2 className="text-xs font-black uppercase tracking-widest text-stone-400">Respaldo de Datos</h2>
                    </div>
                </div>
                <div className="p-6">
                    <div className="bg-amber-50 dark:bg-amber-950/30 rounded-2xl p-4 mb-4 border border-amber-200 dark:border-amber-800">
                        <div className="flex items-start gap-3">
                            <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                            <div>
                                <p className="text-sm font-bold text-amber-700 dark:text-amber-300 mb-1">Importante</p>
                                <p className="text-xs text-amber-600/70 dark:text-amber-400/70">
                                    Descargá un respaldo de la base de datos periódicamente para proteger tus datos.
                                    Guardalo en un lugar seguro (Google Drive, USB, etc.).
                                </p>
                            </div>
                        </div>
                    </div>
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
                                a.download = match ? match[1] : `atelier-backup-${Date.now()}.db`;
                                document.body.appendChild(a);
                                a.click();
                                document.body.removeChild(a);
                                URL.revokeObjectURL(url);
                                setMessage({ type: 'success', text: 'Backup descargado exitosamente' });
                            } catch (e) {
                                setMessage({ type: 'error', text: 'Error al descargar el backup' });
                            }
                        }}
                        className="w-full py-4 bg-primary text-primary-foreground rounded-xl text-xs font-black uppercase tracking-widest hover:scale-[1.02] transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2"
                    >
                        <Download className="w-4 h-4" /> Descargar Backup de la Base de Datos
                    </button>
                </div>
            </section>

            {/* System Info */}
            <section className="mt-8 bg-white dark:bg-stone-800 border-2 border-stone-100 dark:border-stone-700 rounded-2xl p-6">
                <div className="flex items-center gap-2 mb-4">
                    <Shield className="w-5 h-5 text-stone-400" />
                    <h2 className="text-xs font-black uppercase tracking-widest text-stone-400">Información del Sistema</h2>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <InfoItem label="Aplicación" value="Atelier Óptica CRM" />
                    <InfoItem label="Versión" value="1.0.0" />
                    <InfoItem label="Framework" value="Next.js 16" />
                    <InfoItem label="Base de Datos" value="SQLite (Prisma)" />
                </div>
            </section>
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
