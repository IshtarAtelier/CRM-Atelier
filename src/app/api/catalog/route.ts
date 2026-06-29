import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getFileBuffer } from '@/lib/storage';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

export const dynamic = 'force-dynamic';

async function getProductImageBase64(imageKeyOrPath: string | null | undefined): Promise<string | null> {
  if (!imageKeyOrPath) return null;
  try {
    let buffer: Buffer | null = null;
    
    // Resolve public assets vs storage uploads
    if (imageKeyOrPath.startsWith('/assets/') || imageKeyOrPath.startsWith('/images/')) {
      const fullPath = path.join(process.cwd(), 'public', imageKeyOrPath.trim());
      if (fs.existsSync(fullPath)) {
        buffer = fs.readFileSync(fullPath);
      }
    } else {
      buffer = await getFileBuffer(imageKeyOrPath);
    }

    if (!buffer) return null;

    // Convert file (like .avif) to PDF-compatible PNG and compress it using sharp
    const pngBuffer = await sharp(buffer)
      .resize({ width: 400, height: 300, fit: 'inside' })
      .png()
      .toBuffer();
    
    return `data:image/png;base64,${pngBuffer.toString('base64')}`;
  } catch (e) {
    console.error('Error resolving image for PDF:', e);
    return null;
  }
}

export async function GET(req: NextRequest) {
  try {
    const { jsPDF } = await import('jspdf');

    // Fetch active products
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

    // Load cover images (Mona Lisa and Dali)
    const monaLisaPath = path.join(process.cwd(), 'public', 'images', 'mona_lisa_catalog.jpg');
    const daliPath = path.join(process.cwd(), 'public', 'images', 'dali_catalog.jpg');

    let monaLisaBase64 = '';
    let daliBase64 = '';

    try {
      if (fs.existsSync(monaLisaPath)) {
        const buf = fs.readFileSync(monaLisaPath);
        monaLisaBase64 = `data:image/jpeg;base64,${buf.toString('base64')}`;
      }
      if (fs.existsSync(daliPath)) {
        const buf = fs.readFileSync(daliPath);
        daliBase64 = `data:image/jpeg;base64,${buf.toString('base64')}`;
      }
    } catch (err) {
      console.error('Error loading cover images:', err);
    }

    // Load all product images in parallel (using batched or concurrent processing)
    const imagePromises = webProducts.map(async (wp) => {
      const p = wp.product;
      const imgKey = p.imagenesCatalogo?.[0] || wp.imageUrl || null;
      const base64 = await getProductImageBase64(imgKey);
      return { id: wp.id, base64 };
    });
    const resolvedImages = await Promise.all(imagePromises);
    const imageMap = new Map(resolvedImages.map(item => [item.id, item.base64]));

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    // ----------------------------------------------------
    // COVER PAGE (PAGE 1)
    // ----------------------------------------------------
    doc.setFillColor(13, 13, 13); // dark background
    doc.rect(0, 0, pageWidth, pageHeight, 'F');

    // Top gold banner
    doc.setFillColor(158, 127, 101); // #9e7f65 (bronze/gold)
    doc.rect(0, 0, pageWidth, 8, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.text("6 CUOTAS SIN INTERÉS  ·  15% OFF EN EFECTIVO  ·  ENVÍO GRATIS", pageWidth / 2, 5.5, { align: 'center', charSpace: 1.5 });

    // Main Header
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

    // Embed Mona Lisa Image
    if (monaLisaBase64) {
      // Draw golden frame
      doc.setDrawColor(158, 127, 101);
      doc.setLineWidth(1.2);
      doc.rect(48, 70, 114, 144);
      doc.setLineWidth(0.3);
      doc.rect(49.5, 71.5, 111, 141);

      // Draw image
      doc.addImage(monaLisaBase64, 'JPEG', 50, 72, 110, 140);
    }

    // Cover Footer
    doc.setTextColor(140, 140, 140);
    doc.setFont('times', 'italic');
    doc.setFontSize(9);
    doc.text("EL ARTE DE DISEÑAR MIRADAS", pageWidth / 2, 242, { align: 'center' });

    doc.setTextColor(100, 100, 100);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.text("CÓRDOBA, ARGENTINA", pageWidth / 2, 275, { align: 'center', charSpace: 1 });

    // ----------------------------------------------------
    // PRODUCT PAGES (2 PRODUCTS PER PAGE)
    // ----------------------------------------------------
    let currentPage = 1;
    const productsPerPage = 2;

    for (let i = 0; i < webProducts.length; i += productsPerPage) {
      doc.addPage();
      currentPage++;

      // Light/Off-white background for products
      doc.setFillColor(250, 249, 246); // warm off-white/cream
      doc.rect(0, 0, pageWidth, pageHeight, 'F');

      // Thin decorative grey borders around the slots
      doc.setDrawColor(230, 228, 222);
      doc.setLineWidth(0.3);
      doc.line(12, 12, pageWidth - 12, 12);
      doc.line(12, 12, 12, pageHeight - 12);
      doc.line(pageWidth - 12, 12, pageWidth - 12, pageHeight - 12);
      doc.line(12, pageHeight - 12, pageWidth - 12, pageHeight - 12);

      // Subtle horizontal divider in the middle
      doc.line(15, 148, pageWidth - 15, 148);

      // Page Header
      doc.setTextColor(150, 150, 150);
      doc.setFont('times', 'italic');
      doc.setFontSize(7.5);
      doc.text("ATELIER ÓPTICA  ·  EDITORIAL COLLECTION", 18, 18);

      // Page Footer
      doc.text(`Página ${currentPage}`, pageWidth - 18, pageHeight - 16, { align: 'right' });

      // Render up to 2 products
      for (let j = 0; j < productsPerPage; j++) {
        const productIndex = i + j;
        if (productIndex >= webProducts.length) break;

        const wp = webProducts[productIndex];
        const p = wp.product;
        const imgBase64 = imageMap.get(wp.id);

        const isTop = j === 0;
        const startY = isTop ? 22 : 152;

        // Image container coordinates
        const imgX = 45;
        const imgY = startY + 5;
        const imgW = 120;
        const imgH = 75;

        // Draw image
        if (imgBase64) {
          doc.setFillColor(255, 255, 255); // draw white background behind the glasses
          doc.rect(imgX, imgY, imgW, imgH, 'F');
          doc.addImage(imgBase64, 'PNG', imgX, imgY, imgW, imgH);
        } else {
          // Placeholder drawing
          doc.setFillColor(255, 255, 255);
          doc.rect(imgX, imgY, imgW, imgH, 'F');
          doc.setDrawColor(210, 210, 210);
          doc.setLineWidth(0.2);
          doc.rect(imgX, imgY, imgW, imgH);
          
          doc.setTextColor(180, 180, 180);
          doc.setFont('times', 'italic');
          doc.setFontSize(10);
          doc.text("Atelier's Silhouette", pageWidth / 2, imgY + (imgH / 2), { align: 'center' });
        }

        // Text metadata starts at startY + 88
        const textY = startY + 88;

        // Brand / Tag
        doc.setTextColor(158, 127, 101);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.text("EDICIÓN LIMITADA", 20, textY, { charSpace: 1 });

        // Model Title
        doc.setTextColor(20, 20, 20);
        doc.setFont('times', 'bold');
        doc.setFontSize(13);
        const nameDisplay = wp.name || p.model || 'Sin Nombre';
        doc.text(nameDisplay.toUpperCase(), 20, textY + 6);

        // Technical details (Format: CODIGO · TALLE · MATERIAL)
        const lw = p.lensWidth ?? 52;
        const bw = p.bridgeWidth ?? 18;
        const tl = p.templeLength ?? 145;
        const fh = p.frameHeight ?? Math.round(lw * 0.8);
        
        let material = 'ACETATO';
        if (p.seoTags) {
          const tags = p.seoTags.toLowerCase();
          if (tags.includes('titanio')) material = 'TITANIO';
          else if (tags.includes('metal')) material = 'METAL';
        }

        doc.setTextColor(80, 80, 80);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.text(`REF: ${p.model || 'AT-MOD'}   ·   MEDIDAS: ${lw}-${bw}-${tl}   ·   ALTO: ${fh} mm   ·   ${material}`, 20, textY + 11);

        // Stock Badge (on the right side)
        const stock = p.stock ?? 0;
        if (stock > 0) {
          doc.setTextColor(34, 139, 34); // ForestGreen
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(8);
          doc.text(`✓ STOCK DISPONIBLE`, pageWidth - 20, textY + 6, { align: 'right' });
        } else {
          doc.setTextColor(180, 50, 50);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(8);
          doc.text(`SIN STOCK`, pageWidth - 20, textY + 6, { align: 'right' });
        }
      }
    }

    // ----------------------------------------------------
    // BACK COVER PAGE (LAST PAGE)
    // ----------------------------------------------------
    doc.addPage();
    currentPage++;

    doc.setFillColor(13, 13, 13); // dark background
    doc.rect(0, 0, pageWidth, pageHeight, 'F');

    // Embed Salvador Dali Image
    if (daliBase64) {
      // Draw golden frame
      doc.setDrawColor(158, 127, 101);
      doc.setLineWidth(1.2);
      doc.rect(48, 48, 114, 144);
      doc.setLineWidth(0.3);
      doc.rect(49.5, 49.5, 111, 141);

      // Draw image
      doc.addImage(daliBase64, 'JPEG', 50, 50, 110, 140);
    }

    // Back Cover text below image
    doc.setTextColor(158, 127, 101);
    doc.setFont('times', 'italic');
    doc.setFontSize(22);
    doc.text("El arte de ver.", pageWidth / 2, 218, { align: 'center' });

    doc.setTextColor(245, 245, 245);
    doc.setFont('times', 'bold');
    doc.setFontSize(14);
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
