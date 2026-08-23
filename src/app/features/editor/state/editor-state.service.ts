import { Injectable, inject, signal } from '@angular/core';
import {
  PdfToolId,
  PdfAnnotation,
  PendingMedia,
  DigitalSignatureRequest,
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
  private readonly _pendingMedia = signal<PendingMedia | null>(null);
  private readonly _digitalSignature =
    signal<DigitalSignatureRequest | null>(null);

  readonly tool = this._tool.asReadonly();
  readonly zoom = this._zoom.asReadonly();
  readonly fitMode = this._fitMode.asReadonly();
  readonly selectedId = this._selectedId.asReadonly();
  readonly modified = this._modified.asReadonly();
  readonly annotationsByPage = this._annotations.asReadonly();
  readonly pendingMedia = this._pendingMedia.asReadonly();
  readonly digitalSignature = this._digitalSignature.asReadonly();

  setDigitalSignature(req: DigitalSignatureRequest | null): void {
    this._digitalSignature.set(req);
  }

  /* Snapshot/restore for history */
  getAnnotations(): Map<string, PdfAnnotation[]> {
    return this._annotations();
  }

  setAnnotations(map: Map<string, PdfAnnotation[]>): void {
    this._annotations.set(new Map(map));
    const ids = new Set<string>();
    for (const list of map.values()) {
      for (const a of list) {
        ids.add(a.id);
      }
    }
    if (this._selectedId() && !ids.has(this._selectedId() as string)) {
      this._selectedId.set(null);
    }
  }

  getDigital(): DigitalSignatureRequest | null {
    return this._digitalSignature();
  }

  setDigital(req: DigitalSignatureRequest | null): void {
    this._digitalSignature.set(req);
  }

  setModified(value: boolean): void {
    this._modified.set(value);
  }

  setPendingMedia(media: PendingMedia | null): void {
    this._pendingMedia.set(media);
  }

  setTool(tool: PdfToolId): void {
    this._tool.set(tool);
    if (tool !== 'image' && tool !== 'signature' && tool !== 'stamp') {
      this._pendingMedia.set(null);
    }
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

  addAnnotation(pageId: string, annotation: PdfAnnotation): void {
    const map = new Map(this._annotations());
    const existing = map.get(pageId) ?? [];
    map.set(pageId, [...existing, annotation]);
    this._annotations.set(map);
    this._selectedId.set(annotation.id);
    this._modified.set(true);
  }

  updateAnnotation(id: string, patch: Partial<PdfAnnotation>): void {
    const map = new Map(this._annotations());
    for (const [pageId, list] of map) {
      const idx = list.findIndex((a) => a.id === id);
      if (idx < 0) {
        continue;
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

  removeAnnotation(id: string): void {
    const map = new Map(this._annotations());
    for (const [pageId, list] of map) {
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

  selectAnnotation(id: string | null): void {
    this._selectedId.set(id);
  }

  clearSelection(): void {
    this._selectedId.set(null);
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
    this._pendingMedia.set(null);
    this._digitalSignature.set(null);
    this._modified.set(false);
    this._tool.set('select');
    this._zoom.set(1);
    this._fitMode.set('width');
  }

  get pageService(): EditorPagesService {
    return this.pages;
  }
}
