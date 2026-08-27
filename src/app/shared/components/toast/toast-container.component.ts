import { Component, inject } from '@angular/core';
import { NgClass } from '@angular/common';
import { ToastService } from '../../../core/services/toast.service';

@Component({
    selector: 'app-toast-container',
    imports: [NgClass],
    templateUrl: './toast-container.component.html',
    styleUrl: './toast-container.component.scss'
})
export class ToastContainerComponent {
  private readonly toasts = inject(ToastService);
  readonly list = this.toasts.toasts;
  readonly kinds = {
    info: 'fa-solid fa-circle-info',
    success: 'fa-solid fa-circle-check',
    warning: 'fa-solid fa-triangle-exclamation',
    error: 'fa-solid fa-circle-exclamation',
  };

  dismiss(id: number): void {
    this.toasts.dismiss(id);
  }
}
