"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Glasses } from "lucide-react";

export default function LoginPage() {
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError("");

        try {
            const res = await fetch("/api/auth/login", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ email, password }),
            });

            if (res.ok) {
                const data = await res.json();
                if (data.user) {
                    localStorage.setItem('user', JSON.stringify(data.user));
                }
                router.push("/");
                router.refresh(); // Force a full reload to apply middleware redirects properly
            } else {
                const data = await res.json();
                setError(data.error || "Ocurrió un error al iniciar sesión.");
            }
        } catch (err) {
            setError("No se pudo conectar con el servidor.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-background flex flex-col justify-center py-12 sm:px-6 lg:px-8 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-background to-background relative overflow-hidden">
            {/* Elementos decorativos de fondo */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10">
                <div className="absolute top-[-10%] left-[-5%] w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
                <div className="absolute bottom-[-10%] right-[-5%] w-96 h-96 bg-amber-900/5 rounded-full blur-3xl" />
            </div>

            <div className="sm:mx-auto sm:w-full sm:max-w-md animate-in slide-in-from-bottom-4 fade-in duration-700">
                <div className="flex justify-center">
                    <div className="w-16 h-16 rounded-full bg-stone-100 flex items-center justify-center shadow-inner overflow-hidden border-2 border-primary/20 p-1">
                        <img src="/assets/ATELIEROptica Icono full color PNG.png" alt="Logo Atelier Óptica" className="w-full h-full object-contain" />
                    </div>
                </div>
                <h2 className="mt-6 text-center text-3xl font-extrabold text-foreground tracking-tight">
                    Ingreso a Atelier Óptica
                </h2>
                <p className="mt-2 text-center text-sm text-foreground/60">
                    Sistema de Gestión y CRM
                </p>
            </div>

            <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md animate-in slide-in-from-bottom-8 fade-in duration-1000 delay-150">
                <div className="bg-sidebar py-8 px-4 shadow-xl sm:rounded-2xl sm:px-10 border border-sidebar-border mx-4 sm:mx-0">

                    {error && (
                        <div className="mb-4 bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 p-4 rounded-md">
                            <div className="flex">
                                <div className="flex-shrink-0">
                                    <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                    </svg>
                                </div>
                                <div className="ml-3">
                                    <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
                                </div>
                            </div>
                        </div>
                    )}

                    <form className="space-y-6" onSubmit={handleSubmit}>
                        <div>
                            <label
                                htmlFor="email"
                                className="block text-sm font-medium text-foreground/80 mb-1"
                            >
                                Usuario
                            </label>
                            <div className="mt-1">
                                <input
                                    id="email"
                                    name="email"
                                    type="text"
                                    autoComplete="username"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="appearance-none block w-full px-4 py-3 border border-sidebar-border rounded-xl shadow-sm placeholder-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent bg-background text-foreground transition-shadow"
                                    placeholder="ishtar"
                                />
                            </div>
                        </div>

                        <div>
                            <label
                                htmlFor="password"
                                className="block text-sm font-medium text-foreground/80 mb-1"
                            >
                                Contraseña
                            </label>
                            <div className="mt-1">
                                <input
                                    id="password"
                                    name="password"
                                    type="password"
                                    autoComplete="current-password"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="appearance-none block w-full px-4 py-3 border border-sidebar-border rounded-xl shadow-sm placeholder-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent bg-background text-foreground transition-shadow"
                                    placeholder="••••••••"
                                />
                            </div>
                        </div>

                        <div>
                            <button
                                type="submit"
                                disabled={isLoading}
                                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-medium text-primary-foreground bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary focus:ring-offset-background transition-all disabled:opacity-50 disabled:cursor-not-allowed items-center gap-2"
                            >
                                {isLoading ? (
                                    <div className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                                ) : (
                                    <>
                                        Ingresar al Sistema
                                    </>
                                )}
                            </button>
                        </div>
                    </form>

                    <div className="mt-6 text-center">
                        <p className="text-xs text-foreground/40">
                            Admin: ishtar | Vendedor: matias
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
