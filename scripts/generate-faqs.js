const fs = require('fs');
const path = require('path');

const slugs = [
  'ray-ban-meta-smart-glasses-cordoba',
  'lentes-wicue-oscurecen-con-boton',
  'control-miopia',
  'tratamiento-antirreflex-crizal-sapphire',
  'lentes-eyezen-descanso-pantallas-essilor',
  'lentes-stellest-control-miopia-infantil',
  'varilux-xr-series-inteligencia-artificial',
  'varilux-comfort-max-dolor-de-cuello',
  'varilux-vs-genericos-diferencias',
  'mejor-optica-multifocales-cordoba',
  'precio-multifocales-cordoba-2026',
  'optica-exclusiva-cerro-rosas-cordoba',
  'multifocales-primera-vez-guia-cordoba',
  'multifocales-trabajo-oficina-cordoba',
  'guia-multifocales-cordoba',
  'elegir-anteojos-recetados',
  'optica-cordoba-cerro-de-las-rosas',
  'lentes-de-sol-tendencias-2026',
  'como-leer-tu-receta-oftalmologica',
  'filtro-azul-pantallas',
  'cristales-fotocromaticos-transitions',
  'anteojos-para-ninos',
  'como-limpiar-tus-anteojos',
  'multifocales-marcas-precios-varilux-novar',
  'mareos-con-multifocales-soluciones',
  'por-que-nuestros-multifocales-no-fallan-tecnologia-cordoba',
  'pasos-faciles-adaptacion-multifocales',
  'bifocales-vs-multifocales-diferencias',
  'multifocales-ocupacionales-para-computadora',
  'experiencia-boutique-atelier-optica',
  'diseno-y-marcas-armazones-cordoba'
];

const faqs = {};

slugs.forEach(slug => {
  if (slug.includes('stellest') || slug.includes('miopia')) {
    faqs[slug] = [
      {
        question: "¿A qué edad puede mi hijo empezar a usar lentes Stellest?",
        answer: "Los lentes Stellest pueden ser recetados tan pronto como se diagnostica la miopía progresiva en niños, generalmente a partir de los 6 años. Cuanto antes se inicie el tratamiento, más efectivo será para frenar el avance de la miopía."
      },
      {
        question: "Foro: Mi hijo se adaptará bien a los lentes de control de miopía?",
        answer: "¡Sí! Estéticamente, los lentes Stellest lucen exactamente igual que unos lentes comunes de visión sencilla. La constelación de microlentes es invisible, por lo que los niños se adaptan instantáneamente y no sienten ninguna diferencia en su autoestima."
      },
      {
        question: "¿Realmente curan la miopía?",
        answer: "No existe una cura para la miopía, pero la tecnología Stellest ha demostrado clínicamente ralentizar su progresión en un 67% en promedio en comparación con lentes normales. El objetivo es evitar que el niño alcance niveles altos de miopía que puedan causar patologías graves en la adultez."
      }
    ];
  } else if (slug.includes('multifocal') || slug.includes('varilux') || slug.includes('bifocal') || slug.includes('mareos')) {
    faqs[slug] = [
      {
        question: "¿Es normal sentir mareos los primeros días con multifocales?",
        answer: "Es completamente normal. El cerebro necesita un período de 'neuro-adaptación' (generalmente de 3 a 14 días) para aprender a mirar por los diferentes campos de visión. Te recomendamos usarlos de manera continua y mover la cabeza, no solo los ojos."
      },
      {
        question: "¿Cuál es la diferencia entre un Varilux y un multifocal genérico?",
        answer: "La diferencia radica en los campos de visión. Los multifocales genéricos tienen 'pasillos' estrechos que generan visión borrosa en los bordes. Los Varilux (especialmente XR o Comfort Max) ofrecen campos visuales ultra anchos, transiciones suaves y casi nulo efecto de balanceo."
      },
      {
        question: "¿Qué pasa si nunca me adapto?",
        answer: "En Atelier Óptica contamos con una Garantía de Adaptación. Evaluaremos tu caso clínico, ajustaremos el armazón o cambiaremos el diseño del lente si es necesario para asegurar tu total confort."
      }
    ];
  } else if (slug.includes('crizal') || slug.includes('antirreflex') || slug.includes('azul') || slug.includes('eyezen')) {
    faqs[slug] = [
      {
        question: "¿El filtro azul realmente hace la diferencia trabajando en la compu?",
        answer: "Definitivamente. Cristales como Crizal Prevencia o Eyezen bloquean selectivamente la luz azul-violeta nociva emitida por las pantallas. Esto reduce la fatiga visual, previene dolores de cabeza y mejora la calidad del sueño."
      },
      {
        question: "¿Cómo limpio correctamente un lente con tratamiento antirreflex?",
        answer: "Siempre usa microfibra limpia y un líquido limpia-cristales específico. Nunca uses pañuelos de papel, alcohol, ni tu remera, ya que arrastran el polvo microscópico y pueden rayar irremediablemente el tratamiento."
      },
      {
        question: "¿Cuánto dura un tratamiento Crizal?",
        answer: "Con el cuidado adecuado, los tratamientos premium como Crizal Sapphire HR pueden durar intactos toda la vida útil de tu graduación (generalmente 2 a 3 años antes de necesitar una nueva receta)."
      }
    ];
  } else {
    // Generic FAQs for the rest
    faqs[slug] = [
      {
        question: "¿Cuánto demoran en hacer unos lentes recetados?",
        answer: "Dependiendo de la complejidad del cristal (monofocal vs multifocal premium), el proceso en nuestro laboratorio en Córdoba puede demorar entre 3 y 10 días hábiles."
      },
      {
        question: "¿Trabajan con obras sociales?",
        answer: "Trabajamos con facturación para reintegro. Te entregamos la factura oficial junto con el certificado de óptica para que puedas gestionar el reintegro total o parcial según la cobertura de tu obra social o prepaga."
      },
      {
        question: "¿Necesito turno previo para asesoramiento?",
        answer: "Si bien siempre podés visitarnos, recomendamos agendar un turno para dedicarte el tiempo que te merecés y realizar un estudio personalizado de tu perfil visual y estético."
      }
    ];
  }
});

fs.writeFileSync(path.join(__dirname, '../src/lib/blog-faqs.json'), JSON.stringify(faqs, null, 2));
console.log('FAQs generated successfully in src/lib/blog-faqs.json');
