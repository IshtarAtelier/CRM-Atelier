import { Metadata } from "next";
import Link from "next/link";
import { StorefrontNavbar } from "@/components/Storefront/StorefrontNavbar";
import { StorefrontFooter } from "@/components/Storefront/StorefrontFooter";
import { FloatingWhatsApp } from "@/components/Storefront/FloatingWhatsApp";

export const metadata: Metadata = {
  title: "Blog de Salud Visual | Atelier Óptica Córdoba",
  description: "Guías, consejos y artículos escritos por expertos en óptica. Aprendé sobre presbicia, astigmatismo, miopía infantil, lectura de recetas y tecnologías de cristales.",
  keywords: ["blog salud visual", "como leer receta anteojos", "que es el filtro azul", "miopia infantil", "optica cordoba blog"],
};

const ARTICULOS = [
  {
    slug: "como-leer-receta-oftalmologica",
    title: "Guía para leer tu receta oftalmológica (OD, OI, Esfera y Cilindro)",
    excerpt: "Aprendé a descifrar los números que escribió tu oftalmólogo y entendé qué tipo de cristal y tecnología vas a necesitar.",
    category: "Guías",
    date: "Proximamente"
  },
  {
    slug: "filtro-azul-vs-antirreflejo",
    title: "Filtro Azul (Blue Cut) vs Antirreflejo: ¿Qué sirve realmente?",
    excerpt: "Derribamos los mitos sobre la fatiga visual, las pantallas y los cristales. La verdad clínica sobre lo que tus ojos necesitan.",
    category: "Cristales",
    date: "Proximamente"
  },
  {
    slug: "guia-precios-multifocales-argentina",
    title: "¿Cuánto cuesta un lente multifocal en Argentina? (Guía de Precios)",
    excerpt: "Desde opciones económicas hasta la línea Varilux XR y Zeiss. Todo lo que define el precio de un multifocal y cómo evitar sorpresas.",
    category: "Presupuestos",
    date: "Proximamente"
  },
  {
    slug: "control-miopia-infantil-lentes",
    title: "Control de Miopía Infantil: La revolución de Stellest y MyoFix",
    excerpt: "Por qué los niños de hoy desarrollan más miopía por el uso de pantallas y cómo estas nuevas lentes terapéuticas pueden frenarla.",
    category: "Salud Infantil",
    date: "Proximamente"
  }
];

export default function BlogIndexPage() {
  return (
    <div className="bg-[#faf8f5] text-black min-h-screen flex flex-col">
      <StorefrontNavbar theme="dark" />
      
      <main className="flex-grow pt-32 pb-16">
        <section className="px-6 mb-16">
          <div className="max-w-4xl mx-auto text-center">
            <span className="inline-block py-1 px-3 rounded-full bg-[#e8e2db] text-black/60 text-sm font-bold tracking-widest uppercase mb-4">
              Atelier Journal
            </span>
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">
              Educación y Salud Visual
            </h1>
            <p className="text-lg text-black/60 md:text-xl max-w-2xl mx-auto">
              Respondemos con honestidad las preguntas más frecuentes sobre óptica, presbicia, tratamientos y tendencias.
            </p>
          </div>
        </section>

        <section className="max-w-5xl mx-auto px-6 mb-24">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {ARTICULOS.map((post) => (
              <div key={post.slug} className="group flex flex-col bg-white rounded-2xl p-8 shadow-sm border border-[#e8e2db] hover:border-black/30 transition-colors">
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#283f5a]">
                    {post.category}
                  </span>
                  <span className="text-xs text-black/40">·</span>
                  <span className="text-xs text-black/40">{post.date}</span>
                </div>
                <h2 className="text-xl font-bold mb-3 group-hover:text-[#283f5a] transition-colors line-clamp-2">
                  {post.title}
                </h2>
                <p className="text-black/60 mb-6 flex-grow line-clamp-3">
                  {post.excerpt}
                </p>
                <Link href="#" className="inline-flex items-center text-sm font-bold text-black opacity-50 cursor-not-allowed">
                  Próximamente →
                </Link>
              </div>
            ))}
          </div>
        </section>
      </main>

      <StorefrontFooter />
      <FloatingWhatsApp />
    </div>
  );
}
