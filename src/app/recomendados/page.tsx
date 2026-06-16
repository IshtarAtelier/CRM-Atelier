import React from 'react';

export default function RecomendadosPage() {
  return (
    <div className="min-h-screen bg-white p-8">
      <h1 className="text-3xl font-bold mb-6">Nuestros Sitios Recomendados</h1>
      <p className="mb-4 text-gray-600">
        Una selección de portales, foros y sitios de interés enfocados en la salud visual, tecnología de cristales y tendencias en Córdoba.
      </p>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Sitios Pilar Oficiales */}
        <ul className="list-disc pl-6 space-y-2">
          <li><a href="https://varilux.vercel.app" target="_blank" rel="noopener noreferrer">Expertos en Cristales Varilux</a></li>
          <li><a href="https://miopia.vercel.app" target="_blank" rel="noopener noreferrer">Centro Oficial de Control de Miopía</a></li>
          <li><a href="https://lentes-sol.vercel.app" target="_blank" rel="noopener noreferrer">Tendencias en Lentes de Sol</a></li>
          <li><a href="https://presbicia.vercel.app" target="_blank" rel="noopener noreferrer">Guía Médica de la Presbicia</a></li>
          <li><a href="https://luz-azul.vercel.app" target="_blank" rel="noopener noreferrer">Protección Digital y Luz Azul</a></li>
        </ul>

        {/* Sitios de Comunidad y Blogs Locales */}
        <ul className="list-disc pl-6 space-y-2">
          <li><a href="https://blog-autos.vercel.app" target="_blank" rel="noopener noreferrer">Visión Segura al Volante</a></li>
          <li><a href="https://comparador-precios-one.vercel.app" target="_blank" rel="noopener noreferrer">Comparador de Precios en Ópticas</a></li>
          <li><a href="https://deportes-cba.vercel.app" target="_blank" rel="noopener noreferrer">Rendimiento Deportivo y Visión</a></li>
          <li><a href="https://devs-cordoba.vercel.app" target="_blank" rel="noopener noreferrer">Salud Visual para Programadores</a></li>
          <li><a href="https://directorio-medico-topaz.vercel.app" target="_blank" rel="noopener noreferrer">Directorio Médico de Clínicas Oculares</a></li>
          <li><a href="https://diseno-estetica.vercel.app" target="_blank" rel="noopener noreferrer">Revista de Diseño y Estética Facial</a></li>
          <li><a href="https://foro-madres.vercel.app" target="_blank" rel="noopener noreferrer">Foro de Cuidado Infantil y Oftalmopediatría</a></li>
          <li><a href="https://gamers-arg.vercel.app" target="_blank" rel="noopener noreferrer">Comunidad Gamer y Salud Ocular</a></li>
          <li><a href="https://guia-compras.vercel.app" target="_blank" rel="noopener noreferrer">Guía Inteligente de Compras en Córdoba</a></li>
          <li><a href="https://guia-regalos.vercel.app" target="_blank" rel="noopener noreferrer">Ideas de Regalos y Cuidado Personal</a></li>
          <li><a href="https://innovacion-ia.vercel.app" target="_blank" rel="noopener noreferrer">Tecnología, Innovación e Inteligencia Artificial</a></li>
          <li><a href="https://lifestyle-cerro.vercel.app" target="_blank" rel="noopener noreferrer">Estilo de Vida en el Cerro de las Rosas</a></li>
          <li><a href="https://moda-cordoba.vercel.app" target="_blank" rel="noopener noreferrer">Tendencias de Moda y Gafas de Autor</a></li>
          <li><a href="https://noticias-norte.vercel.app" target="_blank" rel="noopener noreferrer">Noticias y Novedades de Zona Norte</a></li>
          <li><a href="https://oftalmopediatria.vercel.app" target="_blank" rel="noopener noreferrer">Salud Visual en la Primera Infancia</a></li>
          <li><a href="https://reviews-opticas.vercel.app" target="_blank" rel="noopener noreferrer">Reseñas y Evaluaciones Reales</a></li>
          <li><a href="https://revista-estudiantil.vercel.app" target="_blank" rel="noopener noreferrer">Revista para Estudiantes Universitarios</a></li>
          <li><a href="https://salud-mayores.vercel.app" target="_blank" rel="noopener noreferrer">Calidad de Vida en Adultos Mayores</a></li>
          <li><a href="https://tech-home-office.vercel.app" target="_blank" rel="noopener noreferrer">Ergonomía en el Home Office</a></li>
          <li><a href="https://influencers-cba.vercel.app" target="_blank" rel="noopener noreferrer">Redes Sociales y Fotografía Profesional</a></li>
        </ul>
      </div>
    </div>
  );
}
