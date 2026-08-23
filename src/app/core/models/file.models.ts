// File-handling domain models

export interface LoadedFile {
  readonly file: File;
  readonly name: string;
  readonly sizeBytes: number;
  readonly data: ArrayBuffer;
  readonly loadedAt: number;
}
