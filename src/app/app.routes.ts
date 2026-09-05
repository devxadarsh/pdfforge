import { Routes } from '@angular/router';
import { MarketingShellComponent } from './layout/shells/marketing-shell/marketing-shell.component';
import { EditorShellComponent } from './layout/shells/editor-shell/editor-shell.component';

export const routes: Routes = [
  {
    path: '',
    component: MarketingShellComponent,
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./features/home/home.component').then((m) => m.HomeComponent),
        title: 'PDFForge — Privacy-First PDF Tools',
      },
      {
        path: 'tools',
        loadComponent: () =>
          import('./features/tools/tools.component').then(
            (m) => m.ToolsComponent,
          ),
        title: 'All Tools — PDFForge',
      },
      {
        path: 'merge',
        loadComponent: () =>
          import('./features/merge/merge.component').then(
            (m) => m.MergeComponent,
          ),
        title: 'Merge PDF — PDFForge',
      },
      {
        path: 'split',
        loadComponent: () =>
          import('./features/split/split.component').then(
            (m) => m.SplitComponent,
          ),
        title: 'Split PDF — PDFForge',
      },
      {
        path: 'compress',
        loadComponent: () =>
          import('./features/compress/compress.component').then(
            (m) => m.CompressComponent,
          ),
        title: 'Compress PDF — PDFForge',
      },
      {
        path: 'convert',
        loadComponent: () =>
          import('./features/convert/convert.component').then(
            (m) => m.ConvertComponent,
          ),
        title: 'Convert PDF — PDFForge',
      },
      {
        path: 'word',
        redirectTo: 'convert',
        pathMatch: 'full',
      },
      {
        path: 'convert/word',
        redirectTo: 'convert',
        pathMatch: 'full',
      },
      {
        path: 'security/protect',
        loadComponent: () =>
          import('./features/security/security.component').then(
            (m) => m.SecurityComponent,
          ),
        title: 'Protect PDF — PDFForge',
      },
      {
        path: 'security/unlock',
        loadComponent: () =>
          import('./features/security/security.component').then(
            (m) => m.SecurityComponent,
          ),
        title: 'Unlock PDF — PDFForge',
      },
      {
        path: 'security/verify',
        loadComponent: () =>
          import('./features/security/verify/security-verify.component').then(
            (m) => m.SecurityVerifyComponent,
          ),
        title: 'Verify PDF & Forensics — PDFForge',
      },
      {
        path: 'security/metadata',
        loadComponent: () =>
          import('./features/security/metadata/security-metadata.component').then(
            (m) => m.SecurityMetadataComponent,
          ),
        title: 'PDF Metadata Inspector & Editor — PDFForge',
      },
      {
        path: 'signature',
        loadComponent: () =>
          import('./features/signature/signature.component').then(
            (m) => m.SignatureComponent,
          ),
        title: 'Signature — PDFForge',
      },
      {
        path: 'recent',
        loadComponent: () =>
          import('./features/recent/recent.component').then(
            (m) => m.RecentComponent,
          ),
        title: 'Recent Documents — PDFForge',
      },
      {
        path: 'settings',
        loadComponent: () =>
          import('./features/settings/settings.component').then(
            (m) => m.SettingsComponent,
          ),
        title: 'Settings — PDFForge',
      },
      {
        path: 'help',
        loadComponent: () =>
          import('./features/help/help.component').then(
            (m) => m.HelpComponent,
          ),
        title: 'Help — PDFForge',
      },
    ],
  },
  {
    path: 'editor',
    component: EditorShellComponent,
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./features/editor/editor.component').then(
            (m) => m.EditorComponent,
          ),
        title: 'PDF Editor — PDFForge',
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
