import {
  Component,
  input,
  signal,
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

  private readonly _collapsed = signal(false);
  readonly isCollapsed = this._collapsed.asReadonly();

  constructor() {
    // Initialise the internal toggle state from the input on first render so
    // the body is shown correctly the very first time the section is drawn
    // (and so that later input changes do not silently override the user
    // toggling the section open/closed).
    queueMicrotask(() => this._collapsed.set(this.collapsed()));
  }

  toggle(): void {
    this._collapsed.update((v) => !v);
  }
}
