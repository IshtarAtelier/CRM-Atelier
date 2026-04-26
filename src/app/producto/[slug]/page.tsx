import { LensConfigurator } from "@/components/Storefront/LensConfigurator";

// Mock data for demonstration until DB is fully synced
const MOCK_PRODUCT = {
  name: "Atelier Carey Vintage",
  brand: "Atelier Colección Autor",
  price: 55000,
  description: "Un diseño atemporal en acetato italiano. Su patrón carey tostado se adapta perfectamente a cualquier tono de piel, aportando una calidez y sofisticación inigualable. Ideal para rostros ovalados o cuadrados.",
  features: ["Acetato Italiano de Alta Densidad", "Bisagras Flexibles de 5 Barriles", "Diseño Ergonómico Ultraliviano"],
  // Usamos una imagen genérica temporal de Unsplash
  imageUrl: "https://images.unsplash.com/photo-1511499767150-a48a237f0083?auto=format&fit=crop&q=80&w=1000",
};

export default function ProductPage({ params }: { params: { slug: string } }) {
  return (
    <div className="min-h-screen bg-stone-50 dark:bg-[#0a0a0a] text-stone-900 dark:text-stone-100 selection:bg-stone-900 selection:text-white dark:selection:bg-white dark:selection:text-black">
      
      {/* HEADER MINIMALISTA */}
      <header className="fixed top-0 w-full p-6 z-50 mix-blend-difference text-white flex justify-between items-center">
        <div className="font-black tracking-tighter text-2xl">ATELIER</div>
        <button className="text-sm font-bold uppercase tracking-widest border border-white/20 px-6 py-2 rounded-full hover:bg-white hover:text-black transition-colors">Volver</button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 min-h-screen">
        
        {/* LADO IZQUIERDO: VISUAL (EFECTO GRAVEDAD CERO) */}
        <div className="relative h-[60vh] lg:h-screen sticky top-0 flex flex-col justify-center items-center p-8 bg-stone-100 dark:bg-stone-950 overflow-hidden">
          {/* Fondo abstracto */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-stone-200/50 dark:from-white/5 via-transparent to-transparent opacity-50" />
          
          <div className="relative z-10 max-w-lg w-full">
            <p className="text-sm uppercase tracking-[0.3em] text-stone-500 mb-4">{MOCK_PRODUCT.brand}</p>
            <h1 className="text-5xl lg:text-7xl font-black tracking-tighter mb-8 dark:text-white">{MOCK_PRODUCT.name}</h1>
            
            {/* Imagen del producto con hover sutil */}
            <div className="relative group perspective-1000">
              <img 
                src={MOCK_PRODUCT.imageUrl} 
                alt={MOCK_PRODUCT.name}
                className="w-full object-cover rounded-2xl shadow-2xl transition-transform duration-700 ease-out group-hover:scale-105 group-hover:rotate-y-2 group-hover:-rotate-x-2"
              />
              <div className="absolute -inset-4 bg-white/10 dark:bg-white/5 blur-2xl -z-10 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
            </div>
          </div>
        </div>

        {/* LADO DERECHO: CONFIGURADOR Y DESCRIPCIÓN */}
        <div className="p-6 md:p-12 lg:p-20 xl:p-24 flex flex-col justify-center">
          
          {/* Descripción */}
          <div className="mb-12">
            <h2 className="text-xl font-bold mb-4 dark:text-white">Sobre el diseño</h2>
            <p className="text-stone-600 dark:text-stone-400 text-lg leading-relaxed mb-6">
              {MOCK_PRODUCT.description}
            </p>
            
            <ul className="space-y-3 border-y border-stone-200 dark:border-stone-800 py-6">
              {MOCK_PRODUCT.features.map((feature, idx) => (
                <li key={idx} className="flex items-center gap-3 text-sm font-medium text-stone-700 dark:text-stone-300">
                  <div className="w-1.5 h-1.5 rounded-full bg-stone-900 dark:bg-white" />
                  {feature}
                </li>
              ))}
            </ul>
          </div>

          {/* El Configurador Interactivo */}
          <LensConfigurator basePrice={MOCK_PRODUCT.price} />

        </div>
      </div>
    </div>
  );
}
