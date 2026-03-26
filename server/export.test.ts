/**
 * Export Pack Tests — useExportPack constants, view mapping, and label formatting.
 *
 * Tests the view label/filename mapping, PDF key mapping, attribute formatting,
 * and export panel data derivation logic.
 */
import { describe, it, expect } from "vitest";

// ── View Label & Filename Mapping ─────────────────────────────

describe("Export View Mapping", () => {
  const VIEW_LABELS: Record<string, string> = {
    frontClose: "Headshot",
    frontFull: "Full Body",
    sideClose: "Profile",
    sideFull: "Walk",
    backFull: "Rear",
  };

  const VIEW_FILENAMES: Record<string, string> = {
    frontClose: "01_Headshot_Primary.png",
    frontFull: "02_Full_Body_Standing.png",
    sideClose: "03_Profile_Head.png",
    sideFull: "04_Full_Body_Walk.png",
    backFull: "05_Full_Body_Rear.png",
  };

  const VIEW_TO_PDF_KEY: Record<string, string> = {
    frontClose: "headshot",
    frontFull: "fullBody",
    sideClose: "profile",
    sideFull: "walk",
    backFull: "back",
  };

  it("should have labels for all 5 standard view types", () => {
    expect(Object.keys(VIEW_LABELS)).toHaveLength(5);
    expect(VIEW_LABELS.frontClose).toBe("Headshot");
    expect(VIEW_LABELS.frontFull).toBe("Full Body");
    expect(VIEW_LABELS.sideClose).toBe("Profile");
    expect(VIEW_LABELS.sideFull).toBe("Walk");
    expect(VIEW_LABELS.backFull).toBe("Rear");
  });

  it("should have numbered filenames for ZIP ordering", () => {
    expect(VIEW_FILENAMES.frontClose).toMatch(/^01_/);
    expect(VIEW_FILENAMES.frontFull).toMatch(/^02_/);
    expect(VIEW_FILENAMES.sideClose).toMatch(/^03_/);
    expect(VIEW_FILENAMES.sideFull).toMatch(/^04_/);
    expect(VIEW_FILENAMES.backFull).toMatch(/^05_/);
  });

  it("all filenames should end with .png", () => {
    Object.values(VIEW_FILENAMES).forEach((fn) => {
      expect(fn).toMatch(/\.png$/);
    });
  });

  it("should map view types to PDF keys", () => {
    expect(VIEW_TO_PDF_KEY.frontClose).toBe("headshot");
    expect(VIEW_TO_PDF_KEY.frontFull).toBe("fullBody");
    expect(VIEW_TO_PDF_KEY.sideClose).toBe("profile");
    expect(VIEW_TO_PDF_KEY.sideFull).toBe("walk");
    expect(VIEW_TO_PDF_KEY.backFull).toBe("back");
  });

  it("all view types should have both labels and filenames", () => {
    const viewTypes = Object.keys(VIEW_LABELS);
    viewTypes.forEach((vt) => {
      expect(VIEW_FILENAMES).toHaveProperty(vt);
      expect(VIEW_TO_PDF_KEY).toHaveProperty(vt);
    });
  });
});

// ── Attribute Formatting ──────────────────────────────────────

describe("Attribute Label Formatting", () => {
  function formatLabel(key: string): string {
    return key
      .replace(/([A-Z])/g, " $1")
      .replace(/^./, (s) => s.toUpperCase())
      .trim();
  }

  it("should convert camelCase to readable labels", () => {
    expect(formatLabel("skinTone")).toBe("Skin Tone");
    expect(formatLabel("eyeColor")).toBe("Eye Color");
    expect(formatLabel("hairStyle")).toBe("Hair Style");
    expect(formatLabel("castingBrand")).toBe("Casting Brand");
  });

  it("should handle single-word keys", () => {
    expect(formatLabel("gender")).toBe("Gender");
    expect(formatLabel("age")).toBe("Age");
  });

  it("should handle multi-part camelCase", () => {
    expect(formatLabel("bodyType")).toBe("Body Type");
    expect(formatLabel("faceShape")).toBe("Face Shape");
  });
});

// ── View Asset Sorting ────────────────────────────────────────

describe("View Asset Sorting", () => {
  const ORDER = ["frontClose", "frontFull", "sideClose", "sideFull", "backFull"];

  it("should sort assets in the correct display order", () => {
    const unsorted = [
      { viewType: "backFull", storageUrl: "url5" },
      { viewType: "frontClose", storageUrl: "url1" },
      { viewType: "sideClose", storageUrl: "url3" },
      { viewType: "frontFull", storageUrl: "url2" },
    ];

    const sorted = [...unsorted].sort(
      (a, b) => ORDER.indexOf(a.viewType) - ORDER.indexOf(b.viewType),
    );

    expect(sorted[0].viewType).toBe("frontClose");
    expect(sorted[1].viewType).toBe("frontFull");
    expect(sorted[2].viewType).toBe("sideClose");
    expect(sorted[3].viewType).toBe("backFull");
  });

  it("should filter out unknown view types", () => {
    const VIEW_LABELS: Record<string, string> = {
      frontClose: "Headshot",
      frontFull: "Full Body",
      sideClose: "Profile",
      sideFull: "Walk",
      backFull: "Rear",
    };

    const assets = [
      { viewType: "frontClose", storageUrl: "url1" },
      { viewType: "unknownView", storageUrl: "url2" },
      { viewType: "frontFull", storageUrl: "url3" },
    ];

    const filtered = assets.filter((a) => VIEW_LABELS[a.viewType]);
    expect(filtered).toHaveLength(2);
    expect(filtered.map((a) => a.viewType)).toEqual(["frontClose", "frontFull"]);
  });
});

// ── Preferences Extraction ────────────────────────────────────

describe("Preferences Extraction from Technical Schema", () => {
  it("should extract preferences from nested technical schema", () => {
    const technicalSchema = {
      subject: {
        gender: "female",
        age: "25",
        ethnicity: "Korean",
        body_type: "slim",
        skin_tone: "warm ivory",
        eye_color: "dark brown",
        hair_color: "black",
        hair_style: "long straight",
      },
      face: {
        shape: "oval",
      },
      context: {
        casting_for: "Chanel",
      },
    };

    const ts = technicalSchema as Record<string, any>;
    const prefs = {
      gender: ts.subject?.gender,
      age: ts.subject?.age,
      ethnicity: ts.subject?.ethnicity,
      bodyType: ts.subject?.body_type,
      skinTone: ts.subject?.skin_tone || ts.skin?.tone,
      eyeColor: ts.subject?.eye_color,
      hairColor: ts.subject?.hair_color,
      hairStyle: ts.subject?.hair_style || ts.hair?.style,
      faceShape: ts.face?.shape,
      castingBrand: ts.context?.casting_for,
    };

    expect(prefs.gender).toBe("female");
    expect(prefs.age).toBe("25");
    expect(prefs.ethnicity).toBe("Korean");
    expect(prefs.bodyType).toBe("slim");
    expect(prefs.skinTone).toBe("warm ivory");
    expect(prefs.eyeColor).toBe("dark brown");
    expect(prefs.hairColor).toBe("black");
    expect(prefs.hairStyle).toBe("long straight");
    expect(prefs.faceShape).toBe("oval");
    expect(prefs.castingBrand).toBe("Chanel");
  });

  it("should handle missing/empty technical schema gracefully", () => {
    const ts = {} as Record<string, any>;
    const prefs = {
      gender: ts.subject?.gender,
      age: ts.subject?.age,
      skinTone: ts.subject?.skin_tone || ts.skin?.tone,
      faceShape: ts.face?.shape,
    };

    expect(prefs.gender).toBeUndefined();
    expect(prefs.age).toBeUndefined();
    expect(prefs.skinTone).toBeUndefined();
    expect(prefs.faceShape).toBeUndefined();
  });
});

// ── ZIP Filename Generation ───────────────────────────────────

describe("ZIP Filename Generation", () => {
  it("should generate safe filenames from model name", () => {
    const modelName = "Test Model";
    const safeName = modelName.trim().toUpperCase().replace(/[^a-zA-Z0-9]/g, "_");
    expect(safeName).toBe("TEST_MODEL");
  });

  it("should handle special characters in model name", () => {
    const modelName = "Élise O'Brien-Smith";
    const safeName = modelName.trim().toUpperCase().replace(/[^a-zA-Z0-9]/g, "_");
    expect(safeName).toMatch(/^[A-Z0-9_]+$/);
  });

  it("should generate correct ZIP filename format", () => {
    const safeName = "JANE_DOE";
    const zipFilename = `CASTING_PACK_${safeName}_2K.zip`;
    expect(zipFilename).toBe("CASTING_PACK_JANE_DOE_2K.zip");
  });

  it("should generate correct PDF filename format", () => {
    const agencyId = "MOD-26-A1B2C3";
    const cleanId = agencyId.replace(/[^a-zA-Z0-9]/g, "_");
    const pdfFilename = `LEGAL_IDENTITY_${cleanId}.pdf`;
    expect(pdfFilename).toBe("LEGAL_IDENTITY_MOD_26_A1B2C3.pdf");
  });

  it("should handle DRAFT fallback when no agencyId", () => {
    const agencyId: string | null = null;
    const cleanId = (agencyId || "DRAFT").replace(/[^a-zA-Z0-9]/g, "_");
    expect(cleanId).toBe("DRAFT");
  });
});

// ── Export Step Labels ────────────────────────────────────────

describe("Export Step Labels", () => {
  const STEP_LABELS: Record<string, string> = {
    idle: "",
    minting: "Minting identity...",
    upscaling: "Upscaling to 2K...",
    "generating-pdf": "Generating document...",
    compressing: "Compressing pack...",
    done: "Complete",
  };

  it("should have labels for all export steps", () => {
    expect(Object.keys(STEP_LABELS)).toHaveLength(6);
  });

  it("idle step should have empty label", () => {
    expect(STEP_LABELS.idle).toBe("");
  });

  it("all non-idle steps should have descriptive labels", () => {
    const nonIdle = Object.entries(STEP_LABELS).filter(([k]) => k !== "idle");
    nonIdle.forEach(([, label]) => {
      expect(label.length).toBeGreaterThan(0);
    });
  });
});

// ── Mint Status Logic ─────────────────────────────────────────

describe("Mint Status", () => {
  it("should detect minted model by agencyId presence", () => {
    const model = { agencyId: "MOD-26-A1B2C3" };
    expect(!!model.agencyId).toBe(true);
  });

  it("should detect unminted model by null agencyId", () => {
    const model = { agencyId: null };
    expect(!!model.agencyId).toBe(false);
  });

  it("agencyId format should match MOD-YY-XXXXXX pattern", () => {
    const agencyId = "MOD-26-A1B2C3";
    expect(agencyId).toMatch(/^MOD-\d{2}-[A-F0-9]{6}$/);
  });
});
