/**
 * Direcciones viejas de fichas que hoy viven con otro nombre: la ficha
 * redirige (308) a la vigente en vez de dar 404.
 *
 * Por qué existe: la tienda renombró sus fichas (27-28/7/2026, nombres
 * estelares y lote SEO; antes, los nombres de la tienda anterior) y ninguna
 * URL vieja redirigía. Google, los anuncios, los carritos guardados y los
 * links compartidos por WhatsApp seguían apuntando a la vieja, y la persona
 * veía "Este modelo ya no está en nuestro catálogo" con el anteojo en stock.
 * Medido el 10/10/2026: 134 fichas inexistentes recibieron visitas en 30 días;
 * la más visitada era el Calipso Oval Carey bajo su nombre viejo.
 *
 * Cómo se arma: por código de fábrica (Product.model), nunca por parecido de
 * nombre. Cada destino se verificó vigente en producción el 10/10/2026. Los
 * modelos dados de baja enteros (Ares, Maia, Niobe, Iris, Jano, Leda, y los
 * de la tienda anterior que ya no se venden) NO van acá: su 404 es correcto.
 *
 * La ficha solo mira este mapa cuando el slug NO existe: un slug vigente
 * nunca se redirige, aunque figure acá.
 */
export const SLUGS_HISTORICOS: Readonly<Record<string, string>> = {
  // ── Renombres (el mismo producto con otro nombre) ──
  'anastasia-c1':                                               'lumen',
  'apolo-c1':                                                   'vega-c1',
  'apolo-c2':                                                   'vega-c2',
  'ariadne-c1':                                                 'armazon-receta-atelier-ariadne-c1',
  'ariadne-c2':                                                 'armazon-receta-atelier-ariadne-c2',
  'atelier-artemis-8f6p':                                       'atelier-artemis-tendencia',
  // El G7013 C1 estaba cargado dos veces: quedó publicado Artemis y se
  // despublicó Halley (antes vivía en next.config.ts).
  'halley-c1':                                                  'atelier-artemis-tendencia',
  'atelier-athena-906p':                                        'armazon-receta-atelier-athena-91501-c6',
  'atelier-gaia':                                               'capsula-escarlata-hy238013-c1-9iju',
  'atelier-gaia-hb3t':                                          'capsula-escarlata-hy238013-c1-9iju',
  'atelier-m7011-c4-as4m':                                      'hebe-c4',
  'atelier-m7027-c4-lgzf':                                      'atelier-calliope',
  'atelier-m7239-c4-3wor':                                      'clotho-c4',
  'atelier-tg2807-c1-116i':                                     'helios-c1',
  'atelier-tl3704a-c4-6tom':                                    'electra-c4',
  'atelier-tl3704a-c5-v7qf':                                    'electra-c5',
  'atelier-tl5208-c2-9zme':                                     'rhea-c2',
  'atelier-tl5213-c4-20z2':                                     'semele-c4',
  'atelier-v99011-c4-0usl':                                     'ulises-c4',
  'atlas-c1':                                                   'rigel-c1',
  'atlas-c3':                                                   'rigel-c3',
  'catalina-c1':                                                'orion',
  'cleopatra-c4':                                               'osiris-c4',
  'clip-on-roma-7036-c2-lentes-de-sol-armazon':                 'clip-on-genova-7036-c2-lentes-de-sol-armazon',
  'eros-c1':                                                    'sirio-c1',
  'eros-c2':                                                    'sirio-c2',
  'febo-c1':                                                    'antares-c1',
  'nestor-c1':                                                  'atelier-artemis-tendencia',
  'pandora-c5':                                                 'armazon-receta-escarlata-pandora-c5-hk011',
  'poseidon':                                                   'dionisio-c2',
  'venus-c4':                                                   'hera-c4',
  // Nombres de la tienda anterior y del lote SEO, encontrados en las visitas del 10/10/2026.
  'capsula-escarlata-armazon-receta-oval-carey':                'capsula-escarlata-calipso-oval-carey-armazon-receta',
  'tendencia-optical-oval-carey-agregale-tu-graduacion':        'capsula-escarlata-calipso-oval-carey-armazon-receta',
  'tendencia-optical-oval-carey':                               'capsula-escarlata-calipso-oval-carey-armazon-receta',
  'tendencia-optical-rectangular-negro-agregale-tu-graduacion': 'capsula-escarlata-onix-tendencia-rectangular-negro-armazon-receta',
  'tendencia-optical-rectangular-negro':                        'capsula-escarlata-onix-tendencia-rectangular-negro-armazon-receta',
  'tendencia-optical-oval-negro':                               'armazon-receta-capsula-escarlata-calipso-oval-negro',
  'capsula-escarlata-ii-oval-negro-armazon-receta':             'armazon-receta-capsula-escarlata-calipso-oval-negro',
  'lentes-sol-clip-on-siena-g5921':                             'lentes-sol-clip-on-siena-g5921-c2',

  // ── Color dado de baja → el MISMO modelo en otro color que sigue en stock ──
  // Ese color ya no se vende, pero la URL está indexada y el modelo sí: se
  // manda al mismo armazón (Google acepta un redirect a un producto
  // equivalente; mandar a /tienda cuenta como soft-404).
  'andromeda-c1':                                               'andromeda-c3',
  'atlas-c2':                                                   'rigel-c1',
  'canopo-c4':                                                  'canopo-c2',
  'gala-c4':                                                    'gala-c3',
  'gala-c6':                                                    'gala-c7',
  'helena-c8':                                                  'helena-c2',
  'pegaso-c1':                                                  'pegaso-c2',
  'polaris-c1':                                                 'polaris-c2',
  'polaris-c5':                                                 'polaris-c6',
  'poseidon-c5':                                                'poseidon-c6',
};

/** Adónde redirige una dirección vieja, o null si no es una ficha renombrada. */
export function slugVigenteDe(slug: string): string | null {
  return Object.prototype.hasOwnProperty.call(SLUGS_HISTORICOS, slug) ? SLUGS_HISTORICOS[slug] : null;
}
