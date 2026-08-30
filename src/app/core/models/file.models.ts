import { PdfAnnotation } from './pdf.models';

export interface StoredPageLayout {
  readonly id: string;
  readonly sourceIndex: number;
  readonly rotation: number;
}

export interface StoredEditorState {
  readonly pages?: StoredPageLayout[];
  readonly annotations?: Record<string, PdfAnnotation[]>;
  readonly currentId?: string | null;
}

export interface LoadedFile {
  readonly file: File;
  readonly name: string;
  readonly sizeBytes: number;
  readonly data: ArrayBuffer;
  readonly loadedAt: number;
  readonly editorState?: StoredEditorState;
}
