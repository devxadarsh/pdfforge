import {
  Component,
  ElementRef,
  viewChild,
  effect,
  input,
  inject,
  ChangeDetectionStrategy,
  OnDestroy,
  signal,
} from '@angular/core';
import {
  PdfViewerService,
  Cancellable,
} from '../../../../core/services/pdf/pdf-viewer.service';

@Component({
  selector: 'app-pdf-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './pdf-page.component.html',
  styleUrl: './pdf-page.component.scss',
})
export class PdfPageComponent implements OnDestroy {
  private readonly viewer = inject(PdfViewerService);
  private readonly elRef = inject(ElementRef<HTMLElement>);
  private readonly canvasRef = viewChild<ElementRef<HTMLCanvasElement>>('canvas');
  readonly pageIndex = input.required<number>();
  readonly scale = input.required<number>();
  readonly rotation = input(0);

  private readonly renderTask: { task: Cancellable | null } = { task: null };
  private readonly isVisible = signal(false);
  private observer: IntersectionObserver | null = null;

  constructor() {
    this.initObserver();

    effect(() => {
      const visible = this.isVisible();
      const canvas = this.canvasRef()?.nativeElement;
      const idx = this.pageIndex();
      const scale = this.scale();
      const rotation = this.rotation();

      if (!canvas) {
        return;
      }

      if (!visible) {
        // Cancel off-screen render to conserve CPU/memory on large documents
        this.renderTask.task?.cancel();
        this.renderTask.task = null;
        return;
      }

      void this.render(canvas, idx, scale, rotation);
    });
  }

  private initObserver(): void {
    if (typeof IntersectionObserver === 'undefined') {
      this.isVisible.set(true);
      return;
    }

    this.observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          this.isVisible.set(entry.isIntersecting);
        }
      },
      {
        rootMargin: '600px 0px 600px 0px',
        threshold: 0,
      },
    );

    this.observer.observe(this.elRef.nativeElement);
  }

  private async render(
    canvas: HTMLCanvasElement,
    idx: number,
    scale: number,
    rotation: number,
  ): Promise<void> {
    await this.viewer.renderPage(
      canvas,
      idx,
      scale,
      this.renderTask,
      rotation,
    );
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
    this.observer = null;
    this.renderTask.task?.cancel();
    this.renderTask.task = null;
  }
}
