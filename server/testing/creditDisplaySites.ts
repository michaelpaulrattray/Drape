/**
 * WHERE A CREDIT NUMBER REACHES A CUSTOMER — the reader behind #1600's guard.
 *
 * `shared/creditDisplay.ts` is the only place a ledger number becomes a number
 * a customer reads. A type carries half of that promise: `formatCredits` takes
 * a branded `DisplayCredits`, so a raw ledger value cannot be formatted by
 * accident. This reader carries the other half — the two things a type cannot
 * see:
 *
 * 1. **A site that never calls the helper at all.** `{credits.toLocaleString()}`
 *    typechecks perfectly and shows a ledger number to a customer.
 * 2. **Scale arithmetic written out by hand.** A `/ 5` at a render site, or a
 *    `* 50` left over from the legacy multiplier, is a second copy of the
 *    scale — working law 4, on the number that quotes a price.
 *
 * # ⚠ This reader is RED BY DESIGN today, and its allowlist is the census
 *
 * P1-1 ships in slices. The helper lands first; the sites are routed with
 * P1-2's prices, because the ×10 display must never appear on today's prices
 * (the card's done-when 4). So `UNROUTED` below is the **measured census of
 * every site still to route** — not an excuse list. It only shrinks, and a
 * routing PR that does not shrink it has not routed anything.
 *
 * # What it reads, stated narrowly so the limit is visible
 *
 * **Rule 1 — a formatted credit number.** `X.toLocaleString()` where `X` is
 * named for credits, in a customer-visible file. `toLocaleString` is the
 * product's own idiom for "make this number readable by a person", so it is a
 * strong signal rather than a guess. The strict vocabulary is used here
 * BECAUSE there is no corroborating text: a bare `price` is excluded, since
 * `PLAN_TIERS.price` is **cents**, not credits, and indicting it would be the
 * false refusal this kind of guard is famous for.
 *
 * **Rule 2 — a credit number beside the word "credit".** An expression
 * interpolated into a template or JSX whose surrounding literal text says
 * "credit". Here a wider vocabulary is safe, because the word itself is the
 * corroboration — `` `${cost} credits` `` is unambiguous in a way `cost` alone
 * never is.
 *
 * **Rule 3 — scale arithmetic.** `/ 5`, `/ 50`, `* 50` against a credit-named
 * operand, anywhere outside the helper. This one runs on STAFF surfaces too:
 * they are exempt from displaying the customer scale, not from inventing it.
 *
 * # What it does NOT see, named rather than left to be discovered
 *
 * - A credit number rendered through a variable whose name says nothing
 *   (`const n = balance; <span>{n}</span>`). Names are the only handle a
 *   textual reader has; the brand on `formatCredits` is what covers this once
 *   a site is routed, which is why the two halves ship together.
 * - A number crossing the wire already divided by a server that did it wrong.
 *   Nothing here reads runtime values.
 * - Copy that states a price as a literal in prose. #1601 owns the price table
 *   and `server/architectureCreditCosts.test.ts` already reads every declared
 *   price out of the tree.
 *
 * So a clean run is a FLOOR, not coverage — and the population counts below
 * exist because a reader that silently stopped parsing reports zero sites,
 * which is byte-identical to a fully routed product.
 */
import { execFileSync } from "node:child_process";
import { join } from "node:path";

import ts from "typescript";

import { readListedSource } from "./listedSource";

/** Trees that can put a number in front of a customer. */
export const SOURCE_ROOTS = ["client/src/", "server/", "shared/"] as const;

/**
 * Surfaces that stay in LEDGER units, by the card's own words: *"Admin and
 * moderator views stay in ledger units, labelled 'units'."* Staff are reading
 * the books, not being quoted a price.
 *
 * The list mirrors the review triage's own STAFF SURFACES
 * (`.github/customer-surfaces.sh`) deliberately — the same four shapes, so a
 * diff the reviewer treats as staff is a diff this guard treats as staff.
 */
export const STAFF_SURFACES = [
  "client/src/features/admin/",
  "client/src/features/moderator/",
  "client/src/pages/Admin",
  "client/src/pages/Moderator",
  "server/routes/admin/",
  "server/routes/moderator",
] as const;

/**
 * ⚠ `server/lib/adminActions/changeRequestActions.ts` is deliberately NOT on
 * that list, though its path says admin. The card names *"change-request
 * texts"* among the server strings a CUSTOMER sees — the action is staff's,
 * the sentence is the customer's, and the path is about who triggers it.
 */

/** The helper itself, which is allowed — required — to know the scale. */
export const THE_HELPER = "shared/creditDisplay.ts";

/** The functions that make a number safe to show. */
export const DISPLAY_HELPERS = [
  "displayBalance",
  "displayPrice",
  "displayRefund",
  "displaySpent",
  "formatCredits",
] as const;

/**
 * Names that mean credits with no other evidence needed (rule 1).
 *
 * ⚠ `price` and a bare `cost` are deliberately ABSENT. `PLAN_TIERS.price` is
 * cents; indicting it would make this guard refuse correct code, which is the
 * failure mode that gets a guard deleted rather than fixed.
 */
const STRICT_CREDIT_NAME = /credit|balance|pointscost|allowance|[a-z]cost$/i;

/** Names that mean credits when the word "credit" is right beside them (rule 2). */
const LOOSE_CREDIT_NAME = /credit|balance|pointscost|allowance|cost|price|spent|remaining|refund|grant/i;

/** The scale multipliers a hand-written conversion would use. */
const SCALE_LITERALS = new Set([5, 50]);

export type CreditSite = {
  /** Repo-relative, forward-slashed. */
  file: string;
  /** 1-indexed, so it is clickable. */
  line: number;
  /** Which rule caught it. */
  rule: "formatted" | "beside-the-word" | "scale-arithmetic";
  /** The offending expression's own source text, trimmed. */
  expression: string;
};

export type CreditDisplayReading = {
  sites: CreditSite[];
  /** Files read. A floor: zero means the walk found nothing to read. */
  files: number;
  /** `toLocaleString` calls seen anywhere in the population. The rule-1 floor. */
  formatCalls: number;
  /** Templates and JSX texts seen. The rule-2 floor. */
  interpolations: number;
};

/**
 * THE CENSUS OF SITES STILL TO ROUTE — #1600's enumerated remainder.
 *
 * Every row is a real place a customer reads a ledger number today. **It only
 * shrinks.** A routing PR deletes the rows it routed; a row that cannot be
 * deleted because the site moved is re-measured, never edited to match.
 *
 * ⚠ It is keyed on (file, rule, expression) and NOT on a line number, which
 * was the first shape and was wrong: every routing PR moves the lines below it
 * and the allowlist would then excuse the wrong sites while reporting a clean
 * shrink. The expression text is what identifies a site across an edit.
 */
export const UNROUTED: readonly {
  file: string;
  rule: CreditSite["rule"];
  expression: string;
  /** How many times this exact shape appears in this file. */
  count: number;
}[] = [
  { file: "client/src/components/UserCard.tsx", rule: "formatted", expression: "creditsBalance.toLocaleString()", count: 1 },
  { file: "client/src/features/billing/AddCreditsModal.tsx", rule: "formatted", expression: "(status?.balance ?? 0).toLocaleString()", count: 1 },
  { file: "client/src/features/billing/AddCreditsModal.tsx", rule: "beside-the-word", expression: "formatCreditsPerDollar(priceAMonth(selected.price, annual), selected.credits)", count: 1 },
  { file: "client/src/features/billing/AddCreditsModal.tsx", rule: "beside-the-word", expression: "currentPrice > 0 ? `, up from ${formatCreditsPerDollar(priceAMonth(currentPrice, annual), currentCredits)}` : null", count: 1 },
  { file: "client/src/features/billing/AddCreditsModal.tsx", rule: "formatted", expression: "(option.credits - currentCredits).toLocaleString()", count: 1 },
  { file: "client/src/features/billing/ChangePlanModal.tsx", rule: "beside-the-word", expression: "formatCreditsPerDollar(priceOf(plan), plan.credits)", count: 1 },
  { file: "client/src/features/billing/ChangePlanModal.tsx", rule: "formatted", expression: "plan.credits.toLocaleString()", count: 2 },
  { file: "client/src/features/billing/ChangePlanModal.tsx", rule: "formatted", expression: "framesFor(plan.credits, costPerFrame).toLocaleString()", count: 1 },
  { file: "client/src/features/billing/ChangePlanModal.tsx", rule: "formatted", expression: "quote.creditAdjustment.toLocaleString()", count: 1 },
  { file: "client/src/features/billing/LowBalanceWarning.tsx", rule: "beside-the-word", expression: "balance", count: 1 },
  { file: "client/src/features/boards/BoardHeader.tsx", rule: "formatted", expression: "creditsBalance.toLocaleString()", count: 1 },
  { file: "client/src/features/boards/canvas/BulkRefreshDialog.tsx", rule: "formatted", expression: "totalCost.toLocaleString()", count: 1 },
  { file: "client/src/features/boards/canvas/CostLabel.tsx", rule: "formatted", expression: "credits.toLocaleString()", count: 1 },
  { file: "client/src/features/boards/canvas/VariationsPopover.tsx", rule: "formatted", expression: "plan.estimatedCreditCost.toLocaleString()", count: 1 },
  { file: "client/src/features/casting/components/CastProfilePanel.tsx", rule: "formatted", expression: "completeCardCost.toLocaleString()", count: 1 },
  { file: "client/src/features/casting/components/ImageViewer/RefinePanel.tsx", rule: "beside-the-word", expression: "iterationCost", count: 2 },
  { file: "client/src/features/casting/components/ImageViewer/ViewTabs.tsx", rule: "formatted", expression: "refreshCost.toLocaleString()", count: 3 },
  { file: "client/src/features/casting/components/ImageViewer/ViewTabs.tsx", rule: "beside-the-word", expression: "cost.toLocaleString()", count: 2 },
  { file: "client/src/features/casting/components/ImageViewer/ViewTabs.tsx", rule: "formatted", expression: "actionableCost.toLocaleString()", count: 3 },
  { file: "client/src/features/casting/components/PackageHealthDialog.tsx", rule: "beside-the-word", expression: "(plan?.cost ?? 0).toLocaleString()", count: 2 },
  { file: "client/src/features/casting/components/PackageHealthDialog.tsx", rule: "formatted", expression: "actionableCost.toLocaleString()", count: 3 },
  { file: "client/src/features/casting/ControlPanel.tsx", rule: "beside-the-word", expression: "castingImageCost", count: 1 },
  { file: "client/src/features/casting/evidence/InkAddPanel.tsx", rule: "beside-the-word", expression: "priceCredits", count: 1 },
  { file: "client/src/features/casting/hooks/useCastingGeneration.ts", rule: "beside-the-word", expression: "totalCost", count: 1 },
  { file: "client/src/features/castingV2/cancelNotice.ts", rule: "beside-the-word", expression: "outcome.refundedCredits", count: 2 },
  { file: "client/src/features/castingV2/components/CandidateTile.tsx", rule: "beside-the-word", expression: "retryPriceCredits", count: 1 },
  { file: "client/src/features/castingV2/components/RefinePanel.tsx", rule: "beside-the-word", expression: "priceCredits", count: 1 },
  { file: "client/src/features/castingV2/components/SignConfirm.tsx", rule: "beside-the-word", expression: "priceCredits", count: 1 },
  { file: "client/src/features/referral/RedeemCodeModal.tsx", rule: "beside-the-word", expression: "data.rewardCredits", count: 1 },
  { file: "client/src/features/settings/ReferralBlock.tsx", rule: "formatted", expression: "(entry.creditsAwarded ?? 0).toLocaleString()", count: 1 },
  { file: "client/src/features/settings/sections/BillingSection.tsx", rule: "formatted", expression: "allowance.toLocaleString()", count: 1 },
  { file: "client/src/features/settings/sections/BillingSection.tsx", rule: "formatted", expression: "balance.toLocaleString()", count: 1 },
  { file: "client/src/features/settings/usageWindow.ts", rule: "formatted", expression: "allowance.toLocaleString()", count: 1 },
  { file: "client/src/features/settings/usageWindow.ts", rule: "formatted", expression: "balance.toLocaleString()", count: 1 },
  { file: "client/src/features/studio/components/CastModelModal.tsx", rule: "beside-the-word", expression: "plan.cost.toLocaleString()", count: 1 },
  { file: "client/src/features/studio/components/StudioSlimHeader.tsx", rule: "formatted", expression: "creditsBalance.toLocaleString()", count: 2 },
  { file: "client/src/features/studio/takeover/CastingTakeover.tsx", rule: "formatted", expression: "creditsData.balance.toLocaleString()", count: 1 },
  { file: "client/src/features/studio/takeover/IdentityChangeDialog.tsx", rule: "beside-the-word", expression: "cost.toLocaleString()", count: 1 },
  { file: "client/src/foundation/primitives.tsx", rule: "formatted", expression: "balance.toLocaleString()", count: 1 },
  { file: "client/src/pages/CastingRoom.tsx", rule: "beside-the-word", expression: "result.refundedCredits", count: 1 },
  { file: "client/src/pages/CastingSheet.tsx", rule: "beside-the-word", expression: "price", count: 1 },
  { file: "client/src/pages/CastingSheet.tsx", rule: "beside-the-word", expression: "typeof balance === \"number\" ? ` · ${balance.toLocaleString()} left` : \"\"", count: 1 },
  { file: "client/src/pages/CastingSheet.tsx", rule: "formatted", expression: "balance.toLocaleString()", count: 1 },
  { file: "server/casting/evidence/evidencePackageExecution.ts", rule: "beside-the-word", expression: "authority.plan.totalCost", count: 1 },
  { file: "server/casting/mintPackage.ts", rule: "beside-the-word", expression: "totalCost", count: 1 },
  { file: "server/casting/refreshSlots.ts", rule: "beside-the-word", expression: "totalCost", count: 1 },
  { file: "server/castingV2/refineReask.ts", rule: "beside-the-word", expression: "input.priceCredits", count: 2 },
  { file: "server/castingV2/refineService.ts", rule: "beside-the-word", expression: "price", count: 1 },
  { file: "server/castingV2/reliabilityReport.ts", rule: "beside-the-word", expression: "report.creditsRefunded", count: 1 },
  { file: "server/castingV2/retryService.ts", rule: "beside-the-word", expression: "price", count: 1 },
  { file: "server/castingV2/retryService.ts", rule: "beside-the-word", expression: "refunded", count: 1 },
  { file: "server/castingV2/rollService.ts", rule: "beside-the-word", expression: "price", count: 1 },
  { file: "server/castingV2/rollService.ts", rule: "beside-the-word", expression: "refundedCredits", count: 1 },
  { file: "server/castingV2/signService.ts", rule: "beside-the-word", expression: "price", count: 1 },
  { file: "server/castingV2/viewRetryService.ts", rule: "beside-the-word", expression: "price", count: 1 },
  { file: "server/db/billing.ts", rule: "beside-the-word", expression: "monthlyCredits", count: 1 },
  { file: "server/db/billing.ts", rule: "beside-the-word", expression: "rolloverCredits", count: 1 },
  { file: "server/db/billing.ts", rule: "beside-the-word", expression: "creditAmount", count: 1 },
  { file: "server/lib/adminActions/changeRequestActions.ts", rule: "beside-the-word", expression: "refundResult.refundId", count: 2 },
  { file: "server/lib/adminActions/changeRequestActions.ts", rule: "beside-the-word", expression: "(refundAmountCents / 100).toFixed(2)", count: 2 },
  { file: "server/lib/adminActions/changeRequestActions.ts", rule: "beside-the-word", expression: "refundType", count: 2 },
  { file: "server/lib/adminActions/changeRequestActions.ts", rule: "beside-the-word", expression: "creditsToDeduct", count: 2 },
  { file: "server/lib/boardOps.ts", rule: "beside-the-word", expression: "cost", count: 2 },
  { file: "server/lib/boardOps.ts", rule: "beside-the-word", expression: "totalCost", count: 1 },
  { file: "server/routes/billing.ts", rule: "beside-the-word", expression: "creditAdjustment", count: 2 },
  { file: "server/routes/generation/castingImaging.ts", rule: "beside-the-word", expression: "CREDIT_COSTS.castingImage", count: 1 },
  { file: "server/stripe/stripeProducts.ts", rule: "formatted", expression: "PLAN_TIERS.starter.monthlyCredits.toLocaleString()", count: 2 },
  { file: "server/stripe/stripeProducts.ts", rule: "formatted", expression: "PLAN_TIERS.pro.monthlyCredits.toLocaleString()", count: 2 },
  { file: "server/stripe/stripeProducts.ts", rule: "formatted", expression: "PLAN_TIERS.studio.monthlyCredits.toLocaleString()", count: 2 },
  { file: "server/stripe/stripeProducts.ts", rule: "formatted", expression: "PLAN_TIERS.business.monthlyCredits.toLocaleString()", count: 2 },
  { file: "server/stripe/stripeProducts.ts", rule: "formatted", expression: "PLAN_TIERS.scale.monthlyCredits.toLocaleString()", count: 2 },
  { file: "server/stripe/stripeProducts.ts", rule: "formatted", expression: "PLAN_TIERS.enterprise.monthlyCredits.toLocaleString()", count: 2 },
  { file: "server/stripe/stripeProducts.ts", rule: "formatted", expression: "PLAN_TIERS.ultimate.monthlyCredits.toLocaleString()", count: 2 },
  { file: "server/stripe/webhooks.ts", rule: "beside-the-word", expression: "grantCredits", count: 1 },
  { file: "server/stripe/webhooks.ts", rule: "beside-the-word", expression: "creditsToRestore", count: 2 },
  { file: "server/stripe/webhooks.ts", rule: "beside-the-word", expression: "creditsRestored", count: 1 },
  { file: "server/stripe/webhooks.ts", rule: "beside-the-word", expression: "currentBalance", count: 1 },
  { file: "shared/refundCopy.ts", rule: "beside-the-word", expression: "f.refunded", count: 1 },
  { file: "shared/refundCopy.ts", rule: "beside-the-word", expression: "f.refundReference", count: 1 },
];

function isStaff(file: string): boolean {
  return STAFF_SURFACES.some((surface) => file.startsWith(surface));
}

/**
 * A LOG LINE IS NOT A CUSTOMER SURFACE, and rule 2 cannot tell one from a
 * sentence without asking.
 *
 * `log.info(\`[Webhook] Refreshed credits … ${grantCredits} …\`)` says "credits"
 * beside a credit-named value and reaches nobody but an operator. Two of the
 * first census's rows were exactly this, and a census row that can never be
 * routed sits in a list whose whole contract is that it only shrinks.
 */
const LOGGER_RECEIVERS = new Set(["log", "logger", "console"]);

function insideALogCall(node: ts.Node): boolean {
  for (let cursor: ts.Node | undefined = node.parent; cursor; cursor = cursor.parent) {
    if (!ts.isCallExpression(cursor)) continue;
    const callee = cursor.expression;
    if (ts.isPropertyAccessExpression(callee) && ts.isIdentifier(callee.expression)) {
      if (LOGGER_RECEIVERS.has(callee.expression.text)) return true;
    }
    if (ts.isIdentifier(callee) && LOGGER_RECEIVERS.has(callee.text)) return true;
  }
  return false;
}

/**
 * Trailing property names that are never a credit amount, however
 * credit-named the object is. `refund.id` is an identifier; `plan.name` is a
 * word. Both tripped rule 2 in the first census.
 */
const NOT_AN_AMOUNT = new Set([
  "id",
  "name",
  "label",
  "title",
  "status",
  "kind",
  "type",
  "reference",
  "key",
  "error",
  "message",
  "reason",
  "description",
]);

/**
 * A shape that cannot be a number, so cannot be a credit number.
 *
 * Two, both measured rather than imagined: a pluralising ternary
 * (`n === 1 ? "" : "s"`), which reads as an interpolation beside the word
 * "credit" and is punctuation; and a property access landing on one of the
 * names above.
 */
function cannotBeAnAmount(node: ts.Node): boolean {
  if (ts.isPropertyAccessExpression(node) && NOT_AN_AMOUNT.has(node.name.text)) return true;
  if (
    ts.isConditionalExpression(node) &&
    ts.isStringLiteralLike(node.whenTrue) &&
    ts.isStringLiteralLike(node.whenFalse)
  ) {
    return true;
  }
  return false;
}

/**
 * Is this node a display helper call, or inside one?
 *
 * ⚠ **It starts at the node ITSELF and the first cut started at its parent**,
 * which made `{formatCredits(balance)} credits` — the fully routed shape — read
 * as an unrouted site. A guard that indicts the correct code is worse than no
 * guard, and this was caught by its own arm rather than by reading.
 */
function insideDisplayHelper(node: ts.Node): boolean {
  for (let cursor: ts.Node | undefined = node; cursor; cursor = cursor.parent) {
    if (ts.isCallExpression(cursor) && ts.isIdentifier(cursor.expression)) {
      if ((DISPLAY_HELPERS as readonly string[]).includes(cursor.expression.text)) return true;
    }
  }
  return false;
}

/** Every identifier and property name an expression mentions. */
function namesIn(node: ts.Node): string[] {
  const out: string[] = [];
  const visit = (current: ts.Node): void => {
    if (ts.isIdentifier(current)) out.push(current.text);
    ts.forEachChild(current, visit);
  };
  visit(node);
  return out;
}

function lineOf(sourceFile: ts.SourceFile, node: ts.Node): number {
  return sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
}

function textOf(node: ts.Node, sourceFile: ts.SourceFile): string {
  return node.getText(sourceFile).replace(/\s+/g, " ").trim().slice(0, 160);
}

/**
 * The literal text around an interpolation — a template's own chunks, or the
 * JSX text beside an expression child.
 */
function surroundingText(node: ts.Node, sourceFile: ts.SourceFile): string {
  const parent = node.parent;
  if (parent && ts.isTemplateSpan(parent) && parent.parent && ts.isTemplateExpression(parent.parent)) {
    const template = parent.parent;
    return template.head.text + template.templateSpans.map((span) => span.literal.text).join(" ");
  }
  if (parent && ts.isJsxExpression(parent) && parent.parent) {
    const host = parent.parent;
    if (ts.isJsxElement(host)) {
      return host.children
        .filter((child) => ts.isJsxText(child))
        .map((child) => child.getText(sourceFile))
        .join(" ");
    }
  }
  return "";
}

export function creditSitesIn(file: string, source: string): CreditSite[] {
  type Located = CreditSite & { at: number };
  const sourceFile = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const sites: Located[] = [];
  const staff = isStaff(file);

  const visit = (node: ts.Node): void => {
    /* Rule 3 — scale arithmetic. Runs on staff surfaces too. */
    if (ts.isBinaryExpression(node)) {
      const operator = node.operatorToken.kind;
      const isScaleOperator =
        operator === ts.SyntaxKind.SlashToken || operator === ts.SyntaxKind.AsteriskToken;
      if (isScaleOperator) {
        const right = node.right;
        const literal =
          ts.isNumericLiteral(right) && SCALE_LITERALS.has(Number(right.text))
            ? Number(right.text)
            : null;
        if (literal !== null && namesIn(node.left).some((name) => LOOSE_CREDIT_NAME.test(name))) {
          sites.push({
            file,
            line: lineOf(sourceFile, node),
            rule: "scale-arithmetic",
            expression: textOf(node, sourceFile),
            at: node.getStart(sourceFile),
          });
        }
      }
    }

    if (!staff) {
      /* Rule 1 — a credit number handed to toLocaleString. */
      if (
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression) &&
        node.expression.name.text === "toLocaleString"
      ) {
        const receiver = node.expression.expression;
        if (
          namesIn(receiver).some((name) => STRICT_CREDIT_NAME.test(name)) &&
          !insideDisplayHelper(node) &&
          !insideALogCall(node)
        ) {
          sites.push({
            file,
            line: lineOf(sourceFile, node),
            rule: "formatted",
            expression: textOf(node, sourceFile),
            at: node.getStart(sourceFile),
          });
        }
      }

      /* Rule 2 — a credit number interpolated beside the word "credit". */
      const interpolated =
        (node.parent && ts.isTemplateSpan(node.parent) && node.parent.expression === node) ||
        (node.parent && ts.isJsxExpression(node.parent) && node.parent.expression === node);
      if (
        interpolated &&
        !insideDisplayHelper(node) &&
        !insideALogCall(node) &&
        !cannotBeAnAmount(node)
      ) {
        const around = surroundingText(node, sourceFile);
        if (
          /credit/i.test(around) &&
          namesIn(node).some((name) => LOOSE_CREDIT_NAME.test(name))
        ) {
          sites.push({
            file,
            line: lineOf(sourceFile, node),
            rule: "beside-the-word",
            expression: textOf(node, sourceFile),
            at: node.getStart(sourceFile),
          });
        }
      }
    }

    ts.forEachChild(node, visit);
  };
  visit(sourceFile);

  /* ONE ROW PER SITE, keyed on the node's own START OFFSET.
     Two earlier shapes of this were both wrong, in opposite directions, and
     each was caught by driving rather than by reading:
       - (line, rule) let ONE site through twice, because
         `` `${x.toLocaleString()} credits` `` trips rule 1 AND rule 2 — 153
         rows over what turned out to be 106 real places.
       - (line, expression) collapsed TWO real sites into one when they shared
         a line and an expression, which is exactly what a planted second
         `creditsBalance.toLocaleString()` on an existing line looks like. That
         sabotage survived GREEN, which is the only reason the offset is here.
     `formatted` wins a tie because it is the stronger signal and the more
     useful thing to print. */
  const order: Record<CreditSite["rule"], number> = {
    formatted: 0,
    "beside-the-word": 1,
    "scale-arithmetic": 2,
  };
  const best = new Map<string, Located>();
  for (const site of sites) {
    const key = `${site.at}`;
    const held = best.get(key);
    if (!held || order[site.rule] < order[held.rule]) best.set(key, site);
  }
  return Array.from(best.values())
    .sort((a, b) => a.at - b.at)
    .map(({ at: _at, ...site }) => site);
}

/** The key a census row and a site are matched on: everything but the line. */
export function censusKey(site: { file: string; rule: CreditSite["rule"]; expression: string }): string {
  return `${site.file}|${site.rule}|${site.expression}`;
}

/**
 * The census as a budget rather than a set.
 *
 * ⚠ **A row carries a COUNT, and the first shape of this did not.** 106
 * measured sites collapsed to 79 distinct (file, rule, expression) keys — the
 * same shape really does appear several times in one file — so a set-shaped
 * list silently excused a NEW site whose text matched one already excused.
 * A budget catches the 107th occurrence of a shape budgeted for 3.
 */
function censusBudget(): Map<string, number> {
  const budget = new Map<string, number>();
  for (const row of UNROUTED) budget.set(censusKey(row), row.count);
  return budget;
}

/** Count the shapes the rules look at, so silence can be told from a clean tree. */
function countFloors(file: string, source: string): { formatCalls: number; interpolations: number } {
  const sourceFile = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  let formatCalls = 0;
  let interpolations = 0;
  const visit = (node: ts.Node): void => {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === "toLocaleString"
    ) {
      formatCalls += 1;
    }
    if (ts.isTemplateExpression(node) || ts.isJsxExpression(node)) interpolations += 1;
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return { formatCalls, interpolations };
}

/** Every file this guard reads — exported so the suite can assert the population. */
export function creditDisplayPopulation(repoRoot: string): string[] {
  return execFileSync("git", ["ls-files", "*.ts", "*.tsx"], {
    encoding: "utf8",
    cwd: repoRoot,
    maxBuffer: 32 * 1024 * 1024,
  })
    .split("\n")
    .map((line) => line.trim().replace(/\\/g, "/"))
    .filter((line) => line.length > 0)
    .filter((line) => SOURCE_ROOTS.some((root) => line.startsWith(root)))
    .filter((line) => !/\.test\.tsx?$/.test(line))
    .filter((line) => !line.startsWith("server/testing/"))
    .filter((line) => line !== THE_HELPER);
}

export function creditDisplaySites(repoRoot: string): CreditDisplayReading {
  const sites: CreditSite[] = [];
  const budget = censusBudget();
  let files = 0;
  let formatCalls = 0;
  let interpolations = 0;

  for (const file of creditDisplayPopulation(repoRoot)) {
    const source = readListedSource(join(repoRoot, file));
    if (source === null) continue;
    files += 1;
    const floors = countFloors(file, source);
    formatCalls += floors.formatCalls;
    interpolations += floors.interpolations;
    for (const site of creditSitesIn(file, source)) {
      const key = censusKey(site);
      const left = budget.get(key) ?? 0;
      if (left > 0) budget.set(key, left - 1);
      else sites.push(site);
    }
  }

  return { sites, files, formatCalls, interpolations };
}
