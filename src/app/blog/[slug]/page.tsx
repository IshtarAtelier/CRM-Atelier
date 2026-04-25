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
  },
  'filtro-azul-pantallas': {
    slug: 'filtro-azul-pantallas',
    title: 'Filtro Azul (Blue Light Cut): ¿Mito o necesidad si trabajás frente a pantallas?',
    excerpt: 'Si sentís fatiga visual o dolores de cabeza después de tu jornada de trabajo, enterate por qué los cristales con filtro azul son fundamentales.',
    metaTitle: 'Lentes con Filtro Azul en Córdoba | ¿Sirven para la computadora? | Atelier Óptica',
    metaDescription: 'Evitá el cansancio visual, ojos secos y dolores de cabeza con cristales Blue Light Cut. Anteojos de descanso para la computadora en Córdoba.',
    date: '2026-04-26',
    category: 'Tecnología',
    imageUrl: 'https://images.unsplash.com/photo-1542626991-cbc4e32524cc?q=80&w=1469&auto=format&fit=crop',
    content: (
      <>
        <p className="lead">Si pasás más de 6 horas al día frente a la computadora, el celular o la tablet, es probable que hayas experimentado dolores de cabeza, ardor en los ojos o problemas para dormir. ¿La solución? Los lentes con <strong>Filtro Azul (Blue Light Cut)</strong>.</p>
        
        <h2>¿Qué es la luz azul?</h2>
        <p>Las pantallas LED emiten una gran cantidad de luz azul de alta energía visible. Aunque parte de la luz azul es natural y nos ayuda a estar despiertos durante el día, la sobreexposición constante a muy corta distancia genera un estrés enorme para nuestra retina.</p>

        <h2>Beneficios de usar cristales con Filtro Azul</h2>
        <ul>
          <li><strong>Adiós a la fatiga visual:</strong> Reducen el esfuerzo que hace el ojo para enfocar la luz de la pantalla.</li>
          <li><strong>Mejoran el sueño:</strong> La luz azul bloquea la producción de melatonina (la hormona del sueño). Usar este filtro a la noche ayuda a dormir mejor.</li>
          <li><strong>Previenen dolores de cabeza:</strong> Disminuyen el brillo y los reflejos molestos.</li>
        </ul>

        <h2>¿Sirven si no tengo aumento?</h2>
        <p>¡Totalmente! Los anteojos de descanso pueden hacerse sin ninguna graduación (neutros) o combinarlos con tu receta para miopía o astigmatismo. Si vivís en Córdoba y trabajás remoto, visitanos para armarte tus anteojos para la PC con los armazones más lindos y livianos.</p>
      </>
    )
  },
  'cristales-fotocromaticos-transitions': {
    slug: 'cristales-fotocromaticos-transitions',
    title: 'Cristales Fotocromáticos: Todo sobre los lentes que se oscurecen con el sol',
    excerpt: 'Comodidad total: lentes recetados en el interior y lentes de sol en el exterior. Descubrí cómo funciona la tecnología fotocromática.',
    metaTitle: 'Lentes Fotocromáticos Transitions Córdoba | Atelier Óptica',
    metaDescription: 'Lentes que se oscurecen al sol. Especialistas en cristales Transitions en Córdoba. 2 en 1: anteojos recetados y de sol al mismo tiempo.',
    date: '2026-04-27',
    category: 'Cristales',
    imageUrl: 'https://images.unsplash.com/photo-1572631382901-cf1a0a6087cb?q=80&w=1476&auto=format&fit=crop',
    content: (
      <>
        <p className="lead">¿Estás cansado de tener que cambiarte de anteojos cada vez que salís a la calle y vuelve a salir el sol? Los cristales <strong>Fotocromáticos (Transitions)</strong> son la respuesta definitiva a este problema.</p>

        <h2>¿Cómo funcionan?</h2>
        <p>Estos lentes inteligentes tienen moléculas que reaccionan a los rayos ultravioleta (UV). Cuando estás adentro de tu casa o en la oficina, los lentes son 100% transparentes. En el momento en que salís y el sol te toca, el cristal se oscurece en segundos, protegiendo tus ojos y dándote la comodidad de un lente de sol oscuro.</p>

        <h2>3 Razones para elegirlos</h2>
        <ol>
          <li><strong>Ahorro y practicidad:</strong> No necesitas comprar un par de lentes recetados y otro par de lentes de sol graduados. Tenés 2 en 1.</li>
          <li><strong>Protección UV total:</strong> Bloquean el 100% de los rayos UVA y UVB dañinos.</li>
          <li><strong>Reducción del deslumbramiento:</strong> Reaccionan a la luz de manera gradual, lo que permite que tus ojos estén relajados y cómodos en cualquier condición climática (días nublados, sol pleno).</li>
        </ol>

        <h2>¿Vienen en distintos colores?</h2>
        <p>¡Sí! Las marcas premium con las que trabajamos (como <strong>Transitions Gen 8</strong>) permiten que el cristal se oscurezca en tonos gris, marrón y verde, para que combine perfecto con el armazón que elijas. Vení a conocerlos a nuestro local en Cerro de las Rosas.</p>
      </>
    )
  },
  'anteojos-para-ninos': {
    slug: 'anteojos-para-ninos',
    title: 'Anteojos para niños: ¿Cuándo hacer el primer control visual?',
    excerpt: 'Señales de alerta de que tu hijo necesita lentes y qué armazones infantiles (flexibles e irrompibles) son los más recomendados.',
    metaTitle: 'Anteojos para Niños en Córdoba | Armazones Flexibles | Atelier Óptica',
    metaDescription: 'Óptica infantil en Córdoba. Armazones flexibles, irrompibles y livianos para niños. Consejos sobre el primer control oftalmológico pediátrico.',
    date: '2026-04-28',
    category: 'Pediatría',
    imageUrl: 'https://images.unsplash.com/photo-1596401057633-54a8fe8ef647?q=80&w=1470&auto=format&fit=crop',
    content: (
      <>
        <p className="lead">Cuidar la visión de los más chicos es vital para su desarrollo, su rendimiento escolar y su autoestima. En Atelier Óptica te contamos cuáles son las señales de alerta y cómo elegir sus primeros lentes.</p>

        <h2>¿Cuándo llevarlos al oftalmólogo?</h2>
        <p>Se recomienda que los chicos tengan su primer chequeo oftalmológico a los <strong>3 años</strong> (o antes si notás algo raro) y, obligatoriamente, a los <strong>5 o 6 años</strong>, antes de ingresar al colegio primario.</p>

        <h2>Señales de que tu hijo podría necesitar anteojos</h2>
        <ul>
          <li><strong>Entrecierra los ojos</strong> para mirar la tele o leer de lejos.</li>
          <li>Se acerca mucho al cuaderno o a la tablet.</li>
          <li>Se frota los ojos constantemente o se queja de dolores de cabeza después de ir a la escuela.</li>
          <li>Se saltea renglones al leer o tiene bajo rendimiento escolar repentino.</li>
        </ul>

        <h2>El anteojo ideal para un niño</h2>
        <p>No podemos ponerle un armazón pesado o frágil a un nene que va a jugar y saltar. Los mejores anteojos para niños deben ser:</p>
        <p><strong>1. Flexibles e irrompibles:</strong> Los materiales como la silicona hipoalergénica (marcas como Miraflex o Nano Vista) permiten que el anteojo se doble sin romperse.</p>
        <p><strong>2. Livianos:</strong> Para no marcarles la nariz ni molestarles en las orejas.</p>
        <p><strong>3. Con agarre trasero:</strong> Las banditas sujetadoras que se agarran por detrás de la nuca aseguran que el anteojo no se caiga al correr.</p>

        <p>En Atelier Óptica tenemos una línea especial infantil súper colorida y resistente para que usar lentes sea algo divertido para ellos.</p>
      </>
    )
  },
  'como-limpiar-tus-anteojos': {
    slug: 'como-limpiar-tus-anteojos',
    title: 'Guía definitiva para limpiar tus anteojos sin rayar el antirreflex',
    excerpt: 'El error más común es usar la remera o servilletas de papel. Aprendé los pasos correctos para que tus cristales duren años como nuevos.',
    metaTitle: 'Cómo limpiar anteojos sin rayarlos | Mantenimiento | Atelier Óptica',
    metaDescription: 'Paso a paso para limpiar tus lentes sin dañar el antirreflex. No uses servilletas de papel ni alcohol. Consejos de óptica.',
    date: '2026-04-29',
    category: 'Mantenimiento',
    imageUrl: 'https://images.unsplash.com/photo-1510425409890-50dce4211a37?q=80&w=1470&auto=format&fit=crop',
    content: (
      <>
        <p className="lead">Hiciste una gran inversión en tus anteojos y en cristales con antirreflex de alta calidad. Sin embargo, limpiarlos con la punta de la remera o con papel higiénico es el camino más rápido para arruinarlos. Te enseñamos a cuidarlos.</p>

        <h2>Los enemigos de tus lentes</h2>
        <ul>
          <li><strong>Servilletas y papel higiénico:</strong> Están hechos de pulpa de madera. A nivel microscópico, son como lijas para tus cristales.</li>
          <li><strong>Tu remera:</strong> Atrapa polvo de la calle. Al frotarla contra el lente, rayás la capa protectora.</li>
          <li><strong>Alcohol o limpiavidrios:</strong> Contienen químicos muy abrasivos que destruyen el filtro antirreflex y el filtro UV al instante.</li>
        </ul>

        <h2>Paso a paso para una limpieza perfecta</h2>
        <ol>
          <li><strong>Agua corriente fría o tibia:</strong> Primero, enjuagá los lentes bajo la canilla (nunca agua caliente, arruina los tratamientos). Esto remueve la arenilla que los podría rayar al frotar.</li>
          <li><strong>Detergente neutro:</strong> Poné una pequeña gota de detergente (el de lavar los platos, sin cítricos ni cremas) en cada dedo y frotá suavemente ambos lados del cristal.</li>
          <li><strong>Enjuagar y sacudir:</strong> Volvé a pasarlos por agua para quitar la espuma y sacudí suavemente para quitar las gotas grandes.</li>
          <li><strong>Secar:</strong> Utilizá un paño de microfibra de óptica (siempre limpio) o dejá que se sequen solos.</li>
        </ol>

        <h2>¿Estás en la calle?</h2>
        <p>Llevá siempre con vos un spray limpia cristales específico de óptica y tu paño de microfibra. Si pasás por <strong>Atelier Óptica</strong> en Cerro de las Rosas, ¡podés llevarte el kit de limpieza perfecto para mantener tus lentes como el primer día!</p>
      </>
    )
  },
  'multifocales-marcas-precios-varilux-novar': {
    slug: 'multifocales-marcas-precios-varilux-novar',
    title: 'Marcas de Multifocales en Argentina: ¿Qué diferencias hay entre Varilux, Novar y genéricos?',
    excerpt: 'Comparativa definitiva sobre campos visuales, tecnologías de tallado digital y por qué el precio de un multifocal varía tanto.',
    metaTitle: 'Multifocales Varilux y Novar en Córdoba | Precios y Diferencias | Atelier Óptica',
    metaDescription: '¿Qué multifocal comprar? Diferencias entre lentes progresivos Varilux, Novar y opciones genéricas. Campos visuales y tecnología de tallado explicada.',
    date: '2026-05-02',
    category: 'Cristales',
    imageUrl: 'https://images.unsplash.com/photo-1589828138980-0010996841e2?q=80&w=1470&auto=format&fit=crop',
    content: (
      <>
        <p className="lead">Si fuiste a una óptica a averiguar por lentes multifocales (progresivos), seguramente te topaste con presupuestos que van desde opciones muy económicas hasta valores premium. La pregunta del millón es: <strong>¿Vale la pena pagar más por una marca reconocida?</strong></p>

        <h2>El secreto está en el "Campo Visual"</h2>
        <p>A diferencia de un cristal de lectura simple, el multifocal concentra tres distancias (lejos, intermedia y cerca) en un solo lente. Por una cuestión de física óptica, en los bordes laterales del cristal se generan <strong>"zonas de aberración"</strong> (visión borrosa). La diferencia de precio entre marcas radica exactamente en la tecnología que usan para "empujar" esas zonas borrosas hacia los bordes extremos, dejándote un canal central de visión mucho más amplio y cómodo.</p>

        <h2>1. Lentes Multifocales Genéricos (Convencionales)</h2>
        <p>Tienen un diseño básico, tallado en la cara externa del cristal. Sus canales de visión intermedia y de lectura suelen ser estrechos. <strong>¿Para quién son?</strong> Para usuarios con presbicia incipiente (adición baja, ej: +1.00) que tienen un presupuesto ajustado y mucha paciencia para adaptar los movimientos de su cabeza.</p>

        <h2>2. Novar (Tecnología Digital Argentina-Alemana)</h2>
        <p><strong>Novar</strong> es hoy en día el líder en relación calidad-precio. Usan tecnología de tallado digital (Freeform) punto por punto en la cara interna del cristal. Esto acerca el diseño visual al ojo, ampliando el campo de visión hasta un 30% respecto a los genéricos. Ofrecen líneas excelentes con adaptación garantizada, siendo una opción inmejorable para la gran mayoría de los pacientes.</p>

        <h2>3. Varilux (Essilor - La línea Premium)</h2>
        <p><strong>Varilux</strong> (creadores del multifocal) es el estándar de oro a nivel mundial. Sus lentes de alta gama (como las líneas Comfort Max, Physio o XR Series) utilizan inteligencia artificial y parámetros biométricos (cómo movés los ojos vs. cómo movés la cabeza) para fabricar un lente hecho a medida. <strong>¿El resultado?</strong> Campos visuales inmensos, casi nula distorsión lateral y una adaptación ultra rápida y natural.</p>

        <h2>Nuestra recomendación en Atelier Óptica</h2>
        <p>La mejor marca no es la más cara, sino la que mejor se adapta a tus actividades diarias y a tu receta. Acercate a nuestro local en Córdoba y evaluaremos juntos qué tecnología te brindará la mejor calidad de vida sin salirte de tu presupuesto.</p>
      </>
    )
  },
  'mareos-con-multifocales-soluciones': {
    slug: 'mareos-con-multifocales-soluciones',
    title: '¿Tus multifocales te marean? Causas principales y cómo solucionarlo',
    excerpt: 'Si sentís que el piso se mueve o te duele la cabeza al usar progresivos, te contamos por qué pasa y cómo lo calibramos para solucionarlo.',
    metaTitle: 'Solución a mareos con lentes multifocales | Atelier Óptica Córdoba',
    metaDescription: '¿Te marean tus lentes progresivos? Explicamos las causas comunes (altura mal tomada, error de adaptación) y cómo re-calibrarlos para ver perfecto.',
    date: '2026-05-04',
    category: 'Salud Visual',
    imageUrl: 'https://images.unsplash.com/photo-1605652157522-83b1bb649c0c?q=80&w=1470&auto=format&fit=crop',
    content: (
      <>
        <p className="lead">Hacerse lentes multifocales es un gran paso, pero muchas personas los abandonan en un cajón tras la primera semana porque sienten que "el piso se mueve", los escalones parecen más altos de lo normal o sienten mareos al mirar de reojo.</p>

        <h2>¿Es normal marearse al principio?</h2>
        <p><strong>Sí.</strong> Tu cerebro estuvo años acostumbrado a mirar de una sola manera. Ahora, debe aprender que para ver de lejos tiene que mirar al frente, y para leer debe bajar la vista. Este proceso de "re-cableado" neuronal se llama neuroadaptación y toma entre 7 a 15 días.</p>

        <h2>Pero si ya pasaron semanas y sigo mal, ¿qué pasa?</h2>
        <p>Si la adaptación no se logra, generalmente el problema no sos vos, sino una falla técnica en la confección del lente. Estas son las 3 causas principales:</p>

        <h3>1. Error en la Altura Pupilar y la DNP</h3>
        <p>El multifocal debe coincidir milimétricamente con el centro de tu pupila. Si el óptico tomó mal la medida de "Altura" (el punto donde empieza a bajar la graduación hacia la lectura), vas a tener que levantar o bajar el mentón de forma exagerada para poder enfocar. Esto causa dolor de cuello y mareos instantáneos.</p>

        <h3>2. El armazón está mal ajustado</h3>
        <p>Si el anteojo se te resbala por la nariz o te queda torcido (una patilla más alta que otra), los centros ópticos del cristal se desfasan. Algo tan simple como ajustar las plaquetas nasales o enderezar las patillas puede hacer que pases de ver borroso a ver perfecto.</p>

        <h3>3. Elegiste un armazón muy pequeño</h3>
        <p>Para que entren las tres graduaciones (lejos, intermedia y cerca), el cristal necesita un mínimo de espacio vertical (usualmente 30mm o más). Si elegís un armazón muy estrecho, el laboratorio tiene que "cortar" la zona de visión intermedia, haciendo que el salto de lejos a cerca sea muy brusco.</p>

        <h2>¿Cómo te ayudamos en Atelier Óptica?</h2>
        <p>Si te hiciste los multifocales en otro lado y no los soportás, o si querés hacerte unos nuevos con <strong>garantía de adaptación total</strong>, vení a visitarnos. Contamos con herramientas de precisión para tomar las medidas correctas y trabajamos con laboratorios que garantizan cristales sin "saltos" molestos. ¡Tus ojos te lo van a agradecer!</p>
      </>
    )
  },
  'por-que-nuestros-multifocales-no-fallan-tecnologia-cordoba': {
    slug: 'por-que-nuestros-multifocales-no-fallan-tecnologia-cordoba',
    title: 'Por qué nuestros multifocales no fallan: El método de doble control en Córdoba',
    excerpt: 'Hacer un lente progresivo perfecto requiere mucho más que una receta. Conocé nuestro protocolo de control cruzado y prueba de probines para una adaptación garantizada.',
    metaTitle: 'Multifocales con Garantía de Adaptación en Córdoba | Atelier Óptica',
    metaDescription: 'En Atelier Óptica garantizamos la adaptación de tus multifocales gracias a nuestra toma de medidas profesional, keratometría y prueba de probines en Cerro de las Rosas.',
    date: '2026-05-06',
    category: 'Nuestra Óptica',
    imageUrl: 'https://images.unsplash.com/photo-1579684453401-9cc5825bc531?q=80&w=1470&auto=format&fit=crop',
    content: (
      <>
        <p className="lead">Uno de los mayores miedos al invertir en lentes multifocales es que no sirvan o terminen guardados en un estuche. En <strong>Atelier Óptica</strong> sabemos que el secreto del éxito no está solo en la marca del cristal, sino en un proceso de calibración clínica exhaustiva. Te contamos por qué nuestra tasa de adaptación es increíblemente superior.</p>

        <h2>No armamos lentes "a ciegas"</h2>
        <p>En muchas ópticas, simplemente leen tu receta médica, te piden que te pongas el armazón y mandan a fabricar el cristal. Nosotros consideramos que la receta es solo el punto de partida. Antes de encargar un multifocal, nuestro protocolo incluye un <strong>control cruzado de 4 pasos</strong> para asegurar que tu ojo, tu receta y el lente elegido estén en perfecta sintonía.</p>

        <h2>Nuestro protocolo de medición profesional</h2>
        
        <ul>
          <li><strong>Control con Keratómetro:</strong> Lo primero que hacemos es un control de tu receta mediante keratometría. Esto nos permite evaluar la curvatura de tu córnea y confirmar objetivamente que los parámetros de astigmatismo de tu receta médica sean los ideales para tu adaptación al lente progresivo.</li>
          <li><strong>Medición de Centros Pupilares:</strong> Utilizamos instrumentos de precisión para calcular la Distancia Nasopupilar exacta (la distancia desde el centro de tu pupila hasta el puente de la nariz). Esta medida electrónica evita los errores de centrado que suelen causar mareos.</li>
          <li><strong>Corroboración Manual de Especialista:</strong> La tecnología nos da los números, pero el ojo humano aporta la ergonomía. Un especialista en medición verifica el ajuste anatómico del armazón en tu rostro y utiliza la técnica de marcado manual (con fibrón) para dibujar la altura exacta de lectura basada en cómo vos sostenés la cabeza de forma natural.</li>
          <li><strong>Prueba de Probines:</strong> ¡No dejamos nada a la imaginación! Antes de pedir tus cristales definitivos, realizamos una prueba física con "probines" (lentes de prueba en consultorio). Así vos mismo podés experimentar cómo vas a ver y nosotros podemos afinar el enfoque hasta que sientas comodidad absoluta.</li>
        </ul>

        <h2>El Vínculo Laboratorio-Óptica</h2>
        <p>Una vez que terminamos nuestra calibración y pruebas manuales, enviamos este "mapa" exacto a los mejores laboratorios de tallado digital de Argentina (como Novar y Essilor-Varilux). Ellos tallan el lente milímetro a milímetro (tecnología Freeform) para que el canal visual se alinee de forma idéntica a lo que probamos en nuestro local.</p>

        <h2>Garantía de Adaptación Real</h2>
        <p>Nuestra confianza en nuestro método de doble control (instrumental + humano) es tan grande que te brindamos <strong>Garantía de Adaptación</strong>. Si tenés problemas para acostumbrarte, re-evaluamos el lente y lo solucionamos.</p>

        <p>Si buscás excelencia visual, un trato profesional que no se apure en tomar tus medidas, y resultados reales, te esperamos en Atelier Óptica, en el corazón del Cerro de las Rosas.</p>
      </>
    )
  },
  'pasos-faciles-adaptacion-multifocales': {
    slug: 'pasos-faciles-adaptacion-multifocales',
    title: '3 Pasos Fáciles para Adaptarte a tus Multifocales (Sin Estrés)',
    excerpt: 'Acostumbrarse a los lentes progresivos es mucho más natural de lo que parece. Seguí estos 3 simples pasos y empezá a disfrutar de una visión perfecta.',
    metaTitle: 'Guía fácil para adaptarse a Lentes Multifocales | Atelier Óptica',
    metaDescription: 'Perdele el miedo a los lentes multifocales. Te damos 3 consejos prácticos y relajados para acostumbrar tus ojos al lente progresivo en tiempo récord.',
    date: '2026-05-08',
    category: 'Salud Visual',
    imageUrl: 'https://images.unsplash.com/photo-1544717305-2782549b5136?q=80&w=1470&auto=format&fit=crop',
    content: (
      <>
        <p className="lead">Es súper común que el primer día que te ponés unos lentes multifocales sientas que todo está un poco "raro". ¡Tranquilo! Tu cerebro es increíblemente inteligente y solo necesita un par de días para descifrar el nuevo mapa. No hace falta que te estreses, la adaptación es un proceso súper natural.</p>

        <p>Acá te dejamos <strong>3 consejos súper simples</strong> para que tu período de acostumbramiento sea rápido y placentero:</p>

        <h2>1. "Apunta con la nariz"</h2>
        <p>El mejor consejo que te podemos dar es este: al principio, no muevas solo los ojos para mirar algo que está a los costados, porque te vas a topar con la zona de desenfoque del cristal. En su lugar, acostumbrate a girar suavemente tu cabeza apuntando con la nariz hacia el objeto que querés mirar. En un par de días, lo vas a hacer de manera automática sin darte cuenta.</p>

        <h2>2. Usalos desde la mañana temprano</h2>
        <p>El error más frecuente es ponerse los anteojos nuevos a las 6 de la tarde, después de haber trabajado todo el día. A esa hora, tus ojos y tu cerebro están cansados. Lo ideal es ponértelos apenas te despertás. Como tu cerebro está fresco, asimilará la nueva graduación mucho más rápido y sin esfuerzo.</p>

        <h2>3. Cómo bajar la escalera sin miedo</h2>
        <p>Al principio, mirar al piso o bajar escalones puede dar la sensación de que el suelo está más cerca o se mueve. Esto pasa porque, si mirás hacia abajo solo con los ojos, estás usando la zona "de lectura" (para ver de cerca) para mirar el suelo (que está lejos). <strong>El truco es fácil:</strong> bajá el mentón y mirá los escalones por la parte superior del cristal. ¡Listo, problema resuelto!</p>

        <h2>Dales tiempo y relajate</h2>
        <p>La regla de oro es usarlos todos los días un poquito más. Tratá de no intercalarlos con tus anteojos viejos, así no confundís a tus ojos. La gran mayoría de las personas se adaptan entre el día 3 y el día 7. Si después de dos semanas sentís que la cosa no mejora, vení a Atelier Óptica y nosotros te los ajustamos, ¡porque queremos verte feliz y viendo perfecto a todas las distancias!</p>
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
