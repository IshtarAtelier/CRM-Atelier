"use client";

import { useRouter } from "next/navigation";
import { LogOut, Lock, Eye, EyeOff, Loader2, X, CheckCircle2, AlertTriangle } from "lucide-react";
import { useState } from "react";

export function UserProfile({ name, role, userId }: { name: string, role: string, userId: string }) {
    const router = useRouter();
    const [isLoggingOut, setIsLoggingOut] = useState(false);
    
    // Change password state
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [newPassword, setNewPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [isChangingPass, setIsChangingPass] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    const handleLogout = async () => {
        setIsLoggingOut(true);
        try {
            await fetch("/api/auth/logout", { method: "POST" });
            router.push("/login");
            router.refresh(); // Force reload to clear middleware state
        } catch (error) {
            console.error("Error logging out", error);
            setIsLoggingOut(false);
        }
    };

    const handleChangePassword = async () => {
        if (!newPassword || newPassword.length < 4) {
            setMessage({ type: 'error', text: 'La contraseña debe tener al menos 4 caracteres' });
            return;
        }

        setIsChangingPass(true);
        setMessage(null);

        try {
            const res = await fetch(`/api/users/${userId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password: newPassword }),
            });

            if (res.ok) {
                setMessage({ type: 'success', text: 'Contraseña actualizada' });
                setNewPassword('');
                setTimeout(() => {
                    setShowPasswordModal(false);
                    setMessage(null);
                }, 2000);
            } else {
                const data = await res.json();
                setMessage({ type: 'error', text: data.error || 'Error al cambiar contraseña' });
            }
        } catch (error) {
            setMessage({ type: 'error', text: 'Error de conexión' });
        } finally {
            setIsChangingPass(false);
        }
    };

    const initial = name ? name.charAt(0).toUpperCase() : "U";
    const roleDisplay = role === "ADMIN" ? "Administrativo" : "Operativo";

    return (
        <>
            <div className="p-4 border-t border-sidebar-border bg-sidebar">
                <div className="flex items-center justify-between px-2 py-2">
                    <div className="flex items-center gap-3 overflow-hidden">
                        <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold flex-shrink-0">
                            {initial}
                        </div>
                        <div className="flex flex-col overflow-hidden">
                            <span className="text-sm font-medium truncate text-foreground">{name}</span>
                            <span className="text-xs text-foreground/50 truncate">{roleDisplay}</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                        {userId && (
                            <button
                                onClick={() => setShowPasswordModal(true)}
                                className="p-2 text-foreground/40 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/30 rounded-lg transition-colors"
                                title="Cambiar contraseña"
                            >
                                <Lock size={16} />
                            </button>
                        )}
                        <button
                            onClick={handleLogout}
                            disabled={isLoggingOut}
                            className="p-2 text-foreground/40 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors"
                            title="Cerrar sesión"
                        >
                            <LogOut size={16} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Change Password Modal */}
            {showPasswordModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-stone-900 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl border border-stone-200 dark:border-stone-800 animate-in zoom-in-95 duration-200">
                        <div className="p-4 border-b border-stone-100 dark:border-stone-800 flex items-center justify-between">
                            <h3 className="font-black text-stone-800 dark:text-white flex items-center gap-2">
                                <Lock className="w-4 h-4 text-amber-500" />
                                Cambiar Contraseña
                            </h3>
                            <button
                                onClick={() => {
                                    setShowPasswordModal(false);
                                    setNewPassword('');
                                    setMessage(null);
                                }}
                                className="p-1 text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 rounded-lg transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-5">
                            {message && (
                                <div className={`mb-4 p-3 rounded-xl flex items-center gap-2 text-xs font-bold ${
                                    message.type === 'success' 
                                        ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400' 
                                        : 'bg-red-50 text-red-600 dark:bg-red-950/50 dark:text-red-400'
                                }`}>
                                    {message.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                                    {message.text}
                                </div>
                            )}
                            
                            <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest block mb-2">
                                Nueva Contraseña
                            </label>
                            <div className="relative mb-5">
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={newPassword}
                                    onChange={e => setNewPassword(e.target.value)}
                                    placeholder="••••••••"
                                    className="w-full px-4 py-3 bg-stone-50 dark:bg-stone-800 border-2 border-stone-200 dark:border-stone-700 rounded-xl text-sm font-bold outline-none focus:border-amber-500 transition-all pr-12"
                                    autoFocus
                                    onKeyDown={e => e.key === 'Enter' && handleChangePassword()}
                                />
                                <button
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
                                >
                                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                            
                            <button
                                onClick={handleChangePassword}
                                disabled={isChangingPass || !newPassword}
                                className="w-full py-3 bg-amber-500 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-amber-600 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                {isChangingPass ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                                Actualizar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
