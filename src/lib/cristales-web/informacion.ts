import type { ClaveOpcion } from './claves';

/**
 * Lo que se le explica al cliente de cada opción de cristal de la tienda, en
 * el área de cristales (/cristales-opticos/tienda-online).
 *
 * Solo TEXTO: el título, los destacados y el precio salen de la base
 * (WebLensOption y el producto vinculado, docs/cristales-web.md). Acá va lo que
 * no cambia si se vincula otro producto de la misma gama: para quién es y qué
 * resuelve. Si algún día una opción pasa a ser otra cosa, se reescribe su
 * entrada; una opción sin entrada se muestra igual, solo sin este texto.
 */
export interface InformacionOpcion {
    paraQuien: string;
    queEs: string;
    /** Página del área de cristales que la explica en detalle, si existe. */
    masInfo?: { texto: string; href: string };
}

export const INFORMACION_OPCIONES: Partial<Record<ClaveOpcion, InformacionOpcion>> = {
    'MONOFOCAL.ORGANICO_BLANCO': {
        queEs: 'Cristal orgánico blanco de índice 1.49, el material óptico clásico: liviano y con muy buena calidad de visión. No lleva antirreflejo.',
        paraQuien: 'Graduaciones bajas y un uso ocasional, o como base para un anteojo de sol teñido.',
    },
    'MONOFOCAL.ORGANICO_AR': {
        queEs: 'El mismo orgánico con antirreflejo: elimina los brillos que molestan de noche y con luces de frente, y hace que se te vean los ojos en las fotos.',
        paraQuien: 'La opción recomendada para el uso diario, sobre todo si manejás de noche.',
        masInfo: { texto: 'Cómo funciona el antirreflejo', href: '/cristales-opticos/antirreflejo' },
    },
    'MONOFOCAL.ORGANICO_BLUE': {
        queEs: 'Orgánico de índice 1.56, más fino que el básico, con antirreflejo y filtro de luz azul violeta para las pantallas.',
        paraQuien: 'Quien pasa muchas horas frente a la computadora o el celular.',
        masInfo: { texto: 'Filtro azul: qué hace y qué no', href: '/cristales-opticos/blue-uv' },
    },
    'MONOFOCAL.POLI_BLUE': {
        queEs: 'Policarbonato 1.59 tallado digitalmente, con filtro de luz azul: el material más resistente a los golpes, y más fino y liviano que el orgánico.',
        paraQuien: 'Chicos, deportistas, armazones al aire o graduaciones medias y altas.',
        masInfo: { texto: 'Policarbonato y alto índice', href: '/cristales-opticos/policarbonato' },
    },
    'MONOFOCAL.ORGANICO_FOTOCROMATICO': {
        queEs: 'Orgánico 1.56 con antirreflejo que se oscurece a gris con el sol y vuelve a ser transparente adentro.',
        paraQuien: 'Quien entra y sale todo el día y no quiere andar cambiando de anteojos.',
        masInfo: { texto: 'Fotocromáticos y Transitions', href: '/cristales-opticos/transitions' },
    },
    'BIFOCAL.ORGANICO_BLANCO': {
        queEs: 'Bifocal Kriptock en orgánico 1.49: arriba la graduación de lejos y abajo, en una ventana visible, la de cerca.',
        paraQuien: 'Quien ya usó bifocales y quiere seguir con ellos. Si es tu primera vez con dos distancias, conviene mirar los multifocales.',
    },
    'MULTIFOCAL.SMART_FREE': {
        queEs: 'Multifocal digital Smart ONE en orgánico 1.49: lejos, intermedia y cerca en un mismo cristal, sin la línea del bifocal.',
        paraQuien: 'La puerta de entrada a los multifocales, para quien empieza a necesitar ver de cerca.',
        masInfo: { texto: 'Guía de multifocales', href: '/multifocales' },
    },
    'MULTIFOCAL.VARILUX': {
        queEs: 'Varilux Comfort de Essilor en Orma con antirreflejo Crizal. Viene en promoción 2x1: el segundo par de cristales es sin cargo, con la misma receta, y el armazón del segundo par también.',
        paraQuien: 'Quien busca la adaptación más fácil y la mejor visión intermedia, la de la computadora.',
        masInfo: { texto: 'Todo sobre Varilux', href: '/cristales-opticos/varilux' },
    },
    'MULTIFOCAL.FOTOCROMATICO': {
        queEs: 'El multifocal Smart ONE en versión fotocromática gris 1.56: se oscurece al sol, así un solo anteojo sirve para todo el día.',
        paraQuien: 'Quien usa multifocales afuera y no quiere un segundo par de sol.',
        masInfo: { texto: 'Fotocromáticos y Transitions', href: '/cristales-opticos/transitions' },
    },
    'TENIDO.COMPACTO': {
        queEs: 'Teñido de un solo tono en todo el cristal, en los colores del laboratorio (gris, verde, sepia, G15, azul y más).',
        paraQuien: 'Para hacer anteojos de sol, con o sin aumento, sobre el armazón que elijas.',
        masInfo: { texto: 'Guía de colores de cristales', href: '/blog/colores-cristales' },
    },
    'TENIDO.DEGRADE': {
        queEs: 'Teñido más oscuro arriba y más claro abajo: protege del sol y deja ver bien el celular o el tablero del auto.',
        paraQuien: 'Anteojos de sol para usar también manejando o en la ciudad.',
        masInfo: { texto: 'Guía de colores de cristales', href: '/blog/colores-cristales' },
    },
};
