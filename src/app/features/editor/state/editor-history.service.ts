import { Injectable, inject, signal, effect } from '@angular/core';
import {
  PdfAnnotation,
  DigitalSignatureRequest,
  TextEditOverrides,
} from '../../../core/models/pdf.models';
import { EditorPage } from '../models/editor-page.model';
import { EditorStateService } from './editor-state.service';
import { EditorPagesService } from './editor-pages.service';

interface HistorySnapshot {
  annotations: Map<string, PdfAnnotation[]>;
  pages: EditorPage[];
  digital: DigitalSignatureRequest | null;
  textOverrides: TextEditOverrides;
}

const DEBOUNCE_MS = 200;
const MAX_HISTORY = 100;

@Injectable({ providedIn: 'root' })
export class EditorHistoryService {
  private readonly state = inject(EditorStateService);
  private readonly pages = inject(EditorPagesService);

  readonly canUndo = signal(false);
  readonly canRedo = signal(false);

  private stack: HistorySnapshot[] = [];
  private pointer = -1;
  private isApplying = false;
  private commitTimer?: ReturnType<typeof setTimeout>;

  constructor() {
    effect(() => {
      this.state.annotationsByPage();
      this.pages.pages();
      this.state.digitalSignature();
      this.state.textOverrides();
      if (this.isApplying) {
        return;
      }
      this.scheduleCommit();
    });
  }

  /** Reset history and capture the current state as the baseline. */
  reset(): void {
    clearTimeout(this.commitTimer);
    this.isApplying = true;
    this.stack = [this.capture()];
    this.pointer = 0;
    this.updateFlags();
    setTimeout(() => {
      this.isApplying = false;
    }, 0);
  }

  undo(): void {
    if (this.pointer <= 0) {
      return;
    }
    this.pointer -= 1;
    this.apply(this.stack[this.pointer]);
  }

  redo(): void {
    if (this.pointer >= this.stack.length - 1) {
      return;
    }
    this.pointer += 1;
    this.apply(this.stack[this.pointer]);
  }

  private scheduleCommit(): void {
    clearTimeout(this.commitTimer);
    this.commitTimer = setTimeout(() => this.commit(), DEBOUNCE_MS);
  }

  private commit(): void {
    this.stack = this.stack.slice(0, this.pointer + 1);
    this.stack.push(this.capture());
    this.pointer = this.stack.length - 1;
    if (this.stack.length > MAX_HISTORY) {
      this.stack.shift();
      this.pointer -= 1;
    }
    this.updateFlags();
  }

  private apply(snapshot: HistorySnapshot): void {
    this.isApplying = true;
    this.state.setAnnotations(this.cloneAnnotations(snapshot.annotations));
    this.pages.setPages(snapshot.pages.map((p) => ({ ...p })));
    this.state.setDigital(
      snapshot.digital
        ? { ...snapshot.digital, certBytes: new Uint8Array(snapshot.digital.certBytes) }
        : null,
    );
    this.state.setTextOverrides(this.cloneTextOverrides(snapshot.textOverrides));
    setTimeout(() => {
      this.isApplying = false;
    }, 0);
  }

  private updateFlags(): void {
    this.canUndo.set(this.pointer > 0);
    this.canRedo.set(this.pointer < this.stack.length - 1);
    this.state.setModified(this.pointer > 0);
  }

  private capture(): HistorySnapshot {
    const digital = this.state.getDigital();
    return {
      annotations: this.cloneAnnotations(this.state.getAnnotations()),
      pages: this.pages.getPages().map((p) => ({ ...p })),
      digital: digital
        ? { ...digital, certBytes: new Uint8Array(digital.certBytes) }
        : null,
      textOverrides: this.cloneTextOverrides(this.state.getTextOverrides()),
    };
  }

  private cloneTextOverrides(
    map: TextEditOverrides,
  ): TextEditOverrides {
    const out = new Map<number, Map<string, string>>();
    for (const [pageIndex, pageMap] of map) {
      out.set(pageIndex, new Map(pageMap));
    }
    return out;
  }

  private cloneAnnotations(
    map: Map<string, PdfAnnotation[]>,
  ): Map<string, PdfAnnotation[]> {
    const out = new Map<string, PdfAnnotation[]>();
    for (const [key, list] of map) {
      out.set(
        key,
        list.map((a) => this.cloneAnnotation(a)),
      );
    }
    return out;
  }

  private cloneAnnotation(a: PdfAnnotation): PdfAnnotation {
    const cloned = { ...a, rect: { ...a.rect } } as PdfAnnotation;
    if (cloned.type === 'drawing') {
      (cloned as { points: ReadonlyArray<{ x: number; y: number }> }).points = [
        ...(cloned as { points: ReadonlyArray<{ x: number; y: number }> }).points,
      ];
    }
    return cloned;
  }
}
