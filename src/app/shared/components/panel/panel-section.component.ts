import {
  Component,
  input,
  linkedSignal,
  ChangeDetectionStrategy,
} from '@angular/core';
import { NgClass } from '@angular/common';

/**
 * Reusable collapsible section primitive used to compose the editor side panels
 * (and any future module). A section renders a titled header with an optional
 * icon + count badge and an optional actions slot projected into the header.
 *
 * `bare` mode renders a lightweight grouped sub-section (title + content only,
 * no card chrome) so sections can be nested inside other sections without
 * visual clutter — the building block for scalable, grouped panel layouts.
 */
@Component({
  selector: 'app-panel-section',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgClass],
  templateUrl: './panel-section.component.html',
  styleUrl: './panel-section.component.scss',
})
export class PanelSectionComponent {
  readonly title = input.required<string>();
  readonly icon = input<string>('');
  readonly count = input<number | null>(null);
  readonly collapsible = input(true);
  readonly collapsed = input(false);
  readonly bare = input(false);

  private readonly _collapsed = linkedSignal(() => this.collapsed());
  readonly isCollapsed = this._collapsed.asReadonly();

  toggle(): void {
    this._collapsed.update((v) => !v);
  }
}
