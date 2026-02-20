/**
 * Drape Premium Identity Document - PDF Generation Service
 * Generates a 7-page professional identity document for exported models
 */

import { jsPDF } from 'jspdf';
import crypto from 'crypto';

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
    fullBody?: string;
    profile?: string;
    walk?: string;
    back?: string;
  };
}

// Color palette
const COLORS = {
  black: [10, 10, 10] as [number, number, number],
  darkGray: [60, 60, 60] as [number, number, number],
  mediumGray: [100, 100, 100] as [number, number, number],
  lightGray: [150, 150, 150] as [number, number, number],
  veryLightGray: [200, 200, 200] as [number, number, number],
  bgGray: [245, 245, 245] as [number, number, number],
  accent: [255, 107, 53] as [number, number, number], // Drape orange
  white: [255, 255, 255] as [number, number, number],
};

// Helper to generate secure hash
function generateSecureHash(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex').substring(0, 32).toUpperCase();
}

// Helper to draw visual hash identicon
function drawHashVisual(doc: jsPDF, hash: string, x: number, y: number, size: number = 25) {
  const cellSize = size / 4;
  const colors = [
    [255, 107, 53],  // Orange
    [96, 165, 250],  // Blue
    [74, 222, 128],  // Green
    [251, 191, 36],  // Yellow
    [167, 139, 250], // Purple
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

// Page 1: Cover Page (Dark Hero)
function createCoverPage(doc: jsPDF, data: PdfModelData) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  
  // Dark background
  doc.setFillColor(15, 15, 15);
  doc.rect(0, 0, pageWidth, pageHeight, 'F');
  
  // Logo header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(255, 255, 255);
  doc.text('drape', 15, 25);
  
  // Orange accent line
  doc.setDrawColor(...COLORS.accent);
  doc.setLineWidth(2);
  doc.line(15, 30, 55, 30);
  
  // Hero image placeholder
  doc.setFillColor(45, 45, 45);
  doc.rect(30, 50, 150, 160, 'F');
  
  if (data.images.headshot) {
    try {
      doc.addImage(data.images.headshot, 'PNG', 30, 50, 150, 160);
    } catch (e) {
      // Fallback to placeholder text
      doc.setTextColor(100, 100, 100);
      doc.setFontSize(10);
      doc.text('[ HERO HEADSHOT IMAGE ]', 105, 130, { align: 'center' });
    }
  } else {
    doc.setTextColor(100, 100, 100);
    doc.setFontSize(10);
    doc.text('[ HERO HEADSHOT IMAGE ]', 105, 130, { align: 'center' });
  }
  
  // Model name
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(36);
  doc.setTextColor(255, 255, 255);
  doc.text(data.modelName.toUpperCase(), 15, 235);
  
  // Agency ID
  doc.setFont('courier', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(...COLORS.accent);
  doc.text(data.agencyId, 15, 248);
  
  // Quick stats
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(180, 180, 180);
  const stats = `AGE ${data.preferences.age || '-'}  -  HEIGHT 5'10"  -  EYES ${data.preferences.eyeColor || '-'}  -  HAIR ${data.preferences.hairColor || '-'}`;
  doc.text(stats, 15, 260);
  
  // Document type
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.text('DIGITAL IDENTITY DOCUMENT', 15, 275);
  
  // Footer
  doc.setFont('courier', 'normal');
  doc.setFontSize(6);
  doc.setTextColor(60, 60, 60);
  doc.text('DRAPE(TM)  -  ORGANIC CASTING ENGINE v3.1  -  DIGITALLY CERTIFIED', 105, 290, { align: 'center' });
}

// Page 2: Composite Card
function createCompCardPage(doc: jsPDF, data: PdfModelData, pageNum: number, totalPages: number) {
  doc.addPage();
  const pageWidth = doc.internal.pageSize.getWidth();
  
  // Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(...COLORS.black);
  doc.text('COMPOSITE CARD', 15, 20);
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...COLORS.mediumGray);
  doc.text(`${data.modelName.toUpperCase()}  |  ${data.agencyId}`, 15, 28);
  
  // Divider
  doc.setDrawColor(...COLORS.veryLightGray);
  doc.setLineWidth(0.3);
  doc.line(15, 33, pageWidth - 15, 33);
  
  // Image grid - 2 large + 3 small
  const imgPlaceholder = (x: number, y: number, w: number, h: number, label: string, imageBase64?: string) => {
    doc.setFillColor(...COLORS.bgGray);
    doc.rect(x, y, w, h, 'F');
    
    if (imageBase64) {
      try {
        doc.addImage(imageBase64, 'PNG', x, y, w, h);
      } catch (e) {
        doc.setTextColor(...COLORS.lightGray);
        doc.setFontSize(9);
        doc.text(`[ ${label} ]`, x + w/2, y + h/2, { align: 'center' });
      }
    } else {
      doc.setTextColor(...COLORS.lightGray);
      doc.setFontSize(9);
      doc.text(`[ ${label} ]`, x + w/2, y + h/2, { align: 'center' });
    }
  };
  
  // Row 1: Headshot + Full Body
  imgPlaceholder(15, 40, 85, 100, 'HEADSHOT', data.images.headshot);
  imgPlaceholder(105, 40, 85, 100, 'FULL BODY', data.images.fullBody);
  
  // Labels
  doc.setFont('courier', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...COLORS.mediumGray);
  doc.text('PRIMARY HEADSHOT', 57.5, 145, { align: 'center' });
  doc.text('FULL BODY STANDING', 147.5, 145, { align: 'center' });
  
  // Row 2: Profile + Walk + Back
  imgPlaceholder(15, 155, 55, 70, 'PROFILE', data.images.profile);
  imgPlaceholder(75, 155, 55, 70, 'WALK', data.images.walk);
  imgPlaceholder(135, 155, 55, 70, 'BACK', data.images.back);
  
  doc.text('PROFILE VIEW', 42.5, 230, { align: 'center' });
  doc.text('MOVEMENT / WALK', 102.5, 230, { align: 'center' });
  doc.text('REAR VIEW', 162.5, 230, { align: 'center' });
  
  // Stats box
  doc.setDrawColor(...COLORS.veryLightGray);
  doc.setLineWidth(0.3);
  doc.rect(15, 240, pageWidth - 30, 30);
  
  const drawStat = (label: string, value: string, x: number, y: number) => {
    doc.setFont('courier', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...COLORS.black);
    doc.text(`${label}: `, x, y);
    doc.setFont('courier', 'normal');
    doc.text(value || '-', x + doc.getTextWidth(`${label}: `), y);
  };
  
  drawStat('AGE', data.preferences.age || '-', 20, 250);
  drawStat('HEIGHT', "5'10\"", 70, 250);
  drawStat('BODY', data.preferences.bodyType || 'Athletic Slim', 130, 250);
  drawStat('EYES', data.preferences.eyeColor || '-', 20, 260);
  drawStat('HAIR', data.preferences.hairColor || '-', 70, 260);
  drawStat('SKIN', data.preferences.skinTone || '-', 130, 260);
  
  // Casting context
  doc.setFont('courier', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...COLORS.mediumGray);
  const vibe = data.preferences.castingVibe;
  const vibeStr = vibe ? `Editorial ${Math.round(vibe.editorial * 100)}% / Commercial ${Math.round(vibe.commercial * 100)}% / Runway ${Math.round(vibe.runway * 100)}%` : 'Editorial 45% / Commercial 35% / Runway 20%';
  doc.text(`CASTING: ${data.preferences.castingBrand || 'Bottega Veneta'}  -  VIBE: ${vibeStr}`, 20, 268);
  
  // Footer
  addPageFooter(doc, pageNum, totalPages, data.agencyId);
}

// Page 3: Character Sheet
function createCharacterSheetPage(doc: jsPDF, data: PdfModelData, pageNum: number, totalPages: number) {
  doc.addPage();
  const pageWidth = doc.internal.pageSize.getWidth();
  const prefs = data.preferences;
  
  // Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(...COLORS.black);
  doc.text('CHARACTER SHEET', 15, 20);
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.mediumGray);
  doc.text('Complete attribute breakdown for identity consistency', 15, 28);
  
  // Divider
  doc.setDrawColor(...COLORS.veryLightGray);
  doc.setLineWidth(0.3);
  doc.line(15, 33, pageWidth - 15, 33);
  
  // Two column layout
  const col1X = 15;
  const col2X = 110;
  let y1 = 45;
  let y2 = 45;
  
  const drawSection = (title: string, items: [string, string][], x: number, startY: number): number => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...COLORS.accent);
    doc.text(title, x, startY);
    
    // Underline
    doc.setDrawColor(...COLORS.accent);
    doc.setLineWidth(0.5);
    doc.line(x, startY + 2, x + 35, startY + 2);
    
    let y = startY + 12;
    for (const [label, value] of items) {
      doc.setFont('courier', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(...COLORS.mediumGray);
      doc.text(label.toUpperCase(), x, y);
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(...COLORS.black);
      doc.text(value || '-', x + 35, y);
      y += 8;
    }
    return y + 5;
  };
  
  // Column 1
  y1 = drawSection('DEMOGRAPHICS', [
    ['GENDER', prefs.gender || 'Female'],
    ['AGE', prefs.age || '24'],
    ['ETHNICITY', prefs.ethnicity || 'European'],
    ['BODY TYPE', prefs.bodyType || 'Athletic Slim'],
    ['HEIGHT', "5'10\""],
  ], col1X, y1);
  
  y1 = drawSection('FACIAL STRUCTURE', [
    ['FACE SHAPE', prefs.faceShape || 'Oval'],
    ['JAWLINE', prefs.jawline || 'Soft Defined'],
    ['CHEEKBONES', prefs.cheekbones || 'High, Subtle'],
    ['CHEEKS', prefs.cheeks || 'Slightly Hollow'],
  ], col1X, y1);
  
  y1 = drawSection('FEATURES', [
    ['EYE SHAPE', prefs.eyeShape || 'Almond, Upturned'],
    ['EYE COLOR', prefs.eyeColor || 'Hazel Green'],
    ['NOSE', prefs.noseShape || 'Straight, Refined'],
    ['LIPS', prefs.lipShape || "Full, Cupid's Bow"],
    ['EYEBROWS', prefs.eyebrowStyle || 'Natural Soft Arch'],
  ], col1X, y1);
  
  // Column 2
  y2 = drawSection('SKIN PROFILE', [
    ['TONE', prefs.skinTone || 'Fair with Warm Undertones'],
    ['TEXTURE', prefs.skinTexture || 'Smooth, Healthy'],
    ['FINISH', prefs.skinFinish || 'Natural Luminous'],
    ['CONDITION', 'Clear'],
  ], col2X, y2);
  
  y2 = drawSection('HAIR SYSTEM', [
    ['COLOR', prefs.hairColor || 'Warm Auburn'],
    ['STYLE', prefs.hairStyle || 'Loose Waves'],
    ['LENGTH', prefs.hairLength || 'Medium (Past Shoulders)'],
    ['TEXTURE', prefs.hairTexture || 'Natural Movement'],
    ['VOLUME', prefs.hairVolume || 'Natural Body'],
    ['FRINGE', prefs.hairFringe || 'Face-Framing Layers'],
    ['PARTING', prefs.hairParting || 'Subtle Side'],
    ['FLYAWAYS', prefs.hairFlyaways || 'Natural Organic'],
  ], col2X, y2);
  
  y2 = drawSection('CASTING CONTEXT', [
    ['BRAND', prefs.castingBrand || 'Bottega Veneta'],
    ['EDITORIAL', `${Math.round((prefs.castingVibe?.editorial || 0.45) * 100)}%`],
    ['COMMERCIAL', `${Math.round((prefs.castingVibe?.commercial || 0.35) * 100)}%`],
    ['RUNWAY', `${Math.round((prefs.castingVibe?.runway || 0.20) * 100)}%`],
  ], col2X, y2);
  
  // Footer
  addPageFooter(doc, pageNum, totalPages, data.agencyId);
}

// Page 4: Director's Notes
function createDirectorsNotesPage(doc: jsPDF, data: PdfModelData, pageNum: number, totalPages: number) {
  doc.addPage();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  
  // Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(...COLORS.black);
  doc.text("DIRECTOR'S NOTES", margin, 20);
  
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.mediumGray);
  doc.text('The complete casting specification used to generate this identity', margin, 28);
  
  // Divider
  doc.setDrawColor(...COLORS.veryLightGray);
  doc.setLineWidth(0.3);
  doc.line(margin, 33, pageWidth - margin, 33);
  
  // Quote box
  doc.setFillColor(250, 250, 250);
  doc.rect(margin, 40, contentWidth, 200, 'F');
  doc.setDrawColor(230, 230, 230);
  doc.rect(margin, 40, contentWidth, 200, 'D');
  
  // Opening quote mark
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(36);
  doc.setTextColor(...COLORS.accent);
  doc.text('"', margin + 5, 55);
  
  // Master prompt content
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.darkGray);
  
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
  doc.setTextColor(...COLORS.accent);
  doc.text('"', pageWidth - margin - 15, 230);
  
  // Attribution
  doc.setFont('courier', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...COLORS.lightGray);
  doc.text(`Generated by Organic Casting Engine v3.1  -  ${data.createdAt}`, 105, 255, { align: 'center' });
  
  // Footer
  addPageFooter(doc, pageNum, totalPages, data.agencyId);
}

// Page 5: Certificate of Authenticity
function createCertificatePage(doc: jsPDF, data: PdfModelData, pageNum: number, totalPages: number) {
  doc.addPage();
  const pageWidth = doc.internal.pageSize.getWidth();
  
  // Decorative border
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.5);
  doc.rect(10, 10, 190, 277, 'D');
  doc.setLineWidth(0.2);
  doc.rect(12, 12, 186, 273, 'D');
  
  // Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(24);
  doc.setTextColor(...COLORS.black);
  doc.text('CERTIFICATE OF AUTHENTICITY', 105, 35, { align: 'center' });
  
  // Subtitle
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...COLORS.mediumGray);
  doc.text('Digital Identity Verification & Provenance Record', 105, 45, { align: 'center' });
  
  // Decorative line
  doc.setDrawColor(...COLORS.accent);
  doc.setLineWidth(1);
  doc.line(70, 52, 140, 52);
  
  // Model info box
  doc.setFillColor(250, 250, 250);
  doc.rect(25, 60, 160, 40, 'F');
  
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(...COLORS.black);
  doc.text(data.modelName.toUpperCase(), 105, 75, { align: 'center' });
  
  doc.setFont('courier', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...COLORS.accent);
  doc.text(data.agencyId, 105, 88, { align: 'center' });
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.mediumGray);
  doc.text('Unique Model Identifier', 105, 96, { align: 'center' });
  
  // Generation record
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...COLORS.black);
  doc.text('GENERATION RECORD', 25, 115);
  
  doc.setDrawColor(230, 230, 230);
  doc.rect(25, 120, 160, 55, 'D');
  
  const records = [
    ['Model ID', data.agencyId],
    ['Session ID', data.sessionId],
    ['Created', data.createdAt],
    ['Minted', data.mintedAt],
    ['Engine', 'Gemini 3 Pro Image Preview'],
    ['Resolution', '4K Ultra (3840x5120)'],
  ];
  
  let y = 128;
  for (const [label, value] of records) {
    doc.setFont('courier', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.mediumGray);
    doc.text(`${label}:`, 30, y);
    
    doc.setFont('courier', 'bold');
    doc.setTextColor(...COLORS.black);
    doc.text(value, 75, y);
    y += 8;
  }
  
  // Secure hash
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...COLORS.black);
  doc.text('SECURE HASH', 25, 185);
  
  const hashInput = data.agencyId + data.sessionId + data.createdAt;
  const secureHash = generateSecureHash(hashInput);
  
  doc.setFont('courier', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.black);
  doc.text(secureHash, 25, 195);
  
  // Visual hash
  drawHashVisual(doc, secureHash, 145, 180, 25);
  
  // Owner information
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...COLORS.black);
  doc.text('ISSUED TO', 25, 220);
  
  doc.setDrawColor(230, 230, 230);
  doc.rect(25, 225, 160, 25, 'D');
  
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(data.ownerName, 30, 235);
  
  doc.setFont('courier', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.mediumGray);
  doc.text(`Account: ${data.ownerId}`, 30, 243);
  
  // Certification stamp
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.accent);
  doc.text('DIGITALLY CERTIFIED', 155, 260, { align: 'center' });
  
  doc.setDrawColor(...COLORS.accent);
  doc.setLineWidth(1);
  doc.ellipse(155, 270, 15, 7.5, 'D');
  
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.text('DRAPE', 155, 272, { align: 'center' });
  
  // Footer note
  doc.setFont('courier', 'normal');
  doc.setFontSize(6);
  doc.setTextColor(...COLORS.lightGray);
  doc.text('This certificate verifies the authenticity and provenance of the above digital identity.', 105, 285, { align: 'center' });
}

// Page 6: Technical Appendix
function createTechnicalAppendixPage(doc: jsPDF, data: PdfModelData, pageNum: number, totalPages: number) {
  doc.addPage();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  
  // Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(...COLORS.black);
  doc.text('TECHNICAL APPENDIX', margin, 20);
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.mediumGray);
  doc.text('Complete technical schema for developers and archival purposes', margin, 28);
  
  // Divider
  doc.setDrawColor(...COLORS.veryLightGray);
  doc.setLineWidth(0.3);
  doc.line(margin, 33, pageWidth - margin, 33);
  
  // Code block background
  doc.setFillColor(250, 250, 250);
  doc.rect(margin, 40, pageWidth - margin * 2, 200, 'F');
  doc.setDrawColor(230, 230, 230);
  doc.rect(margin, 40, pageWidth - margin * 2, 200, 'D');
  
  // JSON schema
  const prefs = data.preferences;
  const schema = {
    subject: {
      gender: prefs.gender || 'female',
      age: prefs.age || '24',
      ethnicity: prefs.ethnicity || 'European',
      body_type: prefs.bodyType || 'athletic_slim',
      skin_tone: prefs.skinTone || 'fair_warm',
      eye_color: prefs.eyeColor || 'hazel_green',
      hair_color: prefs.hairColor || 'warm_auburn',
      hair_style: prefs.hairStyle || 'loose_waves',
      hair_length: prefs.hairLength || 'medium',
    },
    face: {
      shape: prefs.faceShape || 'oval',
      jawline: prefs.jawline || 'soft_defined',
      cheekbones: prefs.cheekbones || 'high_subtle',
      cheeks: prefs.cheeks || 'slightly_hollow',
      eye_shape: prefs.eyeShape || 'almond_upturned',
      nose_shape: prefs.noseShape || 'straight_refined',
      lip_shape: prefs.lipShape || 'full_cupids_bow',
      eyebrow_style: prefs.eyebrowStyle || 'natural_soft_arch',
    },
    context: {
      casting_for: prefs.castingBrand || 'Bottega Veneta',
      vibe_blend: prefs.castingVibe || { editorial: 0.45, commercial: 0.35, runway: 0.20 },
      lighting: 'soft_diffused',
      backdrop: 'neutral_clean',
    },
    skin: {
      tone: prefs.skinTone || 'smooth_healthy',
      texture: prefs.skinTexture || 'natural_luminous',
      finish: prefs.skinFinish || 'clear',
      condition: 'clear',
    },
    hair: {
      style: prefs.hairStyle || 'loose_waves',
      texture: prefs.hairTexture || 'natural_body',
      volume: prefs.hairVolume || 'face_framing',
      fringe: prefs.hairFringe || 'subtle_side',
      parting: prefs.hairParting || 'natural_organic',
      flyaways: prefs.hairFlyaways || 'natural',
    },
  };
  
  // Render JSON with syntax highlighting
  let y = 50;
  const renderJson = (obj: any, indent: number = 0) => {
    const indentStr = '  '.repeat(indent);
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'object' && value !== null) {
        // Key in blue
        doc.setFont('courier', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(59, 130, 246); // Blue
        doc.text(`${indentStr}"${key}":`, margin + 5, y);
        y += 5;
        renderJson(value, indent + 1);
      } else {
        // Key in blue
        doc.setTextColor(59, 130, 246);
        doc.text(`${indentStr}"${key}":`, margin + 5, y);
        
        // Value in orange/green
        const keyWidth = doc.getTextWidth(`${indentStr}"${key}": `);
        if (typeof value === 'number') {
          doc.setTextColor(234, 179, 8); // Yellow for numbers
        } else {
          doc.setTextColor(34, 197, 94); // Green for strings
        }
        doc.text(`"${value}"`, margin + 5 + keyWidth, y);
        y += 5;
      }
      
      if (y > 230) return; // Prevent overflow
    }
  };
  
  renderJson(schema);
  
  // Note
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.lightGray);
  doc.text('This schema can be used to recreate or reference this identity in compatible systems.', 105, 250, { align: 'center' });
  
  // Footer
  addPageFooter(doc, pageNum, totalPages, data.agencyId);
}

// Page 7: Ownership & Usage Rights
function createLegalPage(doc: jsPDF, data: PdfModelData, pageNum: number, totalPages: number) {
  doc.addPage();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  
  // Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(...COLORS.black);
  doc.text('OWNERSHIP & USAGE RIGHTS', margin, 20);
  
  // Divider
  doc.setDrawColor(...COLORS.veryLightGray);
  doc.setLineWidth(0.3);
  doc.line(margin, 28, pageWidth - margin, 28);
  
  const sections = [
    ['GRANT OF RIGHTS', 'Upon export and minting of this digital identity, the Exporting Party ("Owner") is granted exclusive, perpetual, worldwide rights to use, reproduce, modify, and distribute this Generated Model and all associated renders for any lawful purpose, including but not limited to commercial, editorial, and personal use.'],
    ['PERMITTED USES', 'The Owner may use this digital identity for: advertising and marketing campaigns, editorial content and publications, social media and digital platforms, merchandise and product visualization, film, television, and video production, virtual and augmented reality applications, and any derivative works.'],
    ['RESTRICTIONS', 'This digital identity may not be used to: create defamatory, illegal, or harmful content, impersonate real individuals without consent, generate content that violates applicable laws, or claim the identity represents a real human being in contexts where such representation would be misleading.'],
    ['AUTHENTICITY DECLARATION', 'This identity is a procedurally generated digital composite created using artificial intelligence. It does not represent any real person, living or deceased. The unique characteristics of this identity are the result of algorithmic generation and do not infringe upon any individual\'s likeness rights.'],
    ['PROVENANCE', 'This identity was generated and minted through Drape(TM) Organic Casting Engine. The generation parameters, timestamps, and cryptographic signatures are permanently recorded and can be verified against the Drape(TM) registry.'],
  ];
  
  let y = 40;
  for (const [title, content] of sections) {
    if (y > 220) break;
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...COLORS.black);
    doc.text(title, margin, y);
    
    doc.setDrawColor(...COLORS.black);
    doc.setLineWidth(0.3);
    doc.line(margin, y + 2, margin + 40, y + 2);
    
    y += 8;
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.darkGray);
    const lines = doc.splitTextToSize(content, contentWidth);
    doc.text(lines, margin, y);
    y += lines.length * 4 + 10;
  }
  
  // Signature lines
  doc.setDrawColor(...COLORS.black);
  doc.setLineWidth(0.3);
  doc.line(margin, 245, margin + 75, 245);
  doc.line(120, 245, pageWidth - margin, 245);
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...COLORS.lightGray);
  doc.text('Digital Signature (Drape(TM))', margin + 37.5, 252, { align: 'center' });
  doc.text('Date of Issue', 157.5, 252, { align: 'center' });
  
  // Fill values
  doc.setFont('courier', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.black);
  doc.text('DRAPE(TM) CERTIFIED', margin + 37.5, 242, { align: 'center' });
  doc.text(new Date().toISOString().split('T')[0], 157.5, 242, { align: 'center' });
  
  // Footer
  addPageFooter(doc, pageNum, totalPages, data.agencyId);
}

// Helper: Add page footer
function addPageFooter(doc: jsPDF, pageNum: number, totalPages: number, agencyId: string) {
  doc.setFont('courier', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...COLORS.mediumGray);
  doc.text(`Page ${pageNum} of ${totalPages}  -  ${agencyId}  -  DRAPE(TM) IDENTITY DOCUMENT`, 105, 287, { align: 'center' });
}

/**
 * Generate the complete 7-page premium identity document
 */
export async function generatePremiumIdentityPdf(data: PdfModelData): Promise<ArrayBuffer> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const totalPages = 7;
  
  // Generate all pages
  createCoverPage(doc, data);
  createCompCardPage(doc, data, 2, totalPages);
  createCharacterSheetPage(doc, data, 3, totalPages);
  createDirectorsNotesPage(doc, data, 4, totalPages);
  createCertificatePage(doc, data, 5, totalPages);
  createTechnicalAppendixPage(doc, data, 6, totalPages);
  createLegalPage(doc, data, 7, totalPages);
  
  return doc.output('arraybuffer');
}
