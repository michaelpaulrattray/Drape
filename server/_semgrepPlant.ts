// POSITIVE CONTROL for the gate's semgrep step (Warden patrol #1, card #97,
// working law 2). This file exists on a throwaway branch only, so the
// required check can be seen to go RED on the "Static shapes" step. It is
// never merged; the PR that carries it is closed once the red run is
// recorded in docs/WARDEN_LOG.md run 1 §C.
import { exec } from "node:child_process";
import type { Request, Response } from "express";

export function plant(req: Request, res: Response) {
  exec(String(req.query.cmd));
  res.send(eval(String(req.query.code)));
}
