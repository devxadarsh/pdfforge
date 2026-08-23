import {
  Component,
  signal,
  output,
  inject,
  ElementRef,
  viewChild,
  NgZone,
  input,
} from '@angular/core';
import { FileService } from '../../../core/services/file/file.service';
import { LoadedFile } from '../../../core/models/file.models';
import { formatBytes } from '../../../core/utilities/file.util';

@Component({
  selector: 'app-file-dropzone',
  standalone: true,
  templateUrl: './file-dropzone.component.html',
  styleUrl: './file-dropzone.component.scss',
})
export class FileDropzoneComponent {
  private readonly files = inject(FileService);
  private readonly zone = inject(NgZone);
  private readonly fileInput =
    viewChild.required<ElementRef<HTMLInputElement>>('fileInput');

  readonly dragging = signal(false);
  readonly multiple = input(false);
  readonly accept = input('application/pdf,.pdf');
  readonly label = input('Drop a PDF here or click to browse');

  readonly filesLoaded = output<LoadedFile[]>();

  openPicker(): void {
    this.fileInput().nativeElement.click();
  }

  onInputChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = input.files ? Array.from(input.files) : [];
    void this.handleFiles(files);
    input.value = '';
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(true);
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(false);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(false);
    const files = event.dataTransfer ? Array.from(event.dataTransfer.files) : [];
    void this.handleFiles(files);
  }

  private async handleFiles(files: File[]): Promise<void> {
    if (!files.length) {
      return;
    }
    const loaded = await this.files.loadFiles(files);
    if (loaded.length) {
      this.zone.run(() => this.filesLoaded.emit(loaded));
    }
  }

  protected readonly formatBytes = formatBytes;
}
