/**
 * Generate a mock PDF using the pdfService with placeholder data.
 * Run: node --import tsx scripts/generate-mock-pdf.mjs
 */
import { generatePremiumIdentityPdf } from '../server/casting/pdfService.ts';
import fs from 'fs';
import path from 'path';

const mockData = {
  modelName: 'Valentina Reyes',
  agencyId: 'MOD_26_7F3A9B',
  sessionId: 'SES-2026-0324-001',
  createdAt: '2026-03-24 16:08:00',
  mintedAt: '2026-03-24 16:12:34',
  ownerName: 'Mike',
  ownerId: 'usr_00001',
  masterPrompt:
    'A striking female model in her mid-twenties with Mediterranean features. She has an oval face with high, defined cheekbones and a soft jawline. Her skin is a warm olive tone with a natural luminous finish and smooth texture. Her eyes are deep brown with an almond shape, framed by naturally arched brows. Her hair is dark chestnut, styled in loose textured waves that fall past her shoulders with a subtle side parting and natural flyaways. She has full lips with a gentle cupid\'s bow and a straight, refined nose. Her physique is slim-athletic, conveying effortless elegance. The overall mood is editorial with a commercial crossover — think Bottega Veneta meets COS. Lighting should be soft and directional, evoking a warm studio environment.',
  preferences: {
    gender: 'Female',
    age: '25',
    ethnicity: 'Mediterranean',
    bodyType: 'Slim Athletic',
    skinTone: 'Warm Olive',
    skinTexture: 'Smooth',
    skinFinish: 'Natural Luminous',
    eyeColor: 'Deep Brown',
    hairColor: 'Dark Chestnut',
    hairStyle: 'Loose Textured Waves',
    hairLength: 'Past Shoulders',
    hairTexture: 'Natural Movement',
    hairVolume: 'Natural Body',
    hairFringe: 'None',
    hairParting: 'Subtle Side',
    hairFlyaways: 'Natural Organic',
    faceShape: 'Oval',
    jawline: 'Soft Defined',
    cheekbones: 'High, Defined',
    cheeks: 'Slightly Hollow',
    eyeShape: 'Almond',
    noseShape: 'Straight, Refined',
    lipShape: "Full, Cupid's Bow",
    eyebrowStyle: 'Natural Arch',
    castingBrand: 'Bottega Veneta',
    castingVibe: { editorial: 0.55, commercial: 0.30, runway: 0.15 },
  },
  images: {
    // No real images — the PDF will show placeholders
  },
};

async function main() {
  console.log('Generating mock PDF...');
  const buffer = await generatePremiumIdentityPdf(mockData);
  const outPath = path.resolve('/home/ubuntu/MOCK_VALENTINA_REYES_MOD_26_7F3A9B.pdf');
  fs.writeFileSync(outPath, Buffer.from(buffer));
  console.log(`Done! PDF saved to: ${outPath}`);
}

main().catch(console.error);
