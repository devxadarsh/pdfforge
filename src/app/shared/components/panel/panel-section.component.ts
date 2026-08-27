import {
  Component,
  input,
  signal,
  OnInit,
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
  template: `
    @if (bare()) {
      <div class="psec__group">
        <div class="psec__subtitle">
          @if (icon()) {
            <i [ngClass]="icon()" class="psec__subicon"></i>
          }
          <span>{{ title() }}</span>
          @if (count() !== null) {
            <span class="psec__count">{{ count() }}</span>
          }
        </div>
        <div class="psec__body psec__body--bare">
          <ng-content />
        </div>
      </div>
    } @else {
      <div class="psec" [class.psec--collapsed]="collapsible() && collapsed()">
        <button
          type="button"
          class="psec__head"
          [class.psec__head--static]="!collapsible()"
          [attr.aria-expanded]="collapsible() ? !collapsed() : null"
          [disabled]="!collapsible()"
          (click)="toggle()"
        >
          <span class="psec__title">
            @if (icon()) {
              <i [ngClass]="icon()" class="psec__icon"></i>
            }
            <span class="psec__label">{{ title() }}</span>
            @if (count() !== null) {
              <span class="psec__count">{{ count() }}</span>
            }
          </span>
          <span class="psec__actions">
            <ng-content select="[psec-actions]" />
            @if (collapsible()) {
              <i class="fa-solid fa-chevron-down psec__chev"></i>
            }
          </span>
        </button>
        @if (!collapsible() || !collapsed()) {
          <div class="psec__body">
            <ng-content />
          </div>
        }
      </div>
    }
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .psec {
        background: var(--pf-surface-container-lowest);
        border: 1px solid var(--pf-outline-variant);
        border-radius: var(--pf-radius-md);
        overflow: hidden;
      }

      .psec__head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        width: 100%;
        padding: 8px 10px;
        border: none;
        background: transparent;
        color: var(--pf-on-surface);
        font: inherit;
        cursor: pointer;
        text-align: left;
      }

      .psec__head--static {
        cursor: default;
      }

      .psec__head:focus-visible {
        outline: 2px solid var(--pf-primary);
        outline-offset: -2px;
      }

      .psec__title {
        display: flex;
        align-items: center;
        gap: 8px;
        min-width: 0;
      }

      .psec__icon {
        color: var(--pf-on-surface-variant);
        font-size: 12px;
      }

      .psec__label {
        font-size: 12px;
        font-weight: 600;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        color: var(--pf-on-surface-variant);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .psec__count {
        font-size: 11px;
        font-weight: 700;
        color: var(--pf-on-surface-variant);
        background: var(--pf-surface-container);
        border-radius: var(--pf-radius-full);
        padding: 1px 7px;
        min-width: 20px;
        text-align: center;
      }

      .psec__actions {
        display: flex;
        align-items: center;
        gap: 6px;
        flex: none;
      }

      .psec__chev {
        font-size: 10px;
        color: var(--pf-on-surface-variant);
        transition: transform 0.18s ease;
      }

      .psec--collapsed .psec__chev {
        transform: rotate(-90deg);
      }

      .psec__body {
        padding: 10px;
        display: flex;
        flex-direction: column;
        gap: 10px;
      }

      .psec__body--bare {
        padding: 0;
      }

      /* Bare grouped sub-section */
      .psec__subtitle {
        display: flex;
        align-items: center;
        gap: 6px;
        margin-bottom: 8px;
        font-size: 12px;
        font-weight: 600;
        letter-spacing: 0.03em;
        color: var(--pf-on-surface-variant);
      }

      .psec__subicon {
        font-size: 11px;
      }
    `,
  ],
})
export class PanelSectionComponent implements OnInit {
  readonly title = input.required<string>();
  readonly icon = input<string>('');
  readonly count = input<number | null>(null);
  readonly collapsible = input(true);
  readonly collapsed = input(false);
  readonly bare = input(false);

  private readonly _collapsed = signal(false);

  ngOnInit(): void {
    this._collapsed.set(this.collapsed());
  }

  toggle(): void {
    this._collapsed.update((v) => !v);
  }
}
