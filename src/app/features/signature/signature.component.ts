import {
  Component,
  signal,
  inject,
  viewChild,
  ElementRef,
  afterNextRender,
  NgZone,
} from '@angular/core';
import { Router } from '@angular/router';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { NgClass } from '@angular/common';
import * as forge from 'node-forge';
import {
  SignatureResult,
  DigitalSignatureRequest,
} from '../../core/models/pdf.models';
import { SignatureBridgeService } from '../../core/services/signature-bridge.service';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-signature',
  standalone: true,
  imports: [RouterLink, FormsModule, NgClass],
  templateUrl: './signature.component.html',
  styleUrl: './signature.component.scss',
})
export class SignatureComponent {
  private readonly zone = inject(NgZone);
  private readonly router = inject(Router);
  private readonly bridge = inject(SignatureBridgeService);
  private readonly toasts = inject(ToastService);
  readonly tab = signal<'draw' | 'type' | 'upload' | 'digital'>('draw');

  // Draw state
  private canvas = viewChild<ElementRef<HTMLCanvasElement>>('canvas');
  private drawing = false;
  private last: { x: number; y: number } | null = null;

  // Type state
  readonly typed = signal('Your Name');
  readonly font = signal<'cursive' | 'serif' | 'sans'>('cursive');

  // Upload state
  readonly uploadDataUrl = signal<string | null>(null);
  readonly uploadWidth = signal(0);
  readonly uploadHeight = signal(0);

  // Digital ID state
  readonly certBytes = signal<Uint8Array | null>(null);
  readonly certName = signal('');
  readonly password = signal('');
  readonly reason = signal('');
  readonly location = signal('');
  readonly certError = signal<string | null>(null);

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

  setTab(t: 'draw' | 'type' | 'upload' | 'digital'): void {
    this.tab.set(t);
  }

  onCertUpload(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) {
      return;
    }
    this.certError.set(null);
    const reader = new FileReader();
    reader.onload = () => {
      const bytes = new Uint8Array(reader.result as ArrayBuffer);
      try {
        const p12 = forge.pkcs12.pkcs12FromAsn1(
          forge.asn1.fromDer(forge.util.binary.raw.encode(bytes)),
          this.password() || '',
        );
        const bags =
          p12.getBags({ bagType: forge.pki.oids['certBag'] })[
            forge.pki.oids['certBag']
          ];
        this.certName.set(bags?.[0]?.cert?.subject.getField('CN')?.value ?? '');
        this.certBytes.set(bytes);
      } catch {
        this.certError.set(
          'Could not read the certificate. Check the file and password.',
        );
        this.certBytes.set(null);
      }
    };
    reader.readAsArrayBuffer(file);
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

  onUpload(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) {
      return;
    }
    if (!file.type.startsWith('image/')) {
      this.toasts.error('Please choose an image file.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const img = new Image();
      img.onload = () => {
        this.zone.run(() => {
          this.uploadDataUrl.set(dataUrl);
          this.uploadWidth.set(img.naturalWidth);
          this.uploadHeight.set(img.naturalHeight);
        });
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  }

  private buildSignature(): SignatureResult | null {
    if (this.tab() === 'draw') {
      const c = this.canvas()?.nativeElement;
      if (!c || !this.dataUrl()) {
        return null;
      }
      return {
        dataUrl: c.toDataURL('image/png'),
        width: c.clientWidth,
        height: c.clientHeight,
      };
    }
    if (this.tab() === 'type') {
      const text = this.typed().trim();
      if (!text) {
        return null;
      }
      const w = 420;
      const h = 140;
      const cv = document.createElement('canvas');
      cv.width = w;
      cv.height = h;
      const ctx = cv.getContext('2d');
      if (!ctx) {
        return null;
      }
      ctx.fillStyle = '#0f172a';
      ctx.font = `64px ${this.font()}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, w / 2, h / 2);
      return { dataUrl: cv.toDataURL('image/png'), width: w, height: h };
    }
    if (!this.uploadDataUrl()) {
      return null;
    }
    return {
      dataUrl: this.uploadDataUrl()!,
      width: this.uploadWidth(),
      height: this.uploadHeight(),
    };
  }

  addToPdf(): void {
    if (this.tab() === 'digital') {
      const cert = this.certBytes();
      if (!cert) {
        this.toasts.error('Upload a .p12 or .pfx certificate first.');
        return;
      }
      if (!this.password()) {
        this.toasts.error('Enter the certificate password.');
        return;
      }
      const request: DigitalSignatureRequest = {
        certBytes: cert,
        password: this.password(),
        reason: this.reason().trim() || undefined,
        location: this.location().trim() || undefined,
      };
      this.bridge.setDigitalSignature(request);
      this.router.navigate(['/editor']);
      this.toasts.info(
        'Open a PDF, then Export to apply the cryptographic signature.',
      );
      return;
    }
    const signature = this.buildSignature();
    if (!signature) {
      this.toasts.error('Create a signature first: draw, type, or upload one.');
      return;
    }
    this.bridge.setSignature(signature);
    this.router.navigate(['/editor']);
    this.toasts.info('Open a PDF, then click the page to place your signature.');
  }
}
