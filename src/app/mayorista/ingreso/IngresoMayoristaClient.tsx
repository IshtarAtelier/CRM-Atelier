'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Eye, EyeOff } from 'lucide-react';
import { WHATSAPP_PHONE } from '@/lib/constants';

export default function IngresoMayoristaClient() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const waLink = `https://wa.me/${WHATSAPP_PHONE}?text=${encodeURIComponent(
    'Hola! Quiero pedir mi usuario mayorista de Cápsula Escarlata.',
  )}`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.user) localStorage.setItem('user', JSON.stringify(data.user));
        // Cuenta del equipo interno: su área es el CRM, no este portal.
        router.push(data.user?.role === 'OPTICA' ? '/tienda' : '/admin');
        router.refresh();
      } else {
        const data = await res.json();
        setError(data.error || 'Ocurrió un error al iniciar sesión.');
      }
    } catch {
      setError('No se pudo conectar con el servidor.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#141110] text-[#faf8f5] flex flex-col justify-center px-6 py-12">
      <div className="w-full max-w-md mx-auto">
        <p className="text-xs tracking-[0.2em] uppercase text-[#c8a55c] mb-3 text-center">
          Cápsula Escarlata
        </p>
        <h1 className="font-serif text-3xl md:text-4xl font-bold text-center mb-2">
          Área <span className="italic text-[#c8a55c]">Mayorista</span>
        </h1>
        <p className="text-sm text-[#a89e91] text-center mb-10">
          Portal exclusivo para ópticas y distribuidores
        </p>

        {error && (
          <div className="mb-5 border border-red-400/40 bg-red-500/10 text-red-300 text-sm rounded-xl px-4 py-3">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="email" className="block text-xs uppercase tracking-widest text-[#a89e91] mb-1.5">
              Usuario
            </label>
            <input
              id="email"
              name="email"
              type="text"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-[#1f1b18] border border-[#3a332c] text-[#faf8f5] placeholder-[#6b6259] focus:outline-none focus:border-[#c8a55c] transition-colors"
              placeholder="tu-optica@email.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-xs uppercase tracking-widest text-[#a89e91] mb-1.5">
              Contraseña
            </label>
            <div className="relative">
              <input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 pr-12 rounded-xl bg-[#1f1b18] border border-[#3a332c] text-[#faf8f5] placeholder-[#6b6259] focus:outline-none focus:border-[#c8a55c] transition-colors"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6b6259] hover:text-[#a89e91] transition-colors"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3.5 rounded-full bg-[#c8a55c] text-[#141110] font-semibold text-sm uppercase tracking-widest hover:bg-[#d6bfae] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center"
          >
            {isLoading ? (
              <span className="w-5 h-5 border-2 border-[#141110]/30 border-t-[#141110] rounded-full animate-spin" />
            ) : (
              'Ingresar al portal'
            )}
          </button>
        </form>

        <div className="mt-8 border-t border-[#3a332c] pt-6 text-center space-y-3">
          <p className="text-sm text-[#a89e91]">
            ¿Todavía no tenés usuario?{' '}
            <a href={waLink} target="_blank" rel="noopener noreferrer" className="text-[#c8a55c] hover:underline">
              Pedilo por WhatsApp
            </a>
          </p>
          <p className="text-sm text-[#a89e91]">
            <Link href="/mayorista/catalogo" className="text-[#c8a55c] hover:underline">
              Ver el catálogo mayorista →
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
