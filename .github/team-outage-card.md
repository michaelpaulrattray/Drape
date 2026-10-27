**Filed by `.github/workflows/team-silence.yml`** — the detector that does not depend on a shift running (#2719, Retro recurrence R23).

`main` has stood still past the silence threshold **while there was authorised work on the board**. That combination is the finding: silence with an empty band is a park working as designed, and silence with cards on offer is not.

## Why no other alarm fired

Every alarm the team owns keys on work **in flight**: `CREW_SHIFT_STALL_MS` fires only on an **open** shift row, the close-stamp verifies an entry that **exists**, and the park notice describes a park that **happened**. Nothing else measures the absence of runs — which is why this job runs outside the machine it is watching.

## What to read, in this order

1. the newest `.agents/mailbox/foreman-*` entry, and whether one exists for the window at all
2. `.agents/shift-logs/` for the newest runner log name
3. whether `.agents/STOP` exists and what tag it carries — a `PARKED-QUIET` park un-parks itself on any real signal and on a 24-hour heartbeat, so a STOP file is not by itself an explanation
4. whether the runner's lock names a **live process that is not a runner**. That is #2719's measured defect, driven with both controls: the check records only a PID, Windows reuses PIDs, and a lock holding Explorer's PID makes the runner stand down — silently, into a `Write-Host` in a hidden window with no redirection.

## What this card is NOT

**It does not claim a cause, and it cannot.** The runner's lock is overwritten by whichever runner takes it next, so the PID it held during an outage is gone by the time anybody looks. This card is the **observation** — that `main` stood still while there was work on the board — which is the one thing no reader the team owns was able to say.

It also asks for no restart and changes nothing. #2719's own scope: *"This is about a silent stand-down becoming a recorded one, and about an outage having any detector at all."*

## Closing it

Close it when the team is running again, **with what it turned out to be** — a park, a dead lock, a usage cap, a machine off, or something else. That sentence is the only thing that will tell the next reader whether the threshold is right.
