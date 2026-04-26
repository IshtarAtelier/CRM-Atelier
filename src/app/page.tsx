import Link from 'next/link';

export default function StorefrontHome() {
  return (
    <div className="min-h-screen bg-stone-50 dark:bg-stone-950 flex flex-col items-center justify-center text-center px-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-background to-background -z-10" />
      
      <img src="/assets/logo-atelier-optica.png" alt="Atelier Óptica" className="h-20 mb-8 dark:invert object-contain" />
      
      <h1 className="text-4xl md:text-6xl font-black text-stone-900 dark:text-white tracking-tight mb-6 max-w-3xl">
        Bienvenido a tu nueva <br className="hidden md:block"/> 
        <span className="text-primary italic">Vidriera Digital</span>
      </h1>
      
      <p className="text-lg md:text-xl text-stone-600 dark:text-stone-400 mb-10 max-w-2xl leading-relaxed">
        El CRM ha sido trasladado exitosamente a una ruta privada. Este espacio ahora está liberado y listo para que diseñemos tu catálogo público, tienda online y embudo de ventas.
      </p>
      
      <div className="flex flex-col sm:flex-row gap-4 mt-8">
        <Link href="/producto/atelier-carey-vintage" className="px-8 py-4 bg-stone-900 dark:bg-white text-white dark:text-black font-black uppercase tracking-widest text-sm rounded-2xl hover:scale-105 transition-all shadow-xl">
          🔍 Ver Configurador en Acción
        </Link>
        <Link href="/admin" className="px-8 py-4 bg-primary text-primary-foreground font-black uppercase tracking-widest text-sm rounded-2xl hover:bg-primary/90 hover:scale-105 transition-all shadow-xl shadow-primary/20">
          Ir al Panel de Control (CRM)
        </Link>
        <Link href="/blog" className="px-8 py-4 bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-200 font-bold uppercase tracking-widest text-sm rounded-2xl hover:bg-stone-100 dark:hover:bg-stone-800 border border-stone-200 dark:border-stone-800 hover:scale-105 transition-all">
          Ver el Blog
        </Link>
      </div>
    </div>
  );
}
