import { Component, signal, computed, inject, HostListener } from '@angular/core';
import { RouterLink, RouterLinkActive, Router } from '@angular/router';
import { NgClass } from '@angular/common';
import { ThemeService } from '../../core/services/theme.service';

export interface HeaderToolItem {
  readonly label: string;
  readonly path: string;
  readonly icon: string;
  readonly description: string;
  readonly badge?: string;
}

export interface HeaderCategoryMenu {
  readonly id: string;
  readonly label: string;
  readonly icon: string;
  readonly categoryTheme: 'organize' | 'optimize' | 'security' | 'more';
  readonly items: HeaderToolItem[];
}

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, NgClass],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss'
})
export class HeaderComponent {
  protected readonly theme = inject(ThemeService);
  private readonly router = inject(Router);

  readonly categoryMenus: HeaderCategoryMenu[] = [
    {
      id: 'organize',
      label: 'Organize',
      icon: 'fa-solid fa-object-group',
      categoryTheme: 'organize',
      items: [
        {
          label: 'Merge PDF',
          path: '/merge',
          icon: 'fa-solid fa-object-group',
          description: 'Combine multiple PDFs into one document',
          badge: 'Batch',
        },
        {
          label: 'Split PDF',
          path: '/split',
          icon: 'fa-solid fa-scissors',
          description: 'Extract pages or split into separate files',
          badge: 'Ranges',
        },
      ],
    },
    {
      id: 'optimize',
      label: 'Optimize',
      icon: 'fa-solid fa-compress',
      categoryTheme: 'optimize',
      items: [
        {
          label: 'Compress PDF',
          path: '/compress',
          icon: 'fa-solid fa-compress',
          description: 'Shrink file size locally with zero upload',
          badge: 'Fast',
        },
        {
          label: 'Convert PDF',
          path: '/convert',
          icon: 'fa-solid fa-arrows-rotate',
          description: 'Convert PDF to images/text and back',
          badge: 'Multi-format',
        },
      ],
    },
    {
      id: 'security',
      label: 'Security',
      icon: 'fa-solid fa-lock',
      categoryTheme: 'security',
      items: [
        {
          label: 'Protect PDF',
          path: '/security/protect',
          icon: 'fa-solid fa-lock',
          description: 'Add a password and permissions',
          badge: 'AES-256',
        },
        {
          label: 'Unlock PDF',
          path: '/security/unlock',
          icon: 'fa-solid fa-lock-open',
          description: 'Remove password from a supported PDF',
          badge: 'Decrypt',
        },
        {
          label: 'Verify & Forensics',
          path: '/security/verify',
          icon: 'fa-solid fa-shield-halved',
          description: 'Verify digital signatures & tamper history',
          badge: 'Forensics',
        },
        {
          label: 'Edit Metadata',
          path: '/security/metadata',
          icon: 'fa-solid fa-circle-info',
          description: 'Inspect and sanitize document properties',
          badge: 'Clean',
        },
      ],
    },
    {
      id: 'more',
      label: 'More',
      icon: 'fa-solid fa-ellipsis',
      categoryTheme: 'more',
      items: [
        {
          label: 'Add Signature',
          path: '/signature',
          icon: 'fa-solid fa-signature',
          description: 'Draw, type, or stamp verified signatures',
          badge: 'Sign',
        },
        {
          label: 'All Tools Directory',
          path: '/tools',
          icon: 'fa-solid fa-toolbox',
          description: 'Browse complete catalog of all 10 tools',
          badge: 'All',
        },
        {
          label: 'Recent Documents',
          path: '/recent',
          icon: 'fa-solid fa-clock-rotate-left',
          description: 'Locally stored files in your browser',
        },
        {
          label: 'Settings',
          path: '/settings',
          icon: 'fa-solid fa-gear',
          description: 'Theme, auto-save, and privacy settings',
        },
        {
          label: 'Help & Guide',
          path: '/help',
          icon: 'fa-solid fa-circle-question',
          description: 'Keyboard shortcuts, guides & privacy FAQ',
        },
      ],
    },
  ];

  readonly activeMenu = signal<string | null>(null);
  readonly mobileMenuOpen = signal(false);

  readonly themeIcon = computed(() => {
    switch (this.theme.theme()) {
      case 'light':
        return 'fa-solid fa-sun';
      case 'dark':
        return 'fa-solid fa-moon';
      default:
        return 'fa-solid fa-circle-half-stroke';
    }
  });

  toggleMenu(menuId: string): void {
    this.activeMenu.update((curr) => (curr === menuId ? null : menuId));
  }

  isOpen(menuId: string): boolean {
    return this.activeMenu() === menuId;
  }

  closeAllMenus(): void {
    this.activeMenu.set(null);
    this.mobileMenuOpen.set(false);
  }

  toggleMobileMenu(): void {
    this.mobileMenuOpen.update((v) => !v);
    this.activeMenu.set(null);
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.closeAllMenus();
  }

  cycleTheme(): void {
    const order = ['system', 'light', 'dark'] as const;
    const idx = order.indexOf(this.theme.theme());
    this.theme.setTheme(order[(idx + 1) % order.length]);
  }

  openPdf(): void {
    this.closeAllMenus();
    void this.router.navigate(['/editor']);
  }
}

