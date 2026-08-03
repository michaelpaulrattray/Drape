/**
 * The golden briefs — the sentences this product must never get wrong again.
 *
 * Every entry is a brief a founder actually typed, kept with what it must
 * produce. The list is the regression memory of the casting compiler: each one
 * is here because it failed once, in production, on a real roll.
 *
 * `category: true` means the sentence names an occupation, type or kind of
 * person, so `role` must come back non-null AND the echo must carry its
 * "cast as" clause. That pair is the assertion the founder added after a
 * high-fashion editorial brief came back as generic women — `role` is the only
 * field that produces the CASTING CATEGORY block, and gate B5's
 * category-owns-physique rule reads it.
 *
 * Shared by the offline suite (which checks the deterministic repair and the
 * echo) and the LIVE harness (`scripts/drive-golden-briefs.mts`, which checks
 * the interpreter itself). The live half exists because the last regression
 * hid behind stubs: every test drove a hand-written intent that already
 * contained what the bug removed.
 */

export type GoldenBrief = {
  brief: string;
  /** The sentence names a castable category, so `role` must survive. */
  category: boolean;
  /**
   * The sentence names an AESTHETIC REFERENCE — a house, a director, a film.
   * The token must never reach a prompt, and the aesthetic must land somewhere:
   * an archetype, a look, or a composed direction. Never all three null.
   */
  aestheticReference?: boolean;
  /**
   * A bar this brief pins for LATER, named by the work that will meet it.
   *
   * The harness reports these as PENDING rather than FAIL. A permanently red
   * harness is one people stop reading, and the point of recording a future
   * bar is that it survives to be met — not that it shouts every run.
   */
  deferredTo?: string;
  /** Why it is on the list. */
  because: string;
};

export const GOLDEN_BRIEFS: readonly GoldenBrief[] = [
  {
    brief: "female mid 20's high-fashion editorial model",
    category: true,
    because:
      "Persisted role: null with archetype 'raw editorial' — the category was routed into the closed direction vocabulary and the user's words dropped. The sheet read as generic women.",
  },
  {
    brief: "An East Asian model with long pastel pink hair",
    category: true,
    because:
      "Echoed as a fragment opening on a comma, because no category reached the opener — the same missing clause, seen from the other end.",
  },
  {
    brief: "A beauty creator in her late 20s, bleached brows",
    category: true,
    because: "A brow statement must not read as a hair statement; the sheet twinned when it did.",
  },
  {
    brief: "runway model, early 20s, shaved head",
    category: true,
    because: "Coverage is all-or-nothing: eight shaved heads, and no authored cut anywhere.",
  },
  {
    brief: "A skincare founder in his 40s, silver at the temples",
    category: true,
    because: "The brief that exposed full-axis hair deference collapsing a sheet to one haircut.",
  },
  {
    brief: "a 30 year old heavy metal bogan",
    category: true,
    because:
      "The styling-tier brief. A named cut competes with a subcultural category and wins, so the sheet came back as eight tidy haircuts wearing the wrong casting. Bar: visibly subcultural AND at least four distinct silhouettes.",
  },
  {
    brief: "female mid 20s fashion model casting for miu miu",
    category: true,
    aestheticReference: true,
    because:
      "The C7 case. Miu Miu fits no shelf archetype, so the reference landed nowhere at all — archetype null, look null — and the sheet was indistinguishable from one that said only campaign model.",
  },
  {
    brief: "a Margiela runway face, early 20s",
    category: true,
    aestheticReference: true,
    because:
      "THE ANTI-REGRESSION. This one already captures via the look shelf. Adding a second channel for aesthetics must not tempt the interpreter to stop using the first — that is the D-79 failure shape exactly.",
  },
  {
    brief: "a Wes Anderson casting, mid 30s",
    /*
      RE-MARKED true → false, with the behaviour, in one commit.

      It was marked `category: true` against this file's own definition eight
      lines up: "the sentence names an occupation, type or kind of person". "a
      Wes Anderson casting" names none — it names an aesthetic and an age. The
      live evidence agrees: the interpreter returns `role: null` on six of six
      and puts the aesthetic into the direction, which is the correct reading.

      What the wrong mark was holding up: the only way to make the assertion
      pass was for `promoteStatedRole` to promote the whole brief, which is
      what put a director's name into CASTING CATEGORY on every candidate. A
      red golden was demanding the defect.

      The aesthetic half of this entry is untouched and still binding — the
      reference must land somewhere, and the token must never reach a prompt.
    */
    category: false,
    aestheticReference: true,
    because:
      "The boundary the founder pinned: a reference to someone's AESTHETIC is direction. Casting the person stays refused under the named-person law.",
  },
  {
    brief: "a gothic male heavy metal bogan with a long beard and long hair in his mid 20s",
    category: true,
    deferredTo: "D-79 re-ship (partial deference), at M7",
    because:
      "THE FACT-LEVEL DEFERENCE GAP, pinned. Stating a length silences the whole colour axis as well, so the goth prior fills it and the sheet comes back uniformly black. Bar when partial deference returns: length and beard honoured 8/8 as stated, and colour still AUTHORED — dark-leaning for the aesthetic but not uniform, so the sheet can produce its blonde goth.",
  },
  {
    brief: "a photographer in his 50s with salt and pepper hair",
    category: true,
    deferredTo: "D-79 re-ship (partial deference), at M7",
    because:
      "THE GREYING CASE, and the one that has always half-worked. 'Salt and pepper' says something is happening TO the hair while the cut, the length and the base colour underneath are all still open — so full-axis deference silences four facts to honour one. It is the sibling of 'silver at the temples', which survived the D-79 rollback precisely because it routed through a structured field the code owns rather than through prose the interpreter had to keep writing. Bar when partial deference returns: the greying is honoured 8/8, the base reads dark rather than uniformly grey, and the cuts stay authored and varied.",
  },
  {
    brief: "a twitch streamer",
    category: true,
    because:
      "THE AGE-TENDENCY CASE. Nothing in the sentence states an age, so the band drew from the general population and the sheet came back with people who do not stream. The category knows something the brief never says. Bar: the sheet centres on the 20s WITHOUT collapsing to it — an older streamer must stay reachable, because an unusual casting is surprising and not wrong. SECOND BAR, added 2026-08-03 after the miss was finally measured: `role` must survive. It was coming back null on 12 of 120 live samples (10.0%, 95% CI 5.8-16.7%) — and 11 of those were OUR OWN proper-noun guard nulling a role the interpreter had written correctly as 'a Twitch streamer', because the guard could not tell a platform from a person. Fixed by vouching non-people in `properNouns.ts`; re-measured 0 of 120 (95% CI 0.0-3.1%), with the twelve capitalised draws in that run all kept. The load-bearing guard is `roleNameGuard.test.ts`, which runs on every change — this harness is paid and cannot be the only thing watching a one-in-ten event.",
  },
  {
    brief: "a k-pop idol",
    category: true,
    because:
      "THE GROOMING-TENDENCY CASE, and the mirror of the lumberjack. Conventionally clean-shaven, and left to the age curve a sheet of eight returns beards on a third of them. Bar: clean-shaven around seven of eight, with the eighth still reachable — a lean, never a lock. ALSO the heritage bar: the pool is predominantly East Asian and both graded sheets cast roughly one in eight, because grooming had a channel and heritage did not. Bar: majority East Asian, with a real tail — Thai and Chinese idols exist and a sheet with no room for them is a stereotype rather than a casting.",
  },
  {
    brief: "a biker gang leader",
    category: true,
    because:
      "THE BEARD-LEAN CASE, kept with the constraint that surrounds it. A re-roll showed a flint expression centre (D-91 working) and almost no beards, which looked like the lean failing. It was not: emission is 3/3 and the lean puts beards on ~87% of the MEN. Half the sheet is women, because sex is deliberately never leaned (D-90) — so a beard lean can only ever govern half a sex-open brief. Bar: the lean is emitted, and a majority of the MEN are bearded. A tile majority would need a sexLean, which is refused.",
  },
  {
    brief: "a skincare founder in his 40s",
    category: true,
    because:
      "THE NULL CONTROL for pool tendencies. An ordinary occupation implies nothing about age, grooming or heritage, and a tendency invented for it narrows the casting for free. Pinned because the suspicion ran the other way once: two sheets came back beardier with a moustache on one, and the persisted record showed the interpreter had emitted NOTHING — the draw was the ordinary 40s distribution, not a tendency. Bar: all three leans null, and no composed direction either.",
  },
  {
    brief: "a lumberjack in his 40s",
    category: true,
    because:
      "The other half of the grooming tendency, kept as the counter-case so 'clean' cannot be implemented as a global clean-shaven bias. Bar: beards dominate rather than being suppressed.",
  },
  {
    brief: "a model in her 20s wearing chunky glasses",
    category: true,
    because:
      "THE STATED-ACCESSORY CASE. Rendered ZERO glasses: the constant's own no-accessories clause and the AUTHORITY block's ignore-implied-props instruction were overruling words the user actually typed — the drop-a-stated-fact class arriving through the constant rather than the interpreter, which is a place it had never been found. It also emptied a ratified product rule, because 'eyewear and jewelry are stated-only' is worth nothing if stated does not work. Bar: 8/8 wearing them, and unstated accessories still absent everywhere else.",
  },
  {
    brief: "a redhead in her 30s",
    category: false,
    because:
      "A colour word is not an occupation. Kept as the counter-case so the category assertion cannot be satisfied by backfilling every null role.",
  },
  {
    brief: "a wiry cyclist in her 20s",
    category: true,
    because: "The lock validator's permanent fixture — 'her' must hold across all eight.",
  },
] as const;

/**
 * The golden REFINEMENT instructions (M8, §6's hard condition, §15).
 *
 * The brief goldens pin what a sentence must produce. These pin what an EDIT
 * must produce, and they exist for the same reason: an edit that changes the
 * picture without changing the record is the record-lies class, and the way it
 * gets shipped is nobody checking that the parse still means what it meant.
 *
 * Two halves, and the second is the one that will rot first:
 *
 *   `delta` — a real eye ask, which must resolve to exactly these values. Never
 *     "something in the eyes"; a closed vocabulary is only closed if a test
 *     names the value it lands on.
 *   `outOfTier` — a real ask the tier does NOT cover, which must be REFUSED for
 *     free. These matter more than they look: an interpreter that quietly
 *     stretches to fit "make her older" charges 25 credits to make a face that
 *     is not older, and the user is right to be annoyed.
 */
export type GoldenRefinement = {
  instruction: string;
  /** What the face is now — relative asks resolve against it. */
  from?: { eyeColour?: string; eyeShape?: string; hairStyle?: string; hairColour?: string };
  /** The exact delta expected, or `null` when the ask must be refused. */
  delta: {
    eyeColour?: string;
    eyeShape?: string;
    hairStyle?: string;
    hairColour?: string;
    hairTexture?: string;
  } | null;
  because: string;
};

export const GOLDEN_REFINEMENTS: readonly GoldenRefinement[] = [
  {
    instruction: "make her eyes green",
    delta: { eyeColour: "green" },
    because: "The plainest possible ask. If this ever stops working, nothing else matters.",
  },
  {
    instruction: "greener",
    from: { eyeColour: "hazel" },
    delta: { eyeColour: "green" },
    because:
      "A RELATIVE ask, resolved to an absolute AT ENTRY. This is what makes removing an instruction arithmetic rather than a re-interpretation — and it is the case a naive implementation gets wrong by storing the word 'greener'.",
  },
  {
    instruction: "a bit lighter",
    from: { eyeColour: "dark brown" },
    delta: { eyeColour: "brown" },
    because: "Relative on the same axis, in the other direction, with no colour word in the sentence at all.",
  },
  {
    instruction: "give her hooded eyes",
    delta: { eyeShape: "hooded" },
    because:
      "The geometry axis, which the roll never draws. If this parses to nothing, eye shape is unreachable and the tier is colour-only while claiming otherwise.",
  },
  {
    instruction: "make her older",
    delta: null,
    because:
      "THE REFUSAL CASE. Age is a casting decision, and the honest answer is to roll again — not to edit a photograph into a different person. Refused for free.",
  },
  {
    instruction: "give her blonde hair",
    delta: { hairColour: "blonde" },
    because:
      "IT MOVED RATHER THAN DISAPPEARED. This was the out-of-tier counter-case while the tier was eyes-only — 'hair is not eyes' — and the day hair shipped it became a parse case. Kept, with its history, because a golden that is deleted when the answer changes stops being a record of what the product does.",
  },
  {
    instruction: "make her prettier",
    delta: null,
    because:
      "Vague, subjective, and the kind of thing a model will happily 'do' by regenerating a different face. Refused rather than guessed at.",
  },
  /* ---- the hair tier ---- */
  {
    instruction: "make her hair blonde",
    delta: { hairColour: "blonde" },
    because: "The plainest hair ask, and the one that was OUT OF TIER the day before hair shipped — kept as the proof the refusal copy moved with the tier rather than being left behind.",
  },
  {
    instruction: "give her a bob",
    delta: { hairStyle: "bob" },
    because:
      "A CUT is hairStyle, not hairTexture. The nearest miss an eager interpreter makes is answering a cut with a curl pattern, which would persist a texture nobody asked for and leave the length untouched.",
  },
  {
    instruction: "shorter",
    from: { hairStyle: "bob" },
    delta: { hairStyle: "pixie" },
    because: "Relative, on an axis whose vocabulary is 36 named cuts rather than a scale — the interpreter has to know which way is shorter.",
  },
  {
    instruction: "make her hair curly",
    delta: { hairTexture: "curly" },
    because: "The texture axis on its own, so the cut/texture line is exercised from both sides.",
  },
  {
    instruction: "give her a dark bob",
    delta: { hairColour: "dark brown", hairStyle: "bob" },
    because:
      "TWO axes from one sentence. Composition is per-axis, so an instruction naming a cut and a colour must produce both — answering only one is a paid edit that did half of what was asked.",
  },
  {
    instruction: "give her red lipstick",
    delta: null,
    because:
      "Makeup is the NEXT tier, which makes it the sharpest refusal on the list: it is adjacent, plausible, and not yet real. The day it ships this entry moves rather than disappears.",
  },
] as const;
