import {
  Component,
  Output,
  EventEmitter,
  signal,
  viewChild,
  ElementRef,
  ChangeDetectionStrategy,
} from '@angular/core';
import { NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import * as forge from 'node-forge';
import {
  SignatureResult,
  DigitalSignatureRequest,
} from '../../../../core/models/pdf.models';

type SigMode = 'draw' | 'type' | 'upload' | 'seal' | 'digital';

@Component({
  selector: 'app-signature-dialog',
  standalone: true,
  imports: [NgClass, FormsModule],
  templateUrl: './signature-dialog.component.html',
  styleUrl: './signature-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SignatureDialogComponent {
  @Output() result = new EventEmitter<SignatureResult | null>();
  @Output() digitalResult = new EventEmitter<DigitalSignatureRequest | null>();

  readonly canvasRef = viewChild<ElementRef<HTMLCanvasElement>>('canvas');
  readonly mode = signal<SigMode>('draw');
  readonly typedText = signal('Your Name');
  readonly font = signal('cursive');
  readonly size = signal(48);
  readonly color = signal('#0f172a');
  readonly error = signal<string | null>(null);

  // Seal
  readonly sealName = signal('');

  // Digital ID
  readonly certBytes = signal<Uint8Array | null>(null);
  readonly certName = signal('');
  readonly password = signal('');
  readonly reason = signal('');
  readonly location = signal('');
  readonly contactInfo = signal('');

  private drawing = false;
  private last: { x: number; y: number } | null = null;

  private ctx(): CanvasRenderingContext2D | null {
    return this.canvasRef()?.nativeElement.getContext('2d') ?? null;
  }

  setMode(m: SigMode): void {
    this.mode.set(m);
    this.error.set(null);
    if (m === 'type') {
      this.renderText();
    } else if (m === 'seal') {
      this.renderSeal();
    } else {
      this.clear();
    }
  }

  onPointerDown(event: PointerEvent): void {
    if (this.mode() !== 'draw') {
      return;
    }
    const ctx = this.ctx();
    if (!ctx) {
      return;
    }
    this.drawing = true;
    this.last = this.pos(event);
    ctx.beginPath();
    ctx.moveTo(this.last.x, this.last.y);
    (event.target as HTMLElement).setPointerCapture?.(event.pointerId);
  }

  onPointerMove(event: PointerEvent): void {
    if (!this.drawing || this.mode() !== 'draw' || !this.last) {
      return;
    }
    const ctx = this.ctx();
    if (!ctx) {
      return;
    }
    const p = this.pos(event);
    ctx.strokeStyle = this.color();
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(this.last.x, this.last.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    this.last = p;
  }

  onPointerUp(): void {
    this.drawing = false;
    this.last = null;
  }

  onTypeChange(): void {
    if (this.mode() === 'type') {
      this.renderText();
    }
  }

  onSealChange(): void {
    if (this.mode() === 'seal') {
      this.renderSeal();
    }
  }

  onUpload(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }
    if (!file.type.startsWith('image/')) {
      this.error.set('Please choose an image file.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const img = new Image();
      img.onload = () => {
        const ctx = this.ctx();
        const canvas = this.canvasRef()?.nativeElement;
        if (!ctx || !canvas) {
          return;
        }
        this.clear();
        const scale = Math.min(
          canvas.width / img.naturalWidth,
          canvas.height / img.naturalHeight,
        );
        const w = img.naturalWidth * scale;
        const h = img.naturalHeight * scale;
        ctx.drawImage(img, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  }

  onCertUpload(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) {
      return;
    }
    this.error.set(null);
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
        const cn = bags?.[0]?.cert?.subject.getField('CN')?.value;
        this.certName.set(cn ?? '');
        this.certBytes.set(bytes);
      } catch {
        this.error.set(
          'Could not read the certificate. Check the file and password.',
        );
        this.certBytes.set(null);
      }
    };
    reader.readAsArrayBuffer(file);
  }

  cancel(): void {
    this.result.emit(null);
    this.digitalResult.emit(null);
  }

  confirm(): void {
    if (this.mode() === 'digital') {
      this.confirmDigital();
      return;
    }
    const canvas = this.canvasRef()?.nativeElement;
    if (!canvas) {
      this.result.emit(null);
      return;
    }
    this.result.emit({
      dataUrl: canvas.toDataURL('image/png'),
      width: canvas.width,
      height: canvas.height,
    });
  }

  private confirmDigital(): void {
    const cert = this.certBytes();
    if (!cert) {
      this.error.set('Upload a .p12 or .pfx certificate first.');
      return;
    }
    if (!this.password()) {
      this.error.set('Enter the certificate password.');
      return;
    }
    this.digitalResult.emit({
      certBytes: cert,
      password: this.password(),
      reason: this.reason().trim() || undefined,
      location: this.location().trim() || undefined,
      contactInfo: this.contactInfo().trim() || undefined,
      signerName: this.certName().trim() || undefined,
    });
  }

  private renderText(): void {
    const ctx = this.ctx();
    const canvas = this.canvasRef()?.nativeElement;
    if (!ctx || !canvas) {
      return;
    }
    this.clear();
    ctx.fillStyle = this.color();
    ctx.font = `${this.size()}px ${this.font()}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.typedText(), canvas.width / 2, canvas.height / 2);
  }

  private renderSeal(): void {
    const ctx = this.ctx();
    const canvas = this.canvasRef()?.nativeElement;
    if (!ctx || !canvas) {
      return;
    }
    this.clear();
    const cx = 72;
    const cy = canvas.height / 2;
    const r = 54;
    ctx.strokeStyle = '#b45309';
    ctx.fillStyle = '#b45309';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, r - 6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 15px sans-serif';
    ctx.fillText('SEAL', cx, cy);
    ctx.textAlign = 'left';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText('CERTIFIED', 144, 44);
    ctx.font = '15px sans-serif';
    ctx.fillText(this.sealName().trim() || 'Signer Name', 144, 74);
    ctx.fillText(new Date().toLocaleDateString(), 144, 98);
  }

  private clear(): void {
    const ctx = this.ctx();
    const canvas = this.canvasRef()?.nativeElement;
    if (!ctx || !canvas) {
      return;
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  private pos(event: PointerEvent): { x: number; y: number } {
    const canvas = this.canvasRef()?.nativeElement;
    if (!canvas) {
      return { x: 0, y: 0 };
    }
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }
}
