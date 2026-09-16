import { ChangeDetectionStrategy, ChangeDetectorRef, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  extractTextRuns,
  serializeExtractionResult,
  type ExtractionResult,
} from '../../core/services/pdf/content-edit/index';

/**
 * MupdfSpikeComponent — Prompt 1 Manual Verification Harness
 * ─────────────────────────────────────────────────────────────
 * A throwaway Angular component for validating the mupdf-wasm structured
 * text extraction spike in the browser. Not intended for production.
 *
 * Route: /mupdf-spike (registered temporarily in app.routes.ts for testing)
 *
 * How to use:
 *   1. `ng serve`
 *   2. Navigate to http://localhost:4200/mupdf-spike
 *   3. Drop a text-based PDF onto the dropzone (or click to select).
 *   4. Observe the extracted runs in the JSON panel and check the console
 *      for the full serialized output.
 *   5. Compare bounding boxes visually against the rendered thumbnail.
 *
 * Acceptance criteria verified here (PRD §11, Prompt 1):
 *   ✓ mupdf-wasm loads and initializes in browser (WASM)
 *   ✓ Clean array of span objects in console
 *   ✓ Each span contains all TextRun interface fields
 *   ✓ Extraction completes in under 500ms
 *   ✓ Font resource name question answered and documented
 */
@Component({
  selector: 'app-mupdf-spike',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="container py-4">
      <h2 class="mb-1">Prompt 1 Spike — mupdf-wasm Text Extraction</h2>
      <p class="text-muted small mb-3">
        Drop a text-based PDF to validate structured text extraction via mupdf-wasm.
        <strong>This component is for development/testing only.</strong>
      </p>

      <!-- Drop Zone -->
      <div
        class="drop-zone border rounded p-4 text-center mb-3"
        [class.drag-over]="isDragging"
        (dragover)="onDragOver($event)"
        (dragleave)="isDragging = false"
        (drop)="onDrop($event)"
        (click)="fileInput.click()"
        role="button"
        tabindex="0"
        aria-label="Drop a PDF file here or click to select"
        (keydown.enter)="fileInput.click()"
      >
        <i class="fas fa-file-pdf fa-2x mb-2 text-danger"></i>
        <div>{{ isDragging ? 'Drop now…' : 'Drop a PDF here or click to select' }}</div>
        <input #fileInput type="file" accept="application/pdf" class="d-none" (change)="onFileSelected($event)" />
      </div>

      <!-- Page selector -->
      @if (pageCount > 0) {
        <div class="mb-3 d-flex align-items-center gap-2">
          <label for="pageInput" class="form-label mb-0">Page (0-based):</label>
          <input
            id="pageInput"
            type="number"
            class="form-control"
            style="width: 80px"
            [(ngModel)]="selectedPage"
            [min]="0"
            [max]="pageCount - 1"
          />
          <span class="text-muted small">of {{ pageCount }} pages</span>
          <button class="btn btn-sm btn-primary" (click)="extractPage()" [disabled]="isExtracting">
            {{ isExtracting ? 'Extracting…' : 'Extract' }}
          </button>
        </div>
      }

      <!-- Status / Error -->
      @if (errorMsg) {
        <div class="alert alert-danger">{{ errorMsg }}</div>
      }

      <!-- Results -->
      @if (result) {
        <div class="row g-3">
          <!-- Stats card -->
          <div class="col-12">
            <div class="card">
              <div class="card-body">
                <h5 class="card-title">Extraction Stats</h5>
                <dl class="row mb-0">
                  <dt class="col-sm-3">Page index</dt>
                  <dd class="col-sm-9">{{ result.model.pageIndex }}</dd>
                  <dt class="col-sm-3">Runs extracted</dt>
                  <dd class="col-sm-9">{{ result.model.runs.length }}</dd>
                  <dt class="col-sm-3">Time</dt>
                  <dd class="col-sm-9" [class.text-danger]="result.extractionMs > 500" [class.text-success]="result.extractionMs <= 500">
                    {{ result.extractionMs.toFixed(1) }}ms
                    {{ result.extractionMs <= 500 ? '✓ under 500ms target' : '⚠ exceeds 500ms target' }}
                  </dd>
                  <dt class="col-sm-3">Warnings</dt>
                  <dd class="col-sm-9">
                    @if (result.warnings.length === 0) {
                      <span class="text-success">None</span>
                    } @else {
                      @for (w of result.warnings; track w) {
                        <div class="text-warning">{{ w }}</div>
                      }
                    }
                  </dd>
                </dl>
              </div>
            </div>
          </div>

          <!-- Font resource name finding -->
          <div class="col-12">
            <div class="card border-warning">
              <div class="card-header bg-warning bg-opacity-10">
                <strong>⚠ Architectural Finding: Font Resource Name</strong>
              </div>
              <div class="card-body small">
                <p>
                  mupdf's <code>StructuredText / onChar</code> provides <code>Font.getName()</code>
                  → resolved PostScript/family name (e.g. <code>"Helvetica-Bold"</code>).
                </p>
                <p>
                  It does <strong>NOT</strong> expose the raw PDF resource key (e.g. <code>/F1</code>)
                  from the page's <code>Resources/Font</code> dictionary.
                </p>
                <p class="mb-0">
                  Unresolved font resources are prefixed <code>~</code> in the output below
                  (e.g. <code>"~Helvetica-Bold"</code>). Resolution via pdf-lib is planned for Prompt 3.
                </p>
              </div>
            </div>
          </div>

          <!-- Runs table -->
          <div class="col-12">
            <div class="card">
              <div class="card-body">
                <h5 class="card-title">Extracted Runs (first 20)</h5>
                <div class="table-responsive">
                  <table class="table table-sm table-striped">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Text</th>
                        <th>Font (mupdf name)</th>
                        <th>Size</th>
                        <th>Color</th>
                        <th>BBox (x,y,w,h)</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (run of result.model.runs.slice(0, 20); track run.id) {
                        <tr>
                          <td><code>{{ run.id }}</code></td>
                          <td>
                            <span class="text-truncate d-inline-block" style="max-width:200px" [title]="run.text">
                              {{ run.text }}
                            </span>
                          </td>
                          <td><code>{{ run.fontResource }}</code></td>
                          <td>{{ run.fontSize.toFixed(1) }}pt</td>
                          <td>
                            <span
                              class="d-inline-block border"
                              style="width:16px;height:16px;vertical-align:middle"
                              [style.background]="colorToCSS(run.color)"
                            ></span>
                            {{ colorLabel(run.color) }}
                          </td>
                          <td>
                            <code>
                              {{ run.boundingBox.x.toFixed(1) }},
                              {{ run.boundingBox.y.toFixed(1) }},
                              {{ run.boundingBox.width.toFixed(1) }},
                              {{ run.boundingBox.height.toFixed(1) }}
                            </code>
                          </td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
                @if (result.model.runs.length > 20) {
                  <p class="text-muted small">… and {{ result.model.runs.length - 20 }} more. See browser console for full JSON.</p>
                }
              </div>
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .drop-zone {
      cursor: pointer;
      transition: background 0.2s, border-color 0.2s;
      border-style: dashed !important;
    }
    .drop-zone:hover, .drop-zone.drag-over {
      background: rgba(0,0,0,0.04);
      border-color: var(--bs-primary) !important;
    }
  `],
})
export class MupdfSpikeComponent {
  private readonly cdr = inject(ChangeDetectorRef);

  isDragging = false;
  isExtracting = false;
  errorMsg: string | null = null;
  result: ExtractionResult | null = null;
  pageCount = 0;
  selectedPage = 0;

  private pdfBytes: ArrayBuffer | null = null;

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.isDragging = true;
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDragging = false;
    const file = event.dataTransfer?.files[0];
    if (file) void this.loadFile(file);
  }

  onFileSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) void this.loadFile(file);
  }

  private async loadFile(file: File): Promise<void> {
    this.errorMsg = null;
    this.result = null;
    this.pdfBytes = null;
    this.pageCount = 0;
    this.selectedPage = 0;

    if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
      this.errorMsg = 'Please select a PDF file.';
      this.cdr.markForCheck();
      return;
    }

    this.pdfBytes = await file.arrayBuffer();

    // Count pages via pdf-lib (already in the stack, no Zone.js issue).
    try {
      const { PDFDocument } = await import('pdf-lib');
      const pdfDoc = await PDFDocument.load(new Uint8Array(this.pdfBytes), { ignoreEncryption: true });
      this.pageCount = pdfDoc.getPageCount();
    } catch (e) {
      this.errorMsg = `Failed to open PDF: ${String(e)}`;
      this.cdr.markForCheck();
      return;
    }

    this.cdr.markForCheck();
    await this.extractPage();
  }

  async extractPage(): Promise<void> {
    if (!this.pdfBytes || this.isExtracting) return;
    this.isExtracting = true;
    this.errorMsg = null;
    this.result = null;
    this.cdr.markForCheck();

    try {
      const result = await extractTextRuns(this.pdfBytes, this.selectedPage);
      this.result = result;

      // Log full JSON to console for inspection.
      console.group('[Prompt 1 Spike] mupdf extraction result');
      console.log('Page:', this.selectedPage);
      console.log(`Extraction time: ${result.extractionMs.toFixed(1)}ms`);
      console.log('Run count:', result.model.runs.length);
      console.log('Full JSON:', JSON.stringify(serializeExtractionResult(result), null, 2));
      if (result.warnings.length > 0) {
        console.warn('Warnings:', result.warnings);
      }
      console.groupEnd();
    } catch (e) {
      this.errorMsg = `Extraction failed: ${String(e)}`;
      console.error('[Prompt 1 Spike]', e);
    } finally {
      this.isExtracting = false;
      this.cdr.markForCheck();
    }
  }

  colorToCSS(color: ExtractionResult['model']['runs'][number]['color']): string {
    switch (color.type) {
      case 'rgb':
        return `rgb(${Math.round(color.r * 255)},${Math.round(color.g * 255)},${Math.round(color.b * 255)})`;
      case 'gray':
        return `rgb(${Math.round(color.g * 255)},${Math.round(color.g * 255)},${Math.round(color.g * 255)})`;
      case 'cmyk': {
        const r = (1 - color.c) * (1 - color.k);
        const g = (1 - color.m) * (1 - color.k);
        const b = (1 - color.y) * (1 - color.k);
        return `rgb(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)})`;
      }
    }
  }

  colorLabel(color: ExtractionResult['model']['runs'][number]['color']): string {
    switch (color.type) {
      case 'rgb':
        return `rgb(${(color.r * 255).toFixed(0)},${(color.g * 255).toFixed(0)},${(color.b * 255).toFixed(0)})`;
      case 'gray':
        return `gray(${(color.g * 100).toFixed(0)}%)`;
      case 'cmyk':
        return `cmyk(${(color.c * 100).toFixed(0)}%,…)`;
    }
  }
}
