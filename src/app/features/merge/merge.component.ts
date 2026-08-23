import { Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgClass } from '@angular/common';
import { FileDropzoneComponent } from '../../shared/components/dropzone/file-dropzone.component';
import { LoadedFile } from '../../core/models/file.models';
import { formatBytes } from '../../core/utilities/file.util';

interface MergeItem {
  readonly id: string;
  name: string;
  sizeBytes: number;
}

@Component({
  selector: 'app-merge',
  standalone: true,
  imports: [RouterLink, NgClass, FileDropzoneComponent],
  templateUrl: './merge.component.html',
  styleUrl: './merge.component.scss',
})
export class MergeComponent {
  readonly items = signal<MergeItem[]>([]);
  protected readonly formatBytes = formatBytes;

  addFiles(files: LoadedFile[]): void {
    const next = files.map((f) => ({
      id: crypto.randomUUID(),
      name: f.name,
      sizeBytes: f.sizeBytes,
    }));
    this.items.update((list) => [...list, ...next]);
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

  private swap(list: MergeItem[], a: number, b: number): MergeItem[] {
    if (a < 0 || b < 0 || a >= list.length || b >= list.length) {
      return list;
    }
    const copy = [...list];
    [copy[a], copy[b]] = [copy[b], copy[a]];
    return copy;
  }
}
