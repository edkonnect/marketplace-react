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

/** Convert rgb(r, g, b) or #hex to a hex string PDFKit accepts */
function normalizeColor(color: string): string {
  const rgb = color.match(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/i);
  if (rgb) {
    return '#' + [rgb[1], rgb[2], rgb[3]].map(n => parseInt(n).toString(16).padStart(2, '0')).join('');
  }
  return color; // already hex
}

/**
 * Parse HTML produced by the Tiptap rich text editor and render it into a PDFKit doc.
 * Handles: p, h2, h3, ul, ol, li, strong, em, u, s, br, span (with inline color).
 */
function renderHtmlToPdf(doc: PDFKit.PDFDocument, html: string) {
  // Normalise: collapse whitespace between tags, trim
  const cleaned = html.replace(/\s*\n\s*/g, '').trim();

  // Split into top-level block elements
  const blockRe = /<(h2|h3|p|ul|ol|blockquote)((?:\s[^>]*)?)>([\s\S]*?)<\/\1>/gi;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

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

  const renderInlineSegments = (segments: ReturnType<typeof processInline>, opts: Record<string, unknown> = {}) => {
    // PDFKit doesn't support per-character styling in one call; we split by style changes
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
    if (segments.length === 0) doc.text('', opts as any);
    // Reset color
    doc.fillColor('black').font('Helvetica');
  };

  const renderBlock = (tag: string, inner: string) => {
    if (tag === 'h2') {
      doc.moveDown(0.4);
      const segs = processInline(inner);
      doc.fontSize(13).font('Helvetica-Bold').fillColor('black');
      renderInlineSegments(segs);
      doc.fontSize(10).font('Helvetica');
      doc.moveDown(0.2);
    } else if (tag === 'h3') {
      doc.moveDown(0.3);
      doc.fontSize(11).font('Helvetica-Bold').fillColor('black');
      renderInlineSegments(processInline(inner));
      doc.fontSize(10).font('Helvetica');
      doc.moveDown(0.15);
    } else if (tag === 'ul' || tag === 'ol') {
      // Extract list items
      const liRe = /<li(?:\s[^>]*)?>([\s\S]*?)<\/li>/gi;
      let li: RegExpExecArray | null;
      let idx = 1;
      while ((li = liRe.exec(inner)) !== null) {
        const bullet = tag === 'ol' ? `${idx}.  ` : '•  ';
        doc.font('Helvetica').fillColor('black').fontSize(10);
        const segs = processInline(li[1]);
        // Prepend bullet as plain segment
        segs.unshift({ text: bullet, bold: false, italic: false, underline: false, strike: false, color: null });
        renderInlineSegments(segs, { indent: 15 });
        idx++;
      }
      doc.moveDown(0.2);
    } else {
      // p or blockquote
      const segs = processInline(inner);
      if (segs.length === 0 || segs.every(s => s.text.trim() === '')) {
        doc.moveDown(0.4);
      } else {
        doc.fontSize(10);
        renderInlineSegments(segs);
        doc.moveDown(0.15);
      }
    }
  };

  while ((match = blockRe.exec(cleaned)) !== null) {
    lastIndex = match.index + match[0].length;
    renderBlock(match[1].toLowerCase(), match[3]);
  }

  // Fallback: if no block tags matched (plain text stored before rich editor), render as-is
  if (lastIndex === 0 && cleaned.length > 0) {
    const plain = cleaned.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();
    doc.fontSize(10).font('Helvetica').fillColor('black').text(plain);
  }
}

export function generateCurriculumPDF(data: CurriculumPDFData): Readable {
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 50, bottom: 50, left: 50, right: 50 },
  });

  // Header
  doc.fontSize(24).font('Helvetica-Bold').text('Course Curriculum', { align: 'center' });
  doc.moveDown(0.5);
  doc.fontSize(18).font('Helvetica').text(data.courseTitle, { align: 'center' });
  doc.moveDown(1.5);

  // Course Information
  doc.fontSize(12).font('Helvetica-Bold').text('Course Information', { underline: true });
  doc.moveDown(0.5);
  
  doc.fontSize(10).font('Helvetica');
  doc.text(`Subject: ${data.subject}`);
  if (data.gradeLevel) {
    doc.text(`Grade Level: ${data.gradeLevel}`);
  }
  doc.text(`Instructor: ${data.tutorName}`);
  doc.text(`Price: $${data.price}`);
  
  if (data.duration) {
    doc.text(`Session Duration: ${data.duration} minutes`);
  }
  if (data.sessionsPerWeek) {
    doc.text(`Sessions Per Week: ${data.sessionsPerWeek}`);
  }
  if (data.totalSessions) {
    doc.text(`Total Sessions: ${data.totalSessions}`);
  }
  
  doc.moveDown(1.5);

  // Curriculum Content
  doc.fontSize(12).font('Helvetica-Bold').text('Curriculum Details', { underline: true });
  doc.moveDown(0.5);

  // Render HTML curriculum with basic formatting
  renderHtmlToPdf(doc, data.curriculum);

  // Footer
  doc.moveDown(2);
  doc.fontSize(8).font('Helvetica').fillColor('gray')
    .text('Generated by EdKonnect Academy', { align: 'center' });
  doc.text(new Date().toLocaleDateString(), { align: 'center' });

  doc.end();
  
  return doc as unknown as Readable;
}
