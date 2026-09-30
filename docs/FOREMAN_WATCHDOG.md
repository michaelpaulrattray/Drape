# The Foreman Watchdog — the machine-local task that keeps the nights running

**This file exists because the recipe did not (#1610, 2026-09-30).** The
night-shift team runs because of one Windows scheduled task on one machine, and
until this file landed **no tracked byte in this repository contained the word
`Watchdog`.** The script the task launches
(`.agents/foreman/foreman-runner.ps1`) is gitignored — `.gitignore` carries
`.agents/*` and re-closes the level it re-opens with `.agents/foreman/*`, whose
one exemption is the campaign pointer — and so are the standing orders that
describe the team — so both halves, the recipe and the thing it launches,
lived only outside version control. A rebuilt or replaced machine had nothing to
read.

It is the same class as #1539/#1596 one degree worse. There, a task was fixed by
hand and its written recipe was not, so the one road that survives a rebuild
would have re-created a defect the founder had personally complained about.
**Here the road was simply absent.**

⚠ **THE VALUES BELOW WERE READ OFF THE LIVE TASK ON 2026-09-30, NOT
RECONSTRUCTED FROM MEMORY OR FROM A CARD** — see *Read it back at the task*
below, which is the only reading that settles what is registered. Two things the
reading corrected are recorded at the foot of this file rather than quietly
smoothed over.

## The live task, as registered

| | |
|---|---|
| task name | `Drape Foreman Watchdog` (task path `\`, i.e. the root folder) |
| action | `powershell.exe` |
| arguments | `-WindowStyle Hidden -ExecutionPolicy Bypass -File C:\Users\Admin\Drape\.agents\foreman\foreman-runner.ps1` |
| trigger | one time trigger, `StartBoundary 2026-08-25T18:41:00`, repeating every **1 hour**, no repetition duration (indefinite) |
| MultipleInstances | `IgnoreNew` |
| ExecutionTimeLimit | `PT72H` (72 hours) |
| principal | `Admin`, `LogonType Interactive`, `RunLevel Limited` |

## The recipe — what puts it back after a rebuild

```powershell
$action = New-ScheduledTaskAction -Execute 'powershell.exe' `
  -Argument '-WindowStyle Hidden -ExecutionPolicy Bypass -File C:\Users\Admin\Drape\.agents\foreman\foreman-runner.ps1'
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) `
  -RepetitionInterval (New-TimeSpan -Hours 1)
Register-ScheduledTask -TaskName 'Drape Foreman Watchdog' -Action $action -Trigger $trigger `
  -Settings (New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Hours 72))
```

Everything the live task carries that is not named in that call is the default
`New-ScheduledTaskSettingsSet` and `Register-ScheduledTask` produce for the
current interactive user, and was confirmed against the task rather than
assumed: `StartWhenAvailable False`, `DisallowStartIfOnBatteries True`,
`StopIfGoingOnBatteries True`, `RestartCount 0`, `WakeToRun False`,
`RunLevel Limited`, `LogonType Interactive`.

⚠ **AFTER REGISTERING, CHECK THE REPETITION DURATION IS EMPTY.** A
`-RepetitionInterval` with no `-RepetitionDuration` repeats indefinitely on this
Windows build, which is what the live task has (`Duration` blank) — but a
duration that lands as one day would leave the watchdog silently dead from day
two, with the task still present and still reading `Ready`:

```powershell
(Get-ScheduledTask -TaskName 'Drape Foreman Watchdog').Triggers[0].Repetition |
  Format-List Interval, Duration
```

## Why each of the three named settings is what it is

- **`-WindowStyle Hidden` on the action.** The principal is Interactive, so a
  visible console would appear on the founder's own screen. Note the limit
  #1539 measured next door: `-WindowStyle` is not a scheduled-task setting and
  does not suppress a CHILD console — it works here because the action is
  `powershell.exe` itself rather than `cmd.exe` launching something else. The
  mirror needed a `wscript.exe //B` launcher for exactly that reason; this task
  does not.
- **`-MultipleInstances IgnoreNew` is load-bearing.** The runner is a
  *continuous* process, not a per-tick job — its own header, read at the bytes,
  says *"Fresh headless shift after fresh headless shift, forever, until STOP"*
  and *"an hourly watchdog restarts it if it ever dies"*. So the hourly trigger
  fires while the previous instance is still running for hours on end, and
  `IgnoreNew` is what stops Task Scheduler stacking a second runner beside the
  live one every hour. The runner ALSO defends itself — `.agents/foreman.lock`
  holds a PID and a second copy exits when that PID is alive — so this is two
  independent controls rather than one, and neither is a reason to drop the
  other.
- **`ExecutionTimeLimit PT72H`.** A persistent process under a default
  three-day-less limit would be killed mid-shift. 72 hours is the ceiling the
  live task carries; it is not a target, and a runner alive for three days is
  restarted by the next hourly firing after the scheduler stops it.

⚠ **`DisallowStartIfOnBatteries` and `StopIfGoingOnBatteries` are both TRUE**,
which is the PowerShell default and is recorded here because it is a real
operating fact rather than an oversight to fix silently: on battery the nights do
not start, and unplugging stops them. Changing that is a decision, not a
tidy-up — `-AllowStartIfOnBatteries -DontStopIfGoingOnBatteries` on the settings
set is the one-line form if it is ever wanted.

## Read it back at the task, never at this file

This file is a report; the task is the artifact (working law 1). The mistake
#1596 fixed was trusting the written half:

```powershell
$t = Get-ScheduledTask -TaskName 'Drape Foreman Watchdog'
$t.Actions  | Format-List Execute, Arguments
$t.Triggers | Format-List StartBoundary, Enabled
$t.Triggers[0].Repetition | Format-List Interval, Duration
$t.Settings | Format-List MultipleInstances, ExecutionTimeLimit, Enabled
Get-ScheduledTaskInfo -TaskName 'Drape Foreman Watchdog' |
  Format-List LastRunTime, LastTaskResult, NextRunTime
```

## What is deliberately NOT here

- **The runner's own body.** `.agents/foreman/foreman-runner.ps1` is 810 lines
  and is untracked on standing instruction; whether the team's bootstrap belongs
  in the repository is the founder's decision and a wider question than the one
  #1610 measured. This file restores reproducibility of the **task** without
  moving a byte of `.agents/`.
- **The reply mirror's recipe.** The second Drape task on this machine,
  `Drape Crew Reply Mirror`, carries its own recipe — including its
  `wscript.exe` launcher's full body — in the docblock of
  `scripts/crew-mirror-replies.mts`. It is POINTED at here and never copied:
  a second copy of a recipe drifts from the first (working law 4), and that
  drift is the whole content of #1596.

## Two things the reading corrected — and the card and the runner still say otherwise

Both were found by reading the live task, not by reading about it, and both are
recorded here because a recipe that quietly disagrees with the machine is the
defect this file exists to close. Neither is repaired here: each is a decision,
not a tidy-up.

1. **The interval is one hour, not "every few minutes".** #1610's own prose
   says the task launches the runner "every few minutes". The live repetition
   interval is `PT1H`. The card's substance is untouched by this — the recipe
   above registers what the machine actually has, and the read-back command
   prints it.
2. **There is no logon trigger.** The runner's header
   (`.agents/foreman/foreman-runner.ps1`) says *"Scheduled at logon + an hourly
   watchdog restarts it if it ever dies"*. Read three ways on 2026-09-30:
   `Get-ScheduledTask` shows exactly two Drape tasks; the Watchdog has exactly
   one trigger, a time trigger; no task's action names `foreman-runner` but this
   one; and `HKCU:\…\CurrentVersion\Run` has no entry. So after a reboot the
   runner starts at the next hourly firing, not at logon. A rebuild that follows
   the runner's comment would register a trigger this machine never had; a
   rebuild that follows this file registers what it has. Adding a logon trigger
   is a change to how the nights start and is the founder's call.

## Guard

`server/foremanWatchdogRecipe.test.ts` holds the half that lives in tracked
bytes — what this recipe tells you to register. No suite can read a
machine-local scheduled task, in CI or anywhere else, so the live half is read
back by hand with the commands above. The arms are anchored on the ACTION and on
the named settings rather than on bare substrings: `powershell.exe` appears all
over this repository, and an arm that matched it anywhere would pass on a file
that had lost the recipe entirely.
