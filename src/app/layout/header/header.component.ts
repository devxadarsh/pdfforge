import { Component, signal, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, Router } from '@angular/router';
import { NgClass } from '@angular/common';
import { ThemeService } from '../../core/services/theme.service';

interface NavItem {
  readonly label: string;
  readonly path: string;
  readonly icon: string;
}

interface NavGroup {
  readonly title: string;
  readonly items: NavItem[];
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

  readonly primaryNav: NavItem[] = [
    { label: 'Home', path: '/', icon: 'fa-solid fa-house' },
    { label: 'Tools', path: '/tools', icon: 'fa-solid fa-toolbox' },
    { label: 'Editor', path: '/editor', icon: 'fa-solid fa-pen-to-square' },
  ];

  readonly navGroups: NavGroup[] = [
    {
      title: 'Organize',
      items: [
        { label: 'Merge', path: '/merge', icon: 'fa-solid fa-object-group' },
        { label: 'Split', path: '/split', icon: 'fa-solid fa-scissors' },
      ],
    },
    {
      title: 'Optimize',
      items: [
        { label: 'Compress', path: '/compress', icon: 'fa-solid fa-compress' },
        { label: 'Convert', path: '/convert', icon: 'fa-solid fa-arrows-rotate' },
      ],
    },
    {
      title: 'Security',
      items: [
        { label: 'Protect', path: '/security/protect', icon: 'fa-solid fa-lock' },
        { label: 'Unlock', path: '/security/unlock', icon: 'fa-solid fa-lock-open' },
      ],
    },
    {
      title: 'Annotate',
      items: [
        { label: 'Signature', path: '/signature', icon: 'fa-solid fa-signature' },
      ],
    },
    {
      title: '',
      items: [
        { label: 'Recent', path: '/recent', icon: 'fa-solid fa-clock-rotate-left' },
        { label: 'Settings', path: '/settings', icon: 'fa-solid fa-gear' },
        { label: 'Help', path: '/help', icon: 'fa-solid fa-circle-question' },
      ],
    },
  ];

  readonly moreOpen = signal(false);
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

  toggleMore(): void {
    this.moreOpen.update((v) => !v);
  }

  closeMore(): void {
    this.moreOpen.set(false);
  }

  cycleTheme(): void {
    const order = ['system', 'light', 'dark'] as const;
    const idx = order.indexOf(this.theme.theme());
    this.theme.setTheme(order[(idx + 1) % order.length]);
  }

  openPdf(): void {
    this.closeMore();
    void this.router.navigate(['/editor']);
  }
}
