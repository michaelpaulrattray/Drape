/**
 * UPLOAD A CONCEPT — a picture in, a description of THE PERSON out, and
 * nothing else (#185, founder-ordered 2026-08-28).
 *
 * His words, verbatim:
 *
 * > *"the upload a person should be upload a concept or somthing like that …
 * > if you have a model already or concept or image you can upload it the
 * > image analyzer will analyze and describe it to the authour and cast it
 * > with the description . it should only describe the person in the image not
 * > the lighting or background or framing nothing that contradicts our house
 * > locks. that way its easy for someone to upload an image and get a prompt
 * > to create someone similar without having to type it all out."*
 *
 * # A TYPE, NOT AN INVENTORY — his ruling on the first live read (2026-08-28)
 *
 * The road shipped, he looked at what came back, and he corrected the reader's
 * whole job. Verbatim, on #185:
 *
 * > *"Too much inventory. For a cast studio it should come back as a type, not
 * > a police report. That 1,082-character read will lock eye colour, exact
 * > buzz, temple grey, brow shape, shirt cut, 'no tattoos.' Then eight renders
 * > of the same man. That's the old MAX-clone problem, just coming from the
 * > uploader instead of the author."*
 *
 * > *"Upload-a-concept has two jobs. Default to the first: **Cast this role**
 * > — eight different people who could replace the photo. **Match this face**
 * > — only if the user later asks for a lookalike. Right now the reader is
 * > doing job 2 by accident."*
 *
 * KEEP (his list): sex · age BAND · heritage family if actually visible ·
 * build language · hair world · wardrobe world · type. DROP: exact eye colour ·
 * exact brow · exact fade or temple map · seams and garment construction ·
 * *"no jewellery, makeup, or tattoos"* · anything you only noticed by staring.
 * His success test, which is the acceptance drive: **two different uploads of
 * two different men come back as two different types**, and eight renders of
 * one upload are eight different faces in that type.
 *
 * # ⚠ AND THEN HE RULED AGAIN, BECAUSE THE PRODUCT HAD TAKEN THE LENGTH FOR
 * THE FIX (2026-08-28, evening, after trying the shipped modal)
 *
 * The ruling above arrived with numbers in it (*"~150–250 characters, not
 * 1,000"*) and this module built the numbers. He came back to a read that was
 * **243 characters and still an inventory**, and closed that reading off,
 * verbatim on #185:
 *
 * > *"You keep calling 243 characters a type. Length is not the test. Content
 * > is."*
 *
 * > *"Age band, build family, hair world, garment world, presence. No packing
 * > list."*
 *
 * > *"Keep: sex, age band, type, hair world, skin language, piercings, sparse
 * > face-and-arm tattoos, materials. Drop: slight build, blunt bangs, bodysuit,
 * > choker, eye harness, fetish, camera, exact ink."*
 *
 * **The acceptance is GRANULARITY, and the rule is WORLDS, NEVER ITEMS** — the
 * hair world and never the cut, the build family and never a body size, the
 * wardrobe as MATERIALS and never as garments, markings as a world and never
 * as an inventory. {@link GOLDEN_NOTES} and {@link INVENTORY_NOTE} carry it,
 * because a line between two granularities is shown far better than it is
 * stated.
 *
 * ⚠ **AND IT IS CARRIED BY THE INSTRUCTION AND THE SPECIMENS, NOT BY A NEW
 * SWEEP — that is the one judgement call in this change and it is declared
 * rather than assumed.** The obvious build is a word ban on his drop list
 * (*bodysuit*, *choker*, *harness*, *slight*), in the shape
 * {@link ABSENCE_CLAIMS} already has. It is refused on this module's own
 * recorded test, which {@link ABSENCE_CLAIMS} states outright: **a ban is
 * admissible only where the banned thing has no second sense.** Every word on
 * his drop list has one, and HIS OWN PASSING EXAMPLES USE THEM — *"fitted
 * dark crew-neck top"* is a named garment, *"athletic muscular build"* is
 * build language, and his corrected goth line keeps *"lace, leather and
 * metal"* while dropping *"lace bodysuit"*. The difference is granularity,
 * which is not a lexical shape, so a word ban would be the FOURTH instance of
 * the class this file has recorded three times already (bare `cropped`,
 * `reminiscent of`, `cropped at`). Where content IS asserted in code it is in
 * the acceptance DRIVE, against known pictures — a claim about one photograph
 * rather than a rule pointed at every customer.
 *
 * His success test for this ruling is the same shape as the last: the goth
 * upload comes back as {@link GOLDEN_NOTES}.styled rather than as
 * {@link INVENTORY_NOTE}, and the two men keep passing.
 *
 * # ⚠ AND HE RULED ON THAT JUDGEMENT CALL HIMSELF — Crew reply #26,
 * 2026-08-29, verbatim
 *
 * The paragraph above declared a judgement (no word ban) and asked to be
 * challenged. He answered all three parts:
 *
 * > *"Goth: yes, type — with two cuts. Creature: yes, type. Hard ban: no."*
 *
 * > *"Hard ban — Don't. `fitted dark crew-neck` is a named garment and you
 * > already approved it. A ban on bodysuit / choker / harness will either be
 * > too narrow to matter or too wide to trust. Rule stays: reader prefers
 * > materials over named fetish pieces. **Proof is the output, not a word
 * > list.**"*
 *
 * So the judgement above is now HIS, not ours, and the sentence that matters
 * for every future seat is the last one: **the acceptance of this reader is
 * the drive against real pictures, and a word list is not admissible as a
 * substitute for it.** The creature widening (#204) is ratified as it stands
 * — *"That's a species brief, not a portrait inventory … Keep it. Adult
 * presence is the right guard."*
 *
 * His two cuts to the goth line are the third part, and neither is a word:
 *
 * > *"Athletic build — same class of mistake as slight build. spiked — filter
 * > bait; metal accents is enough."*
 *
 * ⚠ **WHAT HE WAS CUTTING FROM IS A LIVE READ, WHICH IS WHY THIS IS READABLE
 * AT ALL AND NOT A GUESS AT HIS MEANING.** The line quoted to him (briefing
 * edition 96, eye item 1, and the pipeline note beside it) is what the SHIPPED
 * reader answered on the goth photograph: *"Woman in her twenties, dark-fashion
 * / cyber-goth model type. Pale skin, sculpted platinum hair, facial piercings
 * and fine-line facial markings, script tattoos on both arms. **Athletic
 * build**, dark structured fashion in lace, leather and **spiked** metal
 * accents."* His *"I'd ship it as"* is that same sentence with exactly those
 * two things taken out. So the reader really did put a build word on a fashion
 * type, and {@link GOLDEN_NOTES}.styled below is his ratification of the live
 * reader's own phrasing minus the two cuts — not a specimen written for it.
 *
 * ⚠ **THE FIRST CUT IS A CHANGE TO THE BUILD RULE, NOT A DELETION FROM ITS
 * LIST, and reading it the other way would have been the smaller, wronger
 * fix.** `slight` was already refused for being a body SIZE; `athletic` was on
 * the instruction's own CLOSED build list, so it was the list working exactly
 * as written. He is therefore not striking a word — he is saying that naming a
 * build ON THIS SUBJECT was the mistake, because a build word a fashion type
 * did not need is one more thing locked onto all eight faces. **A build is
 * named only where the build is part of the type**, which is what his own
 * three specimens have said all along and nobody had read: both passing men
 * are physical types (*"rugged, no-nonsense fitness presence"*, *"authoritative
 * professional"*) and both name one; his corrected goth line is a fashion type
 * and names none. The closed list and the size prohibition are untouched —
 * they still govern the case where a build IS named.
 *
 * **The second cut is the refusal coin reaching the describer** (#129), not a
 * matter of taste, and it is stated in {@link RULES} WITH THAT REASON
 * attached: name the material and never the hardware or its treatment, because
 * a note carrying *spiked* / *studded* / *buckled* is refused outright by the
 * image engine and costs her the cast. A reason travels to the words his list
 * could not enumerate; a banned word does not — which is the same argument he
 * just ratified one paragraph above.
 *
 * # ⚠ AND THE DRIVE HE ASKED FOR SAYS ONE CUT LANDED AND THE OTHER DID NOT
 *
 * *"Proof is the output"* — so the acceptance was driven before this shipped,
 * two arms on the SAME thirteen pictures with one variable (this instruction,
 * before and after), on the founder's own reference set, which the instruction
 * has never seen. Not the goth frame: his corrected note for it is IN the
 * instruction, so reading it would measure recall.
 *
 * - **The build cut LANDED, unanimously and unproven.** Paired on the nine
 *   pictures both arms read: a closed-list build word on **7/9 → 3/9**, every
 *   one of the four changes in his direction and none against (McNemar exact
 *   **p = 0.125** — and with four discordant pairs that test CANNOT go below
 *   0.125, so the bar is out of this sample's reach by construction, not by
 *   result). The three that KEEP a build are the three physical types — a
 *   solid muscular reptilian warrior, an athletic wiry predator, a broad
 *   heavy-set cyclops — which is the boundary rather than the ban.
 * - ⚠ **One "drop" was not a drop, and the first pointer scored it as a win.**
 *   The quadrupedal creature went from *"muscular sinewy build"* to *"sinewy,
 *   powerful build"* — a build claim in words that are not on the closed list
 *   at all. Counting only listed words reads that as compliance. On *any*
 *   build claim the honest figure is **7/9 → 4/9, p = 0.25**.
 * - ⚠ **The hardware cut did NOT measurably land.** Exactly one of the
 *   thirteen carries a named wardrobe piece — a cyber-goth woman's *mechanical
 *   eye-piece* — and it survives in BOTH arms. The other matches were creature
 *   ANATOMY (*"bone-spike ridge"*, an organic substance *"studded"* with
 *   nodules), which is a word with a second sense caught by a word list: this
 *   file's own recorded ban class, arriving for a fourth time inside the
 *   instrument built to measure the rule against it. Whether a machine part
 *   fitted to a cyborg's face is an accessory or a FEATURE of the being was
 *   put to him as a question rather than patched — see the ruling below.
 *
 * # ⚠ HE ANSWERED IT, AND THE ANSWER IS A LINE RATHER THAN A LIST (Crew reply 28, 2026-08-29)
 *
 * The question above went to his page with a recommendation, and he ruled on
 * it, verbatim:
 *
 * > *"Treat it as part of the being. The clothes cut does not strip a face. A
 * > choker is an accessory. A horn is a feature. A machine part fitted into
 * > the skull is a feature. Name it as a type, not a SKU: fitted mechanical
 * > eye or integrated facial hardware. Not spiked eye harness. Not sleek
 * > mechanical eye piece. spiked / metal accents stays on wardrobe only.
 * > That's the law:
 * >
 * > On the body as anatomy → feature
 * > On the outfit as styling → materials, not a named piece
 * > Strapped on, but replacing a body part → feature
 * >
 * > This does not clear every grey case (strap-on visors, armour-as-skin).
 * > Don't write a bigger ban list for those. Use this rule, then check the
 * > output. Don't wait for more uploads to decide the cyborg eye — that class
 * > is why the studio exists. Flattening it to 'exposed mechanical elements'
 * > costs the character."*
 *
 * His three lines are the FEATURE-OR-WARDROBE rule in {@link RULES}, placed
 * immediately ABOVE the wardrobe rule because the defect was the wardrobe rule
 * reaching something it was never about: *"never name a single accessory"* is
 * scoped to a WORN one now, and the machine part fitted into the body is
 * carried by the rule above it.
 *
 * ⚠ **THE GREY CASES ARE DELIBERATELY UNANSWERED, ON HIS INSTRUCTION.** A
 * strap-on visor and armour-as-skin have no line drawn for them here, and the
 * next seat is not to draw one by adding words: *"Don't write a bigger ban
 * list for those"* is the same sentence as *"Proof is the output, not a word
 * list"* one ruling earlier, and this file already carries four instances of
 * a word list catching the thing it was not about.
 *
 * ⚠ **AND THE MEASURED FIGURE ABOVE STAYS AS IT IS.** *"The hardware cut did
 * not measurably land"* was a true reading of the arm that ran, and this
 * ruling does not retroactively make it land — what it changes is the RULE
 * that arm was measuring. One subject of the thirteen is affected either way,
 * so the drive below is a check that the ruling reads correctly on the real
 * pictures rather than a court that could move a number.
 * - Read rate **11/13 in both arms**, with different subjects refusing each
 *   time — the coin, not a regression. The negative control (a blank field)
 *   refused `no_being` in both arms.
 *
 * ⚠ **MATCH THIS FACE IS A NAMED SECOND MODE AND IT IS NOT BUILT** — recorded
 * here so it does not vanish into a closed issue. It is not a describer mode
 * at all when it comes: a lookalike is an IMAGE-anchored road (the Follow's
 * own mechanism, #177), and this reader has one job. Nothing below is a step
 * toward it.
 *
 * ⚠ # AND THE SUBJECT IS A BEING, NOT A PERSON — #204, his own card, one
 * minute after the ruling above
 *
 * He uploaded a stylized humanoid creature (a purple feline deity figure) and
 * was told *"I couldn't find a person in that picture — try one with someone
 * in it."* Read at the code, the door was doing exactly what it was built to
 * do: the reader was asked about *the person*, answered that there was none,
 * and that verdict is deliberately never re-asked. **The SCOPE was the defect,
 * not the door.**
 *
 * It is also the mission's own sentence, in his words: *"we want to be able to
 * cast photoreal humans and sci-fi humans and creatures like monsters etc."* A
 * concept reader that admits only humans is narrower than the studio it feeds.
 *
 * So the subject is **the being in the picture** — human, sci-fi human,
 * creature, robot — and `no_being` fires only on things that are not beings at
 * all: an object, a vehicle, a landscape, a product. That population is not
 * invented here: it is the SAME line the roll road's own wall draws
 * (`interpreter.ts`'s `SUBJECT_INSTRUCTION`, refused by `briefCompiler.ts` as
 * `not_a_being`), and the two are asserted to agree rather than left to drift
 * — a customer who is told a creature can be cast, then told her creature
 * picture has nobody in it, has met two doors that do not.
 *
 * The taxonomy above is unchanged and simply applies: a creature has a kind
 * and a type ("a lean feline humanoid"), a build family, a surface world
 * ("smooth violet skin") where a human has a skin world, a feature world
 * ("tall upright ears, gold ornamentation") where a human has hair, and the
 * same wardrobe-as-materials rule. **Worlds, never items, whatever it is.**
 *
 * # ⚠ THE IP GUARD IS INSTRUCTIONAL, AND THAT IS A DECLARED LIMIT
 *
 * Opening the door to drawn and fantastical subjects lets a recognizable
 * copyrighted character through it, which a human-only reader mostly refused
 * by accident. The rule is his: **a known character comes back as a TYPE,
 * never named, and never described so exhaustively that the description
 * reconstructs it.** It is carried by the instruction and by the granularity
 * rule (an exhaustive reconstruction is an inventory, which is already
 * forbidden) — and NOT by a vision gate asking *"is this a famous
 * character"*, for the reason already recorded above: a reader's verdict that
 * turns a customer away is what law 9 and the fable-1052 class forbid, and
 * #204 asks for none.
 *
 * The structural protection is unchanged and is elsewhere, which is why an
 * instructional guard is enough here: the picture never rides to an engine,
 * what reaches the engine is WORDS, and `briefCompiler.ts`'s likeness wall
 * stands in front of the compile for a description exactly as for a brief she
 * typed. ⚠ **Its honest limit, stated because the widening genuinely narrows
 * the position**: that wall keys on a NAME, so an unnamed but distinctive
 * description passes it. The describer not writing one is the control.
 *
 * # AN ILLUSTRATED UPLOAD DESCRIBES THE BEING, NOT THE MEDIUM
 *
 * A drawing is a picture of somebody, and the medium is a fact about the
 * PICTURE — which this reader has never been allowed to describe. The
 * customer casts photoreal by default and picks a style elsewhere. This is the
 * drawn-hairstyle precedent applied to a new reader: a medium verdict may
 * ROUTE and must never REFUSE.
 *
 * # THE PHOTOGRAPH IS NEVER KEPT AND NEVER RENDERED
 *
 * This is the whole shape of the feature and everything else follows from it.
 * The bytes ride ONE text call as an inline data URI (`openrouterText.ts`'s
 * `userContent` — read at the code, not assumed: images are base64 in the
 * request body, never fetched from an address) and are dropped when it
 * returns. There is no storage write, no row, no table, no migration and no
 * purge path, because there is nothing kept to purge — which is also why this
 * road is outside the ink studio's widening-tripwire class entirely: no
 * stranger's photograph ever reaches a permanently public R2 URL.
 *
 * What survives the call is WORDS, and they land in the customer's own brief
 * box where she can read and edit them before she spends anything. So the
 * engine is given a TYPE, never a face — and the likeness wall
 * (`briefCompiler.ts`'s `LIKENESS_MESSAGE`) still stands in front of the
 * compile exactly as it does for a brief she typed, for free, because this
 * road adds no path around it.
 *
 * # WHAT IT MAY NOT SAY, AND WHY THAT IS CODE RATHER THAN AN INSTRUCTION
 *
 * `houseBlock.ts` is appended to every authored prompt BY CODE and owns the
 * capture, the realism, the framing and the negatives. A description that
 * arrives saying *"soft studio lighting, shallow depth of field, cropped at
 * the chest"* does not add to that block — it ARGUES with it, in the same
 * prompt, and the founder's sentence names exactly this ("nothing that
 * contradicts our house locks").
 *
 * Working law 3 says a backstop tested only through a model that usually
 * behaves is untested, so the rule is not left to {@link RULES}: the returned
 * text is SWEPT (`notAboutThePersonIn`) and a description carrying a forbidden
 * word is re-asked once and then refused. The instruction is the primary
 * control; the sweep is the one that can be driven.
 *
 * # HERITAGE IS NAMED, AND IT WAS ADDED BY LOOKING (law 9)
 *
 * The first real drive read three delivered frames well and one of them was a
 * South Asian man the description called *"warm olive-brown"* and nothing else.
 * That is the founder's own success test failing quietly — *"a prompt to create
 * someone SIMILAR"* — because heritage is the single strongest type fact and a
 * brief without it casts a different person. It is house vocabulary rather than
 * a new claim: `describeHeritage` already writes it into the family clause, and
 * the compiled brief has carried a heritage field since long before this road.
 * The instruction asks for it now, and the re-drive is on the record.
 *
 * # ITS ONE DECLARED LIMIT
 *
 * The sweep holds almost nothing about resemblance, and it must not: a phrase
 * ban wide enough to catch *"looks like X"* also catches *"features reminiscent
 * of South Asian ancestry"*, which is the road's own subject matter — measured,
 * on a real frame, and recorded beside {@link NOT_ABOUT_THE_PERSON}. The
 * protection against a named likeness is structural and lives elsewhere: the
 * photograph does not ride, and `briefCompiler.ts`'s likeness wall stands in
 * front of the compile for a description exactly as for a brief she typed —
 * free, before the claim, the reader's judgement taken twice. A "is this a
 * famous person" vision gate is deliberately NOT built: a reader's verdict
 * turning a customer away is what law 9 and the fable-1052 class forbid, and
 * nothing in his order asks for one.
 *
 * # A READ THAT NEVER ARRIVED IS ASKED AGAIN — #193, and the measurement
 *
 * Six live reads on production frames, one came back `unreadable`, and **the
 * frame that refused answered cleanly three times out of three immediately
 * afterwards** (`scripts/_e76-unreadable-probe-disposable.mts`). So the refusal
 * was the coin and not the picture — and the one outcome this module declined
 * to re-ask was the one that is provably transient, while the outcomes it did
 * re-ask (a read forty characters too long) are the ones a second ask is least
 * likely to change.
 *
 * ⚠ **THE CARD NAMED ONE BRANCH AND THERE ARE THREE, so the repair is the
 * CLASS** (law 7). `{ reason: "unreadable", attempts: 1 }` is returned from an
 * unparseable reply, from a transport that threw, and — the one nobody had
 * counted — from `openrouterText.ts`'s **empty completion on a 200**, which
 * throws `ProviderError("unknown")` and is NOT in `RETRYABLE_FAILURES`, so it
 * gets exactly one shot where a timeout gets three. The two are
 * indistinguishable at the outcome: both branches return the same object, and
 * the original run's log is gone, **so which one the measured refusal came
 * from is unknown and is not asserted here**. Covering both is what makes that
 * not matter.
 *
 * What is NOT re-asked, and each for its own reason: `no_being` (a real
 * answer, not a failure — re-asking it is asking a reader to change a correct
 * verdict); `transport`, `rate_limit` and `timeout` (the transport's own
 * `withRetry` has already burned three attempts, and a fourth would put a
 * customer through ~4x a dead provider's deadline on a synchronous route);
 * `capability`, which is a CANCEL; a throw that is not a `ProviderError` at
 * all, so a bug in our own code cannot be retried into invisibility; and a
 * second failure of any of these, which keeps today's sentence, because a read
 * that comes back as noise twice is the one case where *try a different
 * picture* is honest advice.
 */
/**
 * ⚠ THE CREATURE CHECKLIST — #232 half 2, with his own list from #231.
 *
 * Founder, verbatim (terminal, 2026-08-29): *"Reader: if the tongue or tusks
 * are in the picture and the being still isn't itself without them, write them
 * as features — short oni tusks, long tongue. Not dripping slime, not mouth
 * wide open."* — and, in the same night's addendum: *"Add whiskers to the
 * creature checklist: ears, horns, tail, wings, scales, whiskers — if it's in
 * the frame, write it."*
 *
 * So the FEATURE bullet gained his checklist and the mouth clause, and the
 * closing law is his sentence rather than the list: **if it is in the frame,
 * write it.** The list is a FLOOR — a crest, a beak, fins, an exoskeleton are
 * facts about the being too — and the mouth clause carries the anatomy/styling
 * line this module already draws: on the body as anatomy it is a feature, an
 * acted state is still a pose.
 *
 * ⚠ **Nothing here is a banned WORD.** *"dripping slime"* and *"mouth wide
 * open"* are shown as wrong shapes inside the instruction and are NOT in
 * `NOT_ABOUT_THE_PERSON` — the fourth instance of the `cropped` / bare
 * `framing` class in this file is one too many to risk a fifth, and *"open"*
 * and *"wide"* are ordinary prose about a face.
 *
 * ⚠ **The other three rules of #231 (bare skin reads HAIRLESS, materials not
 * named pieces on the READER's side, LOW keeps species facts) and its
 * Grok-vs-Sonnet reader court are NOT here** — they are that card's, and it is
 * open. What landed with #232 is the one sentence the two cards share.
 */
import { createModuleLogger } from "../logging/logger";
import { interpreterEngine } from "./interpreter";
import { ProviderError, type TextEngine } from "../providers/types";

const log = createModuleLogger("castingV2/conceptDescribe");

/**
 * THE CEILING IS THE ANTI-CLONE CONTROL — 300, and it was 1,200 (his ruling,
 * 2026-08-28).
 *
 * The first live read came back at **1,082 characters** and he named exactly
 * what that buys, verbatim: *"That 1,082-character read will lock eye colour,
 * exact buzz, temple grey, brow shape, shirt cut, 'no tattoos.' Then eight
 * renders of the same man. That's the old MAX-clone problem, just coming from
 * the uploader instead of the author."*
 *
 * So the bound is not a formatting preference and it is not about the
 * entrance's brief cap (it was already far under it). **Every detail the
 * description names is a detail all eight faces are forced to share**, because
 * the words go to the engine verbatim as the first paragraph of the prompt. A
 * casting note fits in a couple of sentences; an inventory does not.
 *
 * ⚠ **BUT IT IS A SANITY RAIL AND NOT THE ACCEPTANCE, AND THIS PARAGRAPH SAID
 * OTHERWISE FOR A DAY.** It called the length *"the one control here that is
 * STRUCTURAL"* and left the impression that fitting under it was the test. He
 * answered that directly — *"You keep calling 243 characters a type. Length is
 * not the test. Content is."* — and {@link INVENTORY_NOTE} is the proof at
 * 243: under this ceiling, over the floor, clean through both sweeps, and
 * exactly the read he refused. The sentence was true about what the ceiling
 * DOES (a 1,082-character police report cannot fit through it) and false about
 * what it PROVES. What the ceiling still earns is its own narrow claim: it is
 * the one bound here that cannot over-refuse a legitimate word.
 *
 * Announced and enforced are different numbers on purpose. The instruction
 * asks for **~150–250** (his own figures — an announced cap is a brief, and a
 * stated target writes the answer rather than filtering it); the code refuses
 * at 300, so an honest read that runs a little over its target is not thrown
 * away for a rounding. A longer read is never truncated mid-word — half a
 * sentence about a person is a claim nobody made.
 */
export const CONCEPT_DESCRIPTION_MAX = 300;

/** The target the reader is ASKED for, in his own numbers. Announced, not enforced. */
export const CONCEPT_DESCRIPTION_TARGET = { low: 150, high: 250 } as const;

/**
 * Below this there is no description, only a shrug wearing one.
 *
 * 100 rather than the target's 150: heritage is named only when it is actually
 * visible and the drop list takes several nouns out, so a legitimately sparse
 * read lands near 120 — and refusing a customer who is holding good type
 * language, over a floor his ruling never made hard, is over-enforcement.
 */
export const CONCEPT_DESCRIPTION_MIN = 100;

/**
 * WORDS ABOUT THE PICTURE, NOT ABOUT THE PERSON — swept out of the reply.
 *
 * Every entry is a claim about the photograph (its light, its set, its frame,
 * its camera, its rendering) or a resemblance claim, and each says which.
 *
 * ⚠ THE LIST IS DELIBERATELY NARROW, and that is the lesson of the typo gate
 * (which owned "shave" and blocked the founder's own bald ask). A word that
 * legitimately describes a PERSON is not on it, however photographic it looks
 * elsewhere: `sharp` stays (sharp cheekbones, a sharp jawline), `light` stays
 * (light brown hair), `soft` stays (soft features), `fair` stays. Where the
 * photographic sense needs banning and the human sense does not, the entry is
 * the PHRASE — `sharp focus`, not `sharp`.
 */
export const NOT_ABOUT_THE_PERSON: ReadonlyArray<{ word: string; because: string }> = [
  /* Light — his sentence names it first. */
  { word: "lighting", because: "the block owns the light (his sentence: 'not the lighting')" },
  { word: "backlit", because: "a light claim" },
  { word: "rim light", because: "a light claim" },
  { word: "key light", because: "a light claim" },
  { word: "softbox", because: "a light claim" },
  { word: "golden hour", because: "a light claim" },
  { word: "high key", because: "a light claim" },
  { word: "low key", because: "a light claim" },
  /* Set. */
  { word: "background", because: "the block owns the set (his sentence: 'not the background')" },
  { word: "backdrop", because: "a set claim" },
  { word: "studio", because: "a set claim, and the block already says it" },
  { word: "seamless", because: "a set claim (a seamless paper sweep)" },
  /* Frame — his sentence names it third, and #182 fixed the framing in code. */
  /* ⚠ BARE `framing` AND BARE `framed` ARE GONE — THE FOURTH INSTANCE OF THE
     CLASS THIS FILE ALREADY RECORDS THREE TIMES, and this one was live rather
     than caught in review. Measured while driving #204: the reader wrote *"a
     coarse dark beard FRAMING a jagged-toothed mouth"* and had a perfectly good
     casting note sent back — and when the second ask came back as noise, the
     customer was told *"I couldn't read that picture just now."* So an
     over-broad ban did not merely refuse a word here, it spent a second call
     and then said something untrue about her picture.

     A beard framing a mouth, a face framed by dark hair: both are ordinary
     prose about a PERSON, and they were reachable before #204 — the widening
     only made the shape more common, because a creature is described by its
     structure. The photographic senses that CANNOT describe a subject are kept
     as PHRASES, the shape this list already uses for `sharp focus`.

     THE DECLARED GAP, in the `cropped` precedent's own words: *"framed by long
     hair"* and *"framed at the chest"* now pass this sweep. The category is
     carried by the ten frame words below it and by {@link RULES}, and one
     uncatchable phrase is a better price than a ban that refuses descriptions
     of faces. */
  { word: "the framing", because: "his own phrase ('not the framing'); a subject is never 'the framing'" },
  { word: "tightly framed", because: "a frame claim" },
  { word: "loosely framed", because: "a frame claim" },
  { word: "framed from", because: "a frame claim ('framed from the chest up')" },
  /* ⚠ NO FORM OF `cropped` IS ON THIS LIST, AND IT TOOK THREE GOES TO ADMIT IT.
     Bare `cropped` swept "close-cropped stubble"; the narrowed `cropped at`
     still sweeps "cropped at the nape"; `tightly cropped` is what everyone
     calls short hair. The word belongs to hair and to garments at least as much
     as to a frame, so every ban wide enough to catch the photographic sense
     also refuses a good description of a person — the typo gate owning "shave"
     for the third time in one sitting. THE DECLARED GAP: a description saying
     "cropped at the chest" and nothing else photographic passes this sweep. The
     category is carried by the ten frame words around it and by {@link RULES};
     one uncatchable phrase is a better price than a ban that refuses haircuts.
     (Review of #187, finding 2 — and the class, not the instance.) */
  { word: "close-up", because: "a frame claim" },
  { word: "closeup", because: "a frame claim" },
  { word: "headshot", because: "a frame claim" },
  { word: "head-and-shoulders", because: "a frame claim" },
  { word: "waist-up", because: "a frame claim, and it contradicts the mid-torso pair (#182)" },
  { word: "chest up", because: "a frame claim, and it is the framing he REFUSED (#182)" },
  { word: "mid-torso", because: "a frame claim; the block says it, the description may not" },
  { word: "full body", because: "a frame claim" },
  { word: "full-length", because: "a frame claim" },
  { word: "portrait", because: "a frame claim about the picture" },
  /* Camera. */
  { word: "camera", because: "a capture claim" },
  { word: "lens", because: "a capture claim" },
  { word: "bokeh", because: "a capture claim" },
  { word: "depth of field", because: "a capture claim" },
  { word: "aperture", because: "a capture claim" },
  { word: "sharp focus", because: "a capture claim; bare 'sharp' is a face word and stays" },
  { word: "shallow focus", because: "a capture claim" },
  /* The artifact itself. */
  { word: "photograph", because: "it describes the picture, not the person" },
  { word: "photo", because: "it describes the picture, not the person" },
  { word: "image", because: "it describes the picture, not the person" },
  { word: "picture", because: "it describes the picture, not the person" },
  { word: "render", because: "it describes the picture, not the person" },
  /* Rendering quality — the prompt-soup words the block's negatives exist for. */
  { word: "8k", because: "a quality claim" },
  { word: "4k", because: "a quality claim" },
  { word: "high resolution", because: "a quality claim" },
  { word: "hyperrealistic", because: "a quality claim" },
  { word: "photorealistic", because: "a quality claim; the STYLE is the block's to state" },
  { word: "ultra detailed", because: "a quality claim" },
  { word: "masterpiece", because: "a quality claim" },
  { word: "award-winning", because: "a quality claim" },
  /*
    Resemblance — and this group is DELIBERATELY ALMOST EMPTY, which is a
    measurement rather than an oversight.

    It held `looks like`, `resembles`, `resembling` and `reminiscent of` until a
    real drive refused a perfectly good description of a South Asian man whose
    only sin was the phrase *"features reminiscent of…"* about his ANCESTRY.
    That is the `cropped` finding again in a different category: a phrase ban
    aimed at *who does this person look like* also catches *what kind of person
    is this*, and the second is the whole point of the road.

    What survives is only what cannot describe a person's own properties. The
    real control is not here at all and never was: `briefCompiler.ts`'s LIKENESS
    WALL stands in front of the compile, free before the claim, taken twice, for
    a description exactly as for a brief she typed — and it is BETTER placed
    than this sweep, because a refusal there leaves her holding editable words
    while a refusal here leaves her holding nothing.
  */
  { word: "look-alike", because: "only ever names somebody; the likeness wall is the real control" },
  { word: "lookalike", because: "only ever names somebody" },
  { word: "in the style of", because: "names an artist or a franchise, never a face" },
];

/** The first of {@link NOT_ABOUT_THE_PERSON} in `text` as a whole word or phrase, or null. */
export function notAboutThePersonIn(text: string): string | null {
  /* Whitespace normalised first, so a phrase split by a newline cannot slip —
     `promptAuthor.neverWrittenIn`'s own finding, reused rather than re-learned. */
  const lower = text.toLowerCase().replace(/\s+/g, " ");
  for (const { word } of NOT_ABOUT_THE_PERSON) {
    const re = new RegExp(`(^|[^a-z0-9])${word.replace(/[-]/g, "\\-")}([^a-z0-9]|$)`);
    if (re.test(lower)) return word;
  }
  return null;
}

/**
 * WHAT THE PERSON DOES NOT HAVE — swept, and it is the ONE inventory habit
 * worth banning by shape (his drop list names it: *"no jewellery, makeup, or
 * tattoos"*).
 *
 * ⚠ THIS IS NOT A FOURTH INSTANCE OF THE TYPO-GATE CLASS, and the difference
 * is the reason it exists rather than being declined like the ones below. Every
 * ban that has burned this road was a ban on a word that describes a person in
 * one sense and a picture in another — `cropped` (a haircut AND a frame),
 * `reminiscent of` (an ancestry AND a likeness). **An absence claim has no
 * second sense.** A type is what somebody IS; "no tattoos" describes nobody,
 * and it does real harm downstream — it reaches the engine verbatim as a
 * negative in the first paragraph of the prompt, forcing all eight faces to
 * share a thing that was never in the picture to begin with, which is the
 * library's own presence-not-absence doctrine arriving from a new direction.
 *
 * The noun list is HIS THREE plus the one obvious sibling, and it stops there:
 * a wider list ("no facial hair", "no glasses") starts catching sentences that
 * a casting director would legitimately write.
 *
 * ⚠ WHAT IS DELIBERATELY **NOT** BANNED, so the next seat does not add it: the
 * rest of his drop list — exact eye colour, brow shape, the fade or temple map,
 * seams and garment construction. Those are ordinary person words, and a list
 * holding `brow`, `eyes` or `cut` would refuse good descriptions on the day it
 * shipped. They are carried by the INSTRUCTION and by
 * {@link CONCEPT_DESCRIPTION_MAX}, which is the honest division of labour here:
 * the length bound makes an inventory structurally impossible to fit, so the
 * nouns it would have carried have nowhere to go.
 */
export const ABSENCE_CLAIMS = {
  /** `no` / `without` / `free of` / `lacking`, optionally hedged with `visible` or `any`. */
  lead: "(?:no|without|free of|lacking)",
  nouns: ["tattoos?", "jewell?e?ry", "make-?up", "piercings?"],
} as const;

/** The absence claim in `text` (as written), or null. */
export function absenceClaimIn(text: string): string | null {
  const lower = text.toLowerCase().replace(/\s+/g, " ");
  const re = new RegExp(
    `(^|[^a-z0-9])(${ABSENCE_CLAIMS.lead}\\s+(?:visible\\s+|any\\s+)*(?:${ABSENCE_CLAIMS.nouns.join("|")}))([^a-z0-9]|$)`,
  );
  const hit = re.exec(lower);
  return hit ? hit[2]! : null;
}

/**
 * ⚠ HIS SPECIMENS — TWO THAT PASS AND ONE THAT FAILS, all four sentences his
 * own, and they are SHOWN to the reader rather than described to it.
 *
 * # LENGTH WAS NEVER THE TEST, AND THE PRODUCT BELIEVED IT WAS
 *
 * The first ruling capped the read at 300 characters and this module took the
 * cap for the fix. He came back to a 243-character read and said so, verbatim
 * on #185:
 *
 * > *"You keep calling 243 characters a type. Length is not the test. Content
 * > is. This is inventory: A woman in her twenties, slight build, long straight
 * > platinum hair with blunt bangs, multiple facial piercings and forearm
 * > tattoos. Dark-fashion / gothic-alternative model type, styled with lace
 * > bodysuit, leather choker and spiked eye harness. What that locks: body size
 * > · exact hair · named garments · a harness. That will reprint this girl, and
 * > lace bodysuit / spiked eye harness / fetish-fashion will refuse on GPT
 * > Image 2."*
 *
 * That box is {@link INVENTORY_NOTE}, and it fits inside every bound this file
 * enforces — under the ceiling, over the floor, clean through both sweeps. So
 * the bounds are a **sanity rail** from here on and not the acceptance: what
 * separates it from {@link GOLDEN_NOTES}.styled is GRANULARITY, and granularity
 * is not a length.
 *
 * # WHY THE FAILING ONE IS SHOWN TOO
 *
 * A specimen teaches a LEVEL of detail in a way an announced number cannot —
 * that is why one has been here since the first ruling. But two good notes
 * cannot show where the line is, only which side of it to be on, and every word
 * he struck (*slight*, *blunt bangs*, *bodysuit*, *choker*, *harness*) is a word
 * a describer would otherwise think was doing its job. The pair puts the line
 * itself in front of the reader — his own instruction, verbatim: *"Use the men
 * as the passing examples. Use the current goth box as the failing example."*
 *
 * ⚠ **AND THIS IS WHY THE GOTH PICTURE IS A POSITIVE CONTROL AND NOT A TEST.**
 * The corrected note for it is now IN the instruction, so a read of that same
 * photograph is measuring recall, not reading — the specimen-joins-the-
 * vocabulary trap, arriving one day after it was written down. The acceptance
 * drive therefore carries heavily-styled subjects the instruction has never
 * seen, and the goth frames prove only that the shape is reachable at all.
 *
 * # THE PAIR IS PLAIN AND STYLED, NOT TWO MEN
 *
 * He gave two passing men and they are near-identical in shape, so showing both
 * teaches the same lesson twice — and this product has MEASURED that prompt
 * context is not additive. {@link GOLDEN_NOTES} is one man and his own
 * corrected goth line instead: the two ENDS of the range a casting reader sees,
 * an ordinary person and a heavily-styled one. Both his men stay in the suite
 * as fixtures, where redundancy costs nothing.
 */
export const GOLDEN_NOTES = {
  /** His passing example, man 1 — an ordinary subject with nothing styled about him. */
  plain:
    "A man in his mid-forties, European heritage, athletic muscular build, "
    + "close-cropped dark hair, fitted dark crew-neck top. Rugged, no-nonsense fitness presence.",
  /**
   * His own correction of the failing box — and this is his SECOND correction
   * of it (Crew reply #26, 2026-08-29), *"I'd ship it as"*, verbatim.
   *
   * ⚠ It differs from the line that shipped in two ways that are the whole of
   * his ruling: it carries **no build word at all** — a styled fashion type is
   * exactly where {@link RULES} now says to leave one out — and it says
   * *"fine-line facial markings, script tattoos on both arms"* where ours said
   * *"sparse fine-line tattoos on the face and arms"*. Both are worlds rather
   * than items; his is the newer one and it is the one shown to the reader.
   */
  styled:
    "Woman in her twenties, dark-fashion / cyber-goth model type. Pale skin, sculpted "
    + "platinum hair, facial piercings and fine-line facial markings, script tattoos on "
    + "both arms. Dark structured fashion in lace, leather and metal.",
  /**
   * His second passing man, and it is NOT shown to the reader — it teaches the
   * same lesson as {@link GOLDEN_NOTES.plain}, and context is not additive here.
   * It lives in the specimens rather than beside them because three exports for
   * one idea is how a fixture drifts away from the thing it is a fixture for.
   */
  secondMan:
    "A man in his mid-to-late forties, South Asian heritage, athletic solid build, "
    + "short dark textured hair, fitted charcoal crew-neck. Serious, composed, "
    + "authoritative professional type.",
} as const;

/**
 * THE FAILING BOX, his words, as it came back to him — the counter-example.
 *
 * Reproduced live on a delivered frame of the same class before this change
 * landed, at 267 characters: *"…slight build, with long straight platinum hair
 * … a black lace top with a leather harness collar and spiked eye-mask
 * accessory, giving an edgy alt-goth/fetish-fashion model type."* So this is a
 * shape the shipped reader genuinely produces, not a shape imagined for a test.
 */
export const INVENTORY_NOTE =
  "A woman in her twenties, slight build, long straight platinum hair with blunt bangs, "
  + "multiple facial piercings and forearm tattoos. Dark-fashion / gothic-alternative model "
  + "type, styled with lace bodysuit, leather choker and spiked eye harness.";

/**
 * THE CLOSED BUILD LIST — the only build words the reader may use, and the
 * ONLY place they are written down.
 *
 * It is exported because the specimens are checked against it: his ruling
 * ("athletic build — same class of mistake as slight build") is the statement
 * that a STYLED type carries none of these while a PHYSICAL type may carry
 * one, and an arm asserting that has to ask the instruction's own list rather
 * than keep a second copy of it beside the question (working law 4 — a
 * shadowing list drifts, and this one would drift silently, since a build word
 * added here and not there simply stops being checked).
 */
export const BUILD_FAMILIES = [
  "athletic", "muscular", "solid", "broad", "wiry", "stocky", "heavy-set", "average",
] as const;

/**
 * ⚠ THE INSTRUCTION IS THE PRIMARY CONTROL AND IT IS HIS RULING, CLAUSE BY
 * CLAUSE — the keep list, the drop list, the numbers and the example are all
 * quoted from #185 rather than paraphrased.
 *
 * The one sentence here that is neither a keep nor a drop is the one that says
 * WHY (*"everything you name is locked on every face"*). A reader told the
 * reason for a rule holds it in the cases the rule did not enumerate, and the
 * drop list can never enumerate *"anything you only noticed by staring"*.
 */
const RULES = [
  "You are a casting director's reader. You are shown one picture and you write a SHORT CASTING NOTE",
  "about the BEING in it: their TYPE, so that eight DIFFERENT ones who could all replace them could be",
  "cast from your words alone. You are not writing a description of this individual.",
  "",
  "THIS STUDIO CASTS BEINGS, not people only: photoreal humans first, and equally sci-fi humans,",
  "creatures, monsters, aliens, robots and androids, drawn or photographed. A creature gets the same",
  "note a person does \u2014 its kind and type, its build family, its surface (skin, scales, fur, plating),",
  "its features (ears, horns, ornamentation, fitted hardware) where a person has hair, and its",
  "wardrobe as materials.",
  "There is NOBODY in the picture only when there is no being in it at all: an object, a vehicle, a",
  "landscape, a building, a product, food, a pattern, an empty room.",
  "",
  "IF THE BEING IS A RECOGNIZABLE CHARACTER from a film, game, comic or show, write its TYPE and",
  "NEVER its name, its franchise, or so much exact detail that your words rebuild that character.",
  "Write the genre being a casting director could actually book \u2014 that is what the customer can cast.",
  "A drawing or a render is a picture OF somebody: describe the being, never the medium or its style.",
  "",
  "WRITE, in a few plain sentences: apparent sex; an age BAND, never an exact age",
  "(\"mid-to-late forties\"); the heritage family, but ONLY if it is genuinely visible — never guess one;",
  "the build FAMILY (\"athletic\", \"broad\", \"solid\"); the hair WORLD (\"short dark hair going grey\",",
  "\"sculpted platinum\"); where they are part of the look, the skin and marking WORLD (\"pale skin\",",
  "\"facial piercings\", \"sparse fine-line tattoos on the face and arms\"); the wardrobe WORLD, given as",
  "MATERIALS and mood (\"fitted dark crew-neck\", \"dark structured fashion in lace, leather and metal\");",
  "and the TYPE itself (\"rugged, no-nonsense fitness presence\", \"dark-fashion / cyber-goth model type\").",
  "",
  "WORLDS, NEVER ITEMS. This is the whole difference between a casting note and a packing list,",
  "and each rule below is a RULE rather than a list of banned words \u2014 apply it to whatever you are looking at:",
  "- HAIR: name the world it belongs to, never the cut. \"Sculpted platinum\" \u2014 not the length, the parting,",
  "  the fringe or the fade. If you could take it to a barber and get it copied, it is too exact.",
  "- BUILD: name one ONLY WHERE THE BUILD IS PART OF THE TYPE — a fitness type, a heavy man, a",
  "  physical presence a casting director would actually book for. If the type is a fashion, a style",
  "  or a character type, LEAVE THE BUILD OUT ENTIRELY: a build word the type did not need is one more",
  "  thing all eight of them are forced to share. When you do name one, choose from this CLOSED list",
  `  and nothing else — ${BUILD_FAMILIES.join(", ")} — and you`,
  "  may pair two of them (\"athletic muscular\", \"solid athletic\").",
  "  A body SIZE or weight is never one of them: \"slight\", \"slender\", \"petite\", \"skinny\", \"curvy\",",
  "  \"trim\" and anything like them are out, alone or as a modifier. A size is the fastest way to reprint",
  "  one person, and eight different people do not share one.",
  "- FEATURE OR WARDROBE \u2014 THE CLOTHES CUT DOES NOT STRIP A FACE. Draw the line by where the thing",
  "  sits, not by what it is made of. On the body as ANATOMY it is a FEATURE and it stays: ears, horns,",
  "  ornamentation, plating, and a machine part fitted into the body \u2014 a mechanical eye, a jaw plate,",
  "  a skull implant. Strapped on, but REPLACING a body part, is still a feature. On the outfit as",
  "  STYLING it is wardrobe, and the wardrobe rule below governs it. A choker is an accessory; a horn",
  "  is a feature; a machine part fitted into the skull is a feature. Name a feature as a TYPE and",
  "  never as a product: \"fitted mechanical eye\", \"integrated facial hardware\" \u2014 never \"spiked eye",
  "  harness\", never \"sleek mechanical eye piece\". Do not flatten it away either: a being's own",
  "  hardware is part of what a casting director would be booking.",
  "- THE CREATURE CHECKLIST \u2014 ears, horns, tail, wings, scales, whiskers, and mouth anatomy.",
  "  IF IT IS IN THE FRAME, WRITE IT. The list is a floor and never a ceiling: extra limbs, fins, a",
  "  crest, a beak, an exoskeleton are facts about the being too, and a fact is not optional taste.",
  "  A MOUTH is anatomy when the being would not be itself without it \u2014 write it as a feature in type",
  "  language (\"short oni tusks\", \"a long tongue\", \"a heavy underbite\", \"non-human dentition\"),",
  "  never as gore and never as an acted state: not \"dripping slime\", not \"mouth wide open\", not a",
  "  snarl or a roar. A mouth that is an ordinary mouth is not a feature and goes unmentioned.",
  "- WARDROBE: ONE phrase, never a list of pieces. If the clothing is plain, the phrase can name it",
  "  (\"fitted dark crew-neck\"). If it is styled or elaborate, the phrase is MATERIALS AND MOOD",
  "  (\"dark structured fashion in lace, leather and metal\"). Never itemise, and never name a single",
  "  WORN accessory \u2014 no harness, no mask, no collar, no glove, no piece of jewellery, whatever it is",
  "  made of. A part of the being itself is not an accessory: that is the rule above.",
  "  Name the MATERIAL, never the hardware or what has been done to it \u2014 \"metal accents\" is enough,",
  "  and \"spiked\", \"studded\", \"buckled\", \"chained\" and their kind are out. That is not taste: a note",
  "  carrying them is REFUSED OUTRIGHT by the image engine, so it costs her the cast altogether.",
  "- MARKINGS: a world, never an inventory. \"Facial piercings\", \"sparse fine-line tattoos on the face",
  "  and arms\" \u2014 never each piece, its design, or where exactly it sits.",
  "",
  "DO NOT CATALOGUE. Leave out exact eye colour, brow shape, the exact cut, fade or hairline,",
  "seams and garment construction, and anything you only noticed by staring. Never say what the person",
  "does NOT have — no \"no tattoos\", no \"no jewellery\", no \"no makeup\".",
  "EVERYTHING YOU NAME IS LOCKED ON EVERY FACE THAT GETS CAST, so each detail you list is a detail",
  "eight different people are forced to share.",
  "",
  "NEVER mention: the lighting, the background or set, the framing, crop or pose direction, the camera,",
  "lens, focus or depth of field, the resolution or quality of the picture, or the picture itself.",
  "Never name a real person or character, and never say who the subject looks like or resembles.",
  "Do not write a prompt, a list, a heading or a preamble — write the note and nothing else.",
  "",
  "THIS IS THE LEVEL OF DETAIL TO AIM FOR. Two notes that are RIGHT:",
  `  "${GOLDEN_NOTES.plain}"`,
  `  "${GOLDEN_NOTES.styled}"`,
  "And one that is WRONG — the same woman as the second note, written as a packing list:",
  `  "${INVENTORY_NOTE}"`,
  "It is wrong because it locks a body size, one exact haircut and three named garments onto all eight",
  "faces, and because garment names like those are refused outright by the image engine.",
  "",
  `Write TWO OR THREE SHORT SENTENCES, about ${CONCEPT_DESCRIPTION_TARGET.low}–${CONCEPT_DESCRIPTION_TARGET.high} characters in total.`,
  'Reply with JSON: {"description": "..."} — or {"description": null} if there is no BEING in the picture at all, only an object, a place or a thing.',
].join("\n");

const ASK = "Describe the person or creature in this picture.";

export type ConceptDescribeInput = {
  bytes: Buffer;
  contentType: string;
  /** `undefined` takes the house transport; `null` is "no transport", for the arms. */
  engine?: TextEngine | null;
  signal?: AbortSignal;
};

/**
 * Every refusal a customer may be shown, named. None of them is an exception.
 *
 * ⚠ **THIS IS A DOOR VOCABULARY AND IT IS READ AS ONE** (#192), which is why it
 * is DECLARED IN `conceptDescribeCopy.ts` and re-exported here rather than the
 * other way round. Its members are that table's keys, and the capability atlas
 * derives this entrance's doors from the table rather than from a grep — so a
 * member added without a customer sentence cannot exist, and one added with a
 * sentence appears on the map (as `concept.<member>`) the same hour. Before
 * this, three of the five were invisible to the map and the fourth was
 * attributed to the interpreter's identically-named `unreadable` door.
 *
 * The direction matters for one reason beyond tidiness: the atlas's charter is
 * that it never runs app code, and THIS module reaches the provider layer.
 * Declaring the union here made that safe only by `import type`'s erasure.
 */
export type { ConceptDescribeRefusal } from "./conceptDescribeCopy";
import type { ConceptDescribeRefusal } from "./conceptDescribeCopy";

export type ConceptDescribeOutcome =
  | { ok: true; description: string; attempts: number }
  | {
      ok: false;
      reason: ConceptDescribeRefusal;
      attempts: number;
    };

/**
 * WHY A READ WAS SENT BACK — and every one of them can be SAID to the reader.
 *
 * ⚠ THIS TYPE EXISTS BECAUSE OF A DEFECT, and the defect is worth naming: the
 * length branch used to set `lastViolation = null` and re-ask with a
 * BYTE-IDENTICAL system and user message at temperature 0. That is a call
 * bought to receive the answer we already have — the model has been told
 * nothing new, so the second read is the first read, and the refusal was
 * decided before the call was made. It was nearly invisible at a 1,200
 * ceiling, where almost nothing ran over. At 300 it is the COMMON path.
 *
 * Its sibling one file over already had this right — `promptAuthor`'s trim
 * re-ask carries the reason AND the previous draft and drops the temperature —
 * so this is the pattern copied rather than invented. Swept for others in the
 * same shape (working law 7): `packageOrchestrator`'s second attempt is a
 * re-RENDER, and `refineInterpreter`'s echo pass re-asks with a constrained
 * vocabulary. One instance, and it is this one.
 *
 * ⚠ **AND THE RE-READ ABOVE IS A BYTE-IDENTICAL SECOND ASK ON PURPOSE — it is
 * NOT that defect coming back, and the next seat must not "fix" it.** That
 * defect was *the answer was wrong and the model was told nothing new*: a
 * `Fault` is a thing the reader SAID, and asking again in silence could only
 * produce the sentence we already have. A read that never arrived has nothing
 * to quote and nothing to correct — there is no fault to name — and the
 * measurement is that an unchanged second ask is exactly what fixes it (3 of 3
 * on the refusing frame). That is why the retry carries `fault: null` rather
 * than a fifth `Fault` member: this union's contract is *what can be SAID to
 * the reader*, and "your previous answer" is a claim about an answer we may
 * never have received.
 */
type Fault =
  | { kind: "picture"; word: string }
  | { kind: "absence"; phrase: string }
  | { kind: "long"; length: number }
  | { kind: "brief"; length: number };

/**
 * WAS THAT A FAILURE WORTH ASKING AGAIN — read off the provider's own published
 * taxonomy, never re-derived here.
 *
 * `unknown` is the empty-200: a real 200 carrying no completion, which
 * `openrouterText.ts` logs with the provider's own finish reasons and throws
 * as `unknown` precisely because a ceiling hit, a stop sequence and a silent
 * upstream refusal are indistinguishable from here. It is deliberately absent
 * from `RETRYABLE_FAILURES` — widening THAT set would change every `withRetry`
 * caller in the product, including the paid image paths, to repair one text
 * read (`providerContract.test.ts` pins the set for exactly this reason). So
 * the second ask is bought HERE, by the one caller that wants it, and every
 * other class stays terminal.
 *
 * Read at the layers rather than assumed: nothing between the throw and this
 * catch re-wraps it — `withRetry` rethrows `lastError` as it stands,
 * `ProviderQueue.run` records the failure and rethrows, and `throughCensus`
 * does the same. So the error arrives whole and `instanceof` is enough; there
 * is no `cause` chain to walk.
 */
function worthAskingAgain(error: unknown): boolean {
  return error instanceof ProviderError && error.failureClass === "unknown";
}

/** The sentence the reader is given on the second ask. It always names the fault. */
function reAsk(fault: Fault): string {
  switch (fault.kind) {
    case "picture":
      return `Your previous answer used "${fault.word}", which describes the picture rather than the person. Write it again without that.`;
    case "absence":
      return `Your previous answer said "${fault.phrase}". Never say what the person does NOT have — describe only what is there. Write it again without that.`;
    case "long":
      return `Your previous answer was ${fault.length} characters — that is an inventory, not a casting note. Write it again in about ${CONCEPT_DESCRIPTION_TARGET.low}–${CONCEPT_DESCRIPTION_TARGET.high} characters, keeping only sex, age band, heritage if visible, build family, hair world, skin and marking world, wardrobe materials and type.`;
    case "brief":
      return `Your previous answer was only ${fault.length} characters and says too little to cast from. Write it again at about ${CONCEPT_DESCRIPTION_TARGET.low}–${CONCEPT_DESCRIPTION_TARGET.high} characters.`;
  }
}

/** The first fault in a read, in the order a customer would care about them. */
function faultIn(description: string): Fault | null {
  if (description.length > CONCEPT_DESCRIPTION_MAX) return { kind: "long", length: description.length };
  if (description.length < CONCEPT_DESCRIPTION_MIN) return { kind: "brief", length: description.length };
  const word = notAboutThePersonIn(description);
  if (word) return { kind: "picture", word };
  const phrase = absenceClaimIn(description);
  if (phrase) return { kind: "absence", phrase };
  return null;
}

/**
 * THREE ANSWERS, NOT TWO (review of #187, finding 1).
 *
 * This returned `string | null` and the caller separated the two meanings of
 * that `null` by asking whether the reply was non-empty — so ANY unparseable
 * non-empty reply (prose instead of JSON, or JSON truncated at the token
 * ceiling) was read as *"there is nobody in your picture"*, which is our fault
 * told to the customer as hers. The reader saying **there is no being here** and the
 * transport handing back **something we cannot read** are different facts and
 * they get different names.
 */
type Parsed =
  | { kind: "described"; description: string }
  | { kind: "said_none" }
  | { kind: "unparseable" };

function parse(raw: string): Parsed {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim());
  } catch {
    return { kind: "unparseable" };
  }
  if (!parsed || typeof parsed !== "object") return { kind: "unparseable" };
  const value = (parsed as Record<string, unknown>).description;
  /* The documented "nobody here" shape is an explicit null. A MISSING key is
     not that answer — it is an object we did not ask for. */
  if (value === null) return { kind: "said_none" };
  if (typeof value !== "string") return { kind: "unparseable" };
  const plain = value.replace(/\s+/g, " ").trim();
  /* An empty string is the same shrug as a null, said differently. */
  return plain.length > 0 ? { kind: "described", description: plain } : { kind: "said_none" };
}

/**
 * ONE read, one re-ask, then an honest refusal.
 *
 * The re-ask exists because the sweep is a blunt instrument by design: a
 * describer that mentioned the light once will usually not mention it twice
 * when told which word it used. A SECOND violation is not argued with — the
 * customer gets a sentence and her own empty brief box, which is the state she
 * was already in, rather than a description quietly stripped of a word and
 * handed over as though it had been written that way.
 */
export async function describeConcept(input: ConceptDescribeInput): Promise<ConceptDescribeOutcome> {
  const engine = input.engine === undefined ? interpreterEngine() : input.engine;
  if (!engine) return { ok: false, reason: "no_transport", attempts: 0 };

  /**
   * One read. Either an outcome the customer gets, or an ask to go again —
   * naming the fault where there IS one, and `null` where no usable answer
   * arrived at all.
   */
  const read = async (attempt: number, previous: Fault | null):
    Promise<ConceptDescribeOutcome | { ok: "retry"; fault: Fault | null }> => {
    let reply: { text?: string | null; truncated?: boolean };
    try {
      reply = await engine.complete({
        about: "describe",
        system: RULES,
        user: previous ? `${ASK} ${reAsk(previous)}` : ASK,
        images: [{ bytes: input.bytes, contentType: input.contentType }],
        json: true,
        temperature: 0,
        /* The describer's own preamble is spent before the object — the face
           scan measured an EMPTY completion at 200 on a two-field ask. This
           read is longer than that one, so the ceiling is larger. Unused
           ceiling costs nothing; billing is per token produced. */
        maxOutputTokens: 900,
        ...(input.signal ? { signal: input.signal } : {}),
      });
    } catch (error) {
      /* The signal is checked as well as the class: a customer who has
         navigated away is not waiting for a second opinion. */
      const again = worthAskingAgain(error) && input.signal?.aborted !== true;
      log.warn(
        { err: error, attempt, again },
        "[conceptDescribe] the reader did not answer",
      );
      return again
        ? { ok: "retry", fault: null }
        : { ok: false, reason: "unreadable", attempts: attempt };
    }

    const parsed = parse(reply.text ?? "");
    /* `{"description": null}` is the reader saying there is no BEING here — an
       object, a place, a thing — and it is a different answer from a read that
       failed. Only one of the two is worth telling her to try a different
       picture about. */
    if (parsed.kind === "said_none") return { ok: false, reason: "no_being", attempts: attempt };
    if (parsed.kind === "unparseable") {
      /* `truncated` is the provider's own `finish_reason === "length"` — the
         reply is a FRAGMENT, which is one of the shapes that lands here, and
         it was being dropped. Logged rather than branched on: a named "write
         it shorter" re-ask is worth building when the number says it happens,
         and at a 900-token ceiling against a 300-character target it should be
         near zero. Buy the incidence before the branch. */
      log.warn(
        { attempt, truncated: reply.truncated === true },
        "[conceptDescribe] the reply was not a description we could read",
      );
      return { ok: "retry", fault: null };
    }
    const { description } = parsed;
    const fault = faultIn(description);
    if (!fault) return { ok: true, description, attempts: attempt };
    log.warn({ attempt, fault, length: description.length }, "[conceptDescribe] the read was sent back");
    /* NEVER truncated and never stripped — re-asked, naming the fault. */
    return { ok: "retry", fault };
  };

  const first = await read(1, null);
  if (first.ok !== "retry") return first;
  const second = await read(2, first.fault);
  if (second.ok !== "retry") return second;
  /* No usable answer, twice. Today's sentence, unchanged — it already says
     "just now", and a reader that comes back as noise twice is the one case
     where looking for a different picture is honest advice. */
  if (second.fault === null) return { ok: false, reason: "unreadable", attempts: 2 };
  /*
    TWO FAMILIES OF SECOND FAILURE, and they are different sentences to her
    because they are different facts. A read that keeps describing the PICTURE,
    or keeps CATALOGUING, is ours — she should try again rather than go looking
    for a better photograph of our problem. A read that keeps coming back as a
    shrug is the only one where a different picture is the honest advice, and it
    takes `unreadable`'s sentence, which already says "just now".
  */
  const reason = second.fault.kind === "picture"
    ? "not_about_the_person"
    : second.fault.kind === "brief" ? "unreadable" : "not_a_casting_note";
  return { ok: false, reason, attempts: 2 };
}
