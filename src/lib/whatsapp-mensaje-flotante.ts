/**
 * El texto con el que el botón flotante abre WhatsApp, según la página.
 *
 * Vive fuera del componente por una razón: ese texto es lo ÚNICO que le dice
 * al bot y al CRM que el chat vino de la web (`origenDeterministico`, y su
 * copia en wa-service/tools.js, buscan frases fijas). Cada vez que alguien
 * redactaba un mensaje nuevo para una página, el chat dejaba de reconocerse
 * sin que nada fallara: el 10/10/26 tres de las seis variantes —checkout,
 * configurador y notas del blog— no traían ninguna frase de la lista. Siendo
 * una función pura, `check:origen` recorre TODAS las variantes y falla si una
 * deja de ser "Tienda online".
 *
 * Regla para un mensaje nuevo: que diga "Estoy en la web de Atelier" (o
 * cualquier frase de FRASES_DEL_SITIO). Agregar una frase nueva a la lista es
 * peor: hay que deployar también el bot, que vive en otro proyecto.
 */
export function mensajeDelBotonFlotante({
  pathname,
  productName,
  message,
  tituloNota,
  isOptica,
}: {
  pathname: string | null | undefined;
  productName?: string;
  message?: string;
  tituloNota?: string | null;
  isOptica?: boolean;
}): { texto: string; compartePagina: boolean } {
  const ruta = pathname || "";
  let texto = "¡Hola! Estoy en la web de Atelier y quisiera que me asesoren.";

  if (isOptica) {
    // Óptica en la tienda mayorista: tono y marca Cápsula Escarlata.
    texto = productName
      ? `Hola! Consulta mayorista sobre el modelo ${productName} (Cápsula Escarlata).`
      : "Hola! Consulta sobre el canal mayorista de Cápsula Escarlata.";
  } else if (productName) {
    texto = `¡Hola! Tengo dudas sobre el modelo ${productName} y me gustaría recibir asesoramiento.`;
  } else if (message) {
    texto = message;
  } else if (tituloNota) {
    texto = `¡Hola! Estoy en la web de Atelier leyendo "${tituloNota}" y me gustaría recibir asesoramiento.`;
  } else if (ruta.includes("/tienda") || ruta.includes("/producto/")) {
    texto = "¡Hola Atelier! Estoy recorriendo la tienda online y me gustaría recibir asesoramiento.";
  } else if (ruta.includes("/arma-tus-lentes")) {
    texto = "¡Hola Atelier! Estoy armando mis lentes en la web y me gustaría recibir asesoramiento.";
  } else if (ruta.startsWith("/checkout")) {
    // Quien escribe desde acá está a un paso de pagar: que el asesor lo sepa.
    texto = "¡Hola! Estoy en la web de Atelier terminando una compra y tengo una consulta.";
  }

  // En ficha de producto, tienda y notas del blog va también el link de la
  // página: WhatsApp arma la previsualización, así el asesor ve qué está
  // mirando y puede abrir la nota para responder sobre lo mismo que se leyó.
  const compartePagina = Boolean(
    productName || ruta.includes("/producto/") || ruta.includes("/tienda") || tituloNota
  );

  return { texto, compartePagina };
}
