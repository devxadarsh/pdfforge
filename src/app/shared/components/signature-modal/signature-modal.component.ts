import {
  Component,
  signal,
  viewChild,
  ElementRef,
  afterNextRender,
  output,
  OnDestroy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import SignaturePad from 'signature_pad';

export interface SignatureResult {
  readonly dataUrl: string;
  readonly width: number;
  readonly height: number;
}

@Component({
  selector: 'app-signature-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './signature-modal.component.html',
  styleUrl: './signature-modal.component.scss',
})
export class SignatureModalComponent implements OnDestroy {
  readonly signatureSelected = output<SignatureResult>();
  readonly closed = output<void>();

  readonly activeTab = signal<'draw' | 'type' | 'upload'>('draw');

  // --- DRAW STATE (SignaturePad) ---
  private readonly canvasRef = viewChild<ElementRef<HTMLCanvasElement>>('drawCanvas');
  private signaturePad: SignaturePad | null = null;
  readonly drawColor = signal<string>('#111827');
  readonly drawWidth = signal<number>(3);
  readonly colorPresets = ['#111827', '#1d4ed8', '#dc2626'];
  readonly widthPresets = [
    { label: 'Fine', value: 2 },
    { label: 'Medium', value: 3.5 },
    { label: 'Bold', value: 5.5 },
  ];

  readonly canUndo = signal<boolean>(false);
  readonly hasDrawn = signal<boolean>(false);

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
      this.initSignaturePad();
    });
  }

  ngOnDestroy(): void {
    if (this.signaturePad) {
      this.signaturePad.off();
      this.signaturePad = null;
    }
  }

  setTab(tab: 'draw' | 'type' | 'upload'): void {
    this.activeTab.set(tab);
    if (tab === 'draw') {
      setTimeout(() => {
        this.initSignaturePad();
      }, 50);
    }
  }

  private initSignaturePad(): void {
    const canvas = this.canvasRef()?.nativeElement;
    if (!canvas) return;

    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.max(400, Math.floor(rect.width * ratio));
    canvas.height = Math.max(180, Math.floor(rect.height * ratio));
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.scale(ratio, ratio);
    }

    if (this.signaturePad) {
      this.signaturePad.off();
    }

    this.signaturePad = new SignaturePad(canvas, {
      penColor: this.drawColor(),
      minWidth: Math.max(1, this.drawWidth() * 0.6),
      maxWidth: this.drawWidth() * 1.6,
      throttle: 16,
      velocityFilterWeight: 0.7,
    });

    this.signaturePad.addEventListener('endStroke', () => {
      this.hasDrawn.set(!this.signaturePad?.isEmpty());
      const data = this.signaturePad?.toData();
      this.canUndo.set(Boolean(data && data.length > 0));
    });

    this.hasDrawn.set(false);
    this.canUndo.set(false);
  }

  setDrawColor(color: string): void {
    this.drawColor.set(color);
    if (this.signaturePad) {
      this.signaturePad.penColor = color;
    }
  }

  setDrawWidth(w: number): void {
    this.drawWidth.set(w);
    if (this.signaturePad) {
      this.signaturePad.minWidth = Math.max(1, w * 0.6);
      this.signaturePad.maxWidth = w * 1.6;
    }
  }

  undoStroke(): void {
    if (!this.signaturePad) return;
    const data = this.signaturePad.toData();
    if (data && data.length > 0) {
      data.pop();
      this.signaturePad.fromData(data);
      this.hasDrawn.set(!this.signaturePad.isEmpty());
      this.canUndo.set(data.length > 0);
    }
  }

  clearCanvas(): void {
    if (this.signaturePad) {
      this.signaturePad.clear();
    }
    this.hasDrawn.set(false);
    this.canUndo.set(false);
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

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      if (r > 220 && g > 220 && b > 220) {
        data[i + 3] = 0;
      } else {
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
      if (!canvas || !this.hasDrawn() || !this.signaturePad || this.signaturePad.isEmpty()) return;

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
