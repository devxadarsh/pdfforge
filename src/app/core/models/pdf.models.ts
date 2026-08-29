// PDFForge domain models

export type PdfToolId =
  | 'select'
  | 'hand'
  | 'text'
  | 'highlight'
  | 'underline'
  | 'strikethrough'
  | 'pen'
  | 'freehand'
  | 'eraser'
  | 'line'
  | 'rectangle'
  | 'circle'
  | 'arrow'
  | 'image'
  | 'signature'
  | 'stamp'
  | 'comment';

export type AnnotationType =
  | 'text'
  | 'highlight'
  | 'underline'
  | 'strikethrough'
  | 'drawing'
  | 'shape'
  | 'image'
  | 'signature'
  | 'stamp'
  | 'comment';

export type ShapeKind = 'rectangle' | 'circle' | 'arrow' | 'line';

export type EraserMode = 'stroke' | 'segment';
export type EraserTarget = 'all' | 'drawing' | 'highlight';

export interface EraserSettings {
  mode: EraserMode;
  size: number;
  tolerance: number;
  target: EraserTarget;
}

export type EditorTheme = 'light' | 'dark' | 'system';

export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PdfPage {
  readonly index: number;
  readonly width: number;
  readonly height: number;
  rotation: 0 | 90 | 180 | 270;
  label?: string;
}

export interface PageSelection {
  readonly pageIndexes: ReadonlyArray<number>;
}

export interface BaseAnnotation {
  readonly id: string;
  readonly type: AnnotationType;
  pageIndex: number;
  rect: Rect;
  rotation: number;
  opacity: number;
  createdAt: number;
  locked?: boolean;
}

export type TextTransform = 'none' | 'uppercase' | 'lowercase' | 'capitalize';

export interface TextAnnotation extends BaseAnnotation {
  type: 'text';
  text: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  italic: boolean;
  underline: boolean;
  align: 'left' | 'center' | 'right';
  color: string;
  backgroundColor?: string;
  /** Extra breathing room, in overlay pixels, around a visible text background. */
  backgroundPadding?: number;
  transform?: TextTransform;
  lineHeight?: number;
  letterSpacing?: number;
}

export interface HighlightAnnotation extends BaseAnnotation {
  type: 'highlight' | 'underline' | 'strikethrough';
  color: string;
  quote: string;
}

export interface DrawingAnnotation extends BaseAnnotation {
  type: 'drawing';
  kind: 'freehand' | 'pen';
  color: string;
  strokeWidth: number;
  points: ReadonlyArray<Point>;
}

export interface ShapeAnnotation extends BaseAnnotation {
  type: 'shape';
  kind: ShapeKind;
  strokeColor: string;
  fillColor: string;
  strokeWidth: number;
  strokeStyle: 'solid' | 'dashed' | 'dotted';
}

export interface ImageAnnotation extends BaseAnnotation {
  type: 'image';
  dataUrl: string;
  naturalWidth: number;
  naturalHeight: number;
}

export interface SignatureAnnotation extends BaseAnnotation {
  type: 'signature';
  dataUrl: string;
  naturalWidth: number;
  naturalHeight: number;
}

export interface StampAnnotation extends BaseAnnotation {
  type: 'stamp';
  text: string;
  color: string;
}

export interface CommentAnnotation extends BaseAnnotation {
  type: 'comment';
  text: string;
  author: string;
}

export type PdfAnnotation =
  | TextAnnotation
  | HighlightAnnotation
  | DrawingAnnotation
  | ShapeAnnotation
  | ImageAnnotation
  | SignatureAnnotation
  | StampAnnotation
  | CommentAnnotation;

export interface ViewportState {
  zoom: number;
  fitMode: 'none' | 'width' | 'page';
  panX: number;
  panY: number;
}

export interface EditorTool {
  readonly id: PdfToolId;
  readonly label: string;
  readonly icon: string;
  readonly shortcut?: string;
  readonly group: 'navigation' | 'content' | 'shapes' | 'media';
}

export interface PdfProcessingJob {
  readonly id: string;
  readonly kind: string;
  readonly startedAt: number;
  progress: number;
  status: 'pending' | 'running' | 'done' | 'error';
  error?: string;
}

export interface PdfProcessingResult {
  readonly blob: Blob;
  readonly fileName: string;
  readonly byteSize: number;
}

export interface PdfMetadata {
  title?: string;
  author?: string;
  subject?: string;
  keywords?: string;
  creator?: string;
  producer?: string;
  creationDate?: string;
  modificationDate?: string;
  pageCount: number;
  encrypted: boolean;
}

export interface RecentDocument {
  readonly id: string;
  readonly name: string;
  readonly sizeBytes: number;
  readonly addedAt: number;
  readonly pageCount?: number;
  readonly dataUrl?: string;
}

export interface EditorState {
  readonly currentTool: PdfToolId;
  readonly currentPage: number;
  readonly selectedAnnotationIds: ReadonlyArray<string>;
  readonly selectedPageIndexes: ReadonlyArray<number>;
  readonly modified: boolean;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
}
