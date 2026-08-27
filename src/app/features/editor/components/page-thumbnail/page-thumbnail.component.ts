import {
  Component,
  ElementRef,
  viewChild,
  effect,
  input,
  inject,
  ChangeDetectionStrategy,
} from '@angular/core';
import { PdfViewerService } from '../../../../core/services/pdf/pdf-viewer.service';

@Component({
  selector: 'app-page-thumbnail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './page-thumbnail.component.html',
  styleUrl: './page-thumbnail.component.scss',
})
export class PageThumbnailComponent {
  private readonly viewer = inject(PdfViewerService);
  private readonly canvasRef = viewChild<ElementRef<HTMLCanvasElement>>('canvas');
  readonly pageIndex = input.required<number>();
  readonly active = input(false);
  readonly current = input(false);
  readonly width = input(180);
  readonly rotation = input(0);

  constructor() {
    effect(() => {
      const canvas = this.canvasRef()?.nativeElement;
      this.pageIndex();
      this.width();
      this.rotation();
      if (!canvas) {
        return;
      }
      void this.render(canvas);
    });
  }

  private async render(canvas: HTMLCanvasElement): Promise<void> {
    const idx = this.pageIndex();
    const rotation = this.rotation();
    const size = await this.viewer.getPageSize(idx, rotation);
    const scale = this.width() / size.width;
    await this.viewer.renderThumbnail(canvas, idx, scale, rotation);
  }
}
