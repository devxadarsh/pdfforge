import { Component, signal, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DragDropModule, CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { FileDropzoneComponent } from '../../shared/components/dropzone/file-dropzone.component';
import { LoadedFile } from '../../core/models/file.models';
import { formatBytes } from '../../core/utilities/file.util';
import { PdfWorkerService } from '../../core/services/worker/pdf-worker.service';
import { DownloadService } from '../../core/services/download/download.service';
import { ToastService } from '../../core/services/toast.service';

interface MergeItem {
  readonly id: string;
  name: string;
  sizeBytes: number;
  data: ArrayBuffer;
}

@Component({
  selector: 'app-merge',
  standalone: true,
  imports: [RouterLink, DragDropModule, FileDropzoneComponent],
  templateUrl: './merge.component.html',
  styleUrl: './merge.component.scss',
})
export class MergeComponent {
  private readonly worker = inject(PdfWorkerService);
  private readonly downloads = inject(DownloadService);
  private readonly toasts = inject(ToastService);

  readonly items = signal<MergeItem[]>([]);
  readonly merging = signal<boolean>(false);
  protected readonly formatBytes = formatBytes;

  readonly totalBytes = () => this.items().reduce((acc, i) => acc + i.sizeBytes, 0);

  clearAll(): void {
    this.items.set([]);
  }

  addFiles(files: LoadedFile[]): void {
    const next = files.map((f) => ({
      id: crypto.randomUUID(),
      name: f.name,
      sizeBytes: f.sizeBytes,
      data: f.data,
    }));
    this.items.update((list) => [...list, ...next]);
    this.toasts.info(`Added ${files.length} file(s) to merge list.`);
  }

  remove(id: string): void {
    this.items.update((list) => list.filter((i) => i.id !== id));
  }

  moveUp(index: number): void {
    this.items.update((list) => this.swap(list, index, index - 1));
  }

  moveDown(index: number): void {
    this.items.update((list) => this.swap(list, index, index + 1));
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
      const blob = new Blob([mergedBytes as BlobPart], { type: 'application/pdf' });
      this.downloads.download(blob, 'merged-document.pdf');
      this.toasts.success('PDFs merged successfully!');
    } catch (err) {
      console.error('[MergeComponent] Merge error:', err);
      this.toasts.error(err instanceof Error ? err.message : 'Merge failed.');
    } finally {
      this.merging.set(false);
    }
  }
}
