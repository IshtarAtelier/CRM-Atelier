import { LensConfigurator } from "@/components/Storefront/LensConfigurator";
import Link from "next/link";
import Image from "next/image";

// Mock data
const MOCK_PRODUCT = {
  name: "Atelier 9030(GLD)",
  brand: "ATELIER COLECCIÓN",
  price: 55000,
  description: "Un diseño atemporal en acetato italiano. Su patrón carey tostado se adapta perfectamente a cualquier tono de piel, aportando una calidez y sofisticación inigualable. Ideal para rostros ovalados o cuadrados.",
  features: ["Acetato Italiano de Alta Densidad", "Bisagras Flexibles de 5 Barriles", "Diseño Ergonómico Ultraliviano"],
  // Usamos la imagen procesada de alta calidad
  imageUrl: "/images/products/atelier-9030-gold.png",
};

export default function ProductPage({ params }: { params: { slug: string } }) {
  return (
    <div className="min-h-screen bg-white text-black selection:bg-black selection:text-white" style={{ fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif" }}>
      
      {/* HEADER MINIMALISTA ESTILO GM */}
      <header className="fixed top-0 w-full z-50 px-5 py-4 flex justify-between items-center bg-transparent mix-blend-difference text-white">
        <Link href="/" className="text-[13px] font-medium hover:opacity-60 transition-opacity" style={{ textShadow: "0 1px 3px rgba(0,0,0,0.3)" }}>
          Back
        </Link>
        <Link href="/" className="absolute left-1/2 -translate-x-1/2 text-[16px] font-bold tracking-[0.15em] drop-shadow-md" style={{ fontFamily: "'Georgia', 'Times New Roman', serif" }}>
          ATELIER ÓPTICA
        </Link>
        <div className="flex gap-5">
           <button className="text-[13px] font-medium hover:opacity-60 transition-opacity" style={{ textShadow: "0 1px 3px rgba(0,0,0,0.3)" }}>Cart(0)</button>
        </div>
      </header>

      <div className="flex flex-col lg:flex-row min-h-screen pt-16 lg:pt-0">
        
        {/* LADO IZQUIERDO: VISUAL (Fondo gris claro, imagen inmensa flotando) */}
        <div className="w-full lg:w-[55%] bg-[#f2f2f2] relative flex items-center justify-center p-6 lg:p-12 min-h-[50vh] lg:h-screen lg:sticky lg:top-0 lg:border-r border-[#e5e5e5]">
          <div className="w-full max-w-2xl aspect-[4/3] lg:aspect-square relative">
            <Image 
              src={MOCK_PRODUCT.imageUrl} 
              alt={MOCK_PRODUCT.name}
              fill
              priority
              className="object-contain mix-blend-multiply"
            />
          </div>
        </div>

        {/* LADO DERECHO: INFO Y CONFIGURADOR */}
        <div className="w-full lg:w-[45%] p-6 lg:p-16 flex flex-col bg-white">
          <div className="mb-10 lg:mb-12">
            <h1 className="text-2xl font-normal mb-2">{MOCK_PRODUCT.name}</h1>
            <p className="text-[15px] text-[#999] mb-1">${MOCK_PRODUCT.price.toLocaleString()}</p>
            <p className="text-[10px] font-bold uppercase tracking-widest mb-8">6 Cuotas sin interés • Envío sin cargo a todo el país</p>
            
            <div className="w-full h-[1px] bg-[#e5e5e5] mb-8" />
            
            <h2 className="text-[13px] font-bold uppercase tracking-widest mb-4">Sobre el diseño</h2>
            <p className="text-[13px] text-[#666] leading-relaxed mb-6">
              {MOCK_PRODUCT.description}
            </p>
            
            <ul className="space-y-2 mb-8">
              {MOCK_PRODUCT.features.map((feature, idx) => (
                <li key={idx} className="text-[12px] text-[#666] flex items-center gap-3">
                  <span className="w-[3px] h-[3px] bg-black rounded-full"></span>
                  {feature}
                </li>
              ))}
            </ul>
          </div>

          <div className="w-full h-[1px] bg-[#e5e5e5] mb-8" />

          {/* El Configurador Interactivo */}
          <LensConfigurator basePrice={MOCK_PRODUCT.price} />
        </div>
      </div>

      {/* BOTON FLOTANTE WHATSAPP (Moderno y sutil) */}
      <div className="fixed bottom-6 right-6 z-50 flex items-center gap-4">
        <span className="bg-white text-black text-[10px] font-bold uppercase tracking-widest px-4 py-3 border border-[#e5e5e5] hidden md:block" style={{ boxShadow: "0 4px 20px rgba(0,0,0,0.05)" }}>
          ¿Dudas? Hablá con un óptico
        </span>
        <a 
          href="https://wa.me/5493541215971?text=Hola%20Atelier,%20estoy%20viendo%20el%20modelo%20Atelier%209030%20y%20tengo%20una%20consulta." 
          target="_blank" 
          rel="noopener noreferrer"
          className="bg-black text-white p-4 rounded-full shadow-2xl hover:scale-110 transition-transform flex items-center justify-center group"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/>
          </svg>
        </a>
      </div>
    </div>
  );
}
