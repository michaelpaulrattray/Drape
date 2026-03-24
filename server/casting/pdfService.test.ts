import { describe, it, expect } from 'vitest';
import { generatePremiumIdentityPdf, PdfModelData } from './pdfService';

describe('PDF Service', () => {
  const mockPdfData: PdfModelData = {
    modelName: 'Test Model',
    agencyId: 'MOD-26-ABC123',
    sessionId: 'SES-1',
    createdAt: '2026-02-04',
    mintedAt: '2026-02-04',
    ownerName: 'Test User',
    ownerId: 'user-123',
    masterPrompt: 'A beautiful model with flowing auburn hair and hazel eyes. She has an oval face with soft features and a warm skin tone.',
    preferences: {
      gender: 'female',
      age: '24',
      ethnicity: 'European',
      bodyType: 'Athletic Slim',
      skinTone: 'Fair with Warm Undertones',
      skinTexture: 'Smooth',
      skinFinish: 'Natural Luminous',
      eyeColor: 'Hazel Green',
      hairColor: 'Warm Auburn',
      hairStyle: 'Loose Waves',
      hairLength: 'Medium',
      faceShape: 'Oval',
      castingBrand: 'Bottega Veneta',
      castingVibe: { editorial: 0.45, commercial: 0.35, runway: 0.20 },
    },
    images: {},
  };

  it('should generate a PDF buffer', async () => {
    const result = await generatePremiumIdentityPdf(mockPdfData);
    
    expect(result).toBeDefined();
    expect(result).toBeInstanceOf(ArrayBuffer);
    expect(result.byteLength).toBeGreaterThan(0);
  });

  it('should generate a valid PDF with correct header', async () => {
    const result = await generatePremiumIdentityPdf(mockPdfData);
    const bytes = new Uint8Array(result);
    
    // PDF files start with %PDF-
    const header = String.fromCharCode(...bytes.slice(0, 5));
    expect(header).toBe('%PDF-');
  });

  it('should handle missing optional preferences', async () => {
    const minimalData: PdfModelData = {
      modelName: 'Minimal Model',
      agencyId: 'MOD-26-MIN001',
      sessionId: 'SES-2',
      createdAt: '2026-02-04',
      mintedAt: '2026-02-04',
      ownerName: 'Test User',
      ownerId: 'user-456',
      masterPrompt: 'A simple test prompt.',
      preferences: {},
      images: {},
    };
    
    const result = await generatePremiumIdentityPdf(minimalData);
    
    expect(result).toBeDefined();
    expect(result).toBeInstanceOf(ArrayBuffer);
    expect(result.byteLength).toBeGreaterThan(0);
  });

  it('should handle empty master prompt', async () => {
    const dataWithEmptyPrompt: PdfModelData = {
      ...mockPdfData,
      masterPrompt: '',
    };
    
    const result = await generatePremiumIdentityPdf(dataWithEmptyPrompt);
    
    expect(result).toBeDefined();
    expect(result.byteLength).toBeGreaterThan(0);
  });

  it('should handle very long model names', async () => {
    const dataWithLongName: PdfModelData = {
      ...mockPdfData,
      modelName: 'A'.repeat(100),
    };
    
    const result = await generatePremiumIdentityPdf(dataWithLongName);
    
    expect(result).toBeDefined();
    expect(result.byteLength).toBeGreaterThan(0);
  });

  it('should handle special characters in model name', async () => {
    const dataWithSpecialChars: PdfModelData = {
      ...mockPdfData,
      modelName: 'Test Model & Co. (2026)',
    };
    
    const result = await generatePremiumIdentityPdf(dataWithSpecialChars);
    
    expect(result).toBeDefined();
    expect(result.byteLength).toBeGreaterThan(0);
  });

  it('should generate PDF with only partial views (no walk/back)', async () => {
    const dataPartialViews: PdfModelData = {
      ...mockPdfData,
      images: {
        headshot: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        fullBody: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        profile: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      },
    };
    
    const result = await generatePremiumIdentityPdf(dataPartialViews);
    expect(result).toBeDefined();
    expect(result.byteLength).toBeGreaterThan(0);
  });

  it('should not contain hardcoded fallback values in output', async () => {
    const minimalData: PdfModelData = {
      modelName: 'Fallback Test',
      agencyId: 'MOD-26-FALL01',
      sessionId: 'SES-FALL',
      createdAt: '2026-03-24',
      mintedAt: '2026-03-24',
      ownerName: 'Test',
      ownerId: 'user-fall',
      masterPrompt: 'Test prompt',
      preferences: {},
      images: {},
    };
    
    const result = await generatePremiumIdentityPdf(minimalData);
    // Decode PDF text content to verify no hardcoded fallbacks
    const text = new TextDecoder('latin1').decode(result);
    // Should NOT contain old hardcoded values
    expect(text).not.toContain('Bottega Veneta');
    expect(text).not.toContain('Athletic Slim');
    expect(text).not.toContain('4K Ultra');
    expect(text).not.toContain('3840x5120');
    expect(text).not.toContain('Organic Casting Engine');
    expect(text.byteLength || result.byteLength).toBeGreaterThan(0);
  });

  it('should contain correct resolution in certificate', async () => {
    const result = await generatePremiumIdentityPdf(mockPdfData);
    const text = new TextDecoder('latin1').decode(result);
    // Should contain the corrected resolution
    expect(text).toContain('2048');
    // Should NOT contain old fake resolution
    expect(text).not.toContain('3840x5120');
  });

  it('should contain Drape branding throughout', async () => {
    const result = await generatePremiumIdentityPdf(mockPdfData);
    const text = new TextDecoder('latin1').decode(result);
    expect(text).toContain('DRAPE');
    expect(text).toContain('Casting Studio');
    // Should NOT contain old engine name
    expect(text).not.toContain('Organic Casting Engine');
  });
});
