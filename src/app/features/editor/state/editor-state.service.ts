import { Injectable, inject, signal } from '@angular/core';
import {
  PdfToolId,
  PdfAnnotation,
  DrawingAnnotation,
  EraserMode,
  EraserTarget,
} from '../../../core/models/pdf.models';
import { EditorPagesService } from './editor-pages.service';

export type EditorFitMode = 'none' | 'width' | 'page';

@Injectable({ providedIn: 'root' })
export class EditorStateService {
  private readonly pages = inject(EditorPagesService);

  private readonly _tool = signal<PdfToolId>('select');
  private readonly _zoom = signal(1);
  private readonly _fitMode = signal<EditorFitMode>('width');
  private readonly _annotations = signal<Map<string, PdfAnnotation[]>>(
    new Map(),
  );
  private readonly _selectedId = signal<string | null>(null);
  private readonly _modified = signal(false);

  // Eraser options
  private readonly _eraserMode = signal<EraserMode>('segment');
  private readonly _eraserSize = signal<number>(16);
  private readonly _eraserTolerance = signal<number>(1.0);
  private readonly _eraserTarget = signal<EraserTarget>('all');
  private readonly _eraserSizePreviewActive = signal<boolean>(false);
  private previewTimer: ReturnType<typeof setTimeout> | null = null;

  readonly tool = this._tool.asReadonly();
  readonly zoom = this._zoom.asReadonly();
  readonly fitMode = this._fitMode.asReadonly();
  readonly selectedId = this._selectedId.asReadonly();
  readonly modified = this._modified.asReadonly();
  readonly annotationsByPage = this._annotations.asReadonly();

  readonly eraserMode = this._eraserMode.asReadonly();
  readonly eraserSize = this._eraserSize.asReadonly();
  readonly eraserTolerance = this._eraserTolerance.asReadonly();
  readonly eraserTarget = this._eraserTarget.asReadonly();
  readonly eraserSizePreviewActive = this._eraserSizePreviewActive.asReadonly();

  setEraserMode(mode: EraserMode): void {
    this._eraserMode.set(mode);
  }

  triggerEraserPreview(persist = false): void {
    this._eraserSizePreviewActive.set(true);
    if (this.previewTimer) {
      clearTimeout(this.previewTimer);
      this.previewTimer = null;
    }
    if (!persist) {
      this.previewTimer = setTimeout(() => {
        this._eraserSizePreviewActive.set(false);
        this.previewTimer = null;
      }, 1500);
    }
  }

  hideEraserPreview(): void {
    if (this.previewTimer) {
      clearTimeout(this.previewTimer);
      this.previewTimer = null;
    }
    this.previewTimer = setTimeout(() => {
      this._eraserSizePreviewActive.set(false);
      this.previewTimer = null;
    }, 800);
  }

  setEraserSize(size: number): void {
    this._eraserSize.set(
      Math.max(8, Math.min(72, Math.round(size * 10) / 10)),
    );
    this.triggerEraserPreview();
  }

  setEraserTolerance(tol: number): void {
    this._eraserTolerance.set(
      Math.max(0.5, Math.min(1.5, Math.round(tol * 100) / 100)),
    );
    this.triggerEraserPreview();
  }

  setEraserTarget(target: EraserTarget): void {
    this._eraserTarget.set(target);
  }

  clearPageAnnotations(pageId: string): void {
    const map = new Map(this._annotations());
    const list = map.get(pageId) ?? [];
    const remaining = list.filter((a) => a.locked);
    if (remaining.length !== list.length) {
      map.set(pageId, remaining);
      this._annotations.set(map);
      this._modified.set(true);
      if (this._selectedId() && !remaining.some((a) => a.id === this._selectedId())) {
        this._selectedId.set(null);
      }
    }
  }

  setTool(tool: PdfToolId): void {
    this._tool.set(tool);
    if (tool !== 'select' && tool !== 'hand') {
      this._selectedId.set(null);
    }
  }

  setZoom(zoom: number): void {
    const next = Math.max(
      0.25,
      Math.min(4, Math.round(zoom * 100) / 100),
    );
    this._zoom.set(next);
    this._fitMode.set('none');
  }

  zoomIn(): void {
    this.setZoom(this._zoom() + 0.25);
  }

  zoomOut(): void {
    this.setZoom(this._zoom() - 0.25);
  }

  setFit(mode: EditorFitMode): void {
    this._fitMode.set(mode);
  }

  resetZoom(): void {
    this._zoom.set(1);
    this._fitMode.set('width');
  }

  readonly annotationsFor = (pageId: string | null): PdfAnnotation[] => {
    if (!pageId) {
      return [];
    }
    return this._annotations().get(pageId) ?? [];
  };

  addAnnotation(
    pageId: string,
    annotation: PdfAnnotation,
    select = true,
  ): void {
    const map = new Map(this._annotations());
    const existing = map.get(pageId) ?? [];
    map.set(pageId, [...existing, annotation]);
    this._annotations.set(map);
    if (select) {
      this._selectedId.set(annotation.id);
    }
    this._modified.set(true);
  }

  updateAnnotation(id: string, patch: Partial<PdfAnnotation>): void {
    const map = new Map(this._annotations());
    for (const [pageId, list] of map) {
      const idx = list.findIndex((a) => a.id === id);
      if (idx < 0) {
        continue;
      }
      // A locked object is immutable through all state entry points. Unlocking
      // remains intentionally available through `toggleLock()`.
      if (list[idx].locked) {
        return;
      }
      const updated = { ...list[idx], ...patch } as PdfAnnotation;
      const next = [...list];
      next[idx] = updated;
      map.set(pageId, next);
      this._annotations.set(map);
      this._modified.set(true);
      return;
    }
  }

  nudgeAnnotation(id: string, dx: number, dy: number): void {
    const map = new Map(this._annotations());
    for (const [pageId, list] of map) {
      const idx = list.findIndex((a) => a.id === id);
      if (idx < 0) {
        continue;
      }
      const cur = list[idx];
      if (cur.locked) {
        return;
      }
      let updated: PdfAnnotation = {
        ...cur,
        rect: {
          ...cur.rect,
          x: Math.round(cur.rect.x + dx),
          y: Math.round(cur.rect.y + dy),
        },
      } as PdfAnnotation;
      if (cur.type === 'drawing') {
        updated = {
          ...cur,
          rect: updated.rect,
          points: cur.points.map((p) => ({
            x: Math.round(p.x + dx),
            y: Math.round(p.y + dy),
          })),
        } as DrawingAnnotation;
      }
      const next = [...list];
      next[idx] = updated;
      map.set(pageId, next);
      this._annotations.set(map);
      this._modified.set(true);
      return;
    }
  }

  /**
   * Keep overlay coordinates anchored to their rendered PDF page when its
   * viewport changes (for example, after collapsing an editor side panel).
   * This is a presentation adjustment, not a document edit, so it does not
   * mark the editor as modified and also applies to locked objects.
   */
  scaleAnnotations(pageId: string, scaleX: number, scaleY: number): void {
    if (
      !Number.isFinite(scaleX) ||
      !Number.isFinite(scaleY) ||
      scaleX <= 0 ||
      scaleY <= 0 ||
      (Math.abs(scaleX - 1) < 0.0001 && Math.abs(scaleY - 1) < 0.0001)
    ) {
      return;
    }
    const list = this._annotations().get(pageId);
    if (!list?.length) {
      return;
    }
    // PDF pages retain their aspect ratio, so these factors are normally
    // identical. Averaging avoids a visible font jump from sub-pixel layout
    // rounding while keeping text proportional if they differ slightly.
    const textScale = (scaleX + scaleY) / 2;
    const map = new Map(this._annotations());
    map.set(
      pageId,
      list.map((annotation) => {
        const scaled = {
          ...annotation,
          rect: {
            x: annotation.rect.x * scaleX,
            y: annotation.rect.y * scaleY,
            width: annotation.rect.width * scaleX,
            height: annotation.rect.height * scaleY,
          },
        };
        if (annotation.type === 'text') {
          return {
            ...scaled,
            fontSize: annotation.fontSize * textScale,
            letterSpacing:
              annotation.letterSpacing === undefined
                ? undefined
                : annotation.letterSpacing * textScale,
            backgroundPadding:
              annotation.backgroundPadding === undefined
                ? undefined
                : annotation.backgroundPadding * textScale,
          };
        }
        if (annotation.type === 'drawing') {
          return {
            ...scaled,
            strokeWidth: annotation.strokeWidth * textScale,
            points: annotation.points.map((p) => ({
              x: p.x * scaleX,
              y: p.y * scaleY,
            })),
          };
        }
        if (annotation.type === 'shape') {
          return {
            ...scaled,
            strokeWidth: annotation.strokeWidth * textScale,
          };
        }
        return scaled;
      }) as PdfAnnotation[],
    );
    this._annotations.set(map);
  }

  toggleLock(id: string): boolean {
    const map = new Map(this._annotations());
    for (const [pageId, list] of map) {
      const idx = list.findIndex((a) => a.id === id);
      if (idx < 0) {
        continue;
      }
      const cur = list[idx];
      const locked = !cur.locked;
      const updated = { ...cur, locked } as PdfAnnotation;
      const next = [...list];
      next[idx] = updated;
      map.set(pageId, next);
      this._annotations.set(map);
      this._modified.set(true);
      return locked;
    }
    return false;
  }

  removeAnnotation(id: string): void {
    const map = new Map(this._annotations());
    for (const [pageId, list] of map) {
      const cur = list.find((a) => a.id === id);
      if (cur?.locked) {
        return;
      }
      const next = list.filter((a) => a.id !== id);
      if (next.length === list.length) {
        continue;
      }
      map.set(pageId, next);
      this._annotations.set(map);
      this._modified.set(true);
      if (this._selectedId() === id) {
        this._selectedId.set(null);
      }
      return;
    }
  }

  /** Duplicate an annotation, offsetting the copy so it is visibly distinct. */
  duplicateAnnotation(id: string): string | null {
    const map = new Map(this._annotations());
    for (const [pageId, list] of map) {
      const idx = list.findIndex((a) => a.id === id);
      if (idx < 0) {
        continue;
      }
      const source = list[idx];
      let copy: PdfAnnotation = {
        ...source,
        id: crypto.randomUUID(),
        rect: {
          x: source.rect.x + 12,
          y: source.rect.y + 12,
          width: source.rect.width,
          height: source.rect.height,
        },
        createdAt: Date.now(),
      } as PdfAnnotation;
      if (source.type === 'drawing') {
        copy = {
          ...source,
          id: copy.id,
          rect: copy.rect,
          createdAt: copy.createdAt,
          points: source.points.map((p) => ({ x: p.x + 12, y: p.y + 12 })),
        } as DrawingAnnotation;
      }
      const next = [...list];
      next.splice(idx + 1, 0, copy);
      map.set(pageId, next);
      this._annotations.set(map);
      this._selectedId.set(copy.id);
      this._modified.set(true);
      return copy.id;
    }
    return null;
  }

  /**
   * Reorder an annotation within its page's z-stack. `direction` is `-1` to
   * send one step backward and `+1` to bring one step forward. Returns the
   * resulting index or `-1` if the annotation could not be moved.
   */
  reorderAnnotation(id: string, direction: -1 | 1): number {
    const map = new Map(this._annotations());
    for (const [pageId, list] of map) {
      const idx = list.findIndex((a) => a.id === id);
      if (idx < 0) {
        continue;
      }
      const target = idx + direction;
      if (target < 0 || target >= list.length) {
        return idx;
      }
      const next = [...list];
      const [moved] = next.splice(idx, 1);
      next.splice(target, 0, moved);
      map.set(pageId, next);
      this._annotations.set(map);
      this._modified.set(true);
      return target;
    }
    return -1;
  }

  /** Move an annotation to the very front of its page's z-stack. */
  bringToFront(id: string): void {
    const map = new Map(this._annotations());
    for (const [pageId, list] of map) {
      const idx = list.findIndex((a) => a.id === id);
      if (idx < 0 || idx === list.length - 1) {
        return;
      }
      const next = [...list];
      const [moved] = next.splice(idx, 1);
      next.push(moved);
      map.set(pageId, next);
      this._annotations.set(map);
      this._modified.set(true);
      return;
    }
  }

  /** Move an annotation to the very back of its page's z-stack. */
  sendToBack(id: string): void {
    const map = new Map(this._annotations());
    for (const [pageId, list] of map) {
      const idx = list.findIndex((a) => a.id === id);
      if (idx <= 0) {
        return;
      }
      const next = [...list];
      const [moved] = next.splice(idx, 1);
      next.unshift(moved);
      map.set(pageId, next);
      this._annotations.set(map);
      this._modified.set(true);
      return;
    }
  }

  selectAnnotation(id: string | null): void {
    this._selectedId.set(id);
  }

  clearSelection(): void {
    this._selectedId.set(null);
  }

  /** Drop annotations whose page is no longer present (e.g. after deletion). */
  pruneAnnotations(validPageIds: ReadonlySet<string>): void {
    const map = this._annotations();
    let changed = false;
    const next = new Map<string, PdfAnnotation[]>();
    for (const [pageId, list] of map) {
      if (!validPageIds.has(pageId)) {
        changed = true;
        continue;
      }
      next.set(pageId, list);
    }
    if (changed) {
      this._annotations.set(next);
    }
  }

  getSelected(pageId: string | null): PdfAnnotation | null {
    if (!pageId) {
      return null;
    }
    const id = this._selectedId();
    if (!id) {
      return null;
    }
    return this._annotations().get(pageId)?.find((a) => a.id === id) ?? null;
  }

  reset(): void {
    this._annotations.set(new Map());
    this._selectedId.set(null);
    this._modified.set(false);
    this._tool.set('select');
    this._zoom.set(1);
    this._fitMode.set('width');
  }

  get pageService(): EditorPagesService {
    return this.pages;
  }
}
