// ────────────────────────────────────────────────────────────────────────────
// Los tonos y las intensidades de teñido que aceptan los laboratorios.
//
// Esta lista es la MISMA que muestra SmartLab (Grupo Óptico) al cargar un
// pedido. No es un detalle estético: si el vendedor elige un tono que el
// laboratorio no tiene, alguien va a tener que llamar para corregirlo y el
// pedido queda parado. Ofrecer solo lo que existe es lo que evita ese ida y
// vuelta.
//
// Para agregar o sacar un tono se edita ACÁ y viaja con el deploy — no hace
// falta tocar la base. Los colores cargados a mano en la tabla `CrystalColor`
// se siguen mostrando después de estos, así nada de lo ya elegido desaparece.
// ────────────────────────────────────────────────────────────────────────────

export interface TonoTenido {
    name: string;
    hexColor: string;
}

/** Tal cual el desplegable de SmartLab, en su mismo orden. */
export const TONOS_TENIDO: TonoTenido[] = [
    { name: 'Gris', hexColor: '#555555' },
    { name: 'Verde', hexColor: '#3f6b4a' },
    { name: 'Sepia', hexColor: '#7a5c3a' },
    { name: 'G15', hexColor: '#2c4c3b' },
    { name: 'Nigth Drive', hexColor: '#c9a227' },
    { name: 'Azul', hexColor: '#3a5a8c' },
    { name: 'Rosa', hexColor: '#d4a3a3' },
    { name: 'Rojo', hexColor: '#ab4040' },
];

/**
 * Intensidades que ofrece SmartLab.
 *
 * Se muestran como sugerencia, pero el campo SIGUE siendo escribible: hay
 * pedidos que piden cosas como "60% más oscuro arriba" y encerrar eso en una
 * lista obligaría al vendedor a elegir algo que no es lo que el cliente pidió.
 */
export const INTENSIDADES_TENIDO = ['0.5', '1', '2', '3', '4'] as const;

/** Los tres estilos de teñido, con el nombre que usa el laboratorio. */
export const ESTILOS_TENIDO = [
    { key: 'COMPACTO', label: 'Color Compacto' },
    { key: 'MUESTRA', label: 'Color Según Muestra' },
    { key: 'DEGRADE', label: 'Color Degradé' },
] as const;
