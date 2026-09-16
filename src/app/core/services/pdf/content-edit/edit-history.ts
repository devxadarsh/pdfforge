/**
 * edit-history.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Engine v0.1 — Undo / Redo History Stack
 *
 * A simple, immutable array-based undo stack for EditCommands.
 * The UI layer calls undo()/redo() to navigate history and receives
 * a new PageContentModel to render.
 *
 * DESIGN:
 *   The history stores snapshots of PageContentModel at each edit point
 *   (not just commands). This is safe for v1 since documents are small enough
 *   that memory cost is negligible. For larger documents, a command-delta
 *   approach could be used (Prompt 7 / hardening scope).
 *
 * ── KEYBOARD BINDINGS (Prompt 5 wires these to Angular) ─────────────────────
 *   Ctrl/Cmd + Z       → undo
 *   Ctrl/Cmd + Shift + Z → redo
 *
 * IMPORTANT: Zero Angular imports. Pure TypeScript module.
 */

import type { PageContentModel, EditCommand } from './text-run.model';

// ─── History Entry ────────────────────────────────────────────────────────────

interface HistoryEntry {
  /** The PageContentModel state BEFORE this command was applied. */
  readonly before: PageContentModel;
  /** The command that was applied to produce `after`. */
  readonly command: EditCommand;
  /** The PageContentModel state AFTER this command was applied. */
  readonly after: PageContentModel;
}

// ─── EditHistory ──────────────────────────────────────────────────────────────

/**
 * Tracks the edit history for a single page's content model.
 * Supports undo and redo up to `maxDepth` entries (default: 50).
 */
export class EditHistory {
  private readonly _entries: HistoryEntry[] = [];
  private _cursor = -1; // Points to the most recent applied entry.

  constructor(private readonly maxDepth = 50) {}

  // ── Accessors ───────────────────────────────────────────────────────────────

  /** Whether there is an action to undo. */
  get canUndo(): boolean {
    return this._cursor >= 0;
  }

  /** Whether there is an action to redo. */
  get canRedo(): boolean {
    return this._cursor < this._entries.length - 1;
  }

  /** Number of recorded history entries. */
  get size(): number {
    return this._entries.length;
  }

  /** Current cursor position (index of last applied entry, -1 if empty). */
  get cursor(): number {
    return this._cursor;
  }

  /** Read-only view of all entries (for testing / inspection). */
  get entries(): readonly Readonly<HistoryEntry>[] {
    return this._entries;
  }

  // ── Mutation ────────────────────────────────────────────────────────────────

  /**
   * Records a new edit and advances the cursor.
   * Any future entries (from previous redo states) are discarded.
   */
  push(command: EditCommand, before: PageContentModel, after: PageContentModel): void {
    // Discard any redo future when a new edit branches the history.
    if (this._cursor < this._entries.length - 1) {
      this._entries.splice(this._cursor + 1);
    }

    this._entries.push({ command, before, after });

    // Trim oldest entries if we exceed maxDepth.
    if (this._entries.length > this.maxDepth) {
      this._entries.shift();
    } else {
      this._cursor++;
    }

    // Clamp cursor to new length.
    this._cursor = this._entries.length - 1;
  }

  /**
   * Reverts to the state before the most recent edit.
   * Returns the `before` PageContentModel, or null if nothing to undo.
   */
  undo(): PageContentModel | null {
    if (!this.canUndo) return null;
    const entry = this._entries[this._cursor];
    this._cursor--;
    return entry.before;
  }

  /**
   * Re-applies the next edit in the redo stack.
   * Returns the `after` PageContentModel, or null if nothing to redo.
   */
  redo(): PageContentModel | null {
    if (!this.canRedo) return null;
    this._cursor++;
    const entry = this._entries[this._cursor];
    return entry.after;
  }

  /** Clears all history and resets the cursor. */
  clear(): void {
    this._entries.length = 0;
    this._cursor = -1;
  }

  /**
   * Returns the EditCommand that will be undone by the next undo() call.
   * Useful for showing a tooltip like "Undo: change 'Hello' to 'World'".
   */
  peekUndo(): EditCommand | null {
    if (!this.canUndo) return null;
    return this._entries[this._cursor].command;
  }

  /**
   * Returns the EditCommand that will be re-applied by the next redo() call.
   */
  peekRedo(): EditCommand | null {
    if (!this.canRedo) return null;
    return this._entries[this._cursor + 1].command;
  }
}

// ─── Standalone helpers (for use without a class instance) ───────────────────

/**
 * Applies undo to an existing history stack and returns:
 *   - The model to render (before state, or null if nothing to undo).
 *   - Whether canUndo / canRedo changed.
 */
export function applyUndo(history: EditHistory): PageContentModel | null {
  return history.undo();
}

/**
 * Applies redo and returns the model to render, or null if nothing to redo.
 */
export function applyRedo(history: EditHistory): PageContentModel | null {
  return history.redo();
}
