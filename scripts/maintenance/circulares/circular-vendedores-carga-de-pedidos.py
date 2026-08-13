from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_JUSTIFY
from reportlab.platypus import (SimpleDocTemplate, Paragraph, Spacer, Table,
                                TableStyle, HRFlowable, KeepTogether)

# Paleta sobria, alineada con la identidad de la óptica (piedra + dorado).
TINTA    = colors.HexColor('#1c1917')
SUAVE    = colors.HexColor('#57534e')
DORADO   = colors.HexColor('#a08444')
LINEA    = colors.HexColor('#e7e5e4')
PANEL    = colors.HexColor('#faf9f7')
ALERTA   = colors.HexColor('#b45309')
PANEL_AL = colors.HexColor('#fffbeb')

SANS = 'Helvetica'
BOLD = 'Helvetica-Bold'

titulo = ParagraphStyle('titulo', fontName=BOLD, fontSize=17, leading=21, textColor=TINTA, spaceAfter=2)
bajada = ParagraphStyle('bajada', fontName=SANS, fontSize=9.5, leading=13, textColor=SUAVE)
membrete = ParagraphStyle('membrete', fontName=BOLD, fontSize=8, leading=10, textColor=DORADO)
meta = ParagraphStyle('meta', fontName=SANS, fontSize=8, leading=10, textColor=SUAVE)

h2 = ParagraphStyle('h2', fontName=BOLD, fontSize=10.5, leading=13, textColor=TINTA,
                    spaceBefore=9, spaceAfter=4)
cuerpo = ParagraphStyle('cuerpo', fontName=SANS, fontSize=9.2, leading=12.6,
                        textColor=TINTA, alignment=TA_JUSTIFY)
item = ParagraphStyle('item', fontName=SANS, fontSize=9.2, leading=12.6, textColor=TINTA,
                      leftIndent=9, bulletIndent=1, spaceAfter=2.5)
nota = ParagraphStyle('nota', fontName=SANS, fontSize=8.6, leading=11.6, textColor=SUAVE)
alerta = ParagraphStyle('alerta', fontName=SANS, fontSize=9.2, leading=12.4, textColor=colors.HexColor('#78350f'))
alerta_t = ParagraphStyle('alerta_t', fontName=BOLD, fontSize=9.4, leading=12.4, textColor=ALERTA, spaceAfter=3)
pie = ParagraphStyle('pie', fontName=SANS, fontSize=7.6, leading=10, textColor=SUAVE)


def panel(flows, fondo=PANEL, borde=LINEA, pad=8):
    t = Table([[flows]], colWidths=[170 * mm])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), fondo),
        ('BOX', (0, 0), (-1, -1), 0.6, borde),
        ('LEFTPADDING', (0, 0), (-1, -1), pad),
        ('RIGHTPADDING', (0, 0), (-1, -1), pad),
        ('TOPPADDING', (0, 0), (-1, -1), pad),
        ('BOTTOMPADDING', (0, 0), (-1, -1), pad),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
    ]))
    return t


doc = SimpleDocTemplate(
    '/Users/ishtarpissano/proyectos/atelier/docs/circular-vendedores-carga-de-pedidos.pdf',
    pagesize=A4,
    leftMargin=20 * mm, rightMargin=20 * mm,
    topMargin=16 * mm, bottomMargin=14 * mm,
    title='Circular a vendedores — Cambios en la carga del pedido',
    author='Atelier Óptica',
)

S = []

S.append(Paragraph('ATELIER ÓPTICA &nbsp;·&nbsp; CIRCULAR INTERNA', membrete))
S.append(Spacer(1, 5))
S.append(Paragraph('Cambios en la carga del pedido', titulo))
S.append(Spacer(1, 3))
S.append(Paragraph(
    'Para el equipo de ventas &nbsp;·&nbsp; Vigente desde el 13 de agosto de 2026', meta))
S.append(Spacer(1, 8))
S.append(HRFlowable(width='100%', thickness=1.1, color=DORADO, spaceAfter=9))

S.append(Paragraph(
    'Desde hoy hay tres cambios en la pantalla de venta. Los dos primeros te piden algo nuevo al cargar '
    'el pedido; el tercero cambia qué se puede corregir después. Están para que no se fabrique un pedido '
    'equivocado y para que, si el cliente reclama, tengamos con qué responderle.', cuerpo))
S.append(Spacer(1, 4))

# ── 1 ────────────────────────────────────────────────────────────────────────
S.append(Paragraph('1. Foto del armazón: ahora es obligatoria', h2))
S.append(Paragraph(
    'Antes de cerrar la venta tenés que sacarle una foto al armazón y subirla desde el mismo repaso '
    'donde cargás las medidas. Sin la foto, el sistema no deja convertir el presupuesto en venta.', cuerpo))
S.append(Spacer(1, 4))
S.append(Paragraph('Si el pedido es un <b>2x1, van dos fotos</b>: una por armazón. No sirve una sola foto con '
                   'los dos juntos, porque cada imagen tiene que corresponderse con las medidas de ese armazón.',
                   item, bulletText='•'))
S.append(Paragraph('Desde el celular el recuadro abre <b>la cámara directo</b>: sacás la foto y queda subida.',
                   item, bulletText='•'))
S.append(Paragraph('Esa foto es la que <b>ve el cliente</b> en su confirmación de compra.',
                   item, bulletText='•'))
S.append(Spacer(1, 5))
S.append(panel([Paragraph(
    '<b>Por qué.</b> Es lo único que después prueba qué armazón se le vendió. Cuando alguien vuelve diciendo '
    '“yo elegí otro”, sin foto es su palabra contra la nuestra — y siempre terminamos rehaciendo el trabajo.',
    nota)]))
S.append(Spacer(1, 4))

# ── 2 ────────────────────────────────────────────────────────────────────────
S.append(Paragraph('2. El cartel de lo que falta, adelante de todo', h2))
S.append(Paragraph(
    'Si el botón de cerrar la venta está deshabilitado, ahora vas a ver <b>arriba de todo, en rojo, la lista '
    'exacta de lo que falta</b>: la foto, una medida, la altura de la receta, el DNI del cliente, lo que sea. '
    'Ya no hay que buscar a ciegas qué campo quedó vacío.', cuerpo))
S.append(Spacer(1, 4))

# ── 3 ────────────────────────────────────────────────────────────────────────
S.append(Paragraph('3. Una venta enviada a fábrica ya no se edita', h2))
S.append(Paragraph(
    'Cuando el pedido sale a fábrica queda cerrado. No se pueden cambiar las medidas, la forma del armazón, '
    'el teñido, los totales ni la receta — <b>tampoco editando la receta desde la ficha del cliente</b>, que '
    'antes cambiaba la venta sin que nadie se enterara.', cuerpo))
S.append(Spacer(1, 4))
S.append(Paragraph('Si hay que corregir algo, <b>pedile a administración que reabra el pedido</b>. '
                   'Quien lo reabre deja escrito el motivo.', item, bulletText='•'))
S.append(Paragraph('Al reconfirmarlo queda una <b>versión nueva</b>, y las anteriores no se borran: la ficha '
                   'guarda el paso a paso completo.', item, bulletText='•'))
S.append(Paragraph('En la ficha queda registrado <b>quién la envió a fábrica y a qué hora</b>.',
                   item, bulletText='•'))
S.append(Spacer(1, 6))

# ── Aviso ────────────────────────────────────────────────────────────────────
S.append(KeepTogether(panel([
    Paragraph('IMPORTANTE — el cliente recibe todo automáticamente', alerta_t),
    Paragraph(
        'En el momento en que convertís el presupuesto en venta, al cliente le llega solo, por <b>mail y por '
        'WhatsApp</b>, la confirmación de compra: la foto y los datos de su receta, el detalle del armazón con '
        'sus medidas, si lleva teñido o no, lo que abonó y el saldo. Se le pide que revise y conteste OK.',
        alerta),
    Spacer(1, 4),
    Paragraph(
        '<b>Qué significa para vos:</b> revisá bien antes de cerrar, porque eso sale tal cual. Y si el cliente '
        'responde con una corrección, avisá enseguida — es la ventana para arreglarlo antes de que la fábrica '
        'empiece.', alerta),
], fondo=PANEL_AL, borde=colors.HexColor('#fcd34d'))))

S.append(Spacer(1, 8))
S.append(HRFlowable(width='100%', thickness=0.6, color=LINEA, spaceAfter=5))
S.append(Paragraph(
    'Ante cualquier duda o si algo no te deja avanzar, avisá antes de improvisar una vuelta. '
    'Atelier Óptica — José Luis de Tejeda 4380, Cerro de las Rosas, Córdoba.', pie))

doc.build(S)
print('PDF generado')
