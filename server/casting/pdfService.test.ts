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
});
