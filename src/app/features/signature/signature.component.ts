import {
  Component,
  signal,
  inject,
  viewChild,
  ElementRef,
  afterNextRender,
  NgZone,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { NgClass } from '@angular/common';
import { FileDropzoneComponent } from '../../shared/components/dropzone/file-dropzone.component';

@Component({
  selector: 'app-signature',
  standalone: true,
  imports: [RouterLink, FormsModule, NgClass, FileDropzoneComponent],
  templateUrl: './signature.component.html',
  styleUrl: './signature.component.scss',
})
export class SignatureComponent {
  private readonly zone = inject(NgZone);
  readonly tab = signal<'draw' | 'type' | 'upload'>('draw');

  // Draw state
  private canvas =
    viewChild<ElementRef<HTMLCanvasElement>>('canvas');
  private drawing = false;
  private last: { x: number; y: number } | null = null;

  // Type state
  readonly typed = signal('Your Name');
  readonly font = signal<'cursive' | 'serif' | 'sans'>('cursive');

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
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#0f172a';
    }
  }

  setTab(t: 'draw' | 'type' | 'upload'): void {
    this.tab.set(t);
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
      ctx.clearRect(0, 0, c.width, c.height);
    }
    this.dataUrl.set(null);
  }
}
