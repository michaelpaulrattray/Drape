# The missing Eyes row, second cause — a damaged reading was kept

> **Status: dated record.** A measurement/evidence/court document from the date it states — it records what was true then; individual verdicts may since have been superseded. Current law: CLAUDE.md, the capability atlas, `DECISION_LOG.md` (#69 stamping sweep, 2026-08-28).


*Investigated 2026-08-15 on the founder's own specimen (candidate 1603,
"Quietly confident", heavy-framed glasses), ordered by fable-547. **$0.15 of
house money**, no user credits, nothing written. Every number below is from a
driven read.*

---

## The hypothesis, and it is dead

Fable's, stated for killing: **label competition at the eye/glasses boundary** —
that on a bespectacled face "eyes" answers nothing, or answers the lenses,
because the glasses own that part of the picture.

```
                             spec-1603   spec-1595   bare-1625   bare-beard
                             (glasses)   (glasses)   (bare)      (bare)
eyes            (incumbent)   0.0942%     0.1182%     0.1637%     0.0991%
her eyes                      0.0000%     0.0769%     0.0859%     0.1066%
the eyes behind the glasses   0.0000%     1.3173%     0.0000%     0.0000%
eyeball                       0.0000%     0.0000%     0.0000%     0.0000%
```

**The incumbent finds eyes on every frame, 4 of 4, including both bespectacled
ones.** Every candidate rephrasing is worse — "her eyes" loses one of his own
frames, and *"the eyes behind the glasses"* finds nothing on three of four and
returns a mask six times too tall on the fourth (6.8% of the frame: the glasses,
not the eyes — silhouette-is-not-material, at a boundary).

Incumbent keeps, per the lips precedent. No phrasing change.

## Then the scan, on the same frame

```
asked 12 · found 11 → nose, lips, hair, skin, glasses, brow@left, brow@right,
                      EYE@LEFT, EYE@RIGHT, ear@left, build
empty  facial hair, horns, teeth, earring        failed  (none)
per side   eyes: left 0.0421%  right 0.0516%
```

**The shipped scan finds both of her eyes.** And the panel built from that scan
draws the row: `Face → Eyes, Brows, Nose, Lips, Ears`.

So on today's code, his specimen shows Eyes. The segmenter is not the cause, the
scan is not the cause, and the panel is not the cause.

## What the cause is: the cache kept the burst's damage

The concurrency burst that lost eleven regions to the provider's limit
(fable-505/506, fixed and proven) **resolved into a scan whose `failed` list was
long — and that scan was cached for the life of the process.** Every later look
at that version returned the damage rather than re-asking. One unlucky read
pinned a wrong panel until a deploy restarted the process.

The rule the code already had for a THROWN read is the right one and simply did
not cover a read that came back *holding* failures:

> *"A failed read is not cached. The next look pays again, which is the right
> trade for a courtesy read: a cached rejection would make one bad minute
> permanent for that version."*

## The fix: weather is not kept; a fact is

A failure now says whether asking again could plausibly help — the reader marks
a 429, a 5xx or a timeout as **weather**; *"nothing of her is below her chin in
this frame"* is a **fact**.

```
a reading with WEATHER in it   served to whoever is waiting, then dropped —
                               the next look re-asks the lost regions
a reading with only FACTS      kept, because asking again buys the same nothing
a clean reading                kept, and still costs exactly one read
```

Both arms are driven, and the control matters more than the rule: without *"a
clean scan is still cached, and still costs one read"*, a fix that simply
stopped caching anything would pass.

## What it costs

A face with a genuinely unanswerable region re-scans on each new look rather
than once — bounded by the client holding its own answer for the session
(`staleTime: Infinity`). The alternative is a wrong panel that cannot be fixed
by looking again, which is what the founder met twice.

## The honest limits

- **His original panel was not re-read**; the process that held it is long
  restarted. This diagnosis is a reconstruction that fits every measurement —
  and the measurements are all on his own frame.
- **n = 2 bespectacled specimens**, both his. The phrasing column is 4 frames ×
  4 phrasings, which is enough to keep the incumbent and not enough to crown a
  rival if one ever appears.
- **The re-ask instrumentation was not the question in the end.** Eyes are
  non-departable, so an empty read buys one retry; on this frame no eye read was
  empty, so there was nothing to retry.
