const path = require('path');
const fs = require('fs');

// Load environment variables from the project's .env file
const projectEnv = path.resolve(__dirname, '../../.env');
if (fs.existsSync(projectEnv)) {
    fs.readFileSync(projectEnv, 'utf8').split('\n').forEach(line => {
        const [key, ...vals] = line.split('=');
        if (key && !key.startsWith('#') && vals.length) {
            process.env[key.trim()] = vals.join('=').trim().replace(/^["']|["']$/g, '');
        }
    });
}

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
    datasources: { db: { url: process.env.DATABASE_URL } }
});

const nodemailer = require('nodemailer');

function buildConicGradient(data, colors) {
    if (!data.length) return 'conic-gradient(#ccc 0% 100%)';
    let cumulative = 0;
    const stops = [];
    data.forEach((item, i) => {
        const start = cumulative;
        cumulative += item.pct;
        stops.push(`${colors[i % colors.length]} ${start}% ${cumulative}%`);
    });
    // Ensure it adds up to 100%
    if (cumulative < 100 && stops.length) {
        const lastStop = stops[stops.length - 1];
        stops[stops.length - 1] = lastStop.substring(0, lastStop.lastIndexOf(' ')) + ' 100%';
    }
    return `conic-gradient(${stops.join(', ')})`;
}

function buildLegend(data, colors) {
    if (!data.length) return '<tr><td style="padding:4px; font-size:12px; color:#999;">Sin datos</td></tr>';
    return data.map((item, i) => `
        <tr>
            <td style="padding:4px 8px 4px 0;">
                <div style="width:12px; height:12px; border-radius:3px; background:${colors[i % colors.length]}; display:inline-block;"></div>
            </td>
            <td style="padding:4px 6px; font-size:12px; color:#555;">${item.label}</td>
            <td style="padding:4px 6px; font-size:13px; font-weight:700; color:#333; text-align:right;">${item.pct}%</td>
            <td style="padding:4px 6px; font-size:11px; color:#888;">(${item.count})</td>
        </tr>
    `).join('');
}

async function sendReport() {
    console.log('Fetching database statistics for June 2026...');
    const startDate = new Date('2026-06-01T00:00:00Z');
    const endDate = new Date('2026-07-01T00:00:00Z');

    // 1. Query all orders of June 2026
    const orders = await prisma.order.findMany({
        where: {
            createdAt: { gte: startDate, lt: endDate },
            isDeleted: false
        },
        select: {
            id: true,
            createdAt: true,
            orderType: true,
            total: true
        }
    });

    console.log(`Found ${orders.length} total orders in June 2026.`);

    // Initialize weeks
    const weeks = [
        { label: 'Semana 1', dates: '1 - 7 Jun', start: new Date('2026-06-01T00:00:00Z'), end: new Date('2026-06-08T00:00:00Z'), ventas: 0, cotizaciones: 0, chats: 0 },
        { label: 'Semana 2', dates: '8 - 14 Jun', start: new Date('2026-06-08T00:00:00Z'), end: new Date('2026-06-15T00:00:00Z'), ventas: 0, cotizaciones: 0, chats: 0 },
        { label: 'Semana 3', dates: '15 - 21 Jun', start: new Date('2026-06-15T00:00:00Z'), end: new Date('2026-06-22T00:00:00Z'), ventas: 0, cotizaciones: 0, chats: 0 },
        { label: 'Semana 4', dates: '22 - 30 Jun', start: new Date('2026-06-22T00:00:00Z'), end: new Date('2026-07-01T00:00:00Z'), ventas: 0, cotizaciones: 0, chats: 0 }
    ];

    for (const o of orders) {
        const day = o.createdAt.getDate();
        let weekIndex = 3;
        if (day <= 7) weekIndex = 0;
        else if (day <= 14) weekIndex = 1;
        else if (day <= 21) weekIndex = 2;

        if (o.orderType === 'SALE') {
            weeks[weekIndex].ventas++;
        } else if (o.orderType === 'QUOTE') {
            weeks[weekIndex].cotizaciones++;
        }
    }

    // Query chats count per week
    for (const w of weeks) {
        w.chats = await prisma.whatsAppChat.count({
            where: { createdAt: { gte: w.start, lt: w.end } }
        });
    }

    const totalVentas = weeks.reduce((a, w) => a + w.ventas, 0);
    const totalCotiz = weeks.reduce((a, w) => a + w.cotizaciones, 0);
    const totalChats = weeks.reduce((a, w) => a + w.chats, 0);
    const maxVentas = Math.max(...weeks.map(w => w.ventas), 1);

    weeks.forEach(w => {
        w.pctVentas = totalVentas > 0 ? Math.round(w.ventas / totalVentas * 100) : 0;
        w.pctCotiz = totalCotiz > 0 ? Math.round(w.cotizaciones / totalCotiz * 100) : 0;
    });

    const conversionRate = Math.round(totalVentas / (totalVentas + totalCotiz) * 100);

    // 2. Product breakdown (Sales only)
    const orderItems = await prisma.orderItem.findMany({
        where: {
            order: {
                createdAt: { gte: startDate, lt: endDate },
                orderType: 'SALE',
                isDeleted: false
            }
        },
        include: { product: true }
    });

    const productMap = {};
    for (const item of orderItems) {
        let type = item.product?.type || 'Otros';
        // Simplify product types
        if (type.toLowerCase().includes('multifocal')) type = 'Multifocal';
        else if (type.toLowerCase().includes('monofocal')) type = 'Monofocal';
        else if (type.toLowerCase().includes('bifocal')) type = 'Bifocal';
        else if (type.toLowerCase().includes('sol')) type = 'Lentes de Sol';
        else if (type.toLowerCase().includes('armazón') || type.toLowerCase().includes('armazon')) type = 'Armazón de Receta';
        else type = 'Otros';

        productMap[type] = (productMap[type] || 0) + item.quantity;
    }

    const productTypes = Object.entries(productMap).map(([label, count]) => ({ label, count }));
    const totalProducts = productTypes.reduce((a, p) => a + p.count, 0);
    productTypes.forEach(p => p.pct = totalProducts > 0 ? Math.round(p.count / totalProducts * 100) : 0);
    productTypes.sort((a, b) => b.count - a.count);

    const prodColors = ['#4CAF50', '#2196F3', '#FF9800', '#9C27B0', '#E91E63', '#78909C'];

    // 3. Client tag breakdown for clients with June orders
    const clientsWithJuneOrders = await prisma.client.findMany({
        where: {
            orders: {
                some: {
                    createdAt: { gte: startDate, lt: endDate },
                    isDeleted: false
                }
            }
        },
        include: { tags: true }
    });

    const tagCountsMap = {};
    for (const c of clientsWithJuneOrders) {
        for (const t of c.tags) {
            tagCountsMap[t.name] = (tagCountsMap[t.name] || 0) + 1;
        }
    }

    const tagData = Object.entries(tagCountsMap).map(([label, count]) => ({ label, count }));
    const totalTags = tagData.reduce((a, t) => a + t.count, 0);
    tagData.forEach(t => t.pct = totalTags > 0 ? Math.round(t.count / totalTags * 100) : 0);
    tagData.sort((a, b) => b.count - a.count);

    const tagColors = ['#1565C0', '#E91E63', '#4CAF50', '#FF9800', '#9C27B0', '#00BCD4', '#795548', '#607D8B', '#F44336', '#CDDC39'];

    // 4. Query May 2026 Sales
    const maySalesCount = await prisma.order.count({
        where: {
            createdAt: { gte: new Date('2026-05-01T00:00:00Z'), lt: new Date('2026-06-01T00:00:00Z') },
            orderType: 'SALE',
            isDeleted: false
        }
    });

    console.log(`May Sales: ${maySalesCount}. June Sales: ${totalVentas}.`);

    // ── Gráfico barras ventas (porcentaje) ──
    const ventasBars = weeks.map((w, i) => {
        const pct = Math.max((w.ventas / maxVentas) * 100, 5);
        const color = w.ventas >= 20 ? '#4CAF50' : (w.ventas >= 10 ? '#2196F3' : (w.ventas > 0 ? '#FF9800' : '#E53935'));
        return `
        <td style="vertical-align:bottom; text-align:center; padding:0 6px; width:25%;">
            <div style="font-size:13px; font-weight:700; color:${color}; margin-bottom:2px;">${w.pctVentas}%</div>
            <div style="font-size:11px; color:#888; margin-bottom:4px;">${w.ventas} ventas</div>
            <div style="background:${color}; width:52px; height:${Math.round(pct * 1.5)}px; margin:0 auto; border-radius:6px 6px 0 0; opacity:0.85;"></div>
            <div style="background:#f8f8f8; padding:6px 4px; border-radius:0 0 6px 6px; margin-top:2px;">
                <div style="font-weight:600; font-size:11px; color:#333;">${w.label}</div>
                <div style="font-size:10px; color:#999;">${w.dates}</div>
            </div>
        </td>`;
    }).join('');

    // ── Gráfico barras cotizaciones (porcentaje) ──
    const maxCotiz = Math.max(...weeks.map(w => w.cotizaciones), 1);
    const cotizBars = weeks.map((w, i) => {
        const pct = Math.max((w.cotizaciones / maxCotiz) * 100, 5);
        return `
        <td style="vertical-align:bottom; text-align:center; padding:0 6px; width:25%;">
            <div style="font-size:13px; font-weight:700; color:#9C27B0; margin-bottom:2px;">${w.pctCotiz}%</div>
            <div style="font-size:11px; color:#888; margin-bottom:4px;">${w.cotizaciones}</div>
            <div style="background:#9C27B0; width:52px; height:${Math.round(pct * 1.2)}px; margin:0 auto; border-radius:6px 6px 0 0; opacity:0.75;"></div>
            <div style="font-size:10px; color:#999; margin-top:6px;">${w.label}</div>
        </td>`;
    }).join('');

    // ── Pie charts (CSS conic-gradient) ──
    const prodGradient = buildConicGradient(productTypes, prodColors);
    const tagGradient = buildConicGradient(tagData, tagColors);

    const html = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="margin:0; padding:0; font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif; background:#f0f2f5;">
        <div style="max-width:700px; margin:0 auto; background:#ffffff;">
            
            <!-- Header -->
            <div style="background:linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%); padding:40px 32px; text-align:center;">
                <h1 style="color:#ffffff; margin:0; font-size:28px; font-weight:300; letter-spacing:2px;">ATELIER ÓPTICA</h1>
                <div style="width:50px; height:2px; background:#e94560; margin:14px auto;"></div>
                <h2 style="color:#e0e0e0; margin:10px 0 0; font-size:18px; font-weight:400;">Reporte Comercial — Junio 2026</h2>
                <p style="color:#aaa; margin:6px 0 0; font-size:12px;">Corte al 20 de Junio | Datos de producción reales</p>
            </div>

            <!-- KPIs -->
            <div style="padding:28px 24px 12px;">
                <table width="100%" cellpadding="0" cellspacing="8">
                    <tr>
                        <td style="text-align:center; width:25%;">
                            <div style="background:#f8f9fa; border-radius:12px; padding:18px 10px; border-left:4px solid #4CAF50;">
                                <div style="font-size:30px; font-weight:700; color:#333;">${totalVentas}</div>
                                <div style="font-size:11px; color:#888; margin-top:2px;">Ventas</div>
                            </div>
                        </td>
                        <td style="text-align:center; width:25%;">
                            <div style="background:#f8f9fa; border-radius:12px; padding:18px 10px; border-left:4px solid #9C27B0;">
                                <div style="font-size:30px; font-weight:700; color:#333;">${totalCotiz}</div>
                                <div style="font-size:11px; color:#888; margin-top:2px;">Cotizaciones</div>
                            </div>
                        </td>
                        <td style="text-align:center; width:25%;">
                            <div style="background:#f8f9fa; border-radius:12px; padding:18px 10px; border-left:4px solid #2196F3;">
                                <div style="font-size:30px; font-weight:700; color:#333;">${totalChats}</div>
                                <div style="font-size:11px; color:#888; margin-top:2px;">Chats WA</div>
                            </div>
                        </td>
                        <td style="text-align:center; width:25%;">
                            <div style="background:#f8f9fa; border-radius:12px; padding:18px 10px; border-left:4px solid #FF9800;">
                                <div style="font-size:30px; font-weight:700; color:#333;">${conversionRate}%</div>
                                <div style="font-size:11px; color:#888; margin-top:2px;">Conversión</div>
                            </div>
                        </td>
                    </tr>
                </table>
            </div>

            <!-- Gráficos de barras -->
            <div style="padding:16px 32px;">
                <table width="100%" cellpadding="0" cellspacing="16">
                    <tr>
                        <td style="width:50%; vertical-align:top;">
                            <h3 style="color:#333; font-size:14px; margin:0 0 12px; border-bottom:2px solid #f0f0f0; padding-bottom:6px;">📈 Ventas por Semana</h3>
                            <table width="100%" cellpadding="0" cellspacing="0">
                                <tr style="height:170px;">${ventasBars}</tr>
                            </table>
                        </td>
                        <td style="width:50%; vertical-align:top;">
                            <h3 style="color:#333; font-size:14px; margin:0 0 12px; border-bottom:2px solid #f0f0f0; padding-bottom:6px;">💬 Cotizaciones por Semana</h3>
                            <table width="100%" cellpadding="0" cellspacing="0">
                                <tr style="height:170px;">${cotizBars}</tr>
                            </table>
                        </td>
                    </tr>
                </table>
            </div>

            <!-- Análisis -->
            <div style="padding:8px 32px 16px;">
                <div style="background:linear-gradient(135deg, #e8f5e9, #f1f8e9); border-radius:12px; padding:18px 20px; border-left:4px solid #4CAF50; margin-bottom:10px;">
                    <h3 style="color:#2e7d32; margin:0 0 6px; font-size:13px;">🏆 Semana 2: Récord del Mes</h3>
                    <p style="color:#555; margin:0; font-size:12px; line-height:1.5;">
                        Concentró el <b>${weeks[1].pctVentas}% de las ventas</b> y el <b>${weeks[1].pctCotiz}% de las cotizaciones</b> del mes. Fue la semana con mayor actividad comercial.
                    </p>
                </div>
                <div style="background:linear-gradient(135deg, #fff3e0, #fff8e1); border-radius:12px; padding:18px 20px; border-left:4px solid #FF9800;">
                    <h3 style="color:#e65100; margin:0 0 6px; font-size:13px;">⚠️ Semana 3: Caída posterior</h3>
                    <p style="color:#555; margin:0; font-size:12px; line-height:1.5;">
                        Las ventas bajaron a <b>${weeks[2].ventas} (${weeks[2].pctVentas}% del total)</b>, aunque las cotizaciones se mantuvieron altas (${weeks[2].pctCotiz}%). La tasa de cierre bajó en esta semana respecto a la semana récord.
                    </p>
                </div>
            </div>

            <!-- SEPARADOR -->
            <div style="padding:0 32px;"><hr style="border:none; border-top:2px solid #f0f0f0; margin:16px 0;"></div>

            <!-- PIE CHART: Tipos de Producto -->
            <div style="padding:16px 32px;">
                <h3 style="color:#333; font-size:16px; margin:0 0 20px; border-bottom:2px solid #f0f0f0; padding-bottom:8px;">
                    🥧 Distribución por Tipo de Producto
                </h3>
                <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                        <td style="width:45%; text-align:center; vertical-align:middle;">
                            <div style="width:180px; height:180px; border-radius:50%; background:${prodGradient}; margin:0 auto; box-shadow:0 4px 12px rgba(0,0,0,0.1);"></div>
                        </td>
                        <td style="width:55%; vertical-align:middle; padding-left:16px;">
                            <table cellpadding="0" cellspacing="0">${buildLegend(productTypes, prodColors)}</table>
                        </td>
                    </tr>
                </table>
                <p style="font-size:11px; color:#999; text-align:center; margin:12px 0 0;">Total: ${totalProducts} productos vendidos</p>
            </div>

            <!-- SEPARADOR -->
            <div style="padding:0 32px;"><hr style="border:none; border-top:2px solid #f0f0f0; margin:16px 0;"></div>

            <!-- PIE CHART: Etiquetas -->
            <div style="padding:16px 32px;">
                <h3 style="color:#333; font-size:16px; margin:0 0 20px; border-bottom:2px solid #f0f0f0; padding-bottom:8px;">
                    🏷️ Distribución por Etiquetas de Cliente
                </h3>
                <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                        <td style="width:45%; text-align:center; vertical-align:middle;">
                            <div style="width:180px; height:180px; border-radius:50%; background:${tagGradient}; margin:0 auto; box-shadow:0 4px 12px rgba(0,0,0,0.1);"></div>
                        </td>
                        <td style="width:55%; vertical-align:middle; padding-left:16px;">
                            <table cellpadding="0" cellspacing="0">${buildLegend(tagData.slice(0, 10), tagColors)}</table>
                        </td>
                    </tr>
                </table>
                <p style="font-size:11px; color:#999; text-align:center; margin:12px 0 0;">Total: ${totalTags} etiquetas asignadas a clientes con órdenes en junio</p>
            </div>

            <!-- Tabla resumen -->
            <div style="padding:16px 32px;">
                <h3 style="color:#333; font-size:15px; margin:0 0 12px; border-bottom:2px solid #f0f0f0; padding-bottom:8px;">📋 Resumen Semanal</h3>
                <table width="100%" cellpadding="0" cellspacing="0" style="border-radius:8px; overflow:hidden; border:1px solid #e0e0e0;">
                    <thead>
                        <tr style="background:#1a1a2e;">
                            <th style="padding:10px 12px; color:#fff; text-align:left; font-size:11px;">Semana</th>
                            <th style="padding:10px 8px; color:#fff; text-align:center; font-size:11px;">Ventas</th>
                            <th style="padding:10px 8px; color:#fff; text-align:center; font-size:11px;">% Ventas</th>
                            <th style="padding:10px 8px; color:#fff; text-align:center; font-size:11px;">Cotiz.</th>
                            <th style="padding:10px 8px; color:#fff; text-align:center; font-size:11px;">% Cotiz.</th>
                            <th style="padding:10px 8px; color:#fff; text-align:center; font-size:11px;">Chats</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${weeks.map((w, i) => {
                            const bg = i % 2 === 0 ? '#fafafa' : '#fff';
                            const badge = w.ventas >= 20 ? '🟢' : (w.ventas >= 10 ? '🔵' : (w.ventas > 0 ? '🟡' : '🔴'));
                            return `<tr style="background:${bg};">
                                <td style="padding:10px 12px; font-weight:600; font-size:12px;">${badge} ${w.label}<br><span style="font-size:10px; color:#999; font-weight:400;">${w.dates}</span></td>
                                <td style="padding:10px 8px; text-align:center; font-weight:600;">${w.ventas}</td>
                                <td style="padding:10px 8px; text-align:center; font-weight:700; color:#333;">${w.pctVentas}%</td>
                                <td style="padding:10px 8px; text-align:center;">${w.cotizaciones}</td>
                                <td style="padding:10px 8px; text-align:center; font-weight:700; color:#9C27B0;">${w.pctCotiz}%</td>
                                <td style="padding:10px 8px; text-align:center;">${w.chats}</td>
                            </tr>`;
                        }).join('')}
                        <tr style="background:#e8f5e9;">
                            <td style="padding:10px 12px; font-weight:700; color:#2e7d32;">TOTAL</td>
                            <td style="padding:10px 8px; text-align:center; font-weight:700; color:#2e7d32;">${totalVentas}</td>
                            <td style="padding:10px 8px; text-align:center; font-weight:700; color:#2e7d32;">100%</td>
                            <td style="padding:10px 8px; text-align:center; font-weight:700; color:#2e7d32;">${totalCotiz}</td>
                            <td style="padding:10px 8px; text-align:center; font-weight:700; color:#2e7d32;">100%</td>
                            <td style="padding:10px 8px; text-align:center; font-weight:700; color:#2e7d32;">${totalChats}</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <!-- Comparación vs Mayo -->
            <div style="padding:12px 32px 28px;">
                <div style="background:#fff3e0; border-radius:10px; padding:16px; text-align:center;">
                    <div style="font-size:11px; color:#888;">vs. Mayo 2026</div>
                    <div style="font-size:15px; font-weight:700; color:#e65100; margin:6px 0;">Mayo: ${maySalesCount} ventas totales → Junio: ${totalVentas} ventas al día 20</div>
                    <div style="font-size:12px; color:#4CAF50; font-weight:600;">
                        ${totalVentas > maySalesCount 
                            ? `📈 +${Math.round(((totalVentas - maySalesCount) / maySalesCount) * 100)}% sobre mayo con 10 días restantes`
                            : `📉 ${Math.round(((totalVentas - maySalesCount) / maySalesCount) * 100)}% respecto a mayo con 10 días restantes`
                        }
                    </div>
                </div>
            </div>

            <!-- Footer -->
            <div style="background:#1a1a2e; padding:24px 32px; text-align:center;">
                <p style="color:#aaa; font-size:12px; margin:0;">Atelier Óptica — Sistema CRM</p>
                <p style="color:#666; font-size:10px; margin:6px 0 0;">Reporte generado automáticamente con datos reales | 20 Jun 2026</p>
            </div>
        </div>
    </body>
    </html>`;

    const smtpUser = process.env.SMTP_USER || process.env.EMAIL_USER;
    const smtpPass = process.env.SMTP_PASS || process.env.EMAIL_PASS;

    if (!smtpUser || !smtpPass) {
        throw new Error('No se configuraron las credenciales de correo (SMTP_USER/EMAIL_USER y SMTP_PASS/EMAIL_PASS).');
    }

    const transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com', port: 465, secure: true,
        auth: { user: smtpUser, pass: smtpPass }
    });

    const info = await transporter.sendMail({
        from: `"Atelier CRM" <${smtpUser}>`,
        to: 'pisano.ishtar@gmail.com',
        subject: '📊 Reporte Comercial Junio 2026 (sin montos) | Atelier Óptica',
        html: html
    });

    console.log('✅ Email enviado exitosamente:', info.messageId);
}

sendReport()
    .catch(e => { console.error('❌ Error:', e.message); process.exit(1); })
    .finally(() => prisma.$disconnect());
