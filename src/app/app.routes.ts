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
        title: 'iPDFEditor — Privacy-First PDF Tools',
      },
      {
        path: 'tools',
        loadComponent: () =>
          import('./features/tools/tools.component').then(
            (m) => m.ToolsComponent,
          ),
        title: 'All Tools — iPDFEditor',
      },
      {
        path: 'merge',
        loadComponent: () =>
          import('./features/merge/merge.component').then(
            (m) => m.MergeComponent,
          ),
        title: 'Merge PDF — iPDFEditor',
      },
      {
        path: 'split',
        loadComponent: () =>
          import('./features/split/split.component').then(
            (m) => m.SplitComponent,
          ),
        title: 'Split PDF — iPDFEditor',
      },
      {
        path: 'extract',
        redirectTo: 'split',
        pathMatch: 'full',
      },
      {
        path: 'compress',
        loadComponent: () =>
          import('./features/compress/compress.component').then(
            (m) => m.CompressComponent,
          ),
        title: 'Compress PDF — iPDFEditor',
      },
      {
        path: 'convert',
        loadComponent: () =>
          import('./features/convert/convert.component').then(
            (m) => m.ConvertComponent,
          ),
        title: 'Convert PDF — iPDFEditor',
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
        title: 'Protect PDF — iPDFEditor',
      },
      {
        path: 'security/unlock',
        loadComponent: () =>
          import('./features/security/security.component').then(
            (m) => m.SecurityComponent,
          ),
        title: 'Unlock PDF — iPDFEditor',
      },
      {
        path: 'security/verify',
        loadComponent: () =>
          import('./features/security/verify/security-verify.component').then(
            (m) => m.SecurityVerifyComponent,
          ),
        title: 'Verify PDF & Forensics — iPDFEditor',
      },
      {
        path: 'security/metadata',
        loadComponent: () =>
          import('./features/security/metadata/security-metadata.component').then(
            (m) => m.SecurityMetadataComponent,
          ),
        title: 'PDF Metadata Inspector & Editor — iPDFEditor',
      },
      {
        path: 'signature',
        loadComponent: () =>
          import('./features/signature/signature.component').then(
            (m) => m.SignatureComponent,
          ),
        title: 'Signature — iPDFEditor',
      },
      {
        path: 'recent',
        loadComponent: () =>
          import('./features/recent/recent.component').then(
            (m) => m.RecentComponent,
          ),
        title: 'Recent Documents — iPDFEditor',
      },
      {
        path: 'settings',
        loadComponent: () =>
          import('./features/settings/settings.component').then(
            (m) => m.SettingsComponent,
          ),
        title: 'Settings — iPDFEditor',
      },
      {
        path: 'help',
        loadComponent: () =>
          import('./features/help/help.component').then(
            (m) => m.HelpComponent,
          ),
        title: 'Help — iPDFEditor',
      },
      // Dedicated High-Volume Converter Landing Routes
      {
        path: 'pdf-to-word',
        loadComponent: () =>
          import('./features/convert/convert.component').then(
            (m) => m.ConvertComponent,
          ),
        data: { mode: 'pdf-word', seoKey: 'pdfToWord' },
        title: 'Convert PDF to Word Online Free (.docx) — iPDFEditor',
      },
      {
        path: 'jpg-to-pdf',
        loadComponent: () =>
          import('./features/convert/convert.component').then(
            (m) => m.ConvertComponent,
          ),
        data: { mode: 'img-pdf', seoKey: 'jpgToPdf' },
        title: 'Convert JPG to PDF Online Free — Images to PDF | iPDFEditor',
      },
      {
        path: 'pdf-to-text',
        loadComponent: () =>
          import('./features/convert/convert.component').then(
            (m) => m.ConvertComponent,
          ),
        data: { mode: 'pdf-text', seoKey: 'pdfToText' },
        title: 'Extract Text from PDF Online (OCR) — Free PDF to Text | iPDFEditor',
      },
      {
        path: 'pdf-to-jpg',
        loadComponent: () =>
          import('./features/convert/convert.component').then(
            (m) => m.ConvertComponent,
          ),
        data: { mode: 'pdf-jpg', seoKey: 'pdfToJpg' },
        title: 'Convert PDF to JPG / PNG Online Free — Save PDF Pages as Images | iPDFEditor',
      },

      // Search-intent keyword route aliases
      { path: 'pdf-editor', redirectTo: 'editor', pathMatch: 'full' },
      { path: 'edit-pdf', redirectTo: 'editor', pathMatch: 'full' },
      { path: 'merge-pdf', redirectTo: 'merge', pathMatch: 'full' },
      { path: 'split-pdf', redirectTo: 'split', pathMatch: 'full' },
      { path: 'compress-pdf', redirectTo: 'compress', pathMatch: 'full' },
      { path: 'convert-pdf', redirectTo: 'convert', pathMatch: 'full' },
      { path: 'sign-pdf', redirectTo: 'signature', pathMatch: 'full' },
      { path: 'protect-pdf', redirectTo: 'security/protect', pathMatch: 'full' },
      { path: 'unlock-pdf', redirectTo: 'security/unlock', pathMatch: 'full' },
      { path: 'rotate-pdf', redirectTo: 'editor', pathMatch: 'full' },
      { path: 'rotate', redirectTo: 'editor', pathMatch: 'full' },
      { path: 'delete-pages', redirectTo: 'split', pathMatch: 'full' },
      { path: 'extract-pages', redirectTo: 'split', pathMatch: 'full' },
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
        title: 'PDF Editor — iPDFEditor',
      },
    ],
  },
  // ── TEMPORARY: Prompt 1 Spike Verification Route ─────────────────────────
  // Remove after acceptance criteria for Prompt 1 are verified.
  {
    path: 'mupdf-spike',
    loadComponent: () =>
      import('./features/mupdf-spike/mupdf-spike.component').then(
        (m) => m.MupdfSpikeComponent,
      ),
    title: '[DEV] mupdf Spike — iPDFEditor',
  },
  // ── TEMPORARY: Prompt 2 Spike Verification Route ─────────────────────────
  // Remove after acceptance criteria for Prompt 2 are verified.
  {
    path: 'font-glyph-spike',
    loadComponent: () =>
      import('./features/font-glyph-spike/font-glyph-spike.component').then(
        (m) => m.FontGlyphSpikeComponent,
      ),
    title: '[DEV] Font Glyph Spike — iPDFEditor',
  },
  { path: '**', redirectTo: '' },
];
