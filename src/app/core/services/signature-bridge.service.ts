import { Injectable, signal } from '@angular/core';
import {
  SignatureResult,
  DigitalSignatureRequest,
} from '../../core/models/pdf.models';

@Injectable({ providedIn: 'root' })
export class SignatureBridgeService {
  private readonly _pending = signal<SignatureResult | null>(null);
  readonly pending = this._pending.asReadonly();

  private readonly _pendingDigital =
    signal<DigitalSignatureRequest | null>(null);
  readonly pendingDigital = this._pendingDigital.asReadonly();

  setSignature(signature: SignatureResult): void {
    this._pending.set(signature);
  }

  setDigitalSignature(request: DigitalSignatureRequest): void {
    this._pendingDigital.set(request);
  }

  clear(): void {
    this._pending.set(null);
    this._pendingDigital.set(null);
  }

  consume(): SignatureResult | null {
    const value = this._pending();
    this._pending.set(null);
    return value;
  }

  consumeDigital(): DigitalSignatureRequest | null {
    const value = this._pendingDigital();
    this._pendingDigital.set(null);
    return value;
  }
}
