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
  | 'shape'
  | 'icon'
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

export type ShapeCategory =
  | 'basic'
  | 'arrows'
  | 'flowchart'
  | 'callouts'
  | 'symbols'
  | 'banners'
  | 'ui'
  | 'math'
  | 'tech';

export type ShapeKind =
  // 1. Basic Geometric & Polygons (20)
  | 'rectangle'
  | 'square'
  | 'rounded-rectangle'
  | 'circle'
  | 'ellipse'
  | 'semi-circle'
  | 'triangle'
  | 'triangle-right'
  | 'diamond'
  | 'parallelogram'
  | 'trapezoid'
  | 'pentagon'
  | 'hexagon'
  | 'heptagon'
  | 'octagon'
  | 'decagon'
  | 'cross-poly'
  | 'ring-donut'
  | 'teardrop'
  | 'corner-cut-rect'

  // 2. Arrows & Directions (18)
  | 'arrow'
  | 'line'
  | 'arrow-right'
  | 'arrow-left'
  | 'arrow-up'
  | 'arrow-down'
  | 'arrow-up-down'
  | 'arrow-left-right'
  | 'arrow-double'
  | 'arrow-curved'
  | 'arrow-circular'
  | 'arrow-uturn'
  | 'arrow-split'
  | 'arrow-fork'
  | 'arrow-quad'
  | 'chevron'
  | 'chevron-double'
  | 'arrow-bent'
  | 'arrow-step'
  | 'arrow-callout'

  // 3. Diagram & Flowchart (18)
  | 'flow-process'
  | 'flow-decision'
  | 'flow-terminator'
  | 'flow-data'
  | 'flow-document'
  | 'flow-multi-document'
  | 'flow-database'
  | 'flow-predefined'
  | 'flow-manual-input'
  | 'flow-manual-operation'
  | 'flow-delay'
  | 'flow-connector'
  | 'flow-off-page'
  | 'flow-preparation'
  | 'flow-internal-storage'
  | 'flow-summing'
  | 'flow-collate'
  | 'flow-display'

  // 4. Callouts & Speech (16)
  | 'callout-speech'
  | 'callout-thought'
  | 'callout-cloud'
  | 'callout-rect'
  | 'callout-rounded'
  | 'callout-oval'
  | 'callout-left'
  | 'callout-right'
  | 'callout-arrow'
  | 'callout-shout'
  | 'callout-caption'
  | 'callout-label'
  | 'callout-price-tag'
  | 'callout-bracket'
  | 'callout-curly-left'
  | 'callout-curly-right'

  // 5. Symbols & Decorative (20)
  | 'symbol-star'
  | 'symbol-star-4'
  | 'symbol-star-6'
  | 'symbol-star-8'
  | 'symbol-heart'
  | 'symbol-cross'
  | 'symbol-plus'
  | 'symbol-minus'
  | 'symbol-lightning'
  | 'symbol-cloud'
  | 'symbol-sun'
  | 'symbol-moon'
  | 'symbol-checkmark'
  | 'symbol-warning'
  | 'symbol-prohibited'
  | 'symbol-info'
  | 'symbol-help'
  | 'symbol-location'
  | 'symbol-flame'
  | 'symbol-droplet'

  // 6. Banners, Ribbons & Badges (14)
  | 'banner-classic'
  | 'banner-curved-up'
  | 'banner-curved-down'
  | 'banner-swallowtail'
  | 'banner-ribbon-folded'
  | 'badge-starburst'
  | 'badge-rosette'
  | 'badge-shield'
  | 'badge-seal'
  | 'badge-award'
  | 'ribbon-bookmark'
  | 'ribbon-vertical'
  | 'tag-discount'
  | 'ticket-voucher'

  // 7. UI & Wireframe Elements (16)
  | 'ui-browser'
  | 'ui-mobile'
  | 'ui-tablet'
  | 'ui-card'
  | 'ui-modal'
  | 'ui-button'
  | 'ui-pill'
  | 'ui-input'
  | 'ui-toggle-on'
  | 'ui-toggle-off'
  | 'ui-progress'
  | 'ui-tab'
  | 'ui-tooltip'
  | 'ui-flag'
  | 'ui-shield'
  | 'ui-gear'
  | 'ui-badge'
  | 'ui-ribbon'
  | 'ui-bookmark'
  | 'ui-ticket'
  | 'ui-cylinder'

  // 8. Math, Science & 3D (14)
  | 'math-infinity'
  | 'math-pi'
  | 'math-delta'
  | 'math-sqrt'
  | 'math-integral'
  | 'math-angle'
  | 'math-venn'
  | 'math-grid'
  | 'math-cube'
  | 'math-cylinder'
  | 'math-cone'
  | 'math-pyramid'
  | 'math-sphere'
  | 'math-coordinate'

  // 9. Tech & Cloud Architecture (14)
  | 'tech-cloud-cluster'
  | 'tech-server-rack'
  | 'tech-database-cluster'
  | 'tech-firewall'
  | 'tech-router'
  | 'tech-switch'
  | 'tech-desktop'
  | 'tech-laptop'
  | 'tech-mobile-device'
  | 'tech-key-auth'
  | 'tech-lock-secure'
  | 'tech-user-node'
  | 'tech-group-nodes'
  | 'tech-message-queue';

export interface ShapeDefinition {
  readonly id: ShapeKind;
  readonly label: string;
  readonly category: ShapeCategory;
  readonly icon: string;
  readonly defaultWidth?: number;
  readonly defaultHeight?: number;
}

export type EraserMode = 'stroke' | 'segment';
export type EraserTarget = 'all' | 'drawing' | 'highlight';

export type DrawingMode = 'continuous' | 'autoselect' | 'box';

export type SelectMode = 'none' | 'box' | 'lasso' | 'click';

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
  groupId?: string;
  resizeMode?: 'fixed' | 'free';
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

export type IconStyleType = 'outlined' | 'filled' | 'filled-outline' | 'duotone' | '3d';

export interface ShapeAnnotation extends BaseAnnotation {
  type: 'shape';
  kind: ShapeKind;
  renderMode?: 'shape' | 'icon';
  iconStyle?: IconStyleType;
  strokeColor: string;
  fillColor: string;
  strokeWidth: number;
  strokeStyle: 'solid' | 'dashed' | 'dotted';
}

export type BlendMode =
  | 'normal'
  | 'multiply'
  | 'screen'
  | 'overlay'
  | 'darken'
  | 'lighten'
  | 'color-burn'
  | 'color-dodge'
  | 'hard-light'
  | 'soft-light'
  | 'difference'
  | 'exclusion'
  | 'luminosity';

export type AspectRatioMode = 'free' | 'original' | '1:1' | '4:3' | '16:9' | '3:2';

export interface ImageAnnotation extends BaseAnnotation {
  type: 'image';
  dataUrl: string;
  naturalWidth: number;
  naturalHeight: number;
  blendMode?: BlendMode;
  aspectRatioMode?: AspectRatioMode;
  lockAspectRatio?: boolean;
  flipHorizontal?: boolean;
  flipVertical?: boolean;
}

export interface SignatureAnnotation extends BaseAnnotation {
  type: 'signature';
  dataUrl: string;
  naturalWidth: number;
  naturalHeight: number;
  blendMode?: BlendMode;
  lockAspectRatio?: boolean;
}

export interface StampAnnotation extends BaseAnnotation {
  type: 'stamp';
  text: string;
  color: string;
}

export interface CommentAnnotation extends BaseAnnotation {
  type: 'comment';
  text: string;
  author?: string;
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

export type PendingPlacement =
  | {
      type: 'image';
      dataUrl: string;
      naturalWidth: number;
      naturalHeight: number;
      width: number;
      height: number;
    }
  | {
      type: 'stamp';
      text: string;
      color: string;
      width: number;
      height: number;
    };

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
  readonly group: 'navigation' | 'content' | 'drawing' | 'shapes' | 'media';
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
