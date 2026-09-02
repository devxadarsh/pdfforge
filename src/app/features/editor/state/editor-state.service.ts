import { Injectable, inject, signal, computed } from '@angular/core';
import {
  PdfToolId,
  PdfAnnotation,
  DrawingAnnotation,
  ShapeKind,
  DrawingMode,
  SelectMode,
  EraserMode,
  EraserTarget,
  PendingPlacement,
  IconStyleType,
} from '../../../core/models/pdf.models';
import { EditorPage } from '../models/editor-page.model';
import { EditorPagesService } from './editor-pages.service';

export type EditorFitMode = 'none' | 'width' | 'page';
 
export interface HistorySnapshot {
  readonly description: string;
  readonly annotations: Map<string, PdfAnnotation[]>;
  readonly pages: EditorPage[];
  readonly currentId: string | null;
  readonly selectedIds: string[];
  readonly pageSelectedIds: string[];
  readonly revisionId: number;
}

@Injectable({ providedIn: 'root' })
export class EditorStateService {
  private readonly pages = inject(EditorPagesService);

  private readonly _tool = signal<PdfToolId>('select');
  private readonly _zoom = signal(1);
  private readonly _fitMode = signal<EditorFitMode>('width');
  private readonly _annotations = signal<Map<string, PdfAnnotation[]>>(
    new Map(),
  );
  private readonly _selectedIds = signal<string[]>([]);
  private readonly _selectedId = computed(() => this._selectedIds()[0] ?? null);
  private _savedRevision = 0;
  private readonly _currentRevision = signal(0);

  // Selection mode options
  private readonly _selectMode = signal<SelectMode>('box');

  // Drawing options
  private readonly _drawingMode = signal<DrawingMode>('continuous');
  private readonly _penColor = signal<string>('#111827');
  private readonly _penStrokeWidth = signal<number>(2);
  private readonly _freehandColor = signal<string>('#dc2626');
  private readonly _freehandStrokeWidth = signal<number>(4);
  private readonly _penSmoothing = signal<'none' | 'medium' | 'high'>('medium');

  // Text tool options
  private readonly _textColor = signal<string>('#111111');
  private readonly _textFontSize = signal<number>(16);
  private readonly _textFontFamily = signal<string>('sans-serif');
  private readonly _textBold = signal<boolean>(false);
  private readonly _textItalic = signal<boolean>(false);

  // Shape & Icon tool options
  private readonly _shapeKind = signal<ShapeKind>('rectangle');
  private readonly _iconKind = signal<ShapeKind>('ui-browser');
  private readonly _iconStyle = signal<IconStyleType>('outlined');
  private readonly _shapeRenderMode = signal<'shape' | 'icon'>('shape');
  private readonly _shapeStrokeColor = signal<string>('#2563eb');
  private readonly _shapeFillColor = signal<string>('rgba(37,99,235,0.12)');
  private readonly _shapeStrokeWidth = signal<number>(2);
  private readonly _shapeFillEnabled = signal<boolean>(true);
  // Resize Mode: 'fixed' (1:1 ratio, default) or 'free' (freehand)
  private readonly _resizeMode = signal<'fixed' | 'free'>('fixed');

  // Markup options
  private readonly _highlightColor = signal<string>('#fde047');
  private readonly _underlineColor = signal<string>('#2563eb');
  private readonly _strikethroughColor = signal<string>('#ef4444');

  // Eraser options
  private readonly _eraserMode = signal<EraserMode>('segment');
  private readonly _eraserSize = signal<number>(16);
  private readonly _eraserTolerance = signal<number>(1.0);
  private readonly _eraserTarget = signal<EraserTarget>('all');
  private readonly _eraserSizePreviewActive = signal<boolean>(false);
  private previewTimer: ReturnType<typeof setTimeout> | null = null;
  // Export bridge
  private readonly _exportTrigger = signal<number>(0);
  private readonly _isExporting = signal<boolean>(false);

  // Mobile sheet states
  private readonly _mobilePropertiesOpen = signal<boolean>(false);
  private readonly _mobilePagesOpen = signal<boolean>(false);

  // Pending item placement (Image / Stamp)
  private readonly _pendingPlacement = signal<PendingPlacement | null>(null);
  readonly pendingPlacement = this._pendingPlacement.asReadonly();

  // Undo / Redo history stacks
  private undoStack: HistorySnapshot[] = [];
  private redoStack: HistorySnapshot[] = [];
  private readonly _canUndo = signal<boolean>(false);
  private readonly _canRedo = signal<boolean>(false);
  private readonly _undoLabel = signal<string>('Undo (Ctrl+Z)');
  private readonly _redoLabel = signal<string>('Redo (Ctrl+Y)');

  readonly tool = this._tool.asReadonly();
  readonly zoom = this._zoom.asReadonly();
  readonly fitMode = this._fitMode.asReadonly();
  readonly selectedIds = this._selectedIds.asReadonly();
  readonly selectedId = this._selectedId;
  readonly selectMode = this._selectMode.asReadonly();
  readonly modified = computed(() => this._currentRevision() !== this._savedRevision);
  readonly annotationsByPage = this._annotations.asReadonly();

  readonly canUndo = this._canUndo.asReadonly();
  readonly canRedo = this._canRedo.asReadonly();
  readonly undoLabel = this._undoLabel.asReadonly();
  readonly redoLabel = this._redoLabel.asReadonly();

  readonly exportTrigger = this._exportTrigger.asReadonly();
  readonly isExporting = this._isExporting.asReadonly();

  readonly mobilePropertiesOpen = this._mobilePropertiesOpen.asReadonly();
  readonly mobilePagesOpen = this._mobilePagesOpen.asReadonly();

  readonly drawingMode = this._drawingMode.asReadonly();
  readonly penColor = this._penColor.asReadonly();
  readonly penStrokeWidth = this._penStrokeWidth.asReadonly();
  readonly freehandColor = this._freehandColor.asReadonly();
  readonly freehandStrokeWidth = this._freehandStrokeWidth.asReadonly();
  readonly penSmoothing = this._penSmoothing.asReadonly();

  readonly textColor = this._textColor.asReadonly();
  readonly textFontSize = this._textFontSize.asReadonly();
  readonly textFontFamily = this._textFontFamily.asReadonly();
  readonly textBold = this._textBold.asReadonly();
  readonly textItalic = this._textItalic.asReadonly();

  readonly shapeKind = this._shapeKind.asReadonly();
  readonly iconKind = this._iconKind.asReadonly();
  readonly iconStyle = this._iconStyle.asReadonly();
  readonly shapeRenderMode = this._shapeRenderMode.asReadonly();
  readonly shapeStrokeColor = this._shapeStrokeColor.asReadonly();
  readonly shapeFillColor = this._shapeFillColor.asReadonly();
  readonly shapeStrokeWidth = this._shapeStrokeWidth.asReadonly();
  readonly shapeFillEnabled = this._shapeFillEnabled.asReadonly();
  readonly resizeMode = this._resizeMode.asReadonly();

  setIconStyle(style: IconStyleType): void {
    this._iconStyle.set(style);
  }

  cycleIconStyle(): void {
    const styles: IconStyleType[] = ['outlined', 'filled', 'filled-outline', 'duotone', '3d'];
    const curr = this._iconStyle();
    const idx = styles.indexOf(curr);
    const next = styles[(idx + 1) % styles.length];
    this._iconStyle.set(next);
  }

  setResizeMode(mode: 'fixed' | 'free'): void {
    this._resizeMode.set(mode);
  }

  toggleResizeMode(): void {
    this._resizeMode.update((m) => (m === 'fixed' ? 'free' : 'fixed'));
  }

  readonly highlightColor = this._highlightColor.asReadonly();
  readonly underlineColor = this._underlineColor.asReadonly();
  readonly strikethroughColor = this._strikethroughColor.asReadonly();

  readonly eraserMode = this._eraserMode.asReadonly();
  readonly eraserSize = this._eraserSize.asReadonly();
  readonly eraserTolerance = this._eraserTolerance.asReadonly();
  readonly eraserTarget = this._eraserTarget.asReadonly();
  readonly eraserSizePreviewActive = this._eraserSizePreviewActive.asReadonly();

  setTextColor(color: string): void {
    this._textColor.set(color);
  }

  setTextFontSize(size: number): void {
    this._textFontSize.set(Math.max(6, Math.min(120, size)));
  }

  setTextFontFamily(family: string): void {
    this._textFontFamily.set(family);
  }

  setTextBold(bold: boolean): void {
    this._textBold.set(bold);
  }

  toggleTextBold(): void {
    this._textBold.update((b) => !b);
  }

  setTextItalic(italic: boolean): void {
    this._textItalic.set(italic);
  }

  toggleTextItalic(): void {
    this._textItalic.update((i) => !i);
  }

  setShapeKind(kind: ShapeKind): void {
    this._shapeKind.set(kind);
  }

  setIconKind(kind: ShapeKind): void {
    this._iconKind.set(kind);
  }

  setShapeStrokeColor(color: string): void {
    this._shapeStrokeColor.set(color);
  }

  setShapeFillColor(color: string): void {
    this._shapeFillColor.set(color);
  }

  setShapeRenderMode(mode: 'shape' | 'icon'): void {
    this._shapeRenderMode.set(mode);
  }

  toggleShapeRenderMode(): void {
    this._shapeRenderMode.update((m) => (m === 'shape' ? 'icon' : 'shape'));
  }

  setShapeStrokeWidth(w: number): void {
    this._shapeStrokeWidth.set(Math.max(1, Math.min(32, w)));
  }

  toggleShapeFill(): void {
    this._shapeFillEnabled.update((f) => !f);
  }

  setHighlightColor(color: string): void {
    this._highlightColor.set(color);
  }

  setUnderlineColor(color: string): void {
    this._underlineColor.set(color);
  }

  setStrikethroughColor(color: string): void {
    this._strikethroughColor.set(color);
  }

  private _saveLocallyHandler: (() => Promise<boolean>) | null = null;

  setSaveLocallyHandler(handler: () => Promise<boolean>): void {
    this._saveLocallyHandler = handler;
  }

  async saveLocally(): Promise<boolean> {
    if (this._saveLocallyHandler) {
      return await this._saveLocallyHandler();
    }
    return true;
  }

  requestExport(): void {
    this._exportTrigger.update((n) => n + 1);
  }

  setIsExporting(loading: boolean): void {
    this._isExporting.set(loading);
  }

  setMobilePropertiesOpen(open: boolean): void {
    this._mobilePropertiesOpen.set(open);
  }

  toggleMobileProperties(): void {
    this._mobilePropertiesOpen.update((v) => !v);
  }

  setMobilePagesOpen(open: boolean): void {
    this._mobilePagesOpen.set(open);
  }

  toggleMobilePages(): void {
    this._mobilePagesOpen.update((v) => !v);
  }

  setDrawingMode(mode: DrawingMode): void {
    this._drawingMode.set(mode);
  }

  setPenColor(color: string): void {
    this._penColor.set(color);
  }

  setPenStrokeWidth(w: number): void {
    this._penStrokeWidth.set(Math.max(1, Math.min(32, w)));
  }

  setFreehandColor(color: string): void {
    this._freehandColor.set(color);
  }

  setFreehandStrokeWidth(w: number): void {
    this._freehandStrokeWidth.set(Math.max(1, Math.min(32, w)));
  }

  setPenSmoothing(smoothing: 'none' | 'medium' | 'high'): void {
    this._penSmoothing.set(smoothing);
  }

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
      this._currentRevision.update(r => r + 1);
      const remainingIds = new Set(remaining.map((a) => a.id));
      this._selectedIds.update((ids) => ids.filter((id) => remainingIds.has(id)));
    }
  }

  setPendingPlacement(placement: PendingPlacement | null): void {
    this._pendingPlacement.set(placement);
  }

  setTool(tool: PdfToolId): void {
    const currentPending = this._pendingPlacement();
    if (currentPending && tool !== currentPending.type) {
      this._pendingPlacement.set(null);
    }
    if (tool === 'shape') {
      this._shapeRenderMode.set('shape');
    } else if (tool === 'icon') {
      this._shapeRenderMode.set('icon');
    }
    this._tool.set(tool);
    if (tool !== 'select' && tool !== 'hand') {
      this._selectedIds.set([]);
    }
  }

  setZoom(zoom: number): void {
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    const minZoom = isMobile ? 0.4 : 0.25;
    const maxZoom = isMobile ? 3.5 : 4.0;
    const next = Math.max(
      minZoom,
      Math.min(maxZoom, Math.round(zoom * 100) / 100),
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

  private cloneAnnotationsMap(source: Map<string, PdfAnnotation[]>): Map<string, PdfAnnotation[]> {
    const copy = new Map<string, PdfAnnotation[]>();
    for (const [k, v] of source) {
      copy.set(
        k,
        v.map((a) =>
          typeof structuredClone === 'function'
            ? structuredClone(a)
            : JSON.parse(JSON.stringify(a)),
        ),
      );
    }
    return copy;
  }

  private createSnapshot(
    description: string,
    revisionId = this._currentRevision(),
  ): HistorySnapshot {
    const pageSel =
      typeof this.pages.selected === 'function'
        ? Array.from(this.pages.selected())
        : [];
    const pageList =
      typeof this.pages.pages === 'function'
        ? this.pages.pages().map((p) => ({ ...p }))
        : [];
    const curId =
      typeof this.pages.currentId === 'function'
        ? this.pages.currentId()
        : null;
    return {
      description,
      annotations: this.cloneAnnotationsMap(this._annotations()),
      pages: pageList,
      currentId: curId,
      selectedIds: [...this._selectedIds()],
      pageSelectedIds: pageSel,
      revisionId,
    };
  }

  private updateActionLabels(): void {
    const topUndo = this.undoStack[this.undoStack.length - 1];
    this._undoLabel.set(topUndo ? `Undo ${topUndo.description} (Ctrl+Z)` : 'Undo (Ctrl+Z)');
    const topRedo = this.redoStack[this.redoStack.length - 1];
    this._redoLabel.set(topRedo ? `Redo ${topRedo.description} (Ctrl+Y)` : 'Redo (Ctrl+Y)');
  }

  pushHistorySnapshot(description = 'Edit'): void {
    const snapshot = this.createSnapshot(description, this._currentRevision());
    this.undoStack.push(snapshot);
    if (this.undoStack.length > 100) {
      this.undoStack.shift();
    }
    this.redoStack = [];
    this._canUndo.set(true);
    this._canRedo.set(false);
    this.updateActionLabels();
    this._currentRevision.update((r) => r + 1);
  }

  undo(): { success: boolean; description?: string } {
    if (this.undoStack.length === 0) {
      return { success: false };
    }
    const previous = this.undoStack.pop()!;
    const current = this.createSnapshot(
      previous.description,
      this._currentRevision(),
    );
    this.redoStack.push(current);

    this._annotations.set(this.cloneAnnotationsMap(previous.annotations));
    if (typeof this.pages.restoreState === 'function') {
      this.pages.restoreState(
        previous.pages.map((p) => ({ ...p })),
        new Set(previous.pageSelectedIds),
        previous.currentId,
      );
    }
    this._selectedIds.set([...previous.selectedIds]);
    this._canUndo.set(this.undoStack.length > 0);
    this._canRedo.set(true);
    this._currentRevision.set(previous.revisionId);
    this.updateActionLabels();
    return { success: true, description: previous.description };
  }

  redo(): { success: boolean; description?: string } {
    if (this.redoStack.length === 0) {
      return { success: false };
    }
    const next = this.redoStack.pop()!;
    const current = this.createSnapshot(
      next.description,
      this._currentRevision(),
    );
    this.undoStack.push(current);

    this._annotations.set(this.cloneAnnotationsMap(next.annotations));
    if (typeof this.pages.restoreState === 'function') {
      this.pages.restoreState(
        next.pages.map((p) => ({ ...p })),
        new Set(next.pageSelectedIds),
        next.currentId,
      );
    }
    this._selectedIds.set([...next.selectedIds]);
    this._canUndo.set(true);
    this._canRedo.set(this.redoStack.length > 0);
    this._currentRevision.set(next.revisionId);
    this.updateActionLabels();
    return { success: true, description: next.description };
  }

  readonly annotationsFor = (pageId: string | null): PdfAnnotation[] => {
    if (!pageId) {
      return [];
    }
    return this._annotations().get(pageId) ?? [];
  };

  getSerializedAnnotations(): Record<string, PdfAnnotation[]> {
    const map = this._annotations();
    const result: Record<string, PdfAnnotation[]> = {};
    for (const [k, v] of map.entries()) {
      if (v && v.length > 0) {
        result[k] = JSON.parse(JSON.stringify(v));
      }
    }
    return result;
  }

  restoreAnnotations(
    annotations?: Record<string, PdfAnnotation[]> | Map<string, PdfAnnotation[]> | null,
  ): void {
    const map = new Map<string, PdfAnnotation[]>();
    if (annotations instanceof Map) {
      for (const [k, v] of annotations.entries()) {
        map.set(k, JSON.parse(JSON.stringify(v)));
      }
    } else if (annotations && typeof annotations === 'object') {
      for (const [k, v] of Object.entries(annotations)) {
        if (Array.isArray(v)) {
          map.set(k, JSON.parse(JSON.stringify(v)));
        }
      }
    }
    this._annotations.set(map);
  }

  getAllAnnotations(): Map<string, PdfAnnotation[]> {
    return this.cloneAnnotationsMap(this._annotations());
  }

  addAnnotation(
    pageId: string,
    annotation: PdfAnnotation,
    select = true,
    recordHistory = true,
    description?: string,
  ): void {
    if (recordHistory) {
      this.pushHistorySnapshot(
        description ??
          `Add ${annotation.type.charAt(0).toUpperCase() + annotation.type.slice(1)}`,
      );
    }
    const map = new Map(this._annotations());
    const existing = map.get(pageId) ?? [];
    map.set(pageId, [...existing, annotation]);
    this._annotations.set(map);
    if (select) {
      this._selectedIds.set([annotation.id]);
    }
    this._currentRevision.update(r => r + 1);
  }

  updateAnnotation(
    id: string,
    patch: Partial<PdfAnnotation>,
    recordHistory = true,
    description = 'Edit Object',
  ): void {
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
      if (recordHistory) {
        this.pushHistorySnapshot(description);
      }
      const updated = { ...list[idx], ...patch } as PdfAnnotation;
      const next = [...list];
      next[idx] = updated;
      map.set(pageId, next);
      this._annotations.set(map);
      this._currentRevision.update(r => r + 1);
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
      this._currentRevision.update(r => r + 1);
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
      this._currentRevision.update(r => r + 1);
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
      this.pushHistorySnapshot();
      map.set(pageId, next);
      this._annotations.set(map);
      this._currentRevision.update(r => r + 1);
      this._selectedIds.update((ids) => ids.filter((i) => i !== id));
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
      this.pushHistorySnapshot();
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
      this._selectedIds.set([copy.id]);
      this._currentRevision.update(r => r + 1);
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
      this._currentRevision.update(r => r + 1);
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
      this._currentRevision.update(r => r + 1);
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
      this._currentRevision.update(r => r + 1);
      return;
    }
  }

  private readonly _lastUngroupedMap = signal<Map<string, string[]>>(
    new Map(),
  );

  setSelectMode(mode: SelectMode): void {
    this._selectMode.set(mode);
  }

  private getGroupMembers(id: string): string[] {
    for (const [, list] of this._annotations()) {
      const target = list.find((a) => a.id === id);
      if (target?.groupId) {
        return list
          .filter((a) => a.groupId === target.groupId)
          .map((a) => a.id);
      }
      if (target) {
        return [id];
      }
    }
    return [id];
  }

  selectAnnotation(id: string | null, additive = false): void {
    if (!id) {
      this._selectedIds.set([]);
      return;
    }
    const memberIds = this.getGroupMembers(id);
    if (additive) {
      const current = new Set(this._selectedIds());
      const allIn = memberIds.every((mId) => current.has(mId));
      if (allIn) {
        for (const mId of memberIds) {
          current.delete(mId);
        }
      } else {
        for (const mId of memberIds) {
          current.add(mId);
        }
      }
      this._selectedIds.set(Array.from(current));
    } else {
      this._selectedIds.set(memberIds);
    }
  }

  selectAnnotations(ids: string[], additive = false): void {
    const expanded = new Set<string>();
    for (const id of ids) {
      for (const mId of this.getGroupMembers(id)) {
        expanded.add(mId);
      }
    }
    if (additive) {
      const set = new Set([...this._selectedIds(), ...expanded]);
      this._selectedIds.set(Array.from(set));
    } else {
      this._selectedIds.set(Array.from(expanded));
    }
  }

  toggleAnnotationSelection(id: string): void {
    this.selectAnnotation(id, true);
  }

  selectAllAnnotations(pageId: string | null): void {
    if (!pageId) {
      return;
    }
    const list = this._annotations().get(pageId) ?? [];
    this._selectedIds.set(list.map((a) => a.id));
  }

  clearSelection(): void {
    this._selectedIds.set([]);
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
    if (!pageId || this._selectedIds().length === 0) {
      return null;
    }
    const id = this._selectedIds()[0];
    return this._annotations().get(pageId)?.find((a) => a.id === id) ?? null;
  }

  getSelectedList(pageId: string | null): PdfAnnotation[] {
    if (!pageId) {
      return [];
    }
    const ids = new Set(this._selectedIds());
    return (this._annotations().get(pageId) ?? []).filter((a) => ids.has(a.id));
  }

  deleteSelected(pageId: string | null): void {
    if (!pageId) {
      return;
    }
    const ids = new Set(this._selectedIds());
    if (ids.size === 0) {
      return;
    }
    this.pushHistorySnapshot();
    const map = new Map(this._annotations());
    const list = map.get(pageId) ?? [];
    const next = list.filter((a) => !ids.has(a.id) || a.locked);
    map.set(pageId, next);
    this._annotations.set(map);
    this._selectedIds.set([]);
    this._currentRevision.update(r => r + 1);
  }

  duplicateSelected(pageId: string | null): string[] {
    if (!pageId) {
      return [];
    }
    const ids = new Set(this._selectedIds());
    if (ids.size === 0) {
      return [];
    }
    this.pushHistorySnapshot();
    const map = new Map(this._annotations());
    const list = map.get(pageId) ?? [];
    const newCopies: PdfAnnotation[] = [];
    const newIds: string[] = [];

    for (const item of list) {
      if (!ids.has(item.id)) {
        continue;
      }
      let copy: PdfAnnotation = {
        ...item,
        id: crypto.randomUUID(),
        rect: {
          x: item.rect.x + 16,
          y: item.rect.y + 16,
          width: item.rect.width,
          height: item.rect.height,
        },
        createdAt: Date.now(),
      } as PdfAnnotation;
      if (item.type === 'drawing') {
        copy = {
          ...item,
          id: copy.id,
          rect: copy.rect,
          createdAt: copy.createdAt,
          points: item.points.map((p) => ({ x: p.x + 16, y: p.y + 16 })),
        } as DrawingAnnotation;
      }
      newCopies.push(copy);
      newIds.push(copy.id);
    }

    if (newCopies.length > 0) {
      map.set(pageId, [...list, ...newCopies]);
      this._annotations.set(map);
      this._selectedIds.set(newIds);
      this._currentRevision.update(r => r + 1);
    }
    return newIds;
  }

  alignSelected(
    pageId: string | null,
    alignment: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom',
  ): void {
    if (!pageId) {
      return;
    }
    const selected = this.getSelectedList(pageId);
    if (selected.length < 2) {
      return;
    }
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const a of selected) {
      minX = Math.min(minX, a.rect.x);
      maxX = Math.max(maxX, a.rect.x + a.rect.width);
      minY = Math.min(minY, a.rect.y);
      maxY = Math.max(maxY, a.rect.y + a.rect.height);
    }
    const centerX = minX + (maxX - minX) / 2;
    const centerY = minY + (maxY - minY) / 2;

    const map = new Map(this._annotations());
    const list = map.get(pageId) ?? [];
    const next = list.map((a) => {
      if (!this._selectedIds().includes(a.id) || a.locked) {
        return a;
      }
      let targetX = a.rect.x;
      let targetY = a.rect.y;
      if (alignment === 'left') {
        targetX = minX;
      } else if (alignment === 'center') {
        targetX = Math.round(centerX - a.rect.width / 2);
      } else if (alignment === 'right') {
        targetX = maxX - a.rect.width;
      } else if (alignment === 'top') {
        targetY = minY;
      } else if (alignment === 'middle') {
        targetY = Math.round(centerY - a.rect.height / 2);
      } else if (alignment === 'bottom') {
        targetY = maxY - a.rect.height;
      }
      const dx = targetX - a.rect.x;
      const dy = targetY - a.rect.y;

      let updated = {
        ...a,
        rect: { ...a.rect, x: targetX, y: targetY },
      } as PdfAnnotation;
      if (a.type === 'drawing') {
        updated = {
          ...a,
          rect: updated.rect,
          points: a.points.map((p) => ({ x: p.x + dx, y: p.y + dy })),
        } as DrawingAnnotation;
      }
      return updated;
    });

    map.set(pageId, next);
    this._annotations.set(map);
    this._currentRevision.update(r => r + 1);
  }

  setBatchOpacity(pageId: string | null, opacity: number): void {
    if (!pageId) {
      return;
    }
    const ids = new Set(this._selectedIds());
    if (ids.size === 0) {
      return;
    }
    const map = new Map(this._annotations());
    const list = map.get(pageId) ?? [];
    const next = list.map((a) =>
      ids.has(a.id) && !a.locked ? { ...a, opacity } : a,
    );
    map.set(pageId, next);
    this._annotations.set(map);
    this._currentRevision.update(r => r + 1);
  }

  toggleBatchLock(pageId: string | null): void {
    if (!pageId) {
      return;
    }
    const selected = this.getSelectedList(pageId);
    if (selected.length === 0) {
      return;
    }
    const hasUnlocked = selected.some((a) => !a.locked);
    const targetLocked = hasUnlocked; // If any is unlocked, lock all; otherwise unlock all
    const ids = new Set(this._selectedIds());
    const map = new Map(this._annotations());
    const list = map.get(pageId) ?? [];
    const next = list.map((a) =>
      ids.has(a.id) ? { ...a, locked: targetLocked } : a,
    );
    map.set(pageId, next);
    this._annotations.set(map);
    this._currentRevision.update(r => r + 1);
  }

  /** Group selected annotations together under a shared groupId */
  groupSelected(pageId: string | null): string | null {
    if (!pageId || this._selectedIds().length < 2) {
      return null;
    }
    this.pushHistorySnapshot();
    const newGroupId = 'grp-' + crypto.randomUUID().slice(0, 8);
    const ids = new Set(this._selectedIds());
    const map = new Map(this._annotations());
    const list = map.get(pageId) ?? [];
    const next = list.map((a) =>
      ids.has(a.id) ? { ...a, groupId: newGroupId } : a,
    );
    map.set(pageId, next);
    this._annotations.set(map);
    this._currentRevision.update(r => r + 1);
    return newGroupId;
  }

  /** Ungroup selected annotations and cache the set for regrouping */
  ungroupSelected(pageId: string | null): string[] {
    if (!pageId || this._selectedIds().length === 0) {
      return [];
    }
    const selected = this.getSelectedList(pageId);
    const hasGrouped = selected.some((a) => Boolean(a.groupId));
    if (!hasGrouped) {
      return [];
    }
    this.pushHistorySnapshot();
    const selectedIds = this._selectedIds();
    // Cache for Regroup action
    const lastMap = new Map(this._lastUngroupedMap());
    lastMap.set(pageId, [...selectedIds]);
    this._lastUngroupedMap.set(lastMap);

    const ids = new Set(selectedIds);
    const map = new Map(this._annotations());
    const list = map.get(pageId) ?? [];
    const next = list.map((a) =>
      ids.has(a.id) ? { ...a, groupId: undefined } : a,
    );
    map.set(pageId, next);
    this._annotations.set(map);
    this._currentRevision.update(r => r + 1);
    return selectedIds;
  }

  /** Regroup previously ungrouped annotations on this page */
  regroupSelected(pageId: string | null): string | null {
    if (!pageId) {
      return null;
    }
    const cachedIds = this._lastUngroupedMap().get(pageId);
    if (!cachedIds || cachedIds.length < 2) {
      return null;
    }
    const map = new Map(this._annotations());
    const list = map.get(pageId) ?? [];
    const existingIds = new Set(list.map((a) => a.id));
    const validIds = cachedIds.filter((id) => existingIds.has(id));
    if (validIds.length < 2) {
      return null;
    }

    this.pushHistorySnapshot();
    const newGroupId = 'grp-' + crypto.randomUUID().slice(0, 8);
    const targetSet = new Set(validIds);
    const next = list.map((a) =>
      targetSet.has(a.id) ? { ...a, groupId: newGroupId } : a,
    );
    map.set(pageId, next);
    this._annotations.set(map);
    this._selectedIds.set(validIds);
    this._currentRevision.update(r => r + 1);
    return newGroupId;
  }

  canRegroup(pageId: string | null): boolean {
    if (!pageId) {
      return false;
    }
    const cached = this._lastUngroupedMap().get(pageId);
    return Boolean(cached && cached.length >= 2);
  }

  hasGroupInSelection(pageId: string | null): boolean {
    if (!pageId) {
      return false;
    }
    return this.getSelectedList(pageId).some((a) => Boolean(a.groupId));
  }

  /** Distribute 3 or more selected annotations evenly across horizontal or vertical axis */
  distributeSelected(pageId: string | null, axis: 'horizontal' | 'vertical'): void {
    if (!pageId) {
      return;
    }
    const selected = this.getSelectedList(pageId);
    if (selected.length < 3) {
      return;
    }

    this.pushHistorySnapshot();
    const sorted = [...selected].sort((a, b) =>
      axis === 'horizontal' ? a.rect.x - b.rect.x : a.rect.y - b.rect.y,
    );

    const first = sorted[0];
    const last = sorted[sorted.length - 1];

    if (axis === 'horizontal') {
      const minX = first.rect.x;
      const maxX = last.rect.x + last.rect.width;
      const totalWidth = sorted.reduce((sum, item) => sum + item.rect.width, 0);
      const freeSpace = maxX - minX - totalWidth;
      const gap = freeSpace / (sorted.length - 1);

      let currentX = minX;
      const newPosMap = new Map<string, number>();
      for (const item of sorted) {
        newPosMap.set(item.id, Math.round(currentX));
        currentX += item.rect.width + gap;
      }

      const map = new Map(this._annotations());
      const list = map.get(pageId) ?? [];
      const next = list.map((a) => {
        if (!newPosMap.has(a.id) || a.locked) {
          return a;
        }
        const targetX = newPosMap.get(a.id)!;
        const dx = targetX - a.rect.x;
        let updated = { ...a, rect: { ...a.rect, x: targetX } } as PdfAnnotation;
        if (a.type === 'drawing') {
          updated = {
            ...a,
            rect: updated.rect,
            points: a.points.map((p) => ({ x: p.x + dx, y: p.y })),
          } as DrawingAnnotation;
        }
        return updated;
      });
      map.set(pageId, next);
      this._annotations.set(map);
      this._currentRevision.update(r => r + 1);
    } else {
      const minY = first.rect.y;
      const maxY = last.rect.y + last.rect.height;
      const totalHeight = sorted.reduce((sum, item) => sum + item.rect.height, 0);
      const freeSpace = maxY - minY - totalHeight;
      const gap = freeSpace / (sorted.length - 1);

      let currentY = minY;
      const newPosMap = new Map<string, number>();
      for (const item of sorted) {
        newPosMap.set(item.id, Math.round(currentY));
        currentY += item.rect.height + gap;
      }

      const map = new Map(this._annotations());
      const list = map.get(pageId) ?? [];
      const next = list.map((a) => {
        if (!newPosMap.has(a.id) || a.locked) {
          return a;
        }
        const targetY = newPosMap.get(a.id)!;
        const dy = targetY - a.rect.y;
        let updated = { ...a, rect: { ...a.rect, y: targetY } } as PdfAnnotation;
        if (a.type === 'drawing') {
          updated = {
            ...a,
            rect: updated.rect,
            points: a.points.map((p) => ({ x: p.x, y: p.y + dy })),
          } as DrawingAnnotation;
        }
        return updated;
      });
      map.set(pageId, next);
      this._annotations.set(map);
      this._currentRevision.update(r => r + 1);
    }
  }

  bringSelectedToFront(pageId: string | null): void {
    if (!pageId) {
      return;
    }
    const ids = new Set(this._selectedIds());
    if (ids.size === 0) {
      return;
    }
    this.pushHistorySnapshot('Bring to Front');
    const map = new Map(this._annotations());
    const list = map.get(pageId) ?? [];
    const unselected = list.filter((a) => !ids.has(a.id));
    const selected = list.filter((a) => ids.has(a.id));
    map.set(pageId, [...unselected, ...selected]);
    this._annotations.set(map);
    this._currentRevision.update(r => r + 1);
  }

  sendSelectedToBack(pageId: string | null): void {
    if (!pageId) {
      return;
    }
    const ids = new Set(this._selectedIds());
    if (ids.size === 0) {
      return;
    }
    this.pushHistorySnapshot('Send to Back');
    const map = new Map(this._annotations());
    const list = map.get(pageId) ?? [];
    const unselected = list.filter((a) => !ids.has(a.id));
    const selected = list.filter((a) => ids.has(a.id));
    map.set(pageId, [...selected, ...unselected]);
    this._annotations.set(map);
    this._currentRevision.update(r => r + 1);
  }

  /** Select all drawings or the latest drawn ink mark on the page for transformation */
  selectDrawingsArea(pageId: string | null): void {
    if (!pageId) {
      return;
    }
    const list = this._annotations().get(pageId) ?? [];
    const drawings = list.filter(
      (a): a is DrawingAnnotation => a.type === 'drawing',
    );
    if (drawings.length === 0) {
      return;
    }
    this._tool.set('select');
    this._selectedIds.set(drawings.map((d) => d.id));
  }

  reset(): void {
    this._annotations.set(new Map());
    this._selectedIds.set([]);
    this._savedRevision = 0;
    this._currentRevision.set(0);
    this._tool.set('select');
    this._zoom.set(1);
    this._fitMode.set('width');
    this.undoStack = [];
    this.redoStack = [];
    this._canUndo.set(false);
    this._canRedo.set(false);
    this.updateActionLabels();
  }

  /** Mark the current state as "saved" so modified() returns false. */
  markSaved(): void {
    this._savedRevision = this._currentRevision();
  }

  get pageService(): EditorPagesService {
    return this.pages;
  }
}
