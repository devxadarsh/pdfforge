import { ChangeDetectionStrategy, ChangeDetectorRef, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  GlyphMissingError,
  GlyphResolver,
  analyzeFontsOnPage,
  editTextInPdf,
  findTextOperators,
  tokenizeContentStream,
  type FontSubsetInfo,
  type TextOperatorLocation,
} from '../../core/services/pdf/content-edit/index';

/**
 * FontGlyphSpikeComponent — Prompt 2 Manual Verification Harness
 * ──────────────────────────────────────────────────────────────
 * Route: /font-glyph-spike
 *
 * Verifies:
 *  1. fontkit can parse embedded font programs from real PDFs.
 *  2. Available glyphs can be enumerated from the font subset.
 *  3. Missing glyphs are detected and blocked with a clear error.
 *  4. Text can be re-encoded and content stream re-serialized.
 *  5. Modified PDF downloads and opens cleanly in Chrome.
 */
@Component({
  selector: 'app-font-glyph-spike',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="container py-4">
      <h2 class="mb-1">Prompt 2 Spike — Font Glyph Encoding</h2>
      <p class="text-muted small mb-3">
        Validates embedded font subset analysis, glyph validation, and content stream re-serialization.
        <strong>Development only.</strong>
      </p>

      <!-- Step 1: Load PDF -->
      <div class="card mb-3">
        <div class="card-header"><strong>Step 1: Load PDF</strong></div>
        <div class="card-body">
          <div
            class="drop-zone border rounded p-3 text-center"
            [class.drag-over]="isDragging"
            (dragover)="onDragOver($event)"
            (dragleave)="isDragging = false"
            (drop)="onDrop($event)"
            (click)="fileInput.click()"
            role="button" tabindex="0"
            (keydown.enter)="fileInput.click()"
          >
            <i class="fas fa-file-pdf fa-2x mb-1 text-danger"></i>
            <div>{{ isDragging ? 'Drop…' : 'Drop a PDF or click' }}</div>
            <input #fileInput type="file" accept="application/pdf" class="d-none" (change)="onFileSelected($event)" />
          </div>
        </div>
      </div>

      <!-- Step 2: Analyze fonts -->
      @if (pdfBytes && !analyzing) {
        <div class="card mb-3">
          <div class="card-header"><strong>Step 2: Font Analysis</strong></div>
          <div class="card-body">
            <div class="d-flex align-items-center gap-2 mb-2">
              <label class="mb-0">Page:</label>
              <input type="number" class="form-control" style="width:80px" [(ngModel)]="selectedPage" [min]="0" [max]="pageCount - 1" />
              <span class="text-muted small">of {{ pageCount }}</span>
              <button class="btn btn-sm btn-primary" (click)="analyzeFonts()">Analyze Fonts</button>
            </div>
          </div>
        </div>
      }

      @if (analyzing) {
        <div class="alert alert-info">Analyzing fonts…</div>
      }

      @if (errorMsg) {
        <div class="alert alert-danger">{{ errorMsg }}</div>
      }

      <!-- Font Analysis Results -->
      @if (fontInfos.size > 0) {
        <div class="card mb-3">
          <div class="card-header"><strong>Fonts on Page {{ selectedPage }}</strong></div>
          <div class="card-body">
            @for (entry of fontInfoArray; track entry.fontKey) {
              <div class="mb-3 border rounded p-2">
                <div class="d-flex justify-content-between align-items-start">
                  <div>
                    <strong>/{{ entry.fontKey }}</strong>
                    <span class="text-muted ms-2">{{ entry.postscriptName }}</span>
                    <span class="badge ms-2"
                      [class.bg-success]="entry.fontkitParsed"
                      [class.bg-warning]="!entry.fontkitParsed">
                      {{ entry.fontkitParsed ? 'fontkit ✓' : 'ToUnicode only' }}
                    </span>
                    <span class="badge bg-secondary ms-1">{{ entry.fontType }}</span>
                  </div>
                  <div class="text-end text-muted small">
                    {{ entry.numGlyphs }} glyphs · {{ entry.availableChars.size }} chars
                  </div>
                </div>
                @if (entry.warnings.length > 0) {
                  @for (w of entry.warnings; track w) {
                    <div class="text-warning small">⚠ {{ w }}</div>
                  }
                }
                <div class="mt-1">
                  <small class="text-muted">Available chars (first 80):</small>
                  <div class="font-mono small bg-light rounded px-2 py-1 mt-1" style="word-break:break-all">
                    {{ charsPreview(entry) }}
                  </div>
                </div>
                @if (entry.toUnicodeMap) {
                  <div class="mt-1">
                    <small class="text-muted">
                      ToUnicode map: {{ entry.toUnicodeMap.byteToUnicode.size }} entries ·
                      {{ entry.toUnicodeMap.isTwoByteEncoding ? '2-byte (CIDFont)' : '1-byte (simple)' }}
                    </small>
                  </div>
                }
              </div>
            }
          </div>
        </div>

        <!-- Step 3: Text operator list -->
        @if (textOps.length > 0) {
          <div class="card mb-3">
            <div class="card-header"><strong>Step 3: Text Operators on Page</strong></div>
            <div class="card-body p-0">
              <div class="table-responsive">
                <table class="table table-sm table-striped mb-0">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Op</th>
                      <th>Font</th>
                      <th>Current Text</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (op of textOps.slice(0, 50); track op.operatorIndex; let i = $index) {
                      <tr [class.table-primary]="selectedRunIndex === i">
                        <td>{{ i }}</td>
                        <td><code>{{ op.operator }}</code></td>
                        <td><code>/{{ op.activeFontKey }}</code></td>
                        <td>
                          <span class="text-truncate d-inline-block" style="max-width:250px" [title]="op.currentText">
                            {{ op.currentText || '(whitespace)' }}
                          </span>
                        </td>
                        <td>
                          <button class="btn btn-xs btn-outline-primary btn-sm" (click)="selectRun(i)">Edit</button>
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
              @if (textOps.length > 50) {
                <p class="text-muted small p-2 mb-0">… {{ textOps.length - 50 }} more. Showing first 50.</p>
              }
            </div>
          </div>
        }

        <!-- Step 4: Edit + glyph validation -->
        @if (selectedRunIndex !== null) {
          <div class="card mb-3">
            <div class="card-header"><strong>Step 4: Edit Text (run #{{ selectedRunIndex }})</strong></div>
            <div class="card-body">
              <div class="mb-2">
                <label class="form-label">Current text:</label>
                <input class="form-control" [value]="textOps[selectedRunIndex].currentText" readonly />
              </div>
              <div class="mb-2">
                <label class="form-label">New text (only use chars in font subset):</label>
                <input class="form-control" [(ngModel)]="newText" (input)="onNewTextInput()" />
              </div>
              @if (validationMsg) {
                <div class="alert" [class.alert-danger]="!glyphsValid" [class.alert-success]="glyphsValid">
                  {{ validationMsg }}
                </div>
              }
              @if (missingGlyphMsg) {
                <div class="card border-warning mb-2">
                  <div class="card-header bg-warning bg-opacity-10"><strong>⚠ Missing Glyph — BLOCKED (PRD §13 Q1 Decision A)</strong></div>
                  <div class="card-body small">
                    <p class="mb-1">{{ missingGlyphMsg }}</p>
                    <p class="mb-0 text-muted">
                      This confirms the block strategy works: the character is rejected before any content
                      stream mutation occurs. No silent corruption.
                    </p>
                  </div>
                </div>
              }
              <button
                class="btn btn-success me-2"
                [disabled]="!glyphsValid || !newText || exporting"
                (click)="applyEdit()"
              >
                {{ exporting ? 'Exporting…' : 'Apply + Download PDF' }}
              </button>
              <button class="btn btn-outline-secondary" (click)="selectedRunIndex = null; validationMsg = ''; missingGlyphMsg = ''">Cancel</button>
            </div>
          </div>
        }

        <!-- Step 5: Missing glyph demo -->
        <div class="card mb-3 border-info">
          <div class="card-header bg-info bg-opacity-10"><strong>Step 5: Missing Glyph Detection Demo</strong></div>
          <div class="card-body">
            <p class="small">
              Demonstrate that characters outside the font subset are reliably detected and blocked.
              Select the first font below and type a rare character to test.
            </p>
            <div class="d-flex gap-2 align-items-center flex-wrap">
              <select class="form-select" style="width:auto" [(ngModel)]="demoFontKey">
                @for (entry of fontInfoArray; track entry.fontKey) {
                  <option [value]="entry.fontKey">{{ entry.fontKey }} ({{ entry.postscriptName }})</option>
                }
              </select>
              <input class="form-control" style="width:200px" [(ngModel)]="demoText" placeholder="Type to test…" (input)="onDemoInput()" />
            </div>
            @if (demoResult) {
              <div class="mt-2 alert" [class.alert-success]="demoResult.valid" [class.alert-danger]="!demoResult.valid">
                @if (demoResult.valid) {
                  ✓ All characters available in the font subset.
                } @else {
                  ✗ BLOCKED: {{ demoResult.missingChars.join(', ') }} not in subset.
                }
              </div>
            }
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .drop-zone { cursor: pointer; border-style: dashed !important; transition: background 0.15s; }
    .drop-zone:hover, .drop-zone.drag-over { background: rgba(0,0,0,0.04); }
    .font-mono { font-family: monospace; }
  `],
})
export class FontGlyphSpikeComponent {
  private readonly cdr = inject(ChangeDetectorRef);

  isDragging = false;
  analyzing = false;
  exporting = false;
  errorMsg = '';
  pdfBytes: ArrayBuffer | null = null;
  pageCount = 0;
  selectedPage = 0;

  fontInfos = new Map<string, FontSubsetInfo>();
  get fontInfoArray(): FontSubsetInfo[] { return [...this.fontInfos.values()]; }

  textOps: TextOperatorLocation[] = [];
  selectedRunIndex: number | null = null;
  newText = '';
  validationMsg = '';
  missingGlyphMsg = '';
  glyphsValid = false;

  demoFontKey = '';
  demoText = '';
  demoResult: { valid: boolean; missingChars: string[] } | null = null;

  onDragOver(e: DragEvent) { e.preventDefault(); this.isDragging = true; }
  onDrop(e: DragEvent) { e.preventDefault(); this.isDragging = false; const f = e.dataTransfer?.files[0]; if (f) void this.loadFile(f); }
  onFileSelected(e: Event) { const f = (e.target as HTMLInputElement).files?.[0]; if (f) void this.loadFile(f); }

  private async loadFile(file: File): Promise<void> {
    this.pdfBytes = await file.arrayBuffer();
    this.fontInfos.clear();
    this.textOps = [];
    this.errorMsg = '';

    try {
      const { PDFDocument } = await import('pdf-lib');
      const doc = await PDFDocument.load(new Uint8Array(this.pdfBytes), { ignoreEncryption: true });
      this.pageCount = doc.getPageCount();
    } catch (e) {
      this.errorMsg = `Failed to open PDF: ${e}`;
    }
    this.cdr.markForCheck();
  }

  async analyzeFonts(): Promise<void> {
    if (!this.pdfBytes) return;
    this.analyzing = true;
    this.errorMsg = '';
    this.fontInfos.clear();
    this.textOps = [];
    this.cdr.markForCheck();

    try {
      // Analyze fonts.
      this.fontInfos = await analyzeFontsOnPage(new Uint8Array(this.pdfBytes), this.selectedPage);

      // Also extract text operators from the content stream.
      const { PDFDocument, PDFName, PDFRawStream, decodePDFRawStream } = await import('pdf-lib');
      const doc = await PDFDocument.load(new Uint8Array(this.pdfBytes!), { ignoreEncryption: true });
      const page = doc.getPages()[this.selectedPage];
      const contentsRef = page.node.lookup(PDFName.of('Contents'));

      let streamText = '';
      const getStream = (ref: unknown) => {
        const obj = doc.context.lookup(ref as import('pdf-lib').PDFRef);
        if (obj instanceof PDFRawStream) {
          try { streamText += new TextDecoder('latin1').decode(decodePDFRawStream(obj).decode()); }
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          catch { streamText += new TextDecoder('latin1').decode((obj as any).contents); }
        }
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const contentsAsAny = contentsRef as any;
      if (contentsRef && typeof contentsAsAny.get === 'function') {
        for (let i = 0; i < contentsAsAny.length; i++) getStream(contentsAsAny.get(i));
      } else if (contentsRef) { getStream(contentsRef); }

      if (streamText) {
        const tokens = tokenizeContentStream(streamText);
        this.textOps = findTextOperators(tokens);
      }

      // Pre-select first font for demo.
      const first = [...this.fontInfos.values()][0];
      if (first) this.demoFontKey = first.fontKey;

      console.group('[Prompt 2 Spike] Font analysis result');
      for (const [key, info] of this.fontInfos) {
        console.log(`Font ${key}:`, {
          postscriptName: info.postscriptName,
          fontType: info.fontType,
          numGlyphs: info.numGlyphs,
          fontkitParsed: info.fontkitParsed,
          availableCharsCount: info.availableChars.size,
          hasToUnicode: !!info.toUnicodeMap,
          toUnicodeEntries: info.toUnicodeMap?.byteToUnicode.size,
          warnings: info.warnings,
        });
      }
      console.log('Text operators found:', this.textOps.length);
      console.groupEnd();
    } catch (e) {
      this.errorMsg = `Analysis failed: ${e}`;
      console.error('[Prompt 2 Spike]', e);
    } finally {
      this.analyzing = false;
      this.cdr.markForCheck();
    }
  }

  selectRun(i: number): void {
    this.selectedRunIndex = i;
    this.newText = this.textOps[i].currentText;
    this.validationMsg = '';
    this.missingGlyphMsg = '';
    this.glyphsValid = true;
    this.cdr.markForCheck();
  }

  onNewTextInput(): void {
    if (this.selectedRunIndex === null) return;
    const op = this.textOps[this.selectedRunIndex];
    const fontInfo = this.fontInfos.get(op.activeFontKey);
    if (!fontInfo) {
      this.validationMsg = `Font "${op.activeFontKey}" not found in analysis.`;
      this.glyphsValid = false;
      this.missingGlyphMsg = '';
      this.cdr.markForCheck();
      return;
    }

    const resolver = new GlyphResolver(fontInfo);
    const result = resolver.validate(this.newText);
    this.glyphsValid = result.valid;

    if (result.valid) {
      this.validationMsg = `✓ All ${this.newText.length} characters available in font subset.`;
      this.missingGlyphMsg = '';
    } else {
      this.validationMsg = '';
      this.missingGlyphMsg = GlyphResolver.missingGlyphWarning(result.missingChars);
    }
    this.cdr.markForCheck();
  }

  async applyEdit(): Promise<void> {
    if (this.selectedRunIndex === null || !this.pdfBytes || !this.glyphsValid) return;
    const op = this.textOps[this.selectedRunIndex];
    const fontInfo = this.fontInfos.get(op.activeFontKey);
    if (!fontInfo) return;

    this.exporting = true;
    this.cdr.markForCheck();

    try {
      const blob = await editTextInPdf(
        this.pdfBytes,
        this.selectedPage,
        this.selectedRunIndex,
        this.newText,
        fontInfo,
      );

      // Trigger download.
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'edited-spike.pdf';
      a.click();
      URL.revokeObjectURL(url);

      console.log('[Prompt 2 Spike] Edit applied and PDF downloaded successfully.');
    } catch (e) {
      if (e instanceof GlyphMissingError) {
        this.missingGlyphMsg = GlyphResolver.missingGlyphWarning(e.missingChars);
      } else {
        this.errorMsg = `Export failed: ${e}`;
      }
      console.error('[Prompt 2 Spike]', e);
    } finally {
      this.exporting = false;
      this.cdr.markForCheck();
    }
  }

  onDemoInput(): void {
    const fontInfo = this.fontInfos.get(this.demoFontKey);
    if (!fontInfo || !this.demoText) { this.demoResult = null; this.cdr.markForCheck(); return; }

    const resolver = new GlyphResolver(fontInfo);
    const result = resolver.validate(this.demoText);
    this.demoResult = { valid: result.valid, missingChars: [...result.missingChars] };
    this.cdr.markForCheck();
  }

  charsPreview(info: FontSubsetInfo): string {
    return [...info.availableChars].slice(0, 80).join('');
  }
}
