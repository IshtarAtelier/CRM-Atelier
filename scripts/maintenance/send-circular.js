const nodemailer = require('nodemailer');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const toEmails = ['turchimatias1@gmail.com', 'pisano.ishtar@gmail.com'];

// Configuración de estilos en línea comunes para simplificar y asegurar contraste
const styles = {
  body: 'font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background-color: #050505; color: #ffffff; margin: 0; padding: 0;',
  wrapper: 'max-width: 600px; margin: 20px auto; background-color: #111111; padding: 40px 25px; border: 1px solid #c2a38a; box-shadow: 0 10px 30px rgba(0,0,0,0.5); color: #ffffff;',
  header: 'text-align: center; margin-bottom: 40px;',
  title: 'font-family: Georgia, serif; font-size: 34px; font-weight: normal; letter-spacing: 4px; color: #f8e3d2; margin: 0; text-transform: uppercase;',
  subtitle: 'font-size: 11px; letter-spacing: 6px; text-transform: uppercase; color: #c2a38a; margin-top: 5px;',
  intro: 'font-size: 16px; line-height: 1.6; color: #f5f5f5; margin-bottom: 25px;',
  divider: 'height: 2px; background-color: #c2a38a; margin: 35px 0; border: none; opacity: 0.3;',
  sectionTitle: 'font-family: Georgia, serif; font-size: 22px; color: #f8e3d2; margin-top: 40px; margin-bottom: 20px; border-bottom: 2px solid #c2a38a; padding-bottom: 8px; letter-spacing: 1px;',
  card: 'background-color: #1f1a17; padding: 22px; border: 1px solid #3d3129; margin-bottom: 30px; border-radius: 4px; color: #ffffff;',
  cardTitle: 'margin-top: 0; color: #f8e3d2; font-size: 19px; font-weight: normal; letter-spacing: 0.5px; border-bottom: 1px solid #3d3129; padding-bottom: 8px;',
  chartContainer: 'margin: 25px 0; background-color: #151210; padding: 20px; border: 1px solid #2d2520; border-radius: 4px;',
  chartTitle: 'font-size: 15px; font-weight: bold; color: #f8e3d2; margin-bottom: 15px; text-transform: uppercase; letter-spacing: 1px;',
  chartLabel: 'font-size: 13px; margin-bottom: 6px; color: #ffffff; display: flex; justify-content: space-between;',
  chartBarBg: 'background-color: #2d2520; height: 14px; border-radius: 7px; margin-bottom: 20px; overflow: hidden; border: 1px solid #3d3129;',
  bulletList: 'padding-left: 20px; line-height: 1.7; color: #ffffff; margin-bottom: 20px;',
  listItem: 'margin-bottom: 12px; color: #ffffff;',
  subListItem: 'color: #e0e0e0; margin-bottom: 6px;',
  textHighlight: 'color: #ffd700; font-weight: bold;',
  footer: 'text-align: center; margin-top: 60px; padding-top: 25px; border-top: 1px solid #2d2520; font-size: 13px; color: #c2a38a;',
  badgeSubir: 'color: #4ade80; font-weight: bold; font-size: 15px;',
  badgeBajar: 'color: #f87171; font-weight: bold; font-size: 15px;',
  badgeMantener: 'color: #60a5fa; font-weight: bold; font-size: 15px;',
  badgeNuevo: 'color: #c084fc; font-weight: bold; font-size: 15px;'
};

const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Resumen de Actualizaciones CRM - Atelier</title>
</head>
<body style="${styles.body}">
  <div style="${styles.wrapper}">
    <div style="${styles.header}">
      <h1 style="${styles.title}">ATELIER</h1>
      <p style="${styles.subtitle}">Óptica Boutique</p>
    </div>

    <p style="${styles.intro}">
      <strong style="color: #ffffff;">Para:</strong> Matías (Ventas y Administración)<br>
      <strong style="color: #ffffff;">De:</strong> Sistema CRM Atelier
    </p>
    
    <p style="${styles.intro}">
      Hola Mati,<br><br>
      Te preparé este resumen actualizado con todos los avances críticos que hemos implementado en el sistema CRM de Atelier. Estas herramientas ya se encuentran activas en <strong>Producción</strong> para facilitar las ventas diarias y automatizar tareas operativas.
    </p>

    <div style="${styles.divider}"></div>

    <div style="${styles.sectionTitle}">📈 Rendimiento de Ventas - Mayo 2026</div>
    <p style="${styles.intro}">
      Para que veas cómo viene impactando tu trabajo en el sistema, acá tenés la radiografía de las ventas acumuladas en lo que va del mes:
    </p>

    <!-- Grafico 1: General de Ventas -->
    <div style="${styles.chartContainer}">
      <div style="${styles.chartTitle}">📊 Ventas Totales por Categoría</div>
      
      <div style="${styles.chartLabel}">
        <span style="color: #ffffff;">🔮 Cristales</span>
        <strong style="${styles.textHighlight}">$7.110.408 (68.7%)</strong>
      </div>
      <div style="${styles.chartBarBg}">
        <div style="height: 100%; border-radius: 7px; width: 68.7%; background-color: #c2a38a;"></div>
      </div>

      <div style="${styles.chartLabel}">
        <span style="color: #ffffff;">🕶️ Armazones de Receta</span>
        <strong style="${styles.textHighlight}">$2.838.000 (27.5%)</strong>
      </div>
      <div style="${styles.chartBarBg}">
        <div style="height: 100%; border-radius: 7px; width: 27.5%; background-color: #9e7f65;"></div>
      </div>

      <div style="${styles.chartLabel}">
        <span style="color: #ffffff;">☀️ Lentes de Sol</span>
        <strong style="${styles.textHighlight}">$250.000 (2.4%)</strong>
      </div>
      <div style="${styles.chartBarBg}">
        <div style="height: 100%; border-radius: 7px; width: 2.4%; background-color: #7a6e65;"></div>
      </div>

      <div style="${styles.chartLabel}">
        <span style="color: #ffffff;">👁️ Lentes de Contacto</span>
        <strong style="${styles.textHighlight}">$140.000 (1.4%)</strong>
      </div>
      <div style="${styles.chartBarBg}">
        <div style="height: 100%; border-radius: 7px; width: 1.4%; background-color: #4a3e35;"></div>
      </div>
    </div>

    <!-- Grafico 2: Desglose por Tipo de Lente (Multifocal vs Monofocal) (CONVERTIDO A GRÁFICO DE TORTA) -->
    <div style="${styles.chartContainer}">
      <div style="${styles.chartTitle}">🔮 Ventas por Tipo de Lente (Mayo 2026)</div>
      <div style="text-align: center; margin: 15px 0;">
        <img src="cid:salespiechart" alt="Gráfico de Torta de Ventas" style="max-width: 100%; height: auto; border: none; display: inline-block;">
      </div>
    </div>

    <div style="${styles.card}">
      <h3 style="${styles.cardTitle}">Resumen acumulado del mes:</h3>
      <ul style="${styles.bulletList}; margin: 0;">
        <li style="${styles.listItem}">Total Facturado: <span style="${styles.textHighlight}">$8.427.098</span> (28 ventas confirmadas).</li>
        <li style="${styles.listItem}">Desempeño Individual: <strong style="color: #ffffff;">¡Gran trabajo, Mati!</strong> Tenés facturado <span style="${styles.textHighlight}">$8.181.598</span> (liderando las ventas de la óptica).</li>
        <li style="${styles.listItem}">Distribución de Cobros:
          <ul style="margin-top: 5px; padding-left: 20px;">
            <li style="${styles.subListItem}">💳 Tarjetas (PayWay 3 y 6 cuotas): <span style="${styles.textHighlight}">$2.989.964</span></li>
            <li style="${styles.subListItem}">📲 Transferencias: <span style="${styles.textHighlight}">$2.497.579</span></li>
            <li style="${styles.subListItem}">💵 Efectivo: <span style="${styles.textHighlight}">$2.449.265</span></li>
          </ul>
        </li>
      </ul>
    </div>

    <div style="${styles.sectionTitle}">📦 1. Actualización Masiva de Catálogo y Precios (Mayo 2026)</div>
    <p style="${styles.intro}">
      Actualizamos los costos del laboratorio Optovision. Ya no es necesario que verifiques las planillas manuales, todo está integrado en el cotizador del sistema. Variación de precios al público:
    </p>
    <ul style="${styles.bulletList}">
      <li style="${styles.listItem}"><span style="${styles.badgeSubir}">📈 Subieron su precio:</span>
        <ul style="margin-top: 5px; padding-left: 20px;">
          <li style="${styles.subListItem}"><strong style="color: #ffffff;">Línea Essilor Interview (Ocupacionales):</strong> La versión ORMA subió de precio (ej. de $464.999 a $589.992) junto con la incorporación de nuevas opciones de degresión (0.80 y 1.30) con Crizal.</li>
          <li style="${styles.subListItem}"><strong style="color: #ffffff;">Monofocales Transitions Gen S (Essilor):</strong> Las versiones talladas (como Orma y Stylis 1.67) registraron aumentos reflejando los costos del laboratorio.</li>
          <li style="${styles.subListItem}"><strong style="color: #ffffff;">Línea Mi Primer Varilux:</strong> Se ajustaron los precios finales para los modelos Comfort Max en Orma, Airwear, Stylis y Transitions Gen S.</li>
        </ul>
      </li>
      <li style="${styles.listItem}"><span style="${styles.badgeBajar}">📉 Bajaron su precio:</span>
        <ul style="margin-top: 5px; padding-left: 20px;">
          <li style="${styles.subListItem}"><strong style="color: #ffffff;">Línea Kodak (Precise y Unique DRO):</strong> Al optimizar la estructura de costos y calibrados, los precios de estas familias bajaron (por ejemplo, el <em>Precise Orma Blue UV 2x1</em> bajó de $1.072.337 a $848.359).</li>
        </ul>
      </li>
      <li style="${styles.listItem}"><span style="${styles.badgeMantener}">🔄 Se mantuvieron estables (variación mínima):</span>
        <ul style="margin-top: 5px; padding-left: 20px;">
          <li style="${styles.subListItem}"><strong style="color: #ffffff;">Varilux Comfort Max y Varilux XR Design:</strong> Los valores de estas líneas de alta gama se actualizaron siguiendo muy de cerca los parámetros previos.</li>
        </ul>
      </li>
      <li style="${styles.listItem}"><span style="${styles.badgeNuevo}">🆕 Nuevas Incorporaciones:</span>
        <ul style="margin-top: 5px; padding-left: 20px;">
          <li style="${styles.subListItem}"><strong style="color: #ffffff;">Espace Plus Digital:</strong> Cargamos por completo la familia en sus índices 1.50 (Orma), 1.59 (Airwear) y sus versiones Transitions Gen S y Acclimates (con beneficio 2x1).</li>
          <li style="${styles.subListItem}"><strong style="color: #ffffff;">Nuevas gamas COMFORT y PHYSIO:</strong> Sumamos COMFORT (ej. <em>COMFORT - ORMA + CRIZAL 2x1</em> a $1.312.246) y PHYSIO (ej. <em>PHYSIO - ORMA + CRIZAL 2x1</em> a $1.559.491) en sus distintas variantes (Airwear, Stylis, Transitions, Xperio) con <strong style="color: #ffffff;">precios súper competitivos</strong>.</li>
        </ul>
      </li>
    </ul>

    <div style="${styles.sectionTitle}">🛡️ 2. Protección contra "Fuera de Rango" en Recetas</div>
    <p style="${styles.intro}">
      Para evitar errores en la venta, el sistema ahora valida los rangos de fabricación permitidos para cada cristal (esferas y cilindros máximos/mínimos). 
      Si ingresas una graduación que supera los límites técnicos (ej. miopía de -12.00 en un cristal que llega a -10.00), <strong style="color: #ffffff;">aparecerá una alerta en la pantalla</strong> como un "salvavidas" para el vendedor.
    </p>

    <div style="${styles.sectionTitle}">🎁 3. Bonificación Inteligente de Armazones en Promos 2x1</div>
    <p style="${styles.intro}">
      El sistema identifica automáticamente cualquier cristal marcado con la condición de <strong>2x1</strong> en el catálogo. Al aplicar el 2x1, la bonificación del segundo armazón ya se encuentra <strong style="color: #ffffff;">100% activa</strong> y funciona así:
    </p>
    <ul style="${styles.bulletList}">
      <li style="${styles.listItem}"><strong style="color: #ffffff;">Si el cliente elige un armazón de nuestra marca Atelier:</strong> El segundo armazón queda completamente bonificado (<strong style="color: #ffffff;">$0 / Gratis</strong>).</li>
      <li style="${styles.listItem}"><strong style="color: #ffffff;">Si el cliente elige un armazón de otra marca:</strong> El sistema bonifica únicamente el monto equivalente al <strong style="color: #ffffff;">precio promedio de un armazón Atelier</strong>, descontando ese tope del total de la venta.</li>
    </ul>

    <div style="${styles.sectionTitle}">⚙️ 4. Tareas Automáticas al Cambiar de Estado</div>
    <p style="${styles.intro}">
      El CRM ahora automatiza la creación de tareas operativas y el flujo post-venta: al pasar un pedido al estado <strong>DELIVERED (Entregado)</strong>, el sistema crea automáticamente una tarea de seguimiento en la ficha del contacto: <strong style="color: #ffffff;">"Solicitar comentario a [Nombre del Cliente]"</strong> para verificar la conformidad y solicitar una reseña.
    </p>

    <div style="${styles.sectionTitle}">💡 5. Actualización de Estados mediante Copilot</div>
    <p style="${styles.intro}">
      <strong style="color: #ffffff;">¿Qué es el Copilot?</strong> Es el asistente inteligente del CRM integrado directamente en el chat/WhatsApp para ayudarte a hacer consultas rápidas (saldos, stock, recetas) y actualizar información usando lenguaje natural.<br><br>
      Ahora podés pedirle al Copilot directamente que avance el estado de un pedido:
    </p>
    <ul style="${styles.bulletList}">
      <li style="${styles.listItem}"><strong style="color: #ffffff;">Ejemplo de uso:</strong> Podés escribirle: <em>"El pedido de Juan Pérez ya está listo"</em> o <em>"Actualizá el pedido de María a Listo para retirar"</em>.</li>
      <li style="${styles.listItem}">El Copilot buscará la venta, la actualizará y, al pasar a <strong>READY (Listo para retirar)</strong>, <strong style="color: #ffffff;">disparará automáticamente un mensaje por WhatsApp al cliente</strong> avisándole del retiro e indicándole si tiene saldo pendiente de cobro.</li>
    </ul>

    <div style="${styles.sectionTitle}">💬 6. Bot Agente de Ventas Automático (Fase 2)</div>
    <p style="${styles.intro}">
      Te adelantamos que el <strong style="color: #ffffff;">Bot Agente de Ventas de WhatsApp</strong> ya está completamente actualizado con su Fase 2:
    </p>
    <ul style="${styles.bulletList}">
      <li style="${styles.listItem}"><strong style="color: #ffffff;">Resumen de Handoff automático:</strong> Al pausar el bot para atención humana, este genera un resumen automático en 2 líneas de los puntos críticos conversados.</li>
      <li style="${styles.listItem}"><strong style="color: #ffffff;">Detección inteligente de tickets de pago:</strong> Detecta cuando el cliente envía una foto de un comprobante y lo etiqueta automáticamente.</li>
      <li style="${styles.listItem}"><strong style="color: #ffffff;">Control de horario comercial mejorado:</strong> Fuera de horario avisa al cliente una sola vez y apaga el bot para no importunar.</li>
    </ul>

    <div style="${styles.divider}"></div>

    <div style="${styles.footer}">
      <p style="color: #c2a38a; margin: 0;">José Luis de Tejeda 4380, Cerro de las Rosas<br>Córdoba, Argentina</p>
    </div>
  </div>
</body>
</html>
`;

async function send() {
    const chartConfig = {
      type: 'pie',
      data: {
        labels: ['Multifocales (74.5%)', 'Monofocales (25.5%)'],
        datasets: [{
          data: [5297000, 1813408],
          backgroundColor: ['#ffd700', '#c2a38a'],
          borderColor: '#151210',
          borderWidth: 3
        }]
      },
      options: {
        plugins: {
          legend: {
            display: true,
            position: 'bottom',
            labels: {
              color: '#ffffff',
              font: {
                size: 14,
                family: 'Georgia, serif'
              },
              boxWidth: 15,
              padding: 15
            }
          },
          datalabels: {
            color: '#151210',
            font: {
              weight: 'bold',
              size: 15
            }
          }
        }
      }
    };

    const chartUrl = `https://quickchart.io/chart?width=500&height=320&bkg=151210&c=${encodeURIComponent(JSON.stringify(chartConfig))}`;
    const chartPath = path.join(__dirname, 'sales-pie.png');
    
    console.log("Downloading sales pie chart from QuickChart...");
    try {
        const response = await axios({
            url: chartUrl,
            method: 'GET',
            responseType: 'stream'
        });
        const writer = fs.createWriteStream(chartPath);
        response.data.pipe(writer);
        await new Promise((resolve, reject) => {
            writer.on('finish', resolve);
            writer.on('error', reject);
        });
        console.log("Chart downloaded successfully to:", chartPath);
    } catch (err) {
        console.error("Failed to download chart, sending email without it:", err.message);
    }

    console.log(`Setting up SMTP transporter for ${process.env.SMTP_USER}...`);
    const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT || '465'),
        secure: process.env.SMTP_SECURE === 'true' || process.env.SMTP_PORT === '465',
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
        },
    });

    const attachments = [];
    if (fs.existsSync(chartPath)) {
        attachments.push({
            filename: 'sales-pie.png',
            path: chartPath,
            cid: 'salespiechart'
        });
    }

    console.log(`Sending email to ${toEmails.join(', ')}...`);
    try {
        const info = await transporter.sendMail({
            from: `"Atelier Óptica" <${process.env.SMTP_USER}>`,
            to: toEmails.join(','),
            subject: '📋 Resumen de Avances y Ventas CRM (Mayo 2026)',
            html: htmlContent,
            attachments: attachments
        });
        console.log('Email sent successfully! MessageId:', info.messageId);
        
        // Limpieza del archivo temporal
        try {
            fs.unlinkSync(chartPath);
            console.log("🗑️ Temp chart image deleted.");
        } catch (e) { /* ignore */ }

    } catch (error) {
        console.error('Failed to send email:', error);
    }
}

send();
