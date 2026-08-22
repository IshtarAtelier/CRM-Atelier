/**
 * AVISOS DE ESCRITORIO — los carteles del sistema operativo, como los de Gmail.
 *
 * Aparecen en la esquina de la pantalla aunque la persona esté en otra pestaña
 * o en otro programa. Es lo único que funciona cuando el CRM no está a la vista:
 * el globo de urgentes vive dentro del panel, así que no sirve si el panel no
 * se está mirando.
 *
 * LÍMITE REAL, para que nadie espere de más: el navegador tiene que estar
 * ABIERTO (aunque sea minimizado o en otra pestaña). Con el navegador cerrado
 * del todo no llega nada — eso necesita "push web", que exige un service worker
 * y claves VAPID en el servidor, y es otro trabajo.
 *
 * El permiso lo da la persona una vez y el navegador lo recuerda. NO se puede
 * pedir solo al cargar la página: Chrome ignora los pedidos que no salen de un
 * clic. Por eso hay un botón (ver `BotonAvisos`).
 */

/** Estado del permiso, sin romper en navegadores viejos o en el servidor. */
export type EstadoAviso = 'no-soportado' | 'default' | 'granted' | 'denied';

export function estadoAvisos(): EstadoAviso {
    if (typeof window === 'undefined' || !('Notification' in window)) return 'no-soportado';
    return Notification.permission as EstadoAviso;
}

/** Pide el permiso. Llamar SOLO desde un clic. */
export async function pedirPermiso(): Promise<EstadoAviso> {
    if (typeof window === 'undefined' || !('Notification' in window)) return 'no-soportado';
    try {
        return (await Notification.requestPermission()) as EstadoAviso;
    } catch {
        return Notification.permission as EstadoAviso;
    }
}

/**
 * ¿La persona está mirando el CRM ahora mismo?
 *
 * Si lo está mirando NO se le manda un cartel del sistema: ya tiene el número en
 * rojo y el globo de urgentes a la vista, y un cartel encima sería ruido. Es
 * exactamente lo que hace el correo: te avisa cuando NO estás en la casilla.
 */
export function estaMirando(): boolean {
    if (typeof document === 'undefined') return false;
    return document.visibilityState === 'visible' && document.hasFocus();
}

interface AvisoParams {
    titulo: string;
    cuerpo: string;
    /** Adónde llevar al hacer clic (ruta del panel). */
    ir?: string;
    /** Los urgentes se quedan hasta que la persona los toca. */
    insistente?: boolean;
    /** Agrupa: dos avisos con la misma etiqueta no se apilan, se reemplazan. */
    etiqueta?: string;
}

/** Muestra un cartel del sistema operativo. Devuelve false si no se pudo. */
export function avisar({ titulo, cuerpo, ir, insistente, etiqueta }: AvisoParams): boolean {
    if (estadoAvisos() !== 'granted') return false;
    try {
        const n = new Notification(titulo, {
            body: cuerpo,
            icon: '/favicon.ico',
            badge: '/favicon.ico',
            tag: etiqueta,
            // Un urgente no se desvanece solo a los pocos segundos: se queda
            // hasta que la persona lo toca o lo descarta.
            requireInteraction: !!insistente,
        });
        n.onclick = () => {
            // Traer la ventana al frente ANTES de navegar: si solo se navega, la
            // página cambia detrás de otro programa y la persona nunca la ve.
            window.focus();
            if (ir) window.location.href = ir;
            n.close();
        };
        return true;
    } catch {
        // Safari en iOS y algunos navegadores embebidos tiran acá aunque el
        // permiso figure concedido. No es un error que valga reportar.
        return false;
    }
}

/**
 * El contador en el título de la pestaña: «(3) Atelier Óptica».
 *
 * Es el aviso que sobrevive a todo: no necesita permiso, no lo bloquea ningún
 * navegador, y se ve con solo mirar la barra de pestañas. Cuando el permiso de
 * los carteles está denegado, esto es lo único que queda.
 */
let tituloOriginal: string | null = null;

export function marcarTitulo(sinLeer: number) {
    if (typeof document === 'undefined') return;
    if (tituloOriginal === null) {
        tituloOriginal = document.title.replace(/^\(\d+\)\s*/, '');
    }
    document.title = sinLeer > 0 ? `(${sinLeer}) ${tituloOriginal}` : tituloOriginal;
}
