import { Component, signal, inject } from '@angular/core';
import { RouterLink, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { FileDropzoneComponent } from '../../shared/components/dropzone/file-dropzone.component';

@Component({
  selector: 'app-security',
  standalone: true,
  imports: [RouterLink, FormsModule, FileDropzoneComponent],
  templateUrl: './security.component.html',
  styleUrl: './security.component.scss',
})
export class SecurityComponent {
  private readonly router = inject(Router);
  readonly mode = signal<'protect' | 'unlock'>('protect');
  readonly password = signal('');
  readonly confirm = signal('');
  readonly permissions = signal({
    print: true,
    copy: true,
    modify: false,
  });

  constructor() {
    const isUnlock = this.router.url.includes('unlock');
    this.mode.set(isUnlock ? 'unlock' : 'protect');
  }

  togglePerm(key: 'print' | 'copy' | 'modify'): void {
    this.permissions.update((p) => ({ ...p, [key]: !p[key] }));
  }
}
