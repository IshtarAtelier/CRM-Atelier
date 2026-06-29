import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getFileBuffer } from '@/lib/storage';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

export const dynamic = 'force-dynamic';

async function getProductImageData(imageKeyOrPath: string | null | undefined) {
  if (!imageKeyOrPath) return null;
  try {
    let buffer: Buffer | null = null;
    if (imageKeyOrPath.startsWith('/assets/') || imageKeyOrPath.startsWith('/images/')) {
      const fullPath = path.join(process.cwd(), 'public', imageKeyOrPath.trim());
      if (fs.existsSync(fullPath)) {
        buffer = fs.readFileSync(fullPath);
      }
    } else {
      buffer = await getFileBuffer(imageKeyOrPath);
    }

    if (!buffer) return null;

    const metadata = await sharp(buffer).metadata();
    const width = metadata.width || 400;
    const height = metadata.height || 300;
    const aspectRatio = width / height;

    const pngBuffer = await sharp(buffer)
      .resize({ width: 600, height: 450, fit: 'inside' })
      .png()
      .toBuffer();
    
    return {
      base64: `data:image/png;base64,${pngBuffer.toString('base64')}`,
      aspectRatio
    };
  } catch (e) {
    console.error('Error resolving image for PDF:', e);
    return null;
  }
}

async function getEditorialImageData(imagePath: string) {
  if (!fs.existsSync(imagePath)) return null;
  try {
    const buffer = fs.readFileSync(imagePath);
    const metadata = await sharp(buffer).metadata();
    const width = metadata.width || 1;
    const height = metadata.height || 1;
    const aspectRatio = width / height;
    
    // Decompress and format editorial banners to high quality JPEGs
    const compressed = await sharp(buffer)
      .resize({ width: 1200, height: 800, fit: 'cover' })
      .jpeg({ quality: 90 })
      .toBuffer();

    return {
      base64: `data:image/jpeg;base64,${compressed.toString('base64')}`,
      aspectRatio
    };
  } catch (err) {
    console.error('Error loading editorial image:', err);
    return null;
  }
}

export async function GET(req: NextRequest) {
  try {
    const { jsPDF } = await import('jspdf');

    const webProducts = await prisma.webProduct.findMany({
      where: { isActive: true },
      include: { product: true },
      orderBy: [
        { category: 'asc' },
        { name: 'asc' }
      ]
    });

    if (webProducts.length === 0) {
      return new Response('No se encontraron productos activos', { status: 404 });
    }

    // Load actual editorial home image assets
    const monaLisaPath = path.join(process.cwd(), 'public', 'images', 'editorial', 'monalisa.webp');
    const fridaPath = path.join(process.cwd(), 'public', 'images', 'editorial', 'filmmaker-frida.webp');
    const daliPath = path.join(process.cwd(), 'public', 'images', 'editorial', 'filmmaker-dali.webp');

    const monaLisa = await getEditorialImageData(monaLisaPath);
    const frida = await getEditorialImageData(fridaPath);
    const dali = await getEditorialImageData(daliPath);

    // Resolve product images in parallel
    const imagePromises = webProducts.map(async (wp) => {
      const p = wp.product;
      const imgKey = p.imagenesCatalogo?.[0] || wp.imageUrl || null;
      const data = await getProductImageData(imgKey);
      return { id: wp.id, data };
    });
    const resolvedImages = await Promise.all(imagePromises);
    const imageMap = new Map(resolvedImages.map(item => [item.id, item.data]));

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    // ----------------------------------------------------
    // EDITORIAL COVER 1: LA GIOCONDA (PAGE 1)
    // ----------------------------------------------------
    doc.setFillColor(10, 10, 10);
    doc.rect(0, 0, pageWidth, pageHeight, 'F');

    // Edge-to-edge landscape cover image (4:3 aspect ratio card)
    if (monaLisa) {
      // 210mm wide x 140mm high landscape hero card
      doc.addImage(monaLisa.base64, 'JPEG', 0, 0, pageWidth, 140);
    }

    // Top subtle bar overlay (same as home page banner)
    doc.setFillColor(158, 127, 101);
    doc.rect(0, 0, pageWidth, 7, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6);
    doc.text("6 CUOTAS SIN INTERÉS  ·  15% OFF EN EFECTIVO O TRANSFERENCIA  ·  ENVÍO GRATIS", pageWidth / 2, 4.8, { align: 'center', charSpace: 1.2 });

    // Home-like Metadata text
    doc.setTextColor(150, 150, 150);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.text("01 / 05  ·  ATELIER FILMS", 20, 158);

    doc.setTextColor(158, 127, 101);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.text("LEONARDO DA VINCI  ·  S. XVI", 20, 168, { charSpace: 1 });

    doc.setTextColor(255, 255, 255);
    doc.setFont('times', 'bold');
    doc.setFontSize(36);
    doc.text("La Gioconda", 20, 182);

    doc.setTextColor(158, 127, 101);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text("COLECCIÓN OPTICAL  ·  EDICIÓN LIMITADA", 20, 192, { charSpace: 1.5 });

    doc.setTextColor(180, 180, 180);
    doc.setFont('times', 'italic');
    doc.setFontSize(10.5);
    doc.text("Diseño de autor en 6 cuotas sin interés y envío gratis a todo el país.", 20, 202);

    // Atelier Optica logo at the bottom
    doc.setTextColor(245, 245, 245);
    doc.setFont('times', 'bold');
    doc.setFontSize(16);
    doc.text("ATELIER ÓPTICA", pageWidth / 2, 250, { align: 'center', charSpace: 2 });

    doc.setTextColor(120, 120, 120);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.text("CATÁLOGO OFICIAL 2025  ·  CÓRDOBA", pageWidth / 2, 258, { align: 'center', charSpace: 1 });

    // ----------------------------------------------------
    // EDITORIAL COVER 2: LA FRIDA (PAGE 2)
    // ----------------------------------------------------
    doc.addPage();
    doc.setFillColor(10, 10, 10);
    doc.rect(0, 0, pageWidth, pageHeight, 'F');

    if (frida) {
      doc.addImage(frida.base64, 'JPEG', 0, 0, pageWidth, 140);
    }

    // Top gold banner
    doc.setFillColor(158, 127, 101);
    doc.rect(0, 0, pageWidth, 7, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6);
    doc.text("6 CUOTAS SIN INTERÉS  ·  15% OFF EN EFECTIVO O TRANSFERENCIA  ·  ENVÍO GRATIS", pageWidth / 2, 4.8, { align: 'center', charSpace: 1.2 });

    // Frida Metadata
    doc.setTextColor(150, 150, 150);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.text("02 / 05  ·  ATELIER FILMS", 20, 158);

    doc.setTextColor(158, 127, 101);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.text("FRIDA KAHLO  ·  S. XX", 20, 168, { charSpace: 1 });

    doc.setTextColor(255, 255, 255);
    doc.setFont('times', 'bold');
    doc.setFontSize(36);
    doc.text("La Frida", 20, 182);

    doc.setTextColor(158, 127, 101);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text("COLECCIÓN ACETATO  ·  EDICIÓN LIMITADA", 20, 192, { charSpace: 1.5 });

    doc.setTextColor(180, 180, 180);
    doc.setFont('times', 'italic');
    doc.setFontSize(10.5);
    doc.text("Diseño de autor en 6 cuotas sin interés y envío gratis a todo el país.", 20, 202);

    doc.setTextColor(245, 245, 245);
    doc.setFont('times', 'bold');
    doc.setFontSize(16);
    doc.text("ATELIER ÓPTICA", pageWidth / 2, 250, { align: 'center', charSpace: 2 });

    doc.setTextColor(120, 120, 120);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.text("CATÁLOGO OFICIAL 2025  ·  CÓRDOBA", pageWidth / 2, 258, { align: 'center', charSpace: 1 });

    // ----------------------------------------------------
    // INTERNAL PAGES (Clean Minimalist White Style)
    // ----------------------------------------------------
    let currentPage = 2;
    const productsPerPage = 2;

    for (let i = 0; i < webProducts.length; i += productsPerPage) {
      doc.addPage();
      currentPage++;

      // Pure white page background
      doc.setFillColor(255, 255, 255);
      doc.rect(0, 0, pageWidth, pageHeight, 'F');

      // Subtle page header
      doc.setTextColor(120, 120, 120);
      doc.setFont('times', 'bold');
      doc.setFontSize(8);
      doc.text("ATELIER ÓPTICA", pageWidth / 2, 12, { align: 'center', charSpace: 1.5 });
      doc.setDrawColor(240, 240, 240);
      doc.setLineWidth(0.2);
      doc.line(15, 15, pageWidth - 15, 15);

      // Page Footer
      doc.setTextColor(150, 150, 150);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.text(`Página ${currentPage}`, pageWidth / 2, 285, { align: 'center' });

      for (let j = 0; j < productsPerPage; j++) {
        const productIndex = i + j;
        if (productIndex >= webProducts.length) break;

        const wp = webProducts[productIndex];
        const p = wp.product;
        const imgData = imageMap.get(wp.id);

        const isTop = j === 0;
        const startY = isTop ? 20 : 150;

        const imgX = 40;
        const imgY = startY + 8;
        const imgW = 130;
        const imgH = 80;

        if (imgData && imgData.base64) {
          let drawW = imgW;
          let drawH = imgW / imgData.aspectRatio;
          if (drawH > imgH) {
            drawH = imgH;
            drawW = imgH * imgData.aspectRatio;
          }
          const drawX = imgX + (imgW - drawW) / 2;
          const drawY = imgY + (imgH - drawH) / 2;

          doc.addImage(imgData.base64, 'PNG', drawX, drawY, drawW, drawH);
        } else {
          // Placeholder
          doc.setFillColor(250, 250, 250);
          doc.rect(imgX, imgY, imgW, imgH, 'F');
          doc.setDrawColor(235, 235, 235);
          doc.setLineWidth(0.25);
          doc.rect(imgX, imgY, imgW, imgH);
          
          doc.setTextColor(180, 180, 180);
          doc.setFont('times', 'italic');
          doc.setFontSize(10);
          doc.text("Silueta Atelier's", pageWidth / 2, imgY + (imgH / 2), { align: 'center' });
        }

        // Details metadata Y
        const textY = startY + 98;

        const modelStr = p.model || '';
        const parts = modelStr.trim().split(/\s+/);
        const modelCode = parts[0] || 'MODEL';
        const colorCode = parts[1] || '';

        const lw = p.lensWidth ?? 52;
        const bw = p.bridgeWidth ?? 18;
        const tl = p.templeLength ?? 145;
        const measuresStr = `${lw}-${bw}-${tl}`;

        doc.setTextColor(0, 0, 0);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.text(modelCode.toUpperCase(), 40, textY);

        const mWidth = doc.getTextWidth(modelCode.toUpperCase());
        doc.setTextColor(120, 120, 120);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.text(`    ${measuresStr}    ${colorCode.toUpperCase()}`, 40 + mWidth, textY);

        // Render Stock badge
        const stock = p.stock ?? 0;
        doc.setTextColor(34, 139, 34);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.text(`✓ STOCK ${stock}`, 170, startY + 12, { align: 'right' });
      }
    }

    // ----------------------------------------------------
    // BACK COVER PAGE (LAST PAGE) - Dark Gallery Style
    // ----------------------------------------------------
    doc.addPage();
    currentPage++;

    doc.setFillColor(10, 10, 10);
    doc.rect(0, 0, pageWidth, pageHeight, 'F');

    // Salvador Dali image
    if (dali) {
      doc.addImage(dali.base64, 'JPEG', 0, 0, pageWidth, 140);
    }

    // Bottom banner
    doc.setFillColor(158, 127, 101);
    doc.rect(0, 0, pageWidth, 7, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6);
    doc.text("6 CUOTAS SIN INTERÉS  ·  15% OFF EN EFECTIVO O TRANSFERENCIA  ·  ENVÍO GRATIS", pageWidth / 2, 4.8, { align: 'center', charSpace: 1.2 });

    // Back Cover texts matching slide design
    doc.setTextColor(150, 150, 150);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.text("03 / 05  ·  ATELIER FILMS", 20, 158);

    doc.setTextColor(158, 127, 101);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.text("SALVADOR DALÍ  ·  S. XX", 20, 168, { charSpace: 1 });

    doc.setTextColor(255, 255, 255);
    doc.setFont('times', 'bold');
    doc.setFontSize(36);
    doc.text("La Persistencia", 20, 182);

    doc.setTextColor(158, 127, 101);
    doc.setFont('times', 'italic');
    doc.setFontSize(20);
    doc.text("El arte de ver.", 20, 202);

    doc.setTextColor(245, 245, 245);
    doc.setFont('times', 'bold');
    doc.setFontSize(16);
    doc.text("ATELIER ÓPTICA", pageWidth / 2, 250, { align: 'center', charSpace: 2 });

    doc.setTextColor(130, 130, 130);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.text("Cerro de las Rosas, Córdoba   ·   ★ 5.0 Google   ·   atelier-optica.com", pageWidth / 2, 258, { align: 'center', charSpace: 0.5 });

    const pdfOutput = doc.output('arraybuffer');
    const buffer = Buffer.from(pdfOutput);

    return new Response(buffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="catalogo_ateliers.pdf"`,
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    });

  } catch (error: any) {
    console.error('Error generating catalog PDF:', error.message);
    return new Response(`Error generando catálogo PDF: ${error.message}`, { status: 500 });
  }
}
