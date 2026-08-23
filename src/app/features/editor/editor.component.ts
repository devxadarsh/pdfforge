import { Component, signal, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgClass, KeyValuePipe } from '@angular/common';
import { EDITOR_TOOLS } from '../../core/constants/tools';
import { PdfToolId } from '../../core/models/pdf.models';
import { FileDropzoneComponent } from '../../shared/components/dropzone/file-dropzone.component';
import { LoadedFile } from '../../core/models/file.models';

@Component({
  selector: 'app-editor',
  standalone: true,
  imports: [RouterLink, NgClass, KeyValuePipe, FileDropzoneComponent],
  templateUrl: './editor.component.html',
  styleUrl: './editor.component.scss',
})
export class EditorComponent {
  readonly tools = EDITOR_TOOLS;
  readonly activeTool = signal<PdfToolId>('select');
  readonly loadedFileName = signal<string | null>(null);

  readonly toolGroups = computed(() => {
    const groups: Record<string, typeof this.tools> = {};
    for (const t of this.tools) {
      (groups[t.group] ??= []).push(t);
    }
    return groups;
  });

  selectTool(id: PdfToolId): void {
    this.activeTool.set(id);
  }

  onFiles(loaded: LoadedFile[]): void {
    const file = loaded[0];
    if (file) {
      this.loadedFileName.set(file.name);
    }
  }
}
