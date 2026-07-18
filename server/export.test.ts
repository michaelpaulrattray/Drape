/**
 * Export Pack Tests — current library-export naming and data formatting.
 *
 * Canonical six-view mapping is tested against the shared implementation in
 * exportViews.test.ts; this file does not carry another hardcoded copy.
 */
import { describe, it, expect } from "vitest";
import { isModelMintedStatus } from "../shared/modelLifecycle";
import { resolveExportEligibility } from "../shared/exportEligibility";

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
    const zipFilename = `CASTING_PACK_${safeName}_CURRENT.zip`;
    expect(zipFilename).toBe("CASTING_PACK_JANE_DOE_CURRENT.zip");
  });

  it("should generate correct PDF filename format", () => {
    const agencyId = "MOD-26-A1B2C3";
    const cleanId = agencyId.replace(/[^a-zA-Z0-9]/g, "_");
    const pdfFilename = `LEGAL_IDENTITY_${cleanId}.pdf`;
    expect(pdfFilename).toBe("LEGAL_IDENTITY_MOD_26_A1B2C3.pdf");
  });

  it("Batch B final round: there is NO DRAFT fallback — a missing ID refuses the export instead", () => {
    // Identity artifacts print only a verified agency ID. A missing or
    // whitespace-only ID makes the export ineligible (repair copy) before
    // any filename exists — resolveExportEligibility, shared client/server.
    expect(resolveExportEligibility({ status: "active", agencyId: null })).toEqual({
      ok: false,
      reason: "missing_agency_id",
    });
    expect(resolveExportEligibility({ status: "locked", agencyId: "  " })).toEqual({
      ok: false,
      reason: "missing_agency_id",
    });
  });
});

// ── Export Step Labels ────────────────────────────────────────

describe("Export Step Labels", () => {
  const STEP_LABELS: Record<string, string> = {
    idle: "",
    preparing: "Preparing the current views...",
    "generating-pdf": "Generating document...",
    compressing: "Compressing pack...",
    done: "Complete",
  };

  it("should have labels for all export steps", () => {
    expect(Object.keys(STEP_LABELS)).toHaveLength(5);
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
  it("Batch B: minted state is STATUS truth — agencyId presence proves nothing", () => {
    // The export hooks derive isMinted via the shared read model; the old
    // !!agencyId derivation misread stray-ID drafts and legacy locked rows.
    expect(isModelMintedStatus("active")).toBe(true);
    expect(isModelMintedStatus("locked")).toBe(true); // legacy minted alias
    expect(isModelMintedStatus("draft")).toBe(false); // even with a stray agencyId
    expect(isModelMintedStatus("archived")).toBe(false);
  });

  it("agencyId format should match MOD-YY-XXXXXX pattern (integrity detail, not read state)", () => {
    const agencyId = "MOD-26-A1B2C3";
    expect(agencyId).toMatch(/^MOD-\d{2}-[A-F0-9]{6}$/);
  });
});

// ── Saved Looks Logic ────────────────────────────────────────

describe("Saved Looks", () => {
  it("should generate safe filenames for look downloads", () => {
    const look = { name: "Summer Vibes", id: 42 };
    const safeName = (look.name || `Look_${look.id}`).replace(/[^a-zA-Z0-9]/g, "_");
    expect(safeName).toBe("Summer_Vibes");
  });

  it("should fallback to Look_ID when name is null", () => {
    const look = { name: null as string | null, id: 7 };
    const safeName = (look.name || `Look_${look.id}`).replace(/[^a-zA-Z0-9]/g, "_");
    expect(safeName).toBe("Look_7");
  });

  it("should generate numbered look filenames for ZIP", () => {
    const looks = [
      { name: "Beach Day", id: 1 },
      { name: null as string | null, id: 2 },
      { name: "Office Chic", id: 3 },
    ];

    const filenames = looks.map((look, i) => {
      const lookName = (look.name || `Look_${i + 1}`).replace(/[^a-zA-Z0-9]/g, "_");
      return `${String(i + 1).padStart(2, "0")}_${lookName}.png`;
    });

    expect(filenames[0]).toBe("01_Beach_Day.png");
    expect(filenames[1]).toBe("02_Look_2.png");
    expect(filenames[2]).toBe("03_Office_Chic.png");
  });

  it("should handle special characters in look names", () => {
    const look = { name: "Été à Paris (2026)", id: 10 };
    const safeName = (look.name || `Look_${look.id}`).replace(/[^a-zA-Z0-9]/g, "_");
    expect(safeName).toMatch(/^[a-zA-Z0-9_]+$/);
  });

});

// ── Looks Display Name ──────────────────────────────────────

describe("Look Display Name", () => {
  it("should use look name when available", () => {
    const look = { name: "Casual Friday", id: 5 };
    const displayName = look.name || `Look ${look.id}`;
    expect(displayName).toBe("Casual Friday");
  });

  it("should fallback to Look ID when name is null", () => {
    const look = { name: null as string | null, id: 12 };
    const displayName = look.name || `Look ${look.id}`;
    expect(displayName).toBe("Look 12");
  });
});

// ── Hero Preview Logic ──────────────────────────────────────

describe("Export Hero Preview Logic", () => {
  it("should prefer latest saved look over casting view", () => {
    const latestLook = { imageUrl: "https://s3.example.com/look1.png", name: "Red Dress" };
    const heroAsset = { storageUrl: "https://s3.example.com/fullbody.png", viewType: "frontFull" };

    const heroUrl = latestLook?.imageUrl || heroAsset?.storageUrl;
    expect(heroUrl).toBe("https://s3.example.com/look1.png");
  });

  it("should fallback to casting view when no saved looks", () => {
    const latestLook = null;
    const heroAsset = { storageUrl: "https://s3.example.com/fullbody.png", viewType: "frontFull" };

    const heroUrl = latestLook?.imageUrl || heroAsset?.storageUrl;
    expect(heroUrl).toBe("https://s3.example.com/fullbody.png");
  });

  it("should show look name as label when look is hero", () => {
    const latestLook = { imageUrl: "url", name: "Evening Gown" };
    const heroLabel = latestLook ? (latestLook.name || "Latest Look") : "Model Preview";
    expect(heroLabel).toBe("Evening Gown");
  });

  it("should show 'Latest Look' when look has no name", () => {
    const latestLook = { imageUrl: "url", name: null as string | null };
    const heroLabel = latestLook ? (latestLook.name || "Latest Look") : "Model Preview";
    expect(heroLabel).toBe("Latest Look");
  });

  it("should show 'Model Preview' when no looks exist", () => {
    const latestLook = null;
    const heroLabel = latestLook ? (latestLook?.name || "Latest Look") : "Model Preview";
    expect(heroLabel).toBe("Model Preview");
  });
});
