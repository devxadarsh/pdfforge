import { Injectable, inject, signal, computed } from '@angular/core';
import { EditorPage } from '../models/editor-page.model';
import { FileService } from '../../../core/services/file/file.service';
import { DownloadService } from '../../../core/services/download/download.service';
import { ToastService } from '../../../core/services/toast.service';
import { PDFDocument, degrees } from 'pdf-lib';

@Injectable({ providedIn: 'root' })
export class EditorPagesService {
  private readonly files = inject(FileService);
  private readonly downloads = inject(DownloadService);
  private readonly toasts = inject(ToastService);

  private readonly _pages = signal<EditorPage[]>([]);
  private readonly _selected = signal<ReadonlySet<string>>(new Set());
  private readonly _currentId = signal<string | null>(null);
  private _lastSelectedId: string | null = null;

  readonly pages = this._pages.asReadonly();
  readonly selected = this._selected.asReadonly();
  readonly selectedCount = computed(() => this._selected().size);
  readonly currentId = this._currentId.asReadonly();
  readonly pagesCount = computed(() => this._pages().length);

  readonly currentPage = computed<EditorPage | null>(() => {
    const id = this._currentId();
    return this._pages().find((p) => p.id === id) ?? null;
  });

  readonly currentIndex = computed<number>(() => {
    const id = this._currentId();
    return this._pages().findIndex((p) => p.id === id);
  });

  init(count: number): void {
    const pages: EditorPage[] = [];
    for (let i = 0; i < count; i++) {
      pages.push({ id: crypto.randomUUID(), sourceIndex: i, rotation: 0 });
    }
    this._pages.set(pages);
    this._selected.set(new Set());
    this._currentId.set(pages.length ? pages[0].id : null);
    this._lastSelectedId = null;
  }

  isSelected(id: string): boolean {
    return this._selected().has(id);
  }

  select(id: string, event?: MouseEvent): void {
    const pages = this._pages();
    const index = pages.findIndex((p) => p.id === id);
    if (index < 0) {
      return;
    }
    const set = new Set(this._selected());
    const additive = !!event && (event.ctrlKey || event.metaKey);
    const range = !!event && event.shiftKey && !!this._lastSelectedId;
    if (range && this._lastSelectedId) {
      const lastIndex = pages.findIndex((p) => p.id === this._lastSelectedId);
      if (lastIndex >= 0) {
        const [a, b] = lastIndex < index ? [lastIndex, index] : [index, lastIndex];
        for (let i = a; i <= b; i++) {
          set.add(pages[i].id);
        }
      }
    } else if (additive) {
      if (set.has(id)) {
        set.delete(id);
      } else {
        set.add(id);
      }
    } else {
      set.clear();
      set.add(id);
    }
    this._selected.set(set);
    this._currentId.set(id);
    this._lastSelectedId = id;
  }

  setCurrent(id: string): void {
    this._currentId.set(id);
  }

  selectAll(): void {
    this._selected.set(new Set(this._pages().map((p) => p.id)));
  }

  clearSelection(): void {
    this._selected.set(new Set());
    this._lastSelectedId = null;
  }

  restoreState(
    pages: EditorPage[],
    selected?: ReadonlySet<string>,
    currentId?: string | null,
  ): void {
    this._pages.set(pages);
    if (selected) {
      this._selected.set(new Set(selected));
    }
    if (currentId !== undefined && currentId !== null && pages.some((p) => p.id === currentId)) {
      this._currentId.set(currentId);
    } else {
      this._currentId.set(pages.length ? pages[0].id : null);
    }
  }

  deleteSelected(): string[] {
    const sel = this._selected();
    if (!sel.size) {
      return [];
    }
    const remaining = this._pages().filter((p) => !sel.has(p.id));
    const removed = this._pages()
      .filter((p) => sel.has(p.id))
      .map((p) => p.id);
    this._pages.set(remaining);
    this._selected.set(new Set());
    this._lastSelectedId = null;
    if (!remaining.some((p) => p.id === this._currentId())) {
      this._currentId.set(remaining.length ? remaining[0].id : null);
    }
    return removed;
  }

  duplicateSelected(): void {
    const sel = this._selected();
    if (!sel.size) {
      return;
    }
    const pages = this._pages();
    const result: EditorPage[] = [];
    for (let i = 0; i < pages.length; i++) {
      result.push(pages[i]);
      if (sel.has(pages[i].id)) {
        result.push({
          id: crypto.randomUUID(),
          sourceIndex: pages[i].sourceIndex,
          rotation: pages[i].rotation,
        });
      }
    }
    this._pages.set(result);
  }

  rotateSelected(delta: number): void {
    const sel = this._selected();
    if (!sel.size) {
      return;
    }
    this._pages.update((list) =>
      list.map((p) =>
        sel.has(p.id)
          ? { ...p, rotation: (((p.rotation + delta) % 360) + 360) % 360 }
          : p,
      ),
    );
  }

  move(id: string, toIndex: number): void {
    const pages = this._pages();
    const from = pages.findIndex((p) => p.id === id);
    if (from < 0) {
      return;
    }
    const next = [...pages];
    const [moved] = next.splice(from, 1);
    // Insert before the drop target. When moving an item down, removing it
    // shifts the trailing indices left by one, so the target's slot is
    // `toIndex - 1` in the shortened array.
    let insert = toIndex;
    if (from < toIndex) {
      insert = toIndex - 1;
    }
    insert = Math.max(0, Math.min(insert, next.length));
    next.splice(insert, 0, moved);
    this._pages.set(next);
  }

  async extractSelected(): Promise<boolean> {
    const sel = this._selected();
    if (!sel.size) {
      this.toasts.error('Select one or more pages to extract.');
      return false;
    }
    const file = this.files.currentFiles()[0];
    if (!file) {
      this.toasts.error('No document is loaded.');
      return false;
    }
    try {
      const src = await PDFDocument.load(file.data.slice(0));
      const out = await PDFDocument.create();
      const ordered = this._pages().filter((p) => sel.has(p.id));
      const indices = ordered.map((p) => p.sourceIndex);
      const copied = await out.copyPages(src, indices);
      ordered.forEach((p, i) => {
        copied[i].setRotation(degrees(p.rotation));
        out.addPage(copied[i]);
      });
      const bytes = await out.save();
      const base = file.name.replace(/\.pdf$/i, '');
      this.downloads.download(
        new Blob([bytes], { type: 'application/pdf' }),
        `${base}-extracted.pdf`,
      );
      this.toasts.success(`Extracted ${ordered.length} page(s).`);
      return true;
    } catch {
      this.toasts.error('Could not extract the selected pages.');
      return false;
    }
  }
}
