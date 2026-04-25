import { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Calendar, Tag } from 'lucide-react';

interface Post {
  slug: string;
  title: string;
  excerpt: string;
  content: React.ReactNode;
  date: string;
  category: string;
  metaTitle: string;
  metaDescription: string;
  imageUrl: string;
}

const posts: Record<string, Post> = {
  'guia-multifocales-cordoba': {
    slug: 'guia-multifocales-cordoba',
    title: 'Lentes Multifocales en Córdoba: Todo lo que necesitas saber',
    excerpt: '¿Qué son los cristales multifocales y cómo elegir los mejores para tu visión? Consejos para una adaptación rápida y sin mareos.',
    metaTitle: 'Lentes Multifocales en Córdoba | Atelier Óptica',
    metaDescription: 'Especialistas en lentes multifocales en Córdoba. Consejos de adaptación, tecnologías (Varilux, Novar) y precios para anteojos multifocales.',
    date: '2026-04-20',
    category: 'Salud Visual',
    imageUrl: 'https://images.unsplash.com/photo-1577803645773-f96470509666?q=80&w=1470&auto=format&fit=crop',
    content: (
      <>
        <p className="lead">La tecnología óptica ha avanzado muchísimo, y hoy en día los <strong>lentes multifocales</strong> son la solución definitiva para quienes padecen presbicia y necesitan ver bien de cerca, de lejos y en distancias intermedias sin tener que cambiar de anteojos constantemente.</p>
        
        <h2>¿Qué es un cristal multifocal o progresivo?</h2>
        <p>A diferencia de los antiguos lentes bifocales (que tenían una línea visible y dividían el lente en dos), los multifocales o progresivos ofrecen una transición gradual de la graduación. Esto permite enfocar a cualquier distancia simplemente moviendo los ojos hacia arriba o hacia abajo.</p>

        <h2>¿Dónde comprar multifocales en Córdoba?</h2>
        <p>En <strong>Atelier Óptica Córdoba</strong>, nos especializamos en la adaptación de lentes multifocales de alta gama. Trabajamos con marcas líderes a nivel mundial como <strong>Varilux (Essilor)</strong> y <strong>Novar</strong>, asegurando campos visuales amplios y la menor distorsión lateral posible.</p>

        <h2>Consejos para una adaptación rápida</h2>
        <ul>
          <li><strong>Usalos todos los días:</strong> La constancia es clave. Tu cerebro necesita unos días para acostumbrarse a las nuevas áreas de visión.</li>
          <li><strong>Mové la cabeza, no solo los ojos:</strong> Al principio, acostúmbrate a apuntar con la nariz hacia lo que querés mirar, especialmente hacia los lados.</li>
          <li><strong>Ajuste perfecto:</strong> El armazón debe estar calibrado a la perfección en tu rostro. Por eso en Atelier Óptica tomamos medidas milimétricas (Distancia Nasopupilar y Altura).</li>
        </ul>

        <h2>¿Por qué elegirnos?</h2>
        <p>Estamos ubicados en José Luis de Tejeda 4380, Cerro de las Rosas, Córdoba. Brindamos asesoramiento personalizado y garantía de adaptación. ¡Visitános y volvé a ver el mundo con claridad!</p>
      </>
    )
  },
  'elegir-anteojos-recetados': {
    slug: 'elegir-anteojos-recetados',
    title: 'Cómo elegir anteojos recetados según la forma de tu cara',
    excerpt: 'Guía definitiva para comprar anteojos recetados que combinen con tu estilo y te brinden la mejor comodidad óptica.',
    metaTitle: 'Anteojos Recetados en Córdoba | Guía de Estilos | Atelier Óptica',
    metaDescription: 'Encontrá los mejores anteojos recetados en Córdoba. Asesoramiento estético y técnico para elegir marcos y cristales a medida.',
    date: '2026-04-15',
    category: 'Tendencias',
    imageUrl: 'https://images.unsplash.com/photo-1509695507497-903c140c43b0?q=80&w=1473&auto=format&fit=crop',
    content: (
      <>
        <p className="lead">Los <strong>anteojos recetados</strong> ya no son solo una necesidad médica; son un accesorio clave en tu estilo diario. Encontrar el armazón ideal puede resaltar tus facciones y darte una apariencia renovada.</p>
        
        <h2>Armazones según la forma de tu rostro</h2>
        <p>Existe una regla general en el mundo de la óptica estética: buscá el contraste. La forma de tu armazón debe contrastar con la forma de tu rostro.</p>

        <h3>Rostro Redondo</h3>
        <p>Si tu cara es circular, sin ángulos fuertes, te beneficiarán los anteojos cuadrados o rectangulares. Estos añadirán líneas definidas y harán que tu rostro parezca más largo y delgado.</p>

        <h3>Rostro Cuadrado</h3>
        <p>Las mandíbulas fuertes y frentes anchas se suavizan con anteojos redondos u ovalados. Los marcos delgados y curvos son tu mejor opción.</p>

        <h3>Rostro Ovalado</h3>
        <p>¡Tienen suerte! Casi cualquier forma les queda bien. Animate a probar armazones grandes, de estilo aviador o marcos geométricos modernos.</p>

        <h2>El cristal también importa</h2>
        <p>Dependiendo de tu graduación (esfera y cilindro), algunos armazones pueden ser mejores que otros. Por ejemplo, miopías altas requieren cristales de alto índice (más delgados) y armazones de acetato (plástico) con bordes un poco más gruesos para disimular el grosor del lente.</p>

        <p>Vení a <strong>Atelier Óptica en Córdoba</strong> y dejate asesorar por nuestro equipo. Te ayudaremos a encontrar el equilibrio perfecto entre visión, comodidad y diseño.</p>
      </>
    )
  },
  'optica-cordoba-cerro-de-las-rosas': {
    slug: 'optica-cordoba-cerro-de-las-rosas',
    title: 'Por qué somos la óptica recomendada en Cerro de las Rosas',
    excerpt: 'Conocé Atelier Óptica, especialistas en atención personalizada, armazones de diseño y cristales de alta precisión en Córdoba.',
    metaTitle: 'Óptica en Córdoba | Cerro de las Rosas | Atelier Óptica',
    metaDescription: 'Tu óptica de confianza en Cerro de las Rosas, Córdoba. Anteojos de sol, multifocales, lentes de contacto y reparación de armazones.',
    date: '2026-04-10',
    category: 'Nuestra Óptica',
    imageUrl: 'https://images.unsplash.com/photo-1555505019-8c3f1c4aba5f?q=80&w=1470&auto=format&fit=crop',
    content: (
      <>
        <p className="lead">Ubicados en el corazón de Cerro de las Rosas, <strong>Atelier Óptica Córdoba</strong> nació con la misión de transformar la experiencia de ir a la óptica. Creemos que cada paciente merece tiempo, escucha y soluciones a medida.</p>

        <h2>Nuestra filosofía</h2>
        <p>Entendemos que los anteojos son algo que vas a llevar puesto todos los días. Por eso combinamos la rigurosidad técnica de la óptica profesional con el cuidado estético de un atelier de diseño.</p>

        <h2>Nuestros servicios en Córdoba</h2>
        <ul>
          <li><strong>Anteojos Recetados:</strong> Armazones de diseño exclusivo, nacionales e importados.</li>
          <li><strong>Especialistas en Multifocales:</strong> Adaptación garantizada con tecnología de medición digital.</li>
          <li><strong>Lentes de Contacto:</strong> Asesoramiento y pruebas de tolerancia.</li>
          <li><strong>Atención por WhatsApp:</strong> Presupuestos y seguimiento de pedidos ágil y rápido.</li>
        </ul>

        <h2>Visitanos</h2>
        <p>Te esperamos en <strong>José Luis de Tejeda 4380</strong>. Ya sea que busques renovar tu estilo, solucionar un problema de visión o simplemente reparar tus anteojos favoritos, en Atelier Óptica vas a encontrar profesionalismo, ética y diseño.</p>
      </>
    )
  },
  'lentes-de-sol-tendencias-2026': {
    slug: 'lentes-de-sol-tendencias-2026',
    title: 'Lentes de Sol en Córdoba: Tendencias 2026 y Protección UV',
    excerpt: 'Descubrí los armazones que son furor este año y por qué el filtro UV400 es innegociable para cuidar tu vista.',
    metaTitle: 'Lentes de Sol 2026 Córdoba | Tendencias y Protección UV | Atelier Óptica',
    metaDescription: 'Encontrá los lentes de sol más buscados del 2026 en Córdoba. Te contamos qué armazones son tendencia y por qué elegir cristales con protección UV400.',
    date: '2026-04-25',
    category: 'Tendencias',
    imageUrl: 'https://images.unsplash.com/photo-1511499767150-a48a237f0083?q=80&w=1480&auto=format&fit=crop',
    content: (
      <>
        <p className="lead">Llegó el momento de renovar tus <strong>lentes de sol</strong>, pero la moda no lo es todo. En esta nota te contamos qué se usa en 2026 y por qué la salud de tus ojos debe ser siempre la prioridad.</p>

        <h2>Las formas que marcan el 2026</h2>
        <p>Este año, el estilo retro y los marcos voluminosos están tomando el control en las calles de Córdoba. Algunas tendencias fuertes:</p>
        <ul>
          <li><strong>Marcos Geométricos:</strong> Hexagonales, octogonales y rectángulos rígidos con esquinas marcadas.</li>
          <li><strong>El regreso de los 2000 (Y2K):</strong> Lentes tipo máscara o "envolventes" con colores llamativos y metálicos.</li>
          <li><strong>Acetato translúcido:</strong> Armazones gruesos pero en colores champagne, caramelo o transparente que aportan luminosidad al rostro.</li>
        </ul>

        <h2>La importancia innegociable del filtro UV400</h2>
        <p>Comprar lentes de sol en la calle o en locales de ropa puede ser un riesgo enorme. Los lentes oscuros sin filtro UV hacen que tu pupila se dilate, permitiendo que los rayos ultravioleta dañinos penetren más profundamente en el ojo. Esto puede causar cataratas prematuras o daños en la retina.</p>

        <p>Un verdadero cristal de sol debe tener certificado <strong>UV400</strong>, que bloquea el 100% de los rayos UVA y UVB. Además, podés sumar tecnología <strong>Polarizada</strong> para eliminar los reflejos del asfalto o el agua, ideal si manejás mucho.</p>

        <h2>Probátelos en Atelier Óptica</h2>
        <p>Te invitamos a nuestro local en Cerro de las Rosas para que te pruebes las últimas colecciones y encuentres un armazón que te proteja y eleve tu estilo al máximo.</p>
      </>
    )
  },
  'como-leer-tu-receta-oftalmologica': {
    slug: 'como-leer-tu-receta-oftalmologica',
    title: 'Cómo leer tu receta oftalmológica paso a paso',
    excerpt: '¿Qué significan Esfera, Cilindro, Eje y Adición? Te explicamos de forma sencilla cómo interpretar lo que te recetó el oftalmólogo.',
    metaTitle: 'Cómo entender la receta de anteojos | Esfera, Cilindro y Eje | Atelier Óptica',
    metaDescription: 'Aprendé a leer tu receta oftalmológica. Explicación fácil de qué es la esfera (miopía/hipermetropía), el cilindro (astigmatismo) y la adición.',
    date: '2026-04-22',
    category: 'Salud Visual',
    imageUrl: 'https://images.unsplash.com/photo-1582685116743-69022ee01509?q=80&w=1470&auto=format&fit=crop',
    content: (
      <>
        <p className="lead">Salís del consultorio del oftalmólogo, mirás el papel y parece que está escrito en otro idioma: <em>OD, OI, Esf -1.25, Cil -0.50, Eje 180°</em>. No te preocupes, en Atelier Óptica te enseñamos a <strong>leer tu receta oftalmológica</strong> en simples pasos.</p>

        <h2>Tus Ojos: OD y OI</h2>
        <p>Lo primero que vas a ver son las siglas <strong>OD</strong> (Ojo Derecho) y <strong>OI</strong> (Ojo Izquierdo). A veces los oftalmólogos también usan AO para referirse a "Ambos Ojos".</p>

        <h2>1. Esfera (Esf o SPH)</h2>
        <p>La esfera indica la potencia principal que necesitás para ver bien. Si el número tiene un signo negativo (<strong>-</strong>), significa que tenés <strong>miopía</strong> (dificultad para ver de lejos). Si tiene un signo positivo (<strong>+</strong>), significa que tenés <strong>hipermetropía</strong> (dificultad para ver de cerca o esfuerzo visual excesivo).</p>

        <h2>2. Cilindro (Cil o CYL) y Eje</h2>
        <p>Estas dos casillas siempre van de la mano e indican si tenés <strong>astigmatismo</strong> (cuando la córnea no es perfectamente redonda y distorsiona la visión a cualquier distancia).</p>
        <ul>
          <li><strong>Cilindro:</strong> Indica la cantidad de astigmatismo. Puede ser negativo o positivo dependiendo del profesional.</li>
          <li><strong>Eje:</strong> Es un número entre 0 y 180 grados que le indica al laboratorio exactamente en qué posición debe colocar la corrección del cilindro.</li>
        </ul>

        <h2>3. Adición (Add)</h2>
        <p>Si pasás los 40 años, es probable que en la receta aparezca un valor bajo el nombre "Add". Esto se refiere a la <strong>presbicia</strong>, y es la potencia "extra" que necesitás sumar a tu graduación de lejos para poder leer bien de cerca. Este valor es clave para encargar <strong>lentes multifocales</strong> o bifocales.</p>

        <h2>¿Tenés dudas con tu receta?</h2>
        <p>Si la letra de tu oftalmólogo es difícil de entender o querés saber qué cristales son los mejores para tu graduación (¿Alto índice? ¿Antirreflex?), envianos una foto de tu receta por WhatsApp y te asesoramos sin cargo.</p>
      </>
    )
  }
};

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const resolvedParams = await params;
  const post = posts[resolvedParams.slug];
  
  if (!post) {
    return {
      title: 'Artículo no encontrado | Atelier Óptica',
    };
  }

  return {
    title: post.metaTitle,
    description: post.metaDescription,
    openGraph: {
      title: post.metaTitle,
      description: post.metaDescription,
      type: 'article',
      publishedTime: post.date,
      images: [post.imageUrl]
    }
  };
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = await params;
  const post = posts[resolvedParams.slug];

  if (!post) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-stone-50 dark:bg-stone-950 pb-20">
      <div className="bg-white dark:bg-stone-900 border-b border-stone-200 dark:border-stone-800">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
          <Link href="/blog" className="inline-flex items-center text-sm font-bold text-stone-500 hover:text-primary transition-colors mb-8 group">
            <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" />
            Volver al blog
          </Link>
          
          <div className="flex items-center gap-4 mb-6">
            <span className="flex items-center text-xs font-bold uppercase tracking-widest text-primary bg-primary/10 px-3 py-1 rounded-full">
              <Tag className="w-3 h-3 mr-1" /> {post.category}
            </span>
            <span className="flex items-center text-xs text-stone-400 font-medium">
              <Calendar className="w-3 h-3 mr-1" />
              {new Date(post.date).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })}
            </span>
          </div>
          
          <h1 className="text-3xl lg:text-5xl font-black text-stone-900 dark:text-white tracking-tight mb-6 leading-tight">
            {post.title}
          </h1>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="rounded-3xl overflow-hidden mb-12 shadow-lg border border-stone-100 dark:border-stone-800 h-64 md:h-96 w-full relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={post.imageUrl} alt={post.title} className="w-full h-full object-cover" />
        </div>

        <article className="prose prose-stone dark:prose-invert prose-lg max-w-none prose-headings:font-black prose-a:text-primary hover:prose-a:text-primary/80 prose-p:leading-relaxed prose-li:my-1">
          {post.content}
        </article>
        
        <div className="mt-16 pt-8 border-t border-stone-200 dark:border-stone-800 text-center">
          <h3 className="text-2xl font-black mb-4 dark:text-white">¿Necesitás asesoramiento personalizado?</h3>
          <p className="text-stone-600 dark:text-stone-400 mb-8">Te esperamos en Atelier Óptica para encontrar tus anteojos ideales.</p>
          <a href="https://wa.me/5493518685644" target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center px-8 py-4 text-sm font-black text-white bg-primary hover:bg-primary/90 rounded-full transition-colors">
            Contactanos por WhatsApp
          </a>
        </div>
      </div>
    </div>
  );
}
