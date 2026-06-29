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

async function getCoverImageData(imagePath: string) {
  if (!fs.existsSync(imagePath)) return null;
  try {
    const buffer = fs.readFileSync(imagePath);
    const metadata = await sharp(buffer).metadata();
    const width = metadata.width || 1;
    const height = metadata.height || 1;
    const aspectRatio = width / height;
    
    const compressed = await sharp(buffer)
      .resize({ width: 1000, height: 1200, fit: 'inside' })
      .jpeg({ quality: 90 })
      .toBuffer();

    return {
      base64: `data:image/jpeg;base64,${compressed.toString('base64')}`,
      aspectRatio
    };
  } catch (err) {
    console.error('Error loading cover image:', err);
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

    // Load actual home hero webp files directly
    const monaLisaPath = path.join(process.cwd(), 'public', 'images', 'editorial', 'monalisa.webp');
    const daliPath = path.join(process.cwd(), 'public', 'images', 'editorial', 'filmmaker-dali.webp');

    const monaLisa = await getCoverImageData(monaLisaPath);
    const dali = await getCoverImageData(daliPath);

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
    // COVER PAGE (PAGE 1) - Editorial Luxury Dark Style
    // ----------------------------------------------------
    doc.setFillColor(10, 10, 10);
    doc.rect(0, 0, pageWidth, pageHeight, 'F');

    // Top gold banner
    doc.setFillColor(158, 127, 101); // #9e7f65
    doc.rect(0, 0, pageWidth, 8, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.text("6 CUOTAS SIN INTERÉS  ·  15% OFF EN EFECTIVO  ·  ENVÍO GRATIS", pageWidth / 2, 5.5, { align: 'center', charSpace: 1.5 });

    // Header Title
    doc.setTextColor(245, 245, 245);
    doc.setFont('times', 'bold');
    doc.setFontSize(32);
    doc.text("ATELIER ÓPTICA", pageWidth / 2, 42, { align: 'center' });

    // Gold Subtitle
    doc.setTextColor(158, 127, 101);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text("COLECCIÓN ÓPTICA  ·  CATÁLOGO OFICIAL 2025", pageWidth / 2, 50, { align: 'center', charSpace: 1.2 });

    // Tagline
    doc.setTextColor(160, 160, 160);
    doc.setFont('times', 'italic');
    doc.setFontSize(10.5);
    doc.text("Diseño de autor. Edición limitada.", pageWidth / 2, 57, { align: 'center' });

    // Mona Lisa Cover Image
    if (monaLisa) {
      const boxW = 120;
      const boxH = 145;
      const boxX = 45;
      const boxY = 72;

      let drawW = boxW;
      let drawH = boxW / monaLisa.aspectRatio;
      if (drawH > boxH) {
        drawH = boxH;
        drawW = boxH * monaLisa.aspectRatio;
      }
      const drawX = boxX + (boxW - drawW) / 2;
      const drawY = boxY + (boxH - drawH) / 2;

      // Golden border frame
      doc.setDrawColor(158, 127, 101);
      doc.setLineWidth(1.2);
      doc.rect(drawX - 2, drawY - 2, drawW + 4, drawH + 4);
      doc.setLineWidth(0.3);
      doc.rect(drawX - 0.5, drawY - 0.5, drawW + 1, drawH + 1);

      doc.addImage(monaLisa.base64, 'JPEG', drawX, drawY, drawW, drawH);
    }

    doc.setTextColor(140, 140, 140);
    doc.setFont('times', 'italic');
    doc.setFontSize(9);
    doc.text("EL ARTE DE DISEÑAR MIRADAS", pageWidth / 2, 242, { align: 'center' });

    doc.setTextColor(100, 100, 100);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.text("CÓRDOBA, ARGENTINA", pageWidth / 2, 275, { align: 'center', charSpace: 1 });

    // ----------------------------------------------------
    // INTERNAL PAGES (Clean Minimalist White Style)
    // ----------------------------------------------------
    let currentPage = 1;
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
      const boxW = 120;
      const boxH = 145;
      const boxX = 45;
      const boxY = 48;

      let drawW = boxW;
      let drawH = boxW / dali.aspectRatio;
      if (drawH > boxH) {
        drawH = boxH;
        drawW = boxH * dali.aspectRatio;
      }
      const drawX = boxX + (boxW - drawW) / 2;
      const drawY = boxY + (boxH - drawH) / 2;

      // Golden frame
      doc.setDrawColor(158, 127, 101);
      doc.setLineWidth(1.2);
      doc.rect(drawX - 2, drawY - 2, drawW + 4, drawH + 4);
      doc.setLineWidth(0.3);
      doc.rect(drawX - 0.5, drawY - 0.5, drawW + 1, drawH + 1);

      doc.addImage(dali.base64, 'JPEG', drawX, drawY, drawW, drawH);
    }

    // Back cover text
    doc.setTextColor(158, 127, 101);
    doc.setFont('times', 'italic');
    doc.setFontSize(22);
    doc.text("El arte de ver.", pageWidth / 2, 218, { align: 'center' });

    doc.setTextColor(245, 245, 245);
    doc.setFont('times', 'bold');
    doc.setFontSize(13);
    doc.text("ATELIER ÓPTICA", pageWidth / 2, 228, { align: 'center', charSpace: 1.5 });

    doc.setTextColor(130, 130, 130);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.text("Cerro de las Rosas, Córdoba   ·   ★ 5.0 Google   ·   atelier-optica.com", pageWidth / 2, 236, { align: 'center', charSpace: 0.5 });

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
