import { Component, signal, computed, inject, OnInit, OnDestroy, viewChild } from '@angular/core';
import { RouterLink, Router, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { PDFDocument } from 'pdf-lib';
import { NgxExtendedPdfViewerModule } from 'ngx-extended-pdf-viewer';
import { FileDropzoneComponent } from '../../shared/components/dropzone/file-dropzone.component';
import { PdfCardGridComponent } from '../../shared/components/pdf-card-grid/pdf-card-grid.component';
import { LoadedFile } from '../../core/models/file.models';
import { PdfWorkerService } from '../../core/services/worker/pdf-worker.service';
import { DownloadService } from '../../core/services/download/download.service';
import { FileService } from '../../core/services/file/file.service';
import { ToastService } from '../../core/services/toast.service';
import { parsePageRange } from '../../core/models/export.models';
import { formatBytes } from '../../core/utilities/file.util';
import { createZipBlob, ZipEntry } from '../../core/utilities/zip.util';

export interface SplitResult {
  readonly mode: 'every' | 'extract';
  readonly count: number;
  readonly zipBlob?: Blob;
  readonly zipFilename?: string;
  readonly singleBlob?: Blob;
  readonly singleFilename?: string;
  readonly singleBuffer?: ArrayBuffer;
  readonly individualFiles: { name: string; blob: Blob; data: ArrayBuffer }[];
}

@Component({
  selector: 'app-split',
  standalone: true,
  imports: [RouterLink, FormsModule, FileDropzoneComponent, NgxExtendedPdfViewerModule, PdfCardGridComponent],
  templateUrl: './split.component.html',
  styleUrl: './split.component.scss',
})
export class SplitComponent implements OnInit, OnDestroy {
  private readonly worker = inject(PdfWorkerService);
  private readonly downloads = inject(DownloadService);
  private readonly fileService = inject(FileService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly toasts = inject(ToastService);

  readonly cardGrid = viewChild<PdfCardGridComponent>('cardGrid');

  readonly mode = signal<'extract' | 'every'>('extract');
  readonly range = signal('1-3, 5');
  readonly loadedFile = signal<LoadedFile | null>(null);
  readonly pageCount = signal<number>(0);
  readonly selectedPages = signal<number[]>([]);
  readonly downloadAsZip = signal<boolean>(true);
  readonly splitting = signal<boolean>(false);
  readonly splitResult = signal<SplitResult | null>(null);
  readonly showConfirmExportModal = signal<boolean>(false);

  // Live PDF Viewer preview state
  readonly docUrl = signal<string | null>(null);
  readonly currentPreviewPage = signal<number>(1);
  readonly showLivePreview = signal<boolean>(true);

  // Pages per row in split preview: 1, 2, 3, 4, 5
  readonly pagesPerRow = signal<number>(2);

  protected readonly formatBytes = formatBytes;

  readonly pagesList = computed(() => {
    const count = this.pageCount();
    return Array.from({ length: count }, (_, i) => i + 1);
  });

  setPagesPerRow(val: number): void {
    this.pagesPerRow.set(val);
  }

  ngOnInit(): void {
    this.route.queryParams.subscribe((params) => {
      if (params['mode'] === 'every') {
        this.mode.set('every');
      } else {
        this.mode.set('extract');
      }
    });
  }

  setMode(m: 'extract' | 'every'): void {
    this.mode.set(m);
    this.splitResult.set(null);
    this.showConfirmExportModal.set(false);
  }

  toggleLivePreview(): void {
    this.showLivePreview.update((v) => !v);
  }

  async onFileLoaded(files: LoadedFile[]): Promise<void> {
    if (!files || files.length === 0) return;
    const file = files[0];
    try {
      const doc = await PDFDocument.load(file.data, { ignoreEncryption: true });
      const count = doc.getPageCount();
      this.loadedFile.set(file);
      this.pageCount.set(count);
      this.splitResult.set(null);

      // Create live preview Blob URL
      const oldUrl = this.docUrl();
      if (oldUrl) {
        URL.revokeObjectURL(oldUrl);
      }
      const blob = new Blob([file.data], { type: 'application/pdf' });
      const newUrl = URL.createObjectURL(blob);
      this.docUrl.set(newUrl);
      this.currentPreviewPage.set(1);

      // Default selection to first half or first 3 pages
      const initialCount = Math.min(count, 3);
      const initial = Array.from({ length: initialCount }, (_, i) => i + 1);
      this.selectedPages.set(initial);
      this.syncRangeFromSelectedPages();

      this.toasts.info(`Loaded "${file.name}" (${count} pages)`);
    } catch (err) {
      console.error('[SplitComponent] Failed to load PDF:', err);
      this.toasts.error('Failed to parse PDF document.');
    }
  }

  clearFile(): void {
    const oldUrl = this.docUrl();
    if (oldUrl) {
      URL.revokeObjectURL(oldUrl);
      this.docUrl.set(null);
    }
    this.loadedFile.set(null);
    this.pageCount.set(0);
    this.selectedPages.set([]);
    this.splitResult.set(null);
  }

  togglePageSelection(pageNum: number): void {
    this.selectedPages.update((curr) => {
      if (curr.includes(pageNum)) {
        return curr.filter((p) => p !== pageNum);
      } else {
        return [...curr, pageNum].sort((a, b) => a - b);
      }
    });
    this.syncRangeFromSelectedPages();
  }

  selectAndPreviewPage(pageNum: number): void {
    this.togglePageSelection(pageNum);
    this.scrollToPage(pageNum);
  }

  scrollToPage(pageNum: number, event?: Event): void {
    event?.stopPropagation();
    if (!this.showLivePreview()) {
      this.showLivePreview.set(true);
    }
    this.currentPreviewPage.set(pageNum);
    setTimeout(() => {
      this.cardGrid()?.scrollToPage(pageNum);
    }, 50);
  }

  togglePageSelectionFromChip(pageNum: number, event?: Event): void {
    event?.stopPropagation();
    this.togglePageSelection(pageNum);
  }

  previewOnly(pageNum: number, event: Event): void {
    this.scrollToPage(pageNum, event);
  }

  onViewerPageChange(newPage: number | undefined): void {
    if (newPage && newPage >= 1 && newPage <= this.pageCount()) {
      this.currentPreviewPage.set(newPage);
    }
  }

  toggleCurrentPageSelection(): void {
    const cur = this.currentPreviewPage();
    if (cur >= 1 && cur <= this.pageCount()) {
      this.togglePageSelection(cur);
    }
  }

  isPageSelected(pageNum: number): boolean {
    return this.selectedPages().includes(pageNum);
  }

  selectAllPages(): void {
    const total = this.pageCount();
    this.selectedPages.set(Array.from({ length: total }, (_, i) => i + 1));
    this.syncRangeFromSelectedPages();
  }

  deselectAllPages(): void {
    this.selectedPages.set([]);
    this.range.set('');
  }

  invertPageSelection(): void {
    const total = this.pageCount();
    const curr = new Set(this.selectedPages());
    const inverted: number[] = [];
    for (let i = 1; i <= total; i++) {
      if (!curr.has(i)) inverted.push(i);
    }
    this.selectedPages.set(inverted);
    this.syncRangeFromSelectedPages();
  }

  selectOddPages(): void {
    const total = this.pageCount();
    const odds = Array.from({ length: total }, (_, i) => i + 1).filter((p) => p % 2 !== 0);
    this.selectedPages.set(odds);
    this.syncRangeFromSelectedPages();
  }

  selectEvenPages(): void {
    const total = this.pageCount();
    const evens = Array.from({ length: total }, (_, i) => i + 1).filter((p) => p % 2 === 0);
    this.selectedPages.set(evens);
    this.syncRangeFromSelectedPages();
  }

  applyPreset(type: 'all' | 'odd' | 'even' | 'first-half'): void {
    const total = this.pageCount();
    if (total <= 0) return;
    if (type === 'all') {
      this.selectAllPages();
    } else if (type === 'odd') {
      this.selectOddPages();
    } else if (type === 'even') {
      this.selectEvenPages();
    } else if (type === 'first-half') {
      const mid = Math.max(1, Math.ceil(total / 2));
      this.selectedPages.set(Array.from({ length: mid }, (_, i) => i + 1));
      this.syncRangeFromSelectedPages();
    }
  }

  onRangeInput(val: string): void {
    this.range.set(val);
    const total = this.pageCount();
    if (total <= 0) return;
    const parts = val.split(',').map((p) => p.trim()).filter(Boolean);
    const selected = new Set<number>();
    for (const part of parts) {
      const indices = parsePageRange(part, total);
      indices.forEach((idx) => selected.add(idx + 1));
    }
    this.selectedPages.set(Array.from(selected).sort((a, b) => a - b));
  }

  private syncRangeFromSelectedPages(): void {
    const pages = [...this.selectedPages()].sort((a, b) => a - b);
    if (pages.length === 0) {
      this.range.set('');
      return;
    }
    const ranges: string[] = [];
    let start = pages[0];
    let prev = pages[0];

    for (let i = 1; i < pages.length; i++) {
      const cur = pages[i];
      if (cur === prev + 1) {
        prev = cur;
      } else {
        ranges.push(start === prev ? `${start}` : `${start}-${prev}`);
        start = cur;
        prev = cur;
      }
    }
    ranges.push(start === prev ? `${start}` : `${start}-${prev}`);
    this.range.set(ranges.join(', '));
  }

  async split(): Promise<void> {
    const file = this.loadedFile();
    const total = this.pageCount();
    const mode = this.mode();
    if (!file || total <= 0) {
      this.toasts.warning('Please select a valid PDF to split.');
      return;
    }

    if (mode === 'extract' && this.selectedPages().length === 0) {
      this.toasts.warning('Please select at least one page to extract.');
      return;
    }

    // If user chooses Split Every Page without ZIP, prompt confirmation modal first
    if (mode === 'every' && !this.downloadAsZip()) {
      this.showConfirmExportModal.set(true);
      return;
    }

    await this.executeSplit();
  }

  confirmSeparateExport(): void {
    this.showConfirmExportModal.set(false);
    void this.executeSplit();
  }

  confirmWithZip(): void {
    this.showConfirmExportModal.set(false);
    this.downloadAsZip.set(true);
    void this.executeSplit();
  }

  cancelExport(): void {
    this.showConfirmExportModal.set(false);
    this.toasts.info('Export cancelled. Tip: Select the ZIP option if you want to export multiple separate files.');
  }

  private async executeSplit(): Promise<void> {
    const file = this.loadedFile();
    const total = this.pageCount();
    const mode = this.mode();
    if (!file || total <= 0) return;

    let ranges: number[][] = [];

    if (mode === 'every') {
      ranges = Array.from({ length: total }, (_, i) => [i]);
    } else {
      const selected = this.selectedPages();
      if (selected.length === 0) {
        this.toasts.warning('Please select at least one page to extract.');
        return;
      }
      // Mode 'extract': combines all chosen pages / ranges into ONE unified new PDF
      ranges = [selected.map((p) => p - 1)];
    }

    this.splitting.set(true);
    try {
      const sourceBytes = new Uint8Array(file.data);
      const results = await this.worker.splitPdf(sourceBytes, ranges);

      if (results.length === 0) {
        this.toasts.warning('No pages were extracted.');
        return;
      }

      const baseName = file.name.replace(/\.pdf$/i, '');
      const individualFiles: { name: string; blob: Blob; data: ArrayBuffer }[] = [];

      for (let i = 0; i < results.length; i++) {
        const splitBytes = results[i];
        const data = splitBytes.buffer.slice(
          splitBytes.byteOffset,
          splitBytes.byteOffset + splitBytes.byteLength,
        ) as ArrayBuffer;
        const blob = new Blob([splitBytes as BlobPart], { type: 'application/pdf' });

        const name = mode === 'every'
          ? `${baseName}-page-${i + 1}.pdf`
          : `${baseName}-extracted.pdf`;

        individualFiles.push({ name, blob, data });
      }

      let zipBlob: Blob | undefined;
      let zipFilename: string | undefined;

      if (results.length > 1) {
        const zipEntries: ZipEntry[] = individualFiles.map((f, idx) => ({
          path: f.name,
          data: results[idx],
        }));
        zipBlob = createZipBlob(zipEntries);
        zipFilename = `${baseName}-${mode === 'every' ? 'split' : 'extracted'}.zip`;
      }

      const result: SplitResult = {
        mode,
        count: results.length,
        individualFiles,
        zipBlob,
        zipFilename,
        singleBlob: results.length === 1 ? individualFiles[0].blob : undefined,
        singleFilename: results.length === 1 ? individualFiles[0].name : undefined,
        singleBuffer: results.length === 1 ? individualFiles[0].data : undefined,
      };

      this.splitResult.set(result);

      if (mode === 'extract') {
        this.toasts.success('Pages extracted successfully! Ready for download.');
      } else if (results.length > 1 && zipBlob && zipFilename) {
        this.toasts.success(`Document split into ${results.length} files and packaged as ZIP! Ready for download.`);
      } else {
        this.toasts.success(`Document split into ${results.length} files successfully! Ready for download.`);
      }
    } catch (err) {
      console.error('[SplitComponent] Split failed:', err);
      this.toasts.error(err instanceof Error ? err.message : 'Failed to split PDF.');
    } finally {
      this.splitting.set(false);
    }
  }

  downloadZip(): void {
    const res = this.splitResult();
    if (!res) return;

    if (res.zipBlob && res.zipFilename) {
      this.downloads.download(res.zipBlob, res.zipFilename);
      this.toasts.success(`Downloaded "${res.zipFilename}"`);
    } else if (res.individualFiles.length > 1) {
      const baseName = (this.loadedFile()?.name || 'document').replace(/\.pdf$/i, '');
      const zipEntries: ZipEntry[] = res.individualFiles.map((f) => ({
        path: f.name,
        data: new Uint8Array(f.data),
      }));
      const blob = createZipBlob(zipEntries);
      const filename = `${baseName}-split.zip`;
      this.downloads.download(blob, filename);
      this.toasts.success(`Downloaded "${filename}"`);
    }
  }

  downloadSingleFile(fileItem: { name: string; blob: Blob }): void {
    this.downloads.download(fileItem.blob, fileItem.name);
    this.toasts.success(`Downloaded "${fileItem.name}"`);
  }

  downloadAllIndividualFiles(): void {
    const res = this.splitResult();
    if (!res) return;
    for (const item of res.individualFiles) {
      this.downloads.download(item.blob, item.name);
    }
    this.toasts.success(`Started downloading ${res.individualFiles.length} files`);
  }

  async openInEditor(targetFile?: { name: string; data: ArrayBuffer }): Promise<void> {
    const res = this.splitResult();
    if (!res) return;

    let target: { name: string; data: ArrayBuffer } | undefined = targetFile;
    if (!target) {
      if (res.singleFilename && res.singleBuffer) {
        target = { name: res.singleFilename, data: res.singleBuffer };
      } else if (res.individualFiles.length > 0) {
        target = {
          name: res.individualFiles[0].name,
          data: res.individualFiles[0].data,
        };
      }
    }

    if (!target) return;

    const file = new File([target.data], target.name, { type: 'application/pdf' });
    const loaded: LoadedFile = {
      file,
      name: target.name,
      sizeBytes: target.data.byteLength,
      data: target.data,
      loadedAt: Date.now(),
    };

    this.fileService.setCurrent([loaded]);
    this.toasts.info('Opening document in PDF Editor…');
    await this.router.navigate(['/editor']);
  }

  resetForAnother(): void {
    this.splitResult.set(null);
  }

  ngOnDestroy(): void {
    const oldUrl = this.docUrl();
    if (oldUrl) {
      URL.revokeObjectURL(oldUrl);
    }
  }
}
