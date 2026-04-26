import Link from "next/link";
import Image from "next/image";

// Placeholder de imágenes hiperrealistas (Estilo Gentle Monster)
const EDITORIAL_MODELS = [
  {
    id: 1,
    name: "ATELIER GHOST (Rimless)",
    image: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=800", // Mujer con anteojos
    price: "$55.000",
    link: "/producto/atelier-carey-vintage"
  },
  {
    id: 2,
    name: "ATELIER ONYX (Acetato)",
    image: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&q=80&w=800", // Hombre con anteojos
    price: "$62.000",
    link: "/producto/atelier-carey-vintage"
  },
  {
    id: 3,
    name: "ATELIER ROSE (Metal)",
    image: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=800", // Mujer fashion
    price: "$48.000",
    link: "/producto/atelier-carey-vintage"
  }
];

// Placeholder para los armazones flotantes (Bodegón)
const FLOATING_FRAMES = [
  {
    id: 1,
    name: "Atelier 9030 (Nylon)",
    price: "$ 55,000.00",
    image: "https://images.unsplash.com/photo-1577803645773-f96470509666?auto=format&fit=crop&q=80&w=800&bg=transparent", // Anteojo fondo transparente
    link: "/producto/atelier-carey-vintage"
  },
  {
    id: 2,
    name: "CIMA Dreamy",
    price: "$ 48,000.00",
    image: "https://images.unsplash.com/photo-1511499767150-a48a237f0083?auto=format&fit=crop&q=80&w=800&bg=transparent",
    link: "/producto/atelier-carey-vintage"
  },
  {
    id: 3,
    name: "Mistral Manglares",
    price: "$ 52,000.00",
    image: "https://images.unsplash.com/photo-1591076482161-42ce6da69f67?auto=format&fit=crop&q=80&w=800&bg=transparent",
    link: "/producto/atelier-carey-vintage"
  },
  {
    id: 4,
    name: "Atelier Carey Vintage",
    price: "$ 65,000.00",
    image: "https://images.unsplash.com/photo-1582142407894-ec85a1260a46?auto=format&fit=crop&q=80&w=800&bg=transparent",
    link: "/producto/atelier-carey-vintage"
  }
];

export default function Home() {
  return (
    <div className="min-h-screen bg-[#f8f8f8] dark:bg-[#0a0a0a] text-black dark:text-white selection:bg-black selection:text-white">
      
      {/* HEADER MINIMALISTA */}
      <header className="fixed top-0 w-full p-6 z-50 mix-blend-difference text-white flex justify-between items-center">
        <div className="font-black tracking-[0.2em] text-xl">ATELIER</div>
        <div className="flex gap-6 text-xs font-bold uppercase tracking-widest">
          <Link href="/admin" className="hover:opacity-50 transition-opacity">CRM</Link>
          <Link href="/blog" className="hover:opacity-50 transition-opacity">Editorial</Link>
          <button>Cart (0)</button>
        </div>
      </header>

      {/* HERO SECTION */}
      <section className="h-screen w-full relative flex items-center justify-center overflow-hidden">
        {/* Usamos una imagen espectacular de fondo */}
        <div className="absolute inset-0">
          <img 
            src="https://images.unsplash.com/photo-1614713568390-4820689b6574?auto=format&fit=crop&q=80&w=2000" 
            alt="Atelier Campaign"
            className="w-full h-full object-cover opacity-90 dark:opacity-70 scale-105 animate-[pulse_20s_ease-in-out_infinite_alternate]"
          />
        </div>
        <div className="absolute inset-0 bg-black/20" />
        
        <div className="relative z-10 text-center text-white">
          <h1 className="text-6xl md:text-8xl font-black tracking-tighter mb-6 drop-shadow-2xl">
            2026 COLLECTION
          </h1>
          <p className="text-sm md:text-base uppercase tracking-[0.5em] font-bold mb-10 opacity-90">
            Diseño de Autor. Precisión Clínica.
          </p>
          <Link 
            href="/producto/atelier-carey-vintage" 
            className="inline-block border-2 border-white px-10 py-4 text-xs font-bold uppercase tracking-widest hover:bg-white hover:text-black transition-colors backdrop-blur-sm"
          >
            Descubrir
          </Link>
        </div>
      </section>

      {/* EDITORIAL GRID (Estilo Gentle Monster) */}
      <section className="px-4 py-20 md:py-32 max-w-[1600px] mx-auto">
        <div className="flex justify-between items-end mb-16 px-4">
          <h2 className="text-3xl md:text-5xl font-black tracking-tighter">
            Nuevos Ingresos
          </h2>
          <p className="text-xs font-bold uppercase tracking-widest hidden md:block">
            Ver toda la colección →
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-4">
          {EDITORIAL_MODELS.map((model) => (
            <Link href={model.link} key={model.id} className="group cursor-pointer">
              <div className="relative aspect-[3/4] overflow-hidden bg-stone-200 dark:bg-stone-900 mb-6 rounded-sm">
                <img 
                  src={model.image} 
                  alt={model.name}
                  className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105"
                />
                {/* Overlay oscuro sutil al hacer hover */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-500" />
              </div>
              <div className="flex justify-between items-start px-2">
                <div>
                  <h3 className="font-bold text-sm tracking-wide mb-1 group-hover:underline underline-offset-4">{model.name}</h3>
                  <p className="text-xs text-stone-500">{model.price}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* FLOATING FRAMES GRID (Bodegón Minimalista) */}
      <section className="bg-[#f4f4f4] dark:bg-[#111] py-20 px-8 md:px-12">
        <h3 className="text-xs font-bold uppercase tracking-widest text-stone-500 mb-16">
          Catálogo Curado
        </h3>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8 md:gap-12">
          {FLOATING_FRAMES.map((frame) => (
            <div key={frame.id} className="group flex flex-col items-center">
              <Link href={frame.link} className="w-full flex-1 flex flex-col items-center justify-center mb-8 relative">
                {/* Contenedor cuadrado perfecto para que respire */}
                <div className="w-full aspect-square flex items-center justify-center p-8 transition-transform duration-700 group-hover:scale-110">
                  <img 
                    src={frame.image} 
                    alt={frame.name}
                    className="w-full object-contain drop-shadow-xl mix-blend-multiply dark:mix-blend-normal dark:brightness-150"
                  />
                </div>
              </Link>
              
              <div className="w-full flex justify-between items-start text-left px-2">
                <div>
                  <h4 className="text-[10px] font-bold tracking-wide uppercase text-stone-900 dark:text-stone-300 mb-1">{frame.name}</h4>
                  <p className="text-[10px] text-stone-500 font-medium">{frame.price}</p>
                </div>
                <button className="text-stone-400 hover:text-stone-900 dark:hover:text-white transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"></path></svg>
                </button>
              </div>
            </div>
          ))}
        </div>
        
        <div className="flex justify-center mt-20">
          <button className="text-xs font-bold uppercase tracking-widest border-b border-stone-300 dark:border-stone-700 pb-1 hover:border-stone-900 dark:hover:border-white transition-colors">
            Cargar más modelos
          </button>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-stone-200 dark:border-stone-900 p-12 flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="font-black tracking-[0.2em] text-xl">ATELIER</div>
        <p className="text-xs text-stone-500 uppercase tracking-widest font-bold">
          Córdoba, Argentina © 2026
        </p>
      </footer>
    </div>
  );
}
