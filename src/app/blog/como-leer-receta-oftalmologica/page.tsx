import React from 'react';
import { Metadata } from 'next';
import { StorefrontNavbar } from '@/components/Storefront/StorefrontNavbar';
import { StorefrontFooter } from '@/components/Storefront/StorefrontFooter';
import { FileText, Eye, CheckCircle } from 'lucide-react';

export const metadata: Metadata = {
  alternates: { canonical: '/blog/como-leer-receta-oftalmologica' },
  title: "Cómo Leer tu Receta Oftalmológica: Guía Paso a Paso | Atelier Óptica",
  description: "¿No entendés tu receta oftalmológica (OD, OI, Esfera, Cilindro)? Descubrí cómo interpretarla con nuestra guía. Asesoramiento en Cerro de las Rosas, Nueva Córdoba y envíos a toda Argentina.",
  keywords: ["cómo leer receta oftalmológica", "receta de anteojos", "esfera cilindro eje", "óptica en Córdoba", "Cerro de las Rosas", "Nueva Córdoba", "anteojos de receta", "Atelier Óptica", "astigmatismo", "miopía", "presbicia"],
};

export default function LeerRecetaOftalmologicaPage() {
  return (
    <div className="min-h-screen bg-[#faf8f5] font-sans text-[#111]">
      <StorefrontNavbar />
      
      <main className="max-w-4xl mx-auto px-6 py-16">
        <article className="bg-white rounded-2xl shadow-[0_2px_10px_rgba(0,0,0,0.02)] border border-black/5 p-8 md:p-12">
          
          <header className="mb-10 border-b border-black/5 pb-8">
            <h1 className="text-3xl md:text-5xl font-medium tracking-tight text-[#111] mb-6 leading-tight">
              Guía Definitiva para Leer tu Receta Oftalmológica: Qué Significan OD, OI, Esfera, Cilindro y Eje
            </h1>
            <div className="flex items-center text-[#666] text-sm">
              <span>Atelier Óptica, Córdoba</span>
              <span className="mx-2">•</span>
              <span>Guías Visuales</span>
            </div>
          </header>

          <div className="blog-article w-full max-w-none">
            <p className="text-xl text-[#444] mb-8 leading-relaxed">
              ¿Saliste del consultorio médico, miraste la receta que te dieron y sentiste que estaba escrita en otro idioma? ¡No te preocupes, nos pasa a todos! En <strong>Atelier Óptica</strong>, tu óptica de confianza en Córdoba (con envíos a todo el país), te ayudamos a &quot;traducir&quot; esos números y letras. Descubrí de forma sencilla qué significan para entender exactamente qué cristales necesitás para cuidar tu visión.
            </p>

            <div className="bg-[#f5f5f5] border-l-4 border-black/10 p-6 rounded-r-lg mb-10">
              <h3 className="text-[#111] font-semibold text-lg flex items-center mb-2">
                <Eye className="w-5 h-5 mr-2" />
                Un recordatorio importante
              </h3>
              <p className="text-[#111] m-0">
                Como especialistas en salud visual y estética, nuestro trabajo es interpretar la receta de tu médico oftalmólogo para asesorarte sobre los mejores cristales y armazones para vos. <strong>Nosotros no medimos la vista, no diagnosticamos patologías ni recetamos tratamientos.</strong> Si sentís que no estás viendo bien, el primer paso siempre debe ser visitar a tu médico oftalmólogo de confianza.
              </p>
            </div>

            <h2 className="text-2xl font-medium tracking-tight text-[#111] mt-10 mb-4 flex items-center">
              <FileText className="w-6 h-6 mr-2 text-[#111]" />
              Las abreviaturas más comunes
            </h2>
            
            <p className="mb-6">
              Al observar tu receta de anteojos, lo primero que vas a notar son unas iniciales en el margen izquierdo. Estas siglas oftalmológicas sirven para identificar de qué ojo estamos hablando:
            </p>

            <ul className="space-y-4 mb-8 bg-[#faf8f5] p-6 rounded-xl border border-black/5">
              <li className="flex items-start">
                <CheckCircle className="w-6 h-6 text-[#111] mr-3 flex-shrink-0 mt-0.5" />
                <div>
                  <strong>OD (Ojo Derecho):</strong> Los valores que le siguen corresponden a la graduación de tu ojo derecho.
                </div>
              </li>
              <li className="flex items-start">
                <CheckCircle className="w-6 h-6 text-[#111] mr-3 flex-shrink-0 mt-0.5" />
                <div>
                  <strong>OI (Ojo Izquierdo):</strong> Los valores indicados para corregir tu ojo izquierdo.
                </div>
              </li>
              <li className="flex items-start">
                <CheckCircle className="w-6 h-6 text-[#111] mr-3 flex-shrink-0 mt-0.5" />
                <div>
                  <strong>AO (Ambos Ojos):</strong> A veces el especialista indica el mismo valor o una idéntica corrección para ambos ojos a la vez.
                </div>
              </li>
            </ul>

            <h2 className="text-2xl font-medium tracking-tight text-[#111] mt-10 mb-4">Los números mágicos: Esfera, Cilindro y Eje</h2>

            <p className="mb-6">
              Aquí es donde la graduación parece pura matemática, pero te lo explicamos de forma simple y clara:
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
              <div className="bg-white border border-black/10 p-6 rounded-xl shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
                <h3 className="font-medium tracking-tight text-lg text-[#111] mb-2">Esfera (ESF o SPH)</h3>
                <p className="text-[#444] text-sm">
                  Indica la dioptría o cantidad de aumento necesaria. Si el número tiene un signo negativo <strong>(-)</strong>, significa que hay miopía (dificultad para ver de lejos). Si tiene un signo positivo <strong>(+)</strong>, indica hipermetropía (dificultad para enfocar de cerca).
                </p>
              </div>

              <div className="bg-white border border-black/10 p-6 rounded-xl shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
                <h3 className="font-medium tracking-tight text-lg text-[#111] mb-2">Cilindro (CIL o CYL)</h3>
                <p className="text-[#444] text-sm">
                  Este número indica que tenés astigmatismo, una condición que hace que veas las cosas distorsionadas a cualquier distancia. Si este casillero está en blanco o tiene un cero, ¡genial!, significa que tu córnea es esférica y no requiere corrección cilíndrica.
                </p>
              </div>

              <div className="bg-white border border-black/10 p-6 rounded-xl shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
                <h3 className="font-medium tracking-tight text-lg text-[#111] mb-2">Eje (AXIS)</h3>
                <p className="text-[#444] text-sm">
                  Siempre acompaña al valor del Cilindro. Es un número que va de 0 a 180 grados y nos indica a los ópticos en qué dirección exacta debemos alinear la corrección del astigmatismo en tu cristal.
                </p>
              </div>

              <div className="bg-white border border-black/10 p-6 rounded-xl shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
                <h3 className="font-medium tracking-tight text-lg text-[#111] mb-2">Adición (ADD)</h3>
                <p className="text-[#444] text-sm">
                  Es el &quot;aumento extra&quot; que se necesita para leer de cerca, una condición típica cuando aparece la presbicia después de los 40 años. Se utiliza para confeccionar anteojos de lectura, bifocales o multifocales de última tecnología.
                </p>
              </div>
            </div>

            <h2 className="text-2xl font-medium tracking-tight text-[#111] mt-10 mb-4">¿Y ahora qué hago con mi receta?</h2>
            
            <p className="mb-6">
              Una vez que tenés tu receta en mano, el siguiente gran paso es elegir los cristales y armazones adecuados. Entender a la perfección tu receta nos permite asesorarte con precisión quirúrgica sobre:
            </p>
            
            <ul className="list-disc pl-6 mb-8 space-y-2">
              <li><strong>El grosor del cristal:</strong> Si tenés números altos (alta miopía o hipermetropía), te asesoraremos sobre cristales de alto índice (ultrafinos) para que tus lentes queden súper livianos y estéticos.</li>
              <li><strong>El tipo de armazón:</strong> No todos los marcos sirven para todas las graduaciones. Te ayudamos a elegir un diseño que sea funcional a tu receta y resalte tu estilo personal.</li>
              <li><strong>Los tratamientos ideales:</strong> Antirreflex, filtro azul para pantallas o fotocromáticos, pensados a medida de tu rutina visual diaria.</li>
            </ul>

            <div className="bg-[#faf8f5] p-8 rounded-2xl text-center mt-12 border border-black/10">
              <h3 className="text-2xl font-medium tracking-tight text-[#111] mb-4">
                Traé tu receta a Atelier Óptica
              </h3>
              <p className="text-[#111] mb-6 max-w-xl mx-auto">
                ¿Estás en Córdoba Capital? Ya sea que te encuentres por Nueva Córdoba, el Centro o el Cerro de las Rosas, traé la receta que te dio tu oftalmólogo y nuestro equipo se encargará del resto. Si estás en otra provincia, ¡hacemos envíos a toda Argentina! Vas a tener unos anteojos increíbles que vas a amar.
              </p>
              <a href="https://wa.me/5493518685644" target="_blank" rel="noopener noreferrer" 
                className="inline-flex items-center justify-center px-6 py-3 bg-[#faf8f5] text-white font-medium rounded-lg hover:bg-[#faf8f5] transition-colors"
              >
                Contactanos por WhatsApp
              </a>
            </div>

          </div>
        </article>
      </main>

      <StorefrontFooter />
    </div>
  );
}