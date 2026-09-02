import {
  Directive,
  ElementRef,
  HostListener,
  Input,
  OnDestroy,
  inject,
} from '@angular/core';

let sharedTooltipEl: HTMLElement | null = null;
let hideTimer: ReturnType<typeof setTimeout> | null = null;
let isAnyTooltipVisible = false;
let globalResetTimer: ReturnType<typeof setTimeout> | null = null;

@Directive({
  selector: 'button[title], button[aria-label], a[title], [pfTooltip]',
  standalone: true,
})
export class MobileTooltipDirective implements OnDestroy {
  private readonly el = inject(ElementRef<HTMLElement>);

  @Input() title?: string;
  @Input('aria-label') ariaLabel?: string;
  @Input('pfTooltip') pfTooltip?: string;

  private holdTimer: ReturnType<typeof setTimeout> | null = null;
  private hoverTimer: ReturnType<typeof setTimeout> | null = null;
  private tempTitle: string | null = null;
  private startX = 0;
  private startY = 0;
  private isHeld = false;

  private get tooltipText(): string {
    return (
      this.pfTooltip ||
      this.tempTitle ||
      this.title ||
      this.ariaLabel ||
      ''
    ).trim();
  }

  // --- DESKTOP HOVER LISTENERS ---

  @HostListener('mouseenter')
  onMouseEnter(): void {
    const rawTitle = this.el.nativeElement.getAttribute('title');
    if (rawTitle) {
      this.tempTitle = rawTitle;
      this.el.nativeElement.removeAttribute('title');
    }

    if (!this.tooltipText) return;

    this.clearHoverTimer();
    if (globalResetTimer) {
      clearTimeout(globalResetTimer);
      globalResetTimer = null;
    }

    // If another tooltip is already visible, switch immediately (0ms), otherwise crisp 100ms delay
    const delay = isAnyTooltipVisible ? 0 : 100;
    this.hoverTimer = setTimeout(() => {
      this.showTooltip();
    }, delay);
  }

  @HostListener('mouseleave')
  onMouseLeave(): void {
    this.clearHoverTimer();
    this.restoreNativeTitle();
    this.hideTooltip(60);
  }

  @HostListener('click')
  onClick(): void {
    this.clearHoverTimer();
    this.restoreNativeTitle();
    this.hideTooltip(0);
  }

  // --- MOBILE TOUCH LISTENERS ---

  @HostListener('touchstart', ['$event'])
  onTouchStart(event: TouchEvent): void {
    if (!this.tooltipText) return;
    const touch = event.touches[0];
    if (!touch) return;

    this.startX = touch.clientX;
    this.startY = touch.clientY;
    this.isHeld = false;
    this.clearHoldTimer();

    // 240ms hold threshold to trigger mobile tooltip preview
    this.holdTimer = setTimeout(() => {
      this.isHeld = true;
      this.showTooltip();
    }, 240);
  }

  @HostListener('touchmove', ['$event'])
  onTouchMove(event: TouchEvent): void {
    if (!this.holdTimer && !this.isHeld) return;
    const touch = event.touches[0];
    if (!touch) return;

    const dx = Math.abs(touch.clientX - this.startX);
    const dy = Math.abs(touch.clientY - this.startY);

    // Cancel if finger moved more than 8px (e.g. user scrolling)
    if (dx > 8 || dy > 8) {
      this.clearHoldTimer();
      if (this.isHeld) {
        this.hideTooltip(0);
        this.isHeld = false;
      }
    }
  }

  @HostListener('touchend')
  @HostListener('touchcancel')
  onTouchEnd(): void {
    this.clearHoldTimer();
    if (this.isHeld) {
      // Keep tooltip visible for 900ms after release so user can easily read it
      this.hideTooltip(900);
      this.isHeld = false;
    }
  }

  @HostListener('contextmenu', ['$event'])
  onContextMenu(event: MouseEvent): void {
    if (this.isHeld) {
      event.preventDefault();
    }
  }

  private clearHoldTimer(): void {
    if (this.holdTimer) {
      clearTimeout(this.holdTimer);
      this.holdTimer = null;
    }
  }

  private clearHoverTimer(): void {
    if (this.hoverTimer) {
      clearTimeout(this.hoverTimer);
      this.hoverTimer = null;
    }
  }

  private restoreNativeTitle(): void {
    if (this.tempTitle !== null) {
      this.el.nativeElement.setAttribute('title', this.tempTitle);
      this.tempTitle = null;
    }
  }

  private showTooltip(): void {
    const text = this.tooltipText;
    if (!text) return;

    if (hideTimer) {
      clearTimeout(hideTimer);
      hideTimer = null;
    }

    const tip = this.getOrCreateTooltipElement();
    this.renderTooltipContent(tip, text);
    tip.style.display = 'inline-flex';
    tip.style.alignItems = 'center';
    tip.style.opacity = '0';

    // Position relative to target element
    const rect = this.el.nativeElement.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;

    const tipRect = tip.getBoundingClientRect();
    const halfWidth = tipRect.width / 2;

    // Viewport horizontal clamping
    let clampedX = centerX;
    const padding = 10;
    if (clampedX - halfWidth < padding) {
      clampedX = halfWidth + padding;
    } else if (clampedX + halfWidth > window.innerWidth - padding) {
      clampedX = window.innerWidth - halfWidth - padding;
    }

    // Viewport vertical check (if too close to top, show below button)
    let isBelow = false;
    let targetY = rect.top - tipRect.height - 7;
    if (targetY < padding) {
      targetY = rect.bottom + 7;
      isBelow = true;
    }

    tip.style.left = `${Math.round(clampedX)}px`;
    tip.style.top = `${Math.round(targetY)}px`;
    tip.style.transform = isBelow
      ? 'translate(-50%, -4px) scale(0.96)'
      : 'translate(-50%, 4px) scale(0.96)';

    // Trigger entrance animation
    requestAnimationFrame(() => {
      tip.style.opacity = '1';
      tip.style.transform = 'translate(-50%, 0) scale(1)';
      isAnyTooltipVisible = true;
    });
  }

  private renderTooltipContent(tip: HTMLElement, text: string): void {
    const match = text.match(/^(.*?)\s*\(([^)]+)\)$/);
    if (match) {
      const label = match[1];
      const shortcut = match[2];
      tip.innerHTML = `<span>${this.escapeHtml(label)}</span><kbd style="display:inline-block;margin-left:6px;padding:1px 5px;font-size:10px;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;font-weight:600;color:#e2e8f0;background:rgba(255,255,255,0.18);border:1px solid rgba(255,255,255,0.22);border-radius:4px;line-height:1.2;">${this.escapeHtml(shortcut)}</kbd>`;
    } else {
      tip.textContent = text;
    }
  }

  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  private hideTooltip(delayMs = 0): void {
    if (hideTimer) {
      clearTimeout(hideTimer);
      hideTimer = null;
    }

    if (delayMs > 0) {
      hideTimer = setTimeout(() => this.dismiss(), delayMs);
    } else {
      this.dismiss();
    }
  }

  private dismiss(): void {
    if (!sharedTooltipEl) return;
    sharedTooltipEl.style.opacity = '0';
    sharedTooltipEl.style.transform = 'translate(-50%, 2px) scale(0.96)';
    setTimeout(() => {
      if (sharedTooltipEl && sharedTooltipEl.style.opacity === '0') {
        sharedTooltipEl.style.display = 'none';
      }
    }, 140);

    if (globalResetTimer) clearTimeout(globalResetTimer);
    globalResetTimer = setTimeout(() => {
      isAnyTooltipVisible = false;
    }, 280);
  }

  private getOrCreateTooltipElement(): HTMLElement {
    if (!sharedTooltipEl) {
      sharedTooltipEl = document.createElement('div');
      sharedTooltipEl.className = 'pf-tooltip';
      Object.assign(sharedTooltipEl.style, {
        position: 'fixed',
        zIndex: '999999',
        pointerEvents: 'none',
        background: 'rgba(23, 23, 23, 0.94)',
        backdropFilter: 'blur(8px)',
        webkitBackdropFilter: 'blur(8px)',
        color: '#ffffff',
        fontSize: '12px',
        fontWeight: '600',
        lineHeight: '1.3',
        padding: '5px 10px',
        borderRadius: '6px',
        boxShadow:
          '0 4px 14px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(255, 255, 255, 0.16)',
        whiteSpace: 'nowrap',
        transition:
          'opacity 0.12s ease, transform 0.12s cubic-bezier(0.16, 1, 0.3, 1)',
        display: 'none',
      });
      document.body.appendChild(sharedTooltipEl);
    }
    return sharedTooltipEl;
  }

  ngOnDestroy(): void {
    this.clearHoldTimer();
    this.clearHoverTimer();
    this.restoreNativeTitle();
    if (this.isHeld) {
      this.hideTooltip(0);
    }
  }
}
