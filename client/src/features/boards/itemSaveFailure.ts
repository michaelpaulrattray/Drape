/**
 * WHEN A CANVAS SAVE FAILS, THE CUSTOMER IS TOLD — AND THEIR WORDS COME BACK.
 *
 * #2405. `boards.updateItem` carries every small edit the canvas makes: a
 * note's text, a node's label, a move, a resize. Its mutation had an
 * `onSuccess` and no `onError`, so a refused or dropped save left no trace but
 * the console. The worst of it was the note: a 359-character shot list was
 * refused (the label is capped at `BOARD_ITEM_LABEL_MAX_LENGTH`), the editor
 * had already closed, and the note snapped back to its old words — or to
 * "Double-click to write" — with nothing on screen to say why.
 *
 * So a failure here decides two things, and they live in one pure function
 * so a test can drive them without a DOM:
 *
 *  - WHAT TO SAY. Our server's own sentence when it wrote one (the length
 *    refusal already names the limit in plain words), otherwise a fallback
 *    naming what did not save. The toast itself is
 *    `readableFailure(err, failure.fallback)` at the call site, the house rule.
 *  - WHETHER TO HAND THE TEXT BACK. When the failed save carried text, the
 *    node's editor is reopened holding exactly what was typed, so nothing the
 *    customer wrote is lost to a failed request. The node listens on the same
 *    `board-rename-node` event the context menu uses, with a `draft`.
 *
 * One toast per kind (`id`), so a burst of failed moves reads as one message.
 */

/** The event a canvas node listens on to open its own text editor. */
export const RENAME_NODE_EVENT = 'board-rename-node';

export type ItemSaveVariables = {
  itemId: number;
  label?: string;
  positionX?: number;
  positionY?: number;
  width?: number;
  height?: number;
};

export type ItemSaveFailure = {
  /** Toast id — one per kind of save, so repeats replace rather than stack. */
  toastId: string;
  /** Our sentence for when the server wrote none. The call site hands it to
   *  `readableFailure(err, failure.fallback)`, where the raw-error-toast sweep
   *  (`client/src/foundation/rawErrorToast.test.ts`) reads the rule. */
  fallback: string;
  /** Reopen this node's editor holding the text that did not save. */
  reopen: { itemId: number; draft: string } | null;
};

export function itemSaveFailure(variables: ItemSaveVariables): ItemSaveFailure {
  if (typeof variables.label === 'string') {
    return {
      toastId: 'board-item-save-text',
      fallback: "Your text didn't save. It's still there, so you can try again.",
      reopen: { itemId: variables.itemId, draft: variables.label },
    };
  }
  if (variables.positionX !== undefined || variables.positionY !== undefined) {
    return {
      toastId: 'board-item-save-move',
      fallback: "That move didn't save. Try again in a moment.",
      reopen: null,
    };
  }
  if (variables.width !== undefined || variables.height !== undefined) {
    return {
      toastId: 'board-item-save-size',
      fallback: "That resize didn't save. Try again in a moment.",
      reopen: null,
    };
  }
  return {
    toastId: 'board-item-save',
    fallback: "That change didn't save. Try again in a moment.",
    reopen: null,
  };
}

/**
 * The text a reopened editor should hold: the unsaved draft when the event
 * carries one, otherwise `null` and the node falls back to its saved label.
 */
export function renameEventDraft(event: Event): string | null {
  const draft = (event as CustomEvent<{ draft?: unknown }>).detail?.draft;
  return typeof draft === 'string' ? draft : null;
}
