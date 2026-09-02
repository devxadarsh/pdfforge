import {
  Component,
  signal,
  inject,
  viewChild,
  ElementRef,
  afterNextRender,
  NgZone,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { NgClass } from '@angular/common';
import { FileDropzoneComponent } from '../../shared/components/dropzone/file-dropzone.component';
import { DownloadService } from '../../core/services/download/download.service';
import { ToastService } from '../../core/services/toast.service';
import { LoadedFile } from '../../core/models/file.models';

@Component({
  selector: 'app-signature',
  standalone: true,
  imports: [RouterLink, FormsModule, NgClass, FileDropzoneComponent],
  templateUrl: './signature.component.html',
  styleUrl: './signature.component.scss',
})
export class SignatureComponent {
  private readonly zone = inject(NgZone);
  private readonly router = inject(Router);
  private readonly downloads = inject(DownloadService);
  private readonly toasts = inject(ToastService);

  readonly tab = signal<'draw' | 'type' | 'upload'>('draw');

  // Draw state
  private canvas = viewChild<ElementRef<HTMLCanvasElement>>('canvas');
  private drawing = false;
  private last: { x: number; y: number } | null = null;
  readonly strokeColor = signal<string>('#0f172a');
  readonly strokeWidth = signal<number>(2.5);

  // Type state
  readonly typed = signal('Your Name');
  readonly font = signal<'cursive' | 'serif' | 'sans'>('cursive');
  readonly typeColor = signal('#0f172a');

  // Output
  readonly dataUrl = signal<string | null>(null);

  constructor() {
    afterNextRender(() => this.setupCanvas());
  }

  private setupCanvas(): void {
    const c = this.canvas()?.nativeElement;
    if (!c) {
      return;
    }
    const ratio = window.devicePixelRatio || 1;
    c.width = c.clientWidth * ratio;
    c.height = c.clientHeight * ratio;
    const ctx = c.getContext('2d');
    if (ctx) {
      ctx.scale(ratio, ratio);
      ctx.lineWidth = this.strokeWidth();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = this.strokeColor();
    }
  }

  setTab(t: 'draw' | 'type' | 'upload'): void {
    this.tab.set(t);
    if (t === 'draw') {
      setTimeout(() => this.setupCanvas(), 50);
    }
  }

  startDraw(event: PointerEvent): void {
    this.drawing = true;
    const rect = this.canvas()!.nativeElement.getBoundingClientRect();
    this.last = { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  moveDraw(event: PointerEvent): void {
    if (!this.drawing || !this.last) {
      return;
    }
    const c = this.canvas()!.nativeElement;
    const ctx = c.getContext('2d');
    if (!ctx) {
      return;
    }
    const rect = c.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    ctx.beginPath();
    ctx.moveTo(this.last.x, this.last.y);
    ctx.lineTo(x, y);
    ctx.stroke();
    this.last = { x, y };
  }

  endDraw(): void {
    if (!this.drawing) {
      return;
    }
    this.drawing = false;
    this.last = null;
    const c = this.canvas()!.nativeElement;
    this.zone.run(() => this.dataUrl.set(c.toDataURL('image/png')));
  }

  clearDraw(): void {
    const c = this.canvas()?.nativeElement;
    const ctx = c?.getContext('2d');
    if (c && ctx) {
      const ratio = window.devicePixelRatio || 1;
      ctx.clearRect(0, 0, c.width / ratio, c.height / ratio);
    }
    this.dataUrl.set(null);
  }

  onUploadLoadedFiles(loaded: LoadedFile[]): void {
    if (!loaded.length) return;
    const file = loaded[0];
    const blob = new Blob([file.data], { type: file.file.type || 'image/png' });
    const reader = new FileReader();
    reader.onload = () => {
      this.dataUrl.set(reader.result as string);
    };
    reader.readAsDataURL(blob);
  }

  downloadSignature(): void {
    let url = this.dataUrl();
    if (this.tab() === 'type') {
      url = this.generateTypedSignatureUrl();
    }
    if (!url) {
      this.toasts.warning('Please create or draw a signature first.');
      return;
    }

    const commaIndex = url.indexOf(',');
    const base64 = commaIndex >= 0 ? url.slice(commaIndex + 1) : url;
    const binStr = atob(base64);
    const bytes = new Uint8Array(binStr.length);
    for (let i = 0; i < binStr.length; i++) {
      bytes[i] = binStr.charCodeAt(i);
    }

    this.downloads.download(
      new Blob([bytes], { type: 'image/png' }),
      'signature.png',
    );
    this.toasts.success('Signature downloaded as PNG.');
  }

  openEditor(): void {
    void this.router.navigate(['/editor']);
  }

  private generateTypedSignatureUrl(): string {
    const canvas = document.createElement('canvas');
    canvas.width = 600;
    canvas.height = 200;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    const fontMap = {
      cursive: "'Caveat', cursive",
      serif: 'Georgia, serif',
      sans: "'Inter', sans-serif",
    };
    ctx.font = `54px ${fontMap[this.font()] || 'cursive'}`;
    ctx.fillStyle = this.typeColor();
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.fillText(this.typed() || 'Signature', 300, 100);

    return canvas.toDataURL('image/png');
  }
}
