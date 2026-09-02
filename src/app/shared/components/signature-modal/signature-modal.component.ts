import {
  Component,
  signal,
  inject,
  viewChild,
  ElementRef,
  afterNextRender,
  output,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export interface SignatureResult {
  readonly dataUrl: string;
  readonly width: number;
  readonly height: number;
}

interface StrokePoint {
  readonly x: number;
  readonly y: number;
}

interface Stroke {
  readonly color: string;
  readonly width: number;
  readonly points: StrokePoint[];
}

@Component({
  selector: 'app-signature-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './signature-modal.component.html',
  styleUrl: './signature-modal.component.scss',
})
export class SignatureModalComponent {
  readonly signatureSelected = output<SignatureResult>();
  readonly closed = output<void>();

  readonly activeTab = signal<'draw' | 'type' | 'upload'>('draw');

  // --- DRAW STATE ---
  private readonly canvasRef = viewChild<ElementRef<HTMLCanvasElement>>('drawCanvas');
  readonly drawColor = signal<string>('#111827');
  readonly drawWidth = signal<number>(3);
  readonly colorPresets = ['#111827', '#1d4ed8', '#dc2626'];
  readonly widthPresets = [
    { label: 'Fine', value: 2 },
    { label: 'Medium', value: 3.5 },
    { label: 'Bold', value: 5.5 },
  ];

  private isDrawing = false;
  private currentStroke: StrokePoint[] = [];
  private readonly strokes = signal<Stroke[]>([]);
  readonly canUndo = computed(() => this.strokes().length > 0);
  readonly hasDrawn = computed(() => this.strokes().length > 0);

  // --- TYPE STATE ---
  readonly typedName = signal<string>('John Doe');
  readonly typeColor = signal<string>('#111827');
  readonly typeFont = signal<string>("'Caveat', cursive");
  readonly fontChoices = [
    { label: 'Casual Script', family: "'Caveat', cursive" },
    { label: 'Classic Elegance', family: "'Dancing Script', cursive" },
    { label: 'Formal Calligraphy', family: "'Great Vibes', cursive" },
    { label: 'Smooth Brush', family: "'Alex Brush', cursive" },
    { label: 'Modern Signature', family: "'Sacramento', cursive" },
    { label: 'Clean Monoline', family: "cursive" },
  ];

  // --- UPLOAD STATE ---
  readonly uploadedDataUrl = signal<string | null>(null);
  readonly uploadedWidth = signal<number>(300);
  readonly uploadedHeight = signal<number>(120);
  readonly removeWhiteBg = signal<boolean>(true);
  readonly isDragging = signal<boolean>(false);

  constructor() {
    afterNextRender(() => {
      this.initCanvas();
    });
  }

  setTab(tab: 'draw' | 'type' | 'upload'): void {
    this.activeTab.set(tab);
    if (tab === 'draw') {
      setTimeout(() => {
        this.initCanvas();
        this.redrawCanvas();
      }, 50);
    }
  }

  private initCanvas(): void {
    const canvas = this.canvasRef()?.nativeElement;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(400, Math.floor(rect.width * dpr));
    canvas.height = Math.max(180, Math.floor(rect.height * dpr));
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.scale(dpr, dpr);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
    }
  }

  onPointerDown(event: PointerEvent): void {
    const canvas = this.canvasRef()?.nativeElement;
    if (!canvas) return;
    canvas.setPointerCapture?.(event.pointerId);
    this.isDrawing = true;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    this.currentStroke = [{ x, y }];
    this.drawPoint(x, y);
  }

  onPointerMove(event: PointerEvent): void {
    if (!this.isDrawing) return;
    const canvas = this.canvasRef()?.nativeElement;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    this.currentStroke.push({ x, y });
    this.drawSegment(this.currentStroke);
  }

  onPointerUp(event: PointerEvent): void {
    if (!this.isDrawing) return;
    this.isDrawing = false;
    if (this.currentStroke.length > 0) {
      this.strokes.update((list) => [
        ...list,
        {
          color: this.drawColor(),
          width: this.drawWidth(),
          points: [...this.currentStroke],
        },
      ]);
      this.currentStroke = [];
    }
  }

  private drawPoint(x: number, y: number): void {
    const canvas = this.canvasRef()?.nativeElement;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = this.drawColor();
    ctx.beginPath();
    ctx.arc(x, y, this.drawWidth() / 2, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawSegment(points: StrokePoint[]): void {
    const canvas = this.canvasRef()?.nativeElement;
    const ctx = canvas?.getContext('2d');
    if (!ctx || points.length < 2) return;
    ctx.strokeStyle = this.drawColor();
    ctx.lineWidth = this.drawWidth();
    ctx.beginPath();
    const p1 = points[points.length - 2];
    const p2 = points[points.length - 1];
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
  }

  private redrawCanvas(): void {
    const canvas = this.canvasRef()?.nativeElement;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const dpr = window.devicePixelRatio || 1;
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);

    for (const stroke of this.strokes()) {
      if (stroke.points.length === 0) continue;
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.width;
      ctx.beginPath();
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
      }
      ctx.stroke();
    }
  }

  undoStroke(): void {
    this.strokes.update((list) => list.slice(0, -1));
    this.redrawCanvas();
  }

  clearCanvas(): void {
    this.strokes.set([]);
    this.currentStroke = [];
    this.redrawCanvas();
  }

  // --- UPLOAD HANDLING ---
  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.isDragging.set(true);
  }

  onDragLeave(): void {
    this.isDragging.set(false);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDragging.set(false);
    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      void this.processImageFile(files[0]);
    }
  }

  onFileInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    if (target.files && target.files.length > 0) {
      void this.processImageFile(target.files[0]);
    }
  }

  private async processImageFile(file: File): Promise<void> {
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const img = new Image();
      img.onload = () => {
        if (this.removeWhiteBg()) {
          const processed = this.filterWhiteBackground(img);
          this.uploadedDataUrl.set(processed);
        } else {
          this.uploadedDataUrl.set(dataUrl);
        }
        this.uploadedWidth.set(img.naturalWidth || 300);
        this.uploadedHeight.set(img.naturalHeight || 120);
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  }

  toggleRemoveWhiteBg(): void {
    this.removeWhiteBg.update((v) => !v);
    const current = this.uploadedDataUrl();
    if (current) {
      const img = new Image();
      img.onload = () => {
        if (this.removeWhiteBg()) {
          this.uploadedDataUrl.set(this.filterWhiteBackground(img));
        }
      };
      img.src = current;
    }
  }

  private filterWhiteBackground(img: HTMLImageElement): string {
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return img.src;

    ctx.drawImage(img, 0, 0);
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imgData.data;

    // Threshold near white (e.g. RGB all > 220) to make transparent
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      if (r > 220 && g > 220 && b > 220) {
        data[i + 3] = 0; // Alpha transparent
      } else {
        // Boost contrast for signature ink
        const brightness = (r + g + b) / 3;
        if (brightness < 120) {
          data[i] = 17;
          data[i + 1] = 24;
          data[i + 2] = 39;
        }
      }
    }
    ctx.putImageData(imgData, 0, 0);
    return canvas.toDataURL('image/png');
  }

  // --- INSERT / SUBMIT ---
  insertSignature(): void {
    const tab = this.activeTab();

    if (tab === 'draw') {
      const canvas = this.canvasRef()?.nativeElement;
      if (!canvas || !this.hasDrawn()) return;

      // Crop canvas to bounding box of strokes for tight signature fit
      const croppedDataUrl = this.cropCanvasToSignature(canvas);
      this.signatureSelected.emit({
        dataUrl: croppedDataUrl,
        width: 220,
        height: 80,
      });
    } else if (tab === 'type') {
      const text = this.typedName().trim();
      if (!text) return;
      const dataUrl = this.renderTypedSignature(text, this.typeFont(), this.typeColor());
      this.signatureSelected.emit({
        dataUrl,
        width: 240,
        height: 75,
      });
    } else if (tab === 'upload') {
      const dataUrl = this.uploadedDataUrl();
      if (!dataUrl) return;
      const aspect = this.uploadedWidth() / Math.max(1, this.uploadedHeight());
      const w = Math.min(240, Math.max(120, 80 * aspect));
      const h = w / aspect;
      this.signatureSelected.emit({
        dataUrl,
        width: Math.round(w),
        height: Math.round(h),
      });
    }
  }

  private cropCanvasToSignature(canvas: HTMLCanvasElement): string {
    const ctx = canvas.getContext('2d');
    if (!ctx) return canvas.toDataURL('image/png');

    const dpr = window.devicePixelRatio || 1;
    const w = canvas.width;
    const h = canvas.height;
    const imgData = ctx.getImageData(0, 0, w, h);
    const data = imgData.data;

    let minX = w,
      minY = h,
      maxX = 0,
      maxY = 0;
    let hasPixels = false;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const alpha = data[(y * w + x) * 4 + 3];
        if (alpha > 10) {
          hasPixels = true;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    if (!hasPixels) return canvas.toDataURL('image/png');

    // Add padding around signature
    const pad = 12 * dpr;
    minX = Math.max(0, minX - pad);
    minY = Math.max(0, minY - pad);
    maxX = Math.min(w, maxX + pad);
    maxY = Math.min(h, maxY + pad);

    const cropW = Math.max(10, maxX - minX);
    const cropH = Math.max(10, maxY - minY);

    const cropCanvas = document.createElement('canvas');
    cropCanvas.width = cropW;
    cropCanvas.height = cropH;
    const cropCtx = cropCanvas.getContext('2d');
    if (!cropCtx) return canvas.toDataURL('image/png');

    cropCtx.drawImage(canvas, minX, minY, cropW, cropH, 0, 0, cropW, cropH);
    return cropCanvas.toDataURL('image/png');
  }

  private renderTypedSignature(text: string, font: string, color: string): string {
    const canvas = document.createElement('canvas');
    canvas.width = 600;
    canvas.height = 200;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    ctx.font = `64px ${font}`;
    ctx.fillStyle = color;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.fillText(text, 300, 100);

    return this.cropCanvasToSignature(canvas);
  }

  close(): void {
    this.closed.emit();
  }
}
