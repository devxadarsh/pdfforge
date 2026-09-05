import { Component, signal, computed, inject, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DragDropModule, CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { PDFDocument } from 'pdf-lib';
import { NgxExtendedPdfViewerModule } from 'ngx-extended-pdf-viewer';
import { FileDropzoneComponent } from '../../shared/components/dropzone/file-dropzone.component';
import { PdfCardGridComponent } from '../../shared/components/pdf-card-grid/pdf-card-grid.component';
import { LoadedFile } from '../../core/models/file.models';
import { formatBytes } from '../../core/utilities/file.util';
import { PdfWorkerService } from '../../core/services/worker/pdf-worker.service';
import { DownloadService } from '../../core/services/download/download.service';
import { FileService } from '../../core/services/file/file.service';
import { ToastService } from '../../core/services/toast.service';

import { BreadcrumbsComponent } from '../../shared/components/breadcrumbs/breadcrumbs.component';
import { ToolSeoContentComponent } from '../../shared/components/tool-seo-content/tool-seo-content.component';
import { SeoService } from '../../core/services/seo/seo.service';
import { SEO_CONFIGS } from '../../core/constants/seo-data';

export interface MergeItem {
  id: string;
  name: string;
  sizeBytes: number;
  data: ArrayBuffer;
  pageCount: number;
}

export interface MergedResult {
  readonly blob: Blob;
  readonly filename: string;
  readonly pageCount: number;
  readonly sizeBytes: number;
  readonly data: ArrayBuffer;
}

@Component({
  selector: 'app-merge',
  standalone: true,
  imports: [
    FormsModule,
    DragDropModule,
    FileDropzoneComponent,
    NgxExtendedPdfViewerModule,
    PdfCardGridComponent,
    BreadcrumbsComponent,
    ToolSeoContentComponent,
  ],
  templateUrl: './merge.component.html',
  styleUrl: './merge.component.scss',
})
export class MergeComponent implements OnDestroy {
  private readonly worker = inject(PdfWorkerService);
  private readonly downloads = inject(DownloadService);
  private readonly fileService = inject(FileService);
  private readonly router = inject(Router);
  private readonly toasts = inject(ToastService);
  private readonly seo = inject(SeoService);

  readonly seoConfig = SEO_CONFIGS['merge'];

  constructor() {
    this.seo.updatePage(this.seoConfig);
  }

  readonly items = signal<MergeItem[]>([]);
  readonly merging = signal<boolean>(false);
  readonly outputFilename = signal<string>('merged-document.pdf');
  readonly previewItem = signal<MergeItem | null>(null);
  readonly previewBlobUrl = signal<string | null>(null);
  readonly mergedResult = signal<MergedResult | null>(null);

  // Pages per row in preview: 1, 2, 3, 4, 5
  readonly mergePagesPerRow = signal<number>(2);

  protected readonly formatBytes = formatBytes;

  readonly totalBytes = computed(() =>
    this.items().reduce((acc, i) => acc + i.sizeBytes, 0),
  );

  readonly totalPageCount = computed(() =>
    this.items().reduce((acc, i) => acc + i.pageCount, 0),
  );

  setMergePagesPerRow(val: number): void {
    this.mergePagesPerRow.set(val);
  }

  clearAll(): void {
    this.items.set([]);
    this.closePreview();
    this.mergedResult.set(null);
  }

  async addFiles(files: LoadedFile[]): Promise<void> {
    const next: MergeItem[] = [];
    for (const f of files) {
      let pages = 1;
      try {
        const doc = await PDFDocument.load(f.data, { ignoreEncryption: true });
        pages = doc.getPageCount();
      } catch {
        pages = 1;
      }
      next.push({
        id: crypto.randomUUID(),
        name: f.name,
        sizeBytes: f.sizeBytes,
        data: f.data,
        pageCount: pages,
      });
    }

    this.items.update((list) => [...list, ...next]);
    this.toasts.info(`Added ${files.length} file(s) to merge list.`);
  }

  remove(id: string): void {
    if (this.previewItem()?.id === id) {
      this.closePreview();
    }
    this.items.update((list) => list.filter((i) => i.id !== id));
  }

  moveUp(index: number): void {
    this.items.update((list) => this.swap(list, index, index - 1));
  }

  moveDown(index: number): void {
    this.items.update((list) => this.swap(list, index, index + 1));
  }

  sortByName(ascending = true): void {
    this.items.update((list) => {
      const copy = [...list];
      copy.sort((a, b) =>
        ascending
          ? a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
          : b.name.localeCompare(a.name, undefined, { numeric: true, sensitivity: 'base' }),
      );
      return copy;
    });
    this.toasts.info(`Files sorted ${ascending ? 'A to Z' : 'Z to A'}.`);
  }

  reverseOrder(): void {
    this.items.update((list) => [...list].reverse());
    this.toasts.info('File order reversed.');
  }

  openPreview(item: MergeItem): void {
    const oldUrl = this.previewBlobUrl();
    if (oldUrl) {
      URL.revokeObjectURL(oldUrl);
    }
    const blob = new Blob([item.data], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    this.previewBlobUrl.set(url);
    this.previewItem.set(item);
  }

  closePreview(): void {
    const oldUrl = this.previewBlobUrl();
    if (oldUrl) {
      URL.revokeObjectURL(oldUrl);
      this.previewBlobUrl.set(null);
    }
    this.previewItem.set(null);
  }

  onDrop(event: CdkDragDrop<MergeItem[]>): void {
    if (event.previousIndex === event.currentIndex) return;
    this.items.update((list) => {
      const copy = [...list];
      moveItemInArray(copy, event.previousIndex, event.currentIndex);
      return copy;
    });
  }

  private swap(list: MergeItem[], a: number, b: number): MergeItem[] {
    if (a < 0 || b < 0 || a >= list.length || b >= list.length) {
      return list;
    }
    const copy = [...list];
    [copy[a], copy[b]] = [copy[b], copy[a]];
    return copy;
  }

  async merge(): Promise<void> {
    const current = this.items();
    if (current.length < 2) {
      this.toasts.warning('Please add at least 2 PDF files to merge.');
      return;
    }

    this.merging.set(true);
    try {
      const workerFiles = current.map((item) => ({
        name: item.name,
        bytes: new Uint8Array(item.data),
      }));

      const mergedBytes = await this.worker.mergePdfs(workerFiles);
      const dataBuffer = mergedBytes.buffer.slice(
        mergedBytes.byteOffset,
        mergedBytes.byteOffset + mergedBytes.byteLength,
      ) as ArrayBuffer;

      const blob = new Blob([mergedBytes as BlobPart], { type: 'application/pdf' });
      let finalName = this.outputFilename().trim();
      if (!finalName) finalName = 'merged-document.pdf';
      if (!finalName.toLowerCase().endsWith('.pdf')) finalName += '.pdf';

      const result: MergedResult = {
        blob,
        filename: finalName,
        pageCount: this.totalPageCount(),
        sizeBytes: mergedBytes.byteLength,
        data: dataBuffer,
      };

      this.mergedResult.set(result);
      this.toasts.success('PDFs merged successfully!');
    } catch (err) {
      console.error('[MergeComponent] Merge error:', err);
      this.toasts.error(err instanceof Error ? err.message : 'Merge failed.');
    } finally {
      this.merging.set(false);
    }
  }

  downloadResult(): void {
    const res = this.mergedResult();
    if (!res) return;
    this.downloads.download(res.blob, res.filename);
    this.toasts.success(`Downloaded "${res.filename}"`);
  }

  async openInEditor(): Promise<void> {
    const res = this.mergedResult();
    if (!res) return;
    const file = new File([res.blob], res.filename, { type: 'application/pdf' });
    const loaded: LoadedFile = {
      file,
      name: res.filename,
      sizeBytes: res.sizeBytes,
      data: res.data,
      loadedAt: Date.now(),
    };
    this.fileService.setCurrent([loaded]);
    this.toasts.info('Opening merged document in PDF Editor…');
    await this.router.navigate(['/editor']);
  }

  resetForAnother(): void {
    this.mergedResult.set(null);
  }

  async onAddMoreFiles(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;

    const files: LoadedFile[] = [];
    for (let i = 0; i < input.files.length; i++) {
      const file = input.files[i];
      const buffer = await file.arrayBuffer();
      files.push({
        file,
        name: file.name,
        sizeBytes: file.size,
        data: buffer,
        loadedAt: Date.now(),
      });
    }

    await this.addFiles(files);
    input.value = '';
  }

  ngOnDestroy(): void {
    const oldUrl = this.previewBlobUrl();
    if (oldUrl) {
      URL.revokeObjectURL(oldUrl);
    }
  }
}
