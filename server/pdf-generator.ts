import PDFDocument from 'pdfkit';
import type { Readable } from 'stream';

export interface CurriculumPDFData {
  courseTitle: string;
  subject: string;
  gradeLevel: string | null;
  tutorName: string;
  curriculum: string;
  price: string;
  duration: number | null;
  sessionsPerWeek: number | null;
  totalSessions: number | null;
}

export interface PaymentReceiptData {
  receiptNumber: string;
  paymentDate: Date;
  parentName: string;
  parentEmail: string | null;
  courseName: string;
  tutorName: string;
  studentName: string;
  amount: string;
  currency: string;
  paymentMethod: string;
  transactionId: string | null;
  paymentType: string;
  installmentInfo?: {
    installmentNumber: number;
    totalInstallments: number;
    remainingAmount: string;
  };
}

export function generatePaymentReceipt(data: PaymentReceiptData): Readable {
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 50, bottom: 50, left: 50, right: 50 },
  });

  // Header with Logo/Title
  doc.fontSize(28).font('Helvetica-Bold').fillColor('#1e40af')
    .text('EdKonnect Academy', { align: 'center' });
  doc.fontSize(12).font('Helvetica').fillColor('black')
    .text('Payment Receipt', { align: 'center' });
  doc.moveDown(0.5);
  
  // Receipt Number and Date
  doc.fontSize(10).font('Helvetica')
    .text(`Receipt #: ${data.receiptNumber}`, { align: 'right' });
  doc.text(`Date: ${data.paymentDate.toLocaleDateString()}`, { align: 'right' });
  doc.moveDown(1.5);

  // Divider line
  doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
  doc.moveDown(1);

  // Bill To Section
  doc.fontSize(12).font('Helvetica-Bold').text('Bill To:');
  doc.moveDown(0.3);
  doc.fontSize(10).font('Helvetica');
  doc.text(data.parentName);
  if (data.parentEmail) {
    doc.text(data.parentEmail);
  }
  doc.moveDown(1.5);

  // Payment Details
  doc.fontSize(12).font('Helvetica-Bold').text('Payment Details:');
  doc.moveDown(0.5);
  
  const detailsY = doc.y;
  doc.fontSize(10).font('Helvetica');
  
  // Left column labels
  doc.text('Course:', 50, detailsY);
  doc.text('Instructor:', 50, detailsY + 20);
  doc.text('Student:', 50, detailsY + 40);
  doc.text('Payment Method:', 50, detailsY + 60);
  if (data.transactionId) {
    doc.text('Transaction ID:', 50, detailsY + 80);
  }
  
  // Right column values
  doc.text(data.courseName, 200, detailsY);
  doc.text(data.tutorName, 200, detailsY + 20);
  doc.text(data.studentName, 200, detailsY + 40);
  doc.text(data.paymentMethod, 200, detailsY + 60);
  if (data.transactionId) {
    doc.text(data.transactionId, 200, detailsY + 80);
  }
  
  doc.y = detailsY + (data.transactionId ? 100 : 80);
  doc.moveDown(1.5);

  // Installment Info if applicable
  if (data.installmentInfo) {
    doc.fontSize(11).font('Helvetica-Bold').fillColor('#d97706')
      .text('Installment Payment', { align: 'center' });
    doc.fontSize(10).font('Helvetica').fillColor('black');
    doc.text(
      `Payment ${data.installmentInfo.installmentNumber} of ${data.installmentInfo.totalInstallments}`,
      { align: 'center' }
    );
    if (data.installmentInfo.remainingAmount !== '0.00') {
      doc.text(
        `Remaining Balance: $${data.installmentInfo.remainingAmount}`,
        { align: 'center' }
      );
    }
    doc.moveDown(1.5);
  }

  // Amount Section
  doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
  doc.moveDown(0.5);
  
  doc.fontSize(14).font('Helvetica-Bold');
  doc.text('Amount Paid:', 50, doc.y);
  doc.fontSize(18).fillColor('#16a34a')
    .text(`$${data.amount} ${data.currency.toUpperCase()}`, { align: 'right' });
  doc.fillColor('black');
  doc.moveDown(0.5);
  
  doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
  doc.moveDown(2);

  // Footer
  doc.fontSize(9).font('Helvetica').fillColor('gray');
  doc.text('Thank you for choosing EdKonnect Academy!', { align: 'center' });
  doc.moveDown(0.5);
  doc.fontSize(8)
    .text('This is an official receipt for your payment.', { align: 'center' });
  doc.text('For questions, please contact support@edkonnect.com', { align: 'center' });
  
  // Add page number at bottom
  doc.text(
    `Page 1 of 1`,
    50,
    doc.page.height - 50,
    { align: 'center' }
  );

  doc.end();
  
  return doc as unknown as Readable;
}

/** Convert rgb(r, g, b) or #hex to a hex string PDFKit accepts. Returns null for unsupported formats (e.g. oklch). */
function normalizeColor(color: string): string | null {
  if (color.startsWith('#')) return color;
  const rgb = color.match(/^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/i);
  if (rgb) {
    return '#' + [rgb[1], rgb[2], rgb[3]].map(n => parseInt(n).toString(16).padStart(2, '0')).join('');
  }
  // oklch, hsl, and other modern formats — PDFKit can't handle them, ignore
  return null;
}

/**
 * Parse HTML produced by the Tiptap rich text editor and render it into a PDFKit doc.
 * Handles: p, h2, h3, ul, ol, li, strong, em, u, s, br, span (with inline color).
 */
/** Extract top-level block elements robustly, handling nested tags (e.g. ul > li > p) */
function extractBlocks(html: string): { tag: string; inner: string }[] {
  const blocks: { tag: string; inner: string }[] = [];
  const blockTags = new Set(['h1', 'h2', 'h3', 'h4', 'p', 'ul', 'ol', 'blockquote']);
  let i = 0;
  while (i < html.length) {
    // Find next opening block tag
    const openMatch = html.slice(i).match(/^<(h[1-4]|p|ul|ol|blockquote)(\s[^>]*)?>/i);
    if (!openMatch) {
      i++;
      continue;
    }
    const tag = openMatch[1].toLowerCase();
    i += openMatch[0].length;
    // Find matching close tag, tracking nesting depth
    let depth = 1;
    let inner = '';
    while (i < html.length && depth > 0) {
      const openNext = html.slice(i).match(new RegExp(`^<${tag}(\\s[^>]*)?>`, 'i'));
      const closeNext = html.slice(i).match(new RegExp(`^<\\/${tag}>`, 'i'));
      if (openNext) {
        depth++;
        inner += openNext[0];
        i += openNext[0].length;
      } else if (closeNext) {
        depth--;
        if (depth > 0) inner += closeNext[0];
        i += closeNext[0].length;
      } else {
        inner += html[i];
        i++;
      }
    }
    if (blockTags.has(tag)) {
      blocks.push({ tag, inner });
    }
  }
  return blocks;
}

/**
 * Pre-process HTML: if the curriculum is stored as a single <p> with <br> line separators
 * (legacy format), explode it into proper <p> blocks so each line renders separately.
 */
function normalizeHtml(html: string): string {
  // Collapse whitespace
  let h = html.replace(/\s*\n\s*/g, '').trim();

  // If there's only one top-level <p> block AND it contains <br> tags, split it up
  const singleP = h.match(/^<p([^>]*)>([\s\S]+)<\/p>$/i);
  if (singleP) {
    // Split on <br> (single or double)
    const inner = singleP[2];
    // Double <br> = paragraph gap, single <br> = new line (still separate <p>)
    const lines = inner.split(/<br\s*\/?>\s*<br\s*\/?>/gi);
    h = lines.map(segment => {
      // Further split each segment on remaining single <br>
      const subLines = segment.split(/<br\s*\/?>/gi);
      return subLines.map(s => s.trim()).filter(s => s.length > 0).map(s => `<p>${s}</p>`).join('');
    }).join('<p></p>'); // empty <p> = paragraph gap between groups
  }

  return h;
}

function renderHtmlToPdf(doc: PDFKit.PDFDocument, html: string) {
  // Strip emojis first (PDFKit built-in fonts can't render them — produces garbage chars)
  const emojiStripped = stripEmoji(html);
  // Normalise: collapse whitespace between tags, then explode br-based content into proper blocks
  const cleaned = normalizeHtml(emojiStripped);

  const blocks = extractBlocks(cleaned);
  const lastIndex = blocks.length > 0 ? 1 : 0;

  const processInline = (inner: string): { text: string; bold: boolean; italic: boolean; underline: boolean; strike: boolean; color: string | null }[] => {
    const segments: { text: string; bold: boolean; italic: boolean; underline: boolean; strike: boolean; color: string | null }[] = [];
    // Strip any remaining tags we don't handle and decode entities
    const spanRe = /<(strong|em|u|s|span)((?:\s[^>]*)?)>([\s\S]*?)<\/\1>|([^<]+)|<br\s*\/?>/gi;
    let m: RegExpExecArray | null;
    const decode = (t: string) => t.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/&#39;/g, "'").replace(/&quot;/g, '"');

    while ((m = spanRe.exec(inner)) !== null) {
      if (m[4]) {
        // Plain text
        segments.push({ text: decode(m[4]), bold: false, italic: false, underline: false, strike: false, color: null });
      } else if (m[0].startsWith('<br')) {
        segments.push({ text: '\n', bold: false, italic: false, underline: false, strike: false, color: null });
      } else {
        const tag = m[1].toLowerCase();
        const attrs = m[2] || '';
        const content = m[3];
        // Extract color from style attr — Tiptap outputs rgb() or hex
        const colorMatch = attrs.match(/color:\s*(rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)|#[0-9a-fA-F]{3,6})/i);
        const rawColor = colorMatch ? colorMatch[1] : null;
        const color = rawColor ? normalizeColor(rawColor) : null;
        // Recurse for nested spans
        const inner2 = processInline(content);
        inner2.forEach(seg => {
          segments.push({
            text: seg.text,
            bold: seg.bold || tag === 'strong',
            italic: seg.italic || tag === 'em',
            underline: seg.underline || tag === 'u',
            strike: seg.strike || tag === 's',
            color: seg.color || color,
          });
        });
      }
    }
    return segments;
  };

  const LEFT = 50; // consistent left margin matching page margin

  const renderInlineSegments = (segments: ReturnType<typeof processInline>, opts: Record<string, unknown> = {}) => {
    if (segments.length === 0) {
      doc.text('', { ...opts } as any);
      return;
    }
    let i = 0;
    while (i < segments.length) {
      const seg = segments[i];
      const font = seg.bold && seg.italic ? 'Helvetica-BoldOblique' : seg.bold ? 'Helvetica-Bold' : seg.italic ? 'Helvetica-Oblique' : 'Helvetica';
      const continued = i < segments.length - 1;
      doc.font(font)
        .fillColor(seg.color || 'black')
        .text(seg.text, { ...opts, continued, underline: seg.underline, strike: seg.strike } as any);
      i++;
    }
    doc.fillColor('black').font('Helvetica');
  };

  const renderBlock = (tag: string, inner: string) => {
    if (tag === 'h2') {
      doc.moveDown(0.5);
      doc.fontSize(12).font('Helvetica-Bold').fillColor('#1e40af');
      renderInlineSegments(processInline(inner), { align: 'left' });
      doc.fontSize(10).font('Helvetica').fillColor('black');
      doc.moveDown(0.15);
    } else if (tag === 'h3') {
      doc.moveDown(0.3);
      doc.fontSize(11).font('Helvetica-Bold').fillColor('#374151');
      renderInlineSegments(processInline(inner), { align: 'left' });
      doc.fontSize(10).font('Helvetica').fillColor('black');
      doc.moveDown(0.1);
    } else if (tag === 'ul' || tag === 'ol') {
      // Simple li extractor that handles <li><p>text</p></li>
      const liBlocks: string[] = [];
      let j = 0;
      while (j < inner.length) {
        const liOpen = inner.slice(j).match(/^<li(\s[^>]*)?>/i);
        if (!liOpen) { j++; continue; }
        j += liOpen[0].length;
        let liDepth = 1, liInner = '';
        while (j < inner.length && liDepth > 0) {
          if (inner.slice(j).match(/^<li(\s[^>]*)?>/i)) {
            const m = inner.slice(j).match(/^<li(\s[^>]*)?>/i)!;
            liDepth++; liInner += m[0]; j += m[0].length;
          } else if (inner.slice(j).match(/^<\/li>/i)) {
            liDepth--; if (liDepth > 0) liInner += '</li>'; j += 5;
          } else {
            liInner += inner[j]; j++;
          }
        }
        liBlocks.push(liInner);
      }

      let idx = 1;
      for (const liContent of liBlocks) {
        const bullet = tag === 'ol' ? `${idx}.` : '\u2022';
        doc.font('Helvetica').fillColor('black').fontSize(10);
        // Strip wrapping <p> tags that Tiptap v3 adds inside <li>
        const strippedLi = liContent.replace(/^<p[^>]*>([\s\S]*?)<\/p>$/i, '$1')
          .replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '$1 ');
        const bulletX = LEFT + 2;
        const textX = LEFT + 14;
        const savedY = doc.y;
        doc.text(bullet, bulletX, savedY, { lineBreak: false, width: 12 });
        doc.y = savedY;
        const segs = processInline(strippedLi);
        renderInlineSegments(segs, { align: 'left', x: textX } as any);
        idx++;
      }
      doc.moveDown(0.2);
    } else {
      // p or blockquote
      const segs = processInline(inner);
      if (segs.length === 0 || segs.every(s => s.text.trim() === '')) {
        doc.moveDown(0.35);
      } else {
        doc.fontSize(10).font('Helvetica').fillColor('black');
        renderInlineSegments(segs, { align: 'left', lineGap: 2 });
        doc.moveDown(0.3);
      }
    }
  };

  for (const block of blocks) {
    renderBlock(block.tag, block.inner);
  }

  // Fallback: if no block tags matched (plain text stored before rich editor), render as-is
  if (lastIndex === 0 && cleaned.length > 0) {
    const plain = stripEmoji(cleaned.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim());
    doc.fontSize(10).font('Helvetica').fillColor('black').text(plain);
  }
}

/** Replace emoji with PDF-safe text equivalents that preserve meaning. */
function stripEmoji(text: string): string {
  return text
    // Common bullet/diamond/arrow emoji used in curriculum → bullet point
    .replace(/[\uD83D][\uDD39\uDD38\uDD37\uDD36\uDD35\uDD34]/g, '\u2022')  // small squares
    .replace(/\u25C6|\u25C7|\u25A0|\u25A1|\u25B6|\u25CF|\u25AA|\u25AB/g, '\u2022') // geometric shapes
    .replace(/\u2794|\u27A4|\u2192|\u21D2/g, '>')                           // arrows → >
    .replace(/\u2714|\u2713/g, '[x]')                                       // checkmarks
    .replace(/\u2716|\u2717/g, '[!]')                                       // x marks
    // All remaining surrogate-pair emoji (color emoji) → strip
    .replace(/[\uD83C-\uDBFF][\uDC00-\uDFFF]/g, '')
    .replace(/[\u2600-\u26FF]/g, '')   // Misc symbols
    .replace(/[\u2700-\u27BF]/g, '')   // Dingbats
    .replace(/[\uFE00-\uFEFF]/g, '')   // Variation selectors, BOM
    .replace(/\s{2,}/g, ' ')
    .trimStart();
}

function drawGraduationCap(doc: PDFKit.PDFDocument, x: number, y: number, size: number) {
  // Scale the lucide graduation cap paths (viewBox 0 0 24 24) to `size` px
  const s = size / 24;
  const tx = (n: number) => x + n * s;
  const ty = (n: number) => y + n * s;

  doc.save();
  doc.lineWidth(1.5 * s).strokeColor('#1e40af').fillColor('#1e40af');

  // Hat brim: M2 10 l10 -5 l10 5 l-10 5 z
  doc
    .moveTo(tx(2), ty(10))
    .lineTo(tx(12), ty(5))
    .lineTo(tx(22), ty(10))
    .lineTo(tx(12), ty(15))
    .closePath()
    .fillAndStroke('#1e40af', '#1e40af');

  // Right tassel pole: M22 10 v6
  doc.moveTo(tx(22), ty(10)).lineTo(tx(22), ty(16)).stroke();

  // Mortarboard sides: M6 12 v5 c3 3 9 3 12 0 v-5
  doc
    .moveTo(tx(6), ty(12))
    .lineTo(tx(6), ty(17))
    .bezierCurveTo(tx(9), ty(20), tx(15), ty(20), tx(18), ty(17))
    .lineTo(tx(18), ty(12))
    .stroke();

  doc.restore();
}

function drawPageHeader(doc: PDFKit.PDFDocument) {
  // Draw graduation cap icon
  drawGraduationCap(doc, 50, 12, 20);
  // Brand name next to icon
  doc.fontSize(13).font('Helvetica-Bold').fillColor('#1e40af')
    .text('EdKonnect Academy', 76, 16, { lineBreak: false });
  // Divider below header
  doc.moveTo(50, 38).lineTo(545, 38).lineWidth(0.5).strokeColor('#1e40af').stroke();
  doc.lineWidth(1).strokeColor('black').fillColor('black');
}

export function generateCurriculumPDF(data: CurriculumPDFData): Readable {
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 55, bottom: 55, left: 50, right: 50 },
    autoFirstPage: true,
  });

  // Draw header on first page — positioned absolutely at top
  drawPageHeader(doc);

  // Re-draw header on every subsequent page
  doc.on('pageAdded', () => {
    drawPageHeader(doc);
    doc.y = 50;
    // Reset font state so content on new page starts clean
    doc.font('Helvetica').fontSize(10).fillColor('black');
  });

  // Start content below header divider
  doc.y = 50;

  // Course title
  doc.fontSize(20).font('Helvetica-Bold').fillColor('#1e40af')
    .text(data.courseTitle, 50, doc.y, { align: 'center' });
  doc.fontSize(11).font('Helvetica').fillColor('#6b7280')
    .text('Course Curriculum', 50, doc.y, { align: 'center' });
  doc.fillColor('black');
  doc.moveDown(1);

  // Divider
  doc.moveTo(50, doc.y).lineTo(545, doc.y).lineWidth(0.5).strokeColor('#e5e7eb').stroke();
  doc.lineWidth(1).strokeColor('black');
  doc.moveDown(0.7);

  // Course Information
  doc.fontSize(11).font('Helvetica-Bold').fillColor('#1e40af')
    .text('Course Information', 50, doc.y);
  doc.fillColor('black').moveDown(0.4);

  doc.fontSize(10).font('Helvetica');
  doc.text(`Subject: ${data.subject}`, 50, doc.y);
  if (data.gradeLevel) doc.text(`Grade Level: ${data.gradeLevel}`, 50, doc.y);
  doc.text(`Instructor: ${data.tutorName}`, 50, doc.y);
  if (data.sessionsPerWeek) doc.text(`Sessions Per Week: ${data.sessionsPerWeek}`, 50, doc.y);

  doc.moveDown(1);

  // Divider
  doc.moveTo(50, doc.y).lineTo(545, doc.y).lineWidth(0.5).strokeColor('#e5e7eb').stroke();
  doc.lineWidth(1).strokeColor('black');
  doc.moveDown(0.7);

  // Curriculum Details heading
  doc.fontSize(11).font('Helvetica-Bold').fillColor('#1e40af')
    .text('Curriculum Details', 50, doc.y);
  doc.fillColor('black').moveDown(0.5);

  // Render HTML curriculum content
  renderHtmlToPdf(doc, data.curriculum);

  // Footer on last page
  const footerY = doc.page.height - 40;
  doc.moveTo(50, footerY).lineTo(545, footerY).lineWidth(0.5).strokeColor('#e5e7eb').stroke();
  doc.fontSize(8).font('Helvetica').fillColor('#9ca3af')
    .text(
      `EdKonnect Academy  |  Generated ${new Date().toLocaleDateString()}`,
      50, footerY + 6,
      { align: 'center', lineBreak: false }
    );

  doc.end();

  return doc as unknown as Readable;
}
