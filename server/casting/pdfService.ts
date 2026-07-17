/**
 * Drape™ Premium Identity Document - PDF Generation Service
 * Generates a 7-page professional identity document for exported models
 *
 * Design language: warm minimalist (cream/obsidian/stone)
 * Matches the Drape app palette: #f5f3ef, #eae7e1, #1a1a1a, #b8b3a8
 */

import { jsPDF } from 'jspdf';
import crypto from 'crypto';
import { imageFileTypeFromDataUrl } from '../../shared/exportViews';

// Types for PDF generation
export interface PdfModelData {
  modelName: string;
  agencyId: string;
  sessionId: string;
  createdAt: string;
  mintedAt: string;
  ownerName: string;
  ownerId: string;
  masterPrompt: string;
  preferences: {
    gender?: string;
    age?: string;
    ethnicity?: string;
    bodyType?: string;
    skinTone?: string;
    skinTexture?: string;
    skinFinish?: string;
    eyeColor?: string;
    hairColor?: string;
    hairStyle?: string;
    hairLength?: string;
    hairTexture?: string;
    hairVolume?: string;
    hairFringe?: string;
    hairParting?: string;
    hairFlyaways?: string;
    faceShape?: string;
    jawline?: string;
    cheekbones?: string;
    cheeks?: string;
    eyeShape?: string;
    noseShape?: string;
    lipShape?: string;
    eyebrowStyle?: string;
    castingBrand?: string;
    castingVibe?: { editorial: number; commercial: number; runway: number };
  };
  images: {
    headshot?: string; // base64
    threeQuarter?: string; // audit V3: the D-39 slot the era-0 map dropped
    fullBody?: string;
    profile?: string;
    walk?: string;
    back?: string;
  };
}

// Warm minimalist color palette (matches Drape app)
const C = {
  obsidian:    [26, 26, 26]    as [number, number, number],  // #1a1a1a
  charcoal:    [61, 53, 48]    as [number, number, number],  // #3D3530
  stone:       [138, 128, 120] as [number, number, number],  // #8A8078
  muted:       [184, 179, 168] as [number, number, number],  // #b8b3a8
  border:      [214, 210, 204] as [number, number, number],  // #D6D2CC
  cream:       [245, 243, 239] as [number, number, number],  // #f5f3ef
  canvas:      [234, 231, 225] as [number, number, number],  // #eae7e1
  warmWhite:   [250, 248, 245] as [number, number, number],  // #FAF8F5
  white:       [255, 255, 255] as [number, number, number],
};

// Helper to generate secure hash
function generateSecureHash(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex').substring(0, 32).toUpperCase();
}

// Helper to draw visual hash identicon (warm palette)
function drawHashVisual(doc: jsPDF, hash: string, x: number, y: number, size: number = 25) {
  const cellSize = size / 4;
  const colors = [
    [138, 128, 120], // Stone
    [184, 179, 168], // Muted
    [61, 53, 48],    // Charcoal
    [214, 210, 204], // Border
    [26, 26, 26],    // Obsidian
  ];

  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 4; col++) {
      const charIndex = row * 4 + col;
      const charCode = hash.charCodeAt(charIndex) || 0;
      const colorIndex = charCode % colors.length;
      const color = colors[colorIndex];

      doc.setFillColor(color[0], color[1], color[2]);
      doc.rect(x + col * cellSize, y + row * cellSize, cellSize - 0.5, cellSize - 0.5, 'F');
    }
  }
}

/**
 * Add an image preserving 1:1 aspect ratio within a bounding box.
 * Centers the square image inside the container.
 */
function addSquareImage(
  doc: jsPDF,
  base64: string,
  containerX: number,
  containerY: number,
  containerW: number,
  containerH: number,
) {
  const side = Math.min(containerW, containerH);
  const imgX = containerX + (containerW - side) / 2;
  const imgY = containerY + (containerH - side) / 2;
  doc.addImage(base64, imageFileTypeFromDataUrl(base64).pdfFormat, imgX, imgY, side, side);
}

/** Display value or em-dash for missing data */
function val(v: string | undefined | null): string {
  if (!v || v.trim() === '') return '\u2014';
  return v;
}

// Page 1: Cover Page (Warm Minimalist)
function createCoverPage(doc: jsPDF, data: PdfModelData) {
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();

  // Warm white background
  doc.setFillColor(...C.warmWhite);
  doc.rect(0, 0, pw, ph, 'F');

  // Logo header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...C.obsidian);
  doc.text('drape', 15, 25);

  // Stone accent line
  doc.setDrawColor(...C.stone);
  doc.setLineWidth(1.5);
  doc.line(15, 29, 50, 29);

  // Hero image area
  const heroX = 30;
  const heroY = 45;
  const heroW = 150;
  const heroH = 160;
  doc.setFillColor(...C.canvas);
  doc.rect(heroX, heroY, heroW, heroH, 'F');

  if (data.images.headshot) {
    try {
      addSquareImage(doc, data.images.headshot, heroX, heroY, heroW, heroH);
    } catch {
      doc.setTextColor(...C.muted);
      doc.setFontSize(10);
      doc.text('[ HERO HEADSHOT ]', heroX + heroW / 2, heroY + heroH / 2, { align: 'center' });
    }
  } else {
    doc.setTextColor(...C.muted);
    doc.setFontSize(10);
    doc.text('[ HERO HEADSHOT ]', heroX + heroW / 2, heroY + heroH / 2, { align: 'center' });
  }

  // Model name
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(36);
  doc.setTextColor(...C.obsidian);
  doc.text(data.modelName.toUpperCase(), 15, 230);

  // Agency ID
  doc.setFont('courier', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(...C.charcoal);
  doc.text(data.agencyId, 15, 243);

  // Quick stats — only show what exists
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...C.stone);
  const parts: string[] = [];
  if (data.preferences.age) parts.push(`AGE ${data.preferences.age}`);
  if (data.preferences.eyeColor) parts.push(`EYES ${data.preferences.eyeColor}`);
  if (data.preferences.hairColor) parts.push(`HAIR ${data.preferences.hairColor}`);
  const stats = parts.length > 0 ? parts.join('  \u2014  ') : 'DIGITAL IDENTITY';
  doc.text(stats, 15, 255);

  // Document type
  doc.setFontSize(8);
  doc.setTextColor(...C.muted);
  doc.text('DIGITAL IDENTITY DOSSIER', 15, 270);

  // Disclaimer — subtle, immersive
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(6);
  doc.setTextColor(...C.muted);
  doc.text('For creative and commercial reference only. This is not a legal identity document.', pw / 2, 280, { align: 'center' });

  // Footer
  doc.setFont('courier', 'normal');
  doc.setFontSize(6);
  doc.setTextColor(...C.border);
  doc.text('DRAPE\u2122  \u2014  CASTING STUDIO  \u2014  DIGITALLY CERTIFIED', pw / 2, 290, { align: 'center' });
}

// Page 2: Composite Card
function createCompCardPage(doc: jsPDF, data: PdfModelData, pageNum: number, totalPages: number) {
  doc.addPage();
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();

  // Background
  doc.setFillColor(...C.warmWhite);
  doc.rect(0, 0, pw, ph, 'F');

  // Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(...C.obsidian);
  doc.text('COMPOSITE CARD', 15, 20);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...C.stone);
  doc.text(`${data.modelName.toUpperCase()}  |  ${data.agencyId}`, 15, 28);

  // Divider
  doc.setDrawColor(...C.border);
  doc.setLineWidth(0.3);
  doc.line(15, 33, pw - 15, 33);

  // Collect available images
  const availableViews: { label: string; base64: string }[] = [];
  if (data.images.headshot) availableViews.push({ label: 'PRIMARY HEADSHOT', base64: data.images.headshot });
  if (data.images.threeQuarter) availableViews.push({ label: 'THREE-QUARTER PORTRAIT', base64: data.images.threeQuarter });
  if (data.images.fullBody) availableViews.push({ label: 'FULL BODY STANDING', base64: data.images.fullBody });
  if (data.images.profile) availableViews.push({ label: 'PROFILE VIEW', base64: data.images.profile });
  if (data.images.walk) availableViews.push({ label: 'MOVEMENT / WALK', base64: data.images.walk });
  if (data.images.back) availableViews.push({ label: 'REAR VIEW', base64: data.images.back });

  const margin = 15;
  const contentW = pw - margin * 2;

  if (availableViews.length === 0) {
    doc.setTextColor(...C.muted);
    doc.setFontSize(11);
    doc.text('No views generated yet.', pw / 2, 120, { align: 'center' });
  } else if (availableViews.length <= 2) {
    // 1-2 images: large side by side (square)
    const gap = 5;
    const cols = availableViews.length;
    const imgW = (contentW - gap * (cols - 1)) / cols;
    const imgH = imgW;
    availableViews.forEach((v, i) => {
      const x = margin + i * (imgW + gap);
      doc.setFillColor(...C.canvas);
      doc.rect(x, 40, imgW, imgH, 'F');
      try { addSquareImage(doc, v.base64, x, 40, imgW, imgH); } catch { /* placeholder */ }
      doc.setFont('courier', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(...C.stone);
      doc.text(v.label, x + imgW / 2, 40 + imgH + 5, { align: 'center' });
    });
  } else {
    // 3-5 images: 2 large top row + remaining bottom row
    const gap = 5;
    const topW = (contentW - gap) / 2;
    const topH = topW;

    for (let i = 0; i < 2 && i < availableViews.length; i++) {
      const v = availableViews[i];
      const x = margin + i * (topW + gap);
      doc.setFillColor(...C.canvas);
      doc.rect(x, 40, topW, topH, 'F');
      try { addSquareImage(doc, v.base64, x, 40, topW, topH); } catch { /* placeholder */ }
      doc.setFont('courier', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(...C.stone);
      doc.text(v.label, x + topW / 2, 40 + topH + 5, { align: 'center' });
    }

    const remaining = availableViews.slice(2);
    if (remaining.length > 0) {
      const row2Y = 40 + topH + 15;
      const botW = (contentW - gap * (remaining.length - 1)) / remaining.length;
      const botH = botW;
      remaining.forEach((v, i) => {
        const x = margin + i * (botW + gap);
        doc.setFillColor(...C.canvas);
        doc.rect(x, row2Y, botW, botH, 'F');
        try { addSquareImage(doc, v.base64, x, row2Y, botW, botH); } catch { /* placeholder */ }
        doc.setFont('courier', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(...C.stone);
        doc.text(v.label, x + botW / 2, row2Y + botH + 5, { align: 'center' });
      });
    }
  }

  // Stats box at bottom
  const statsY = 240;
  doc.setDrawColor(...C.border);
  doc.setLineWidth(0.3);
  doc.rect(margin, statsY, contentW, 30);

  const drawStat = (label: string, value: string, x: number, y: number) => {
    doc.setFont('courier', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...C.obsidian);
    doc.text(`${label}: `, x, y);
    doc.setFont('courier', 'normal');
    doc.text(val(value), x + doc.getTextWidth(`${label}: `), y);
  };

  drawStat('AGE', data.preferences.age || '', 20, statsY + 10);
  drawStat('BODY', data.preferences.bodyType || '', 70, statsY + 10);
  drawStat('SKIN', data.preferences.skinTone || '', 130, statsY + 10);
  drawStat('EYES', data.preferences.eyeColor || '', 20, statsY + 20);
  drawStat('HAIR', data.preferences.hairColor || '', 70, statsY + 20);
  drawStat('ETHNICITY', data.preferences.ethnicity || '', 130, statsY + 20);

  // Casting context
  doc.setFont('courier', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...C.stone);
  const vibe = data.preferences.castingVibe;
  const vibeStr = vibe
    ? `Editorial ${Math.round(vibe.editorial * 100)}% / Commercial ${Math.round(vibe.commercial * 100)}% / Runway ${Math.round(vibe.runway * 100)}%`
    : '\u2014';
  const brandStr = val(data.preferences.castingBrand);
  doc.text(`CASTING: ${brandStr}  \u2014  VIBE: ${vibeStr}`, 20, statsY + 28);

  addPageFooter(doc, pageNum, totalPages, data.agencyId);
}

// Page 3: Character Sheet
function createCharacterSheetPage(doc: jsPDF, data: PdfModelData, pageNum: number, totalPages: number) {
  doc.addPage();
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const prefs = data.preferences;

  // Background
  doc.setFillColor(...C.warmWhite);
  doc.rect(0, 0, pw, ph, 'F');

  // Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(...C.obsidian);
  doc.text('CHARACTER SHEET', 15, 20);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...C.stone);
  doc.text('Complete attribute breakdown for identity consistency', 15, 28);

  // Divider
  doc.setDrawColor(...C.border);
  doc.setLineWidth(0.3);
  doc.line(15, 33, pw - 15, 33);

  const col1X = 15;
  const col2X = 110;
  let y1 = 45;
  let y2 = 45;

  const drawSection = (title: string, items: [string, string][], x: number, startY: number): number => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...C.charcoal);
    doc.text(title, x, startY);

    doc.setDrawColor(...C.charcoal);
    doc.setLineWidth(0.5);
    doc.line(x, startY + 2, x + 35, startY + 2);

    let y = startY + 12;
    for (const [label, value] of items) {
      doc.setFont('courier', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(...C.stone);
      doc.text(label.toUpperCase(), x, y);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(...C.obsidian);
      doc.text(val(value), x + 35, y);
      y += 8;
    }
    return y + 5;
  };

  // Column 1
  y1 = drawSection('DEMOGRAPHICS', [
    ['GENDER', prefs.gender || ''],
    ['AGE', prefs.age || ''],
    ['ETHNICITY', prefs.ethnicity || ''],
    ['BODY TYPE', prefs.bodyType || ''],
  ], col1X, y1);

  y1 = drawSection('FACIAL STRUCTURE', [
    ['FACE SHAPE', prefs.faceShape || ''],
    ['JAWLINE', prefs.jawline || ''],
    ['CHEEKBONES', prefs.cheekbones || ''],
    ['CHEEKS', prefs.cheeks || ''],
  ], col1X, y1);

  y1 = drawSection('FEATURES', [
    ['EYE SHAPE', prefs.eyeShape || ''],
    ['EYE COLOR', prefs.eyeColor || ''],
    ['NOSE', prefs.noseShape || ''],
    ['LIPS', prefs.lipShape || ''],
    ['EYEBROWS', prefs.eyebrowStyle || ''],
  ], col1X, y1);

  // Column 2
  y2 = drawSection('SKIN PROFILE', [
    ['TONE', prefs.skinTone || ''],
    ['TEXTURE', prefs.skinTexture || ''],
    ['FINISH', prefs.skinFinish || ''],
  ], col2X, y2);

  y2 = drawSection('HAIR SYSTEM', [
    ['COLOR', prefs.hairColor || ''],
    ['STYLE', prefs.hairStyle || ''],
    ['LENGTH', prefs.hairLength || ''],
    ['TEXTURE', prefs.hairTexture || ''],
    ['VOLUME', prefs.hairVolume || ''],
    ['FRINGE', prefs.hairFringe || ''],
    ['PARTING', prefs.hairParting || ''],
    ['FLYAWAYS', prefs.hairFlyaways || ''],
  ], col2X, y2);

  y2 = drawSection('CASTING CONTEXT', [
    ['BRAND', prefs.castingBrand || ''],
    ['EDITORIAL', prefs.castingVibe ? `${Math.round(prefs.castingVibe.editorial * 100)}%` : ''],
    ['COMMERCIAL', prefs.castingVibe ? `${Math.round(prefs.castingVibe.commercial * 100)}%` : ''],
    ['RUNWAY', prefs.castingVibe ? `${Math.round(prefs.castingVibe.runway * 100)}%` : ''],
  ], col2X, y2);

  addPageFooter(doc, pageNum, totalPages, data.agencyId);
}

// Page 4: Director's Notes
function createDirectorsNotesPage(doc: jsPDF, data: PdfModelData, pageNum: number, totalPages: number) {
  doc.addPage();
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pw - margin * 2;

  // Background
  doc.setFillColor(...C.warmWhite);
  doc.rect(0, 0, pw, ph, 'F');

  // Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(...C.obsidian);
  doc.text("DIRECTOR'S NOTES", margin, 20);

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(9);
  doc.setTextColor(...C.stone);
  doc.text('The complete casting specification used to generate this identity', margin, 28);

  // Divider
  doc.setDrawColor(...C.border);
  doc.setLineWidth(0.3);
  doc.line(margin, 33, pw - margin, 33);

  // Quote box
  doc.setFillColor(...C.cream);
  doc.rect(margin, 40, contentWidth, 200, 'F');
  doc.setDrawColor(...C.border);
  doc.rect(margin, 40, contentWidth, 200, 'D');

  // Opening quote mark
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(36);
  doc.setTextColor(...C.stone);
  doc.text('\u201C', margin + 5, 55);

  // Master prompt content
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...C.charcoal);

  const promptText = data.masterPrompt || 'No master prompt available';
  const lines = doc.splitTextToSize(promptText, contentWidth - 20);
  const maxLines = 45;
  const displayLines = lines.slice(0, maxLines);

  let y = 65;
  for (const line of displayLines) {
    doc.text(line, margin + 10, y);
    y += 4.5;
  }

  // Closing quote mark
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(36);
  doc.setTextColor(...C.stone);
  doc.text('\u201D', pw - margin - 15, 230);

  // Attribution
  doc.setFont('courier', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...C.muted);
  doc.text(`Generated by Drape\u2122 Casting Studio  \u2014  ${data.createdAt}`, pw / 2, 255, { align: 'center' });

  addPageFooter(doc, pageNum, totalPages, data.agencyId);
}

// Page 5: Certificate of Authenticity
function createCertificatePage(doc: jsPDF, data: PdfModelData, pageNum: number, totalPages: number) {
  doc.addPage();
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();

  // Background
  doc.setFillColor(...C.warmWhite);
  doc.rect(0, 0, pw, ph, 'F');

  // Decorative border
  doc.setDrawColor(...C.border);
  doc.setLineWidth(0.5);
  doc.rect(10, 10, 190, 277, 'D');
  doc.setLineWidth(0.2);
  doc.rect(12, 12, 186, 273, 'D');

  // Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(24);
  doc.setTextColor(...C.obsidian);
  doc.text('CERTIFICATE OF AUTHENTICITY', pw / 2, 35, { align: 'center' });

  // Subtitle
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...C.stone);
  doc.text('Digital Identity Verification & Provenance Record', pw / 2, 45, { align: 'center' });

  // Decorative line
  doc.setDrawColor(...C.charcoal);
  doc.setLineWidth(1);
  doc.line(70, 52, 140, 52);

  // Model info box
  doc.setFillColor(...C.cream);
  doc.rect(25, 60, 160, 40, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(...C.obsidian);
  doc.text(data.modelName.toUpperCase(), pw / 2, 75, { align: 'center' });

  doc.setFont('courier', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...C.charcoal);
  doc.text(data.agencyId, pw / 2, 88, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...C.stone);
  doc.text('Unique Model Identifier', pw / 2, 96, { align: 'center' });

  // Generation record
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...C.obsidian);
  doc.text('GENERATION RECORD', 25, 115);

  doc.setDrawColor(...C.border);
  doc.rect(25, 120, 160, 55, 'D');

  const records = [
    ['Model ID', data.agencyId],
    ['Session ID', data.sessionId],
    ['Created', data.createdAt],
    ['Minted', data.mintedAt],
    ['Engine', 'Gemini 3 Pro Image Preview'],
    ['Resolution', '2K (2048\u00D72048)'],
  ];

  let certY = 128;
  for (const [label, value] of records) {
    doc.setFont('courier', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...C.stone);
    doc.text(`${label}:`, 30, certY);

    doc.setFont('courier', 'bold');
    doc.setTextColor(...C.obsidian);
    doc.text(value, 75, certY);
    certY += 8;
  }

  // Secure hash
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...C.obsidian);
  doc.text('SECURE HASH', 25, 185);

  const hashInput = data.agencyId + data.sessionId + data.createdAt;
  const secureHash = generateSecureHash(hashInput);

  doc.setFont('courier', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...C.obsidian);
  doc.text(secureHash, 25, 195);

  drawHashVisual(doc, secureHash, 145, 180, 25);

  // Owner information
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...C.obsidian);
  doc.text('ISSUED TO', 25, 220);

  doc.setDrawColor(...C.border);
  doc.rect(25, 225, 160, 25, 'D');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...C.obsidian);
  doc.text(data.ownerName, 30, 235);

  doc.setFont('courier', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...C.stone);
  doc.text(`Account: ${data.ownerId}`, 30, 243);

  // Certification stamp
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...C.charcoal);
  doc.text('DIGITALLY CERTIFIED', 155, 260, { align: 'center' });

  doc.setDrawColor(...C.charcoal);
  doc.setLineWidth(1);
  doc.ellipse(155, 270, 15, 7.5, 'D');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(...C.charcoal);
  doc.text('DRAPE', 155, 272, { align: 'center' });

  // Footer note
  doc.setFont('courier', 'normal');
  doc.setFontSize(6);
  doc.setTextColor(...C.muted);
  doc.text('This certificate verifies the authenticity and provenance of the above digital identity.', pw / 2, 285, { align: 'center' });
}

// Page 6: Technical Appendix
function createTechnicalAppendixPage(doc: jsPDF, data: PdfModelData, pageNum: number, totalPages: number) {
  doc.addPage();
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const margin = 15;

  // Background
  doc.setFillColor(...C.warmWhite);
  doc.rect(0, 0, pw, ph, 'F');

  // Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(...C.obsidian);
  doc.text('TECHNICAL APPENDIX', margin, 20);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...C.stone);
  doc.text('Complete technical schema for developers and archival purposes', margin, 28);

  // Divider
  doc.setDrawColor(...C.border);
  doc.setLineWidth(0.3);
  doc.line(margin, 33, pw - margin, 33);

  // Code block background
  doc.setFillColor(...C.cream);
  doc.rect(margin, 40, pw - margin * 2, 200, 'F');
  doc.setDrawColor(...C.border);
  doc.rect(margin, 40, pw - margin * 2, 200, 'D');

  // JSON schema — actual values only, null for missing
  const prefs = data.preferences;
  const schema = {
    subject: {
      gender: prefs.gender || null,
      age: prefs.age || null,
      ethnicity: prefs.ethnicity || null,
      body_type: prefs.bodyType || null,
      skin_tone: prefs.skinTone || null,
      eye_color: prefs.eyeColor || null,
      hair_color: prefs.hairColor || null,
      hair_style: prefs.hairStyle || null,
      hair_length: prefs.hairLength || null,
    },
    face: {
      shape: prefs.faceShape || null,
      jawline: prefs.jawline || null,
      cheekbones: prefs.cheekbones || null,
      cheeks: prefs.cheeks || null,
      eye_shape: prefs.eyeShape || null,
      nose_shape: prefs.noseShape || null,
      lip_shape: prefs.lipShape || null,
      eyebrow_style: prefs.eyebrowStyle || null,
    },
    context: {
      casting_for: prefs.castingBrand || null,
      vibe_blend: prefs.castingVibe || null,
    },
    skin: {
      tone: prefs.skinTone || null,
      texture: prefs.skinTexture || null,
      finish: prefs.skinFinish || null,
    },
    hair: {
      style: prefs.hairStyle || null,
      texture: prefs.hairTexture || null,
      volume: prefs.hairVolume || null,
      fringe: prefs.hairFringe || null,
      parting: prefs.hairParting || null,
      flyaways: prefs.hairFlyaways || null,
    },
  };

  // Render JSON with warm syntax highlighting
  let jsonY = 50;
  const renderJson = (obj: Record<string, unknown>, indent: number = 0) => {
    const indentStr = '  '.repeat(indent);
    for (const [key, value] of Object.entries(obj)) {
      if (jsonY > 230) return;

      if (value !== null && typeof value === 'object') {
        doc.setFont('courier', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(...C.charcoal);
        doc.text(`${indentStr}"${key}":`, margin + 5, jsonY);
        jsonY += 5;
        renderJson(value as Record<string, unknown>, indent + 1);
      } else {
        doc.setTextColor(...C.charcoal);
        doc.text(`${indentStr}"${key}":`, margin + 5, jsonY);

        const keyWidth = doc.getTextWidth(`${indentStr}"${key}": `);
        if (value === null) {
          doc.setTextColor(...C.muted);
          doc.text('null', margin + 5 + keyWidth, jsonY);
        } else if (typeof value === 'number') {
          doc.setTextColor(...C.stone);
          doc.text(`${value}`, margin + 5 + keyWidth, jsonY);
        } else {
          doc.setTextColor(...C.obsidian);
          doc.text(`"${value}"`, margin + 5 + keyWidth, jsonY);
        }
        jsonY += 5;
      }
    }
  };

  renderJson(schema);

  // Note
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  doc.setTextColor(...C.muted);
  doc.text('This schema can be used to recreate or reference this identity in compatible systems.', pw / 2, 250, { align: 'center' });

  addPageFooter(doc, pageNum, totalPages, data.agencyId);
}

// Page 7: Ownership & Usage Rights
function createLegalPage(doc: jsPDF, data: PdfModelData, pageNum: number, totalPages: number) {
  doc.addPage();
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pw - margin * 2;

  // Background
  doc.setFillColor(...C.warmWhite);
  doc.rect(0, 0, pw, ph, 'F');

  // Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(...C.obsidian);
  doc.text('OWNERSHIP & USAGE RIGHTS', margin, 20);

  // Divider
  doc.setDrawColor(...C.border);
  doc.setLineWidth(0.3);
  doc.line(margin, 28, pw - margin, 28);

  const sections = [
    ['GRANT OF RIGHTS', 'Upon export and minting of this digital identity, the Exporting Party ("Owner") is granted exclusive, perpetual, worldwide rights to use, reproduce, modify, and distribute this Generated Model and all associated renders for any lawful purpose, including but not limited to commercial, editorial, and personal use.'],
    ['PERMITTED USES', 'The Owner may use this digital identity for: advertising and marketing campaigns, editorial content and publications, social media and digital platforms, merchandise and product visualization, film, television, and video production, virtual and augmented reality applications, and any derivative works.'],
    ['RESTRICTIONS', 'This digital identity may not be used to: create defamatory, illegal, or harmful content, impersonate real individuals without consent, generate content that violates applicable laws, or claim the identity represents a real human being in contexts where such representation would be misleading.'],
    ['AUTHENTICITY DECLARATION', 'This identity is a procedurally generated digital composite created using artificial intelligence. It does not represent any real person, living or deceased. The unique characteristics of this identity are the result of algorithmic generation and do not infringe upon any individual\'s likeness rights.'],
    ['PROVENANCE', 'This identity was generated and minted through Drape\u2122 Casting Studio. The generation parameters, timestamps, and cryptographic signatures are permanently recorded and can be verified against the Drape\u2122 registry.'],
  ];

  let legalY = 40;
  for (const [title, content] of sections) {
    if (legalY > 220) break;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...C.obsidian);
    doc.text(title, margin, legalY);

    doc.setDrawColor(...C.obsidian);
    doc.setLineWidth(0.3);
    doc.line(margin, legalY + 2, margin + 40, legalY + 2);

    legalY += 8;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...C.charcoal);
    const lines = doc.splitTextToSize(content, contentWidth);
    doc.text(lines, margin, legalY);
    legalY += lines.length * 4 + 10;
  }

  // Signature lines
  doc.setDrawColor(...C.obsidian);
  doc.setLineWidth(0.3);
  doc.line(margin, 245, margin + 75, 245);
  doc.line(120, 245, pw - margin, 245);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...C.muted);
  doc.text('Digital Signature (Drape\u2122)', margin + 37.5, 252, { align: 'center' });
  doc.text('Date of Issue', 157.5, 252, { align: 'center' });

  // Fill values
  doc.setFont('courier', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...C.obsidian);
  doc.text('DRAPE\u2122 CERTIFIED', margin + 37.5, 242, { align: 'center' });
  doc.text(new Date().toISOString().split('T')[0], 157.5, 242, { align: 'center' });

  addPageFooter(doc, pageNum, totalPages, data.agencyId);
}

// Helper: Add page footer
function addPageFooter(doc: jsPDF, pageNum: number, totalPages: number, agencyId: string) {
  doc.setFont('courier', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...C.stone);
  doc.text(
    `Page ${pageNum} of ${totalPages}  \u2014  ${agencyId}  \u2014  DRAPE\u2122 IDENTITY DOSSIER`,
    105,
    287,
    { align: 'center' },
  );
}

/**
 * Generate the complete 7-page premium identity document
 */
export async function generatePremiumIdentityPdf(data: PdfModelData): Promise<ArrayBuffer> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const totalPages = 7;

  createCoverPage(doc, data);
  createCompCardPage(doc, data, 2, totalPages);
  createCharacterSheetPage(doc, data, 3, totalPages);
  createDirectorsNotesPage(doc, data, 4, totalPages);
  createCertificatePage(doc, data, 5, totalPages);
  createTechnicalAppendixPage(doc, data, 6, totalPages);
  createLegalPage(doc, data, 7, totalPages);

  return doc.output('arraybuffer');
}
