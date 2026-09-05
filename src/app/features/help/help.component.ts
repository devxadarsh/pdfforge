import { Component, signal, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { NgClass, UpperCasePipe } from '@angular/common';

interface FaqItem {
  readonly q: string;
  readonly a: string;
  readonly category: 'general' | 'editor' | 'convert' | 'security';
  readonly icon: string;
}

interface ShortcutItem {
  readonly action: string;
  readonly keys: string[];
  readonly category: string;
}

interface GuideCard {
  readonly title: string;
  readonly description: string;
  readonly icon: string;
  readonly route: string;
  readonly categoryClass: string;
  readonly actionLabel: string;
  readonly points: string[];
}

@Component({
  selector: 'app-help',
  standalone: true,
  imports: [RouterLink, FormsModule, NgClass, UpperCasePipe],
  templateUrl: './help.component.html',
  styleUrl: './help.component.scss',
})
export class HelpComponent {
  readonly searchQuery = signal<string>('');
  readonly activeCategory = signal<'all' | 'general' | 'editor' | 'convert' | 'security'>('all');

  readonly categories = [
    { id: 'all', label: 'All Topics', icon: 'fa-solid fa-list-check' },
    { id: 'general', label: 'General & Privacy', icon: 'fa-solid fa-shield-halved' },
    { id: 'editor', label: 'Editor & Annotations', icon: 'fa-solid fa-pen-ruler' },
    { id: 'convert', label: 'Convert & Tools', icon: 'fa-solid fa-arrows-rotate' },
    { id: 'security', label: 'Security & Signatures', icon: 'fa-solid fa-lock' },
  ] as const;

  readonly featureGuides: GuideCard[] = [
    {
      title: 'Full PDF Editor & Studio',
      description: 'Draw, annotate, highlight, redact, stamp, and sign PDFs directly in your canvas.',
      icon: 'fa-solid fa-pen-nib',
      route: '/editor',
      categoryClass: 'edit',
      actionLabel: 'Open PDF Studio',
      points: [
        'Vector freehand drawing with customizable pens and erasers',
        'Rich text boxes, font sizing, weights, and color picker',
        'Geometric shapes, arrows, rectangles, and line tools',
        'Cryptographic e-signatures and custom image stamping',
      ],
    },
    {
      title: 'Merge & Split Documents',
      description: 'Rearrange, combine, and dissect large documents with drag-and-drop ease.',
      icon: 'fa-solid fa-object-group',
      route: '/merge',
      categoryClass: 'organize',
      actionLabel: 'Explore Organize Suite',
      points: [
        'Batch file merging with visual drag-and-drop reordering',
        'Extract individual single pages or custom ranges (e.g. 1-3, 5)',
        'Lossless quality preservation for vector fonts and media',
        'Zero page count or file size artificial limits',
      ],
    },
    {
      title: 'Smart Compression & Word',
      description: 'Shrink file sizes and convert between PDF, editable Word (.docx), text, and photos.',
      icon: 'fa-solid fa-gauge-high',
      route: '/convert',
      categoryClass: 'optimize',
      actionLabel: 'Launch Convert Suite',
      points: [
        'Honest client-side stream compression without mock data',
        'Pure in-browser Microsoft Word (.docx) document generator',
        'Local Tesseract.js WASM optical character recognition (OCR)',
        'Compile batches of PNG, JPG, and WebP images into PDFs',
      ],
    },
    {
      title: 'Security, Encryption & Sign',
      description: 'Fortify PDFs with passwords or inspect cryptographic signature validity.',
      icon: 'fa-solid fa-file-shield',
      route: '/security/protect',
      categoryClass: 'security',
      actionLabel: 'Open Security Suite',
      points: [
        'Standard password protection and encryption locally',
        'Remove passwords from supported unlocked documents',
        'Cryptographic signature forensics and certificate validation',
        'Metadata inspection and sensitive property sanitization',
      ],
    },
  ];

  readonly shortcuts: ShortcutItem[] = [
    { action: 'Undo last action', keys: ['Ctrl / ⌘', 'Z'], category: 'Editor' },
    { action: 'Redo last action', keys: ['Ctrl / ⌘', 'Shift', 'Z'], category: 'Editor' },
    { action: 'Search text inside document', keys: ['Ctrl / ⌘', 'F'], category: 'Navigation' },
    { action: 'Zoom In', keys: ['Ctrl / ⌘', '+'], category: 'View' },
    { action: 'Zoom Out', keys: ['Ctrl / ⌘', '-'], category: 'View' },
    { action: 'Fit to Width / Page', keys: ['Ctrl / ⌘', '0'], category: 'View' },
    { action: 'Delete selected element', keys: ['Delete / Backspace'], category: 'Editor' },
    { action: 'Pan Canvas (Hand mode)', keys: ['H', 'or Space + Drag'], category: 'Tools' },
    { action: 'Select & Move Tool', keys: ['V', 'or S'], category: 'Tools' },
    { action: 'Add Text Annotation', keys: ['T'], category: 'Tools' },
    { action: 'Freehand Pen Tool', keys: ['P'], category: 'Tools' },
  ];

  readonly faqs: FaqItem[] = [
    {
      category: 'general',
      icon: 'fa-solid fa-shield-halved',
      q: 'Are my files ever uploaded to any cloud server or database?',
      a: 'Absolutely not. PDFForge is architected strictly as a browser-only client application. All rendering, editing, merging, conversion, and compression occurs in your local machine RAM using WebAssembly and HTML5 Canvas. No server receives, logs, or even sees your PDF bytes.',
    },
    {
      category: 'general',
      icon: 'fa-solid fa-user-xmark',
      q: 'Do I need an account, credit card, or email signup?',
      a: 'No account, no sign-in, and no hidden subscriptions. PDFForge is 100% free and unmetered forever. You can open, edit, and export as many documents as you need without creating credentials.',
    },
    {
      category: 'editor',
      icon: 'fa-solid fa-floppy-disk',
      q: 'Will I lose my work if I accidentally close the tab or reload?',
      a: 'No! If you have Auto-Save enabled in Settings, PDFForge continuously synchronizes your active document and annotations into your browser local IndexedDB database. When you reopen the editor, your document and edits will be restored automatically.',
    },
    {
      category: 'convert',
      icon: 'fa-solid fa-file-word',
      q: 'How does PDF to Word (.docx) conversion work without a backend?',
      a: 'PDFForge uses an in-memory OpenXML packaging engine combined with client-side OCR text extraction. It compiles valid Microsoft Word (.docx) ZIP archives directly in browser memory and initiates a local Blob download, preserving document paragraphs with zero server communication.',
    },
    {
      category: 'convert',
      icon: 'fa-solid fa-compress',
      q: 'How does local PDF compression work and why are results honest?',
      a: 'Browser compression works by re-encoding embedded image rasters and compressing uncompressed PDF object streams. Unlike commercial sites that promise a fabricated "90% reduction" for every file, PDFForge reports genuine byte reductions. Already compressed or vector-heavy files may see smaller reductions.',
    },
    {
      category: 'security',
      icon: 'fa-solid fa-signature',
      q: 'Are drawn signatures or electronic signatures stored anywhere?',
      a: 'Never. Signatures drawn or uploaded in PDFForge are converted into inline vector graphics or embedded raster elements that are burned directly into your downloaded PDF file. They are never transmitted over the internet or saved to external databases.',
    },
    {
      category: 'general',
      icon: 'fa-solid fa-hard-drive',
      q: 'Is there a document size limit for processing?',
      a: 'There is no artificial platform limit. PDFForge can handle multi-hundred page documents, governed only by your device memory (RAM) and browser processing power. For large documents (100MB+), client-side processing may take a few seconds longer.',
    },
    {
      category: 'security',
      icon: 'fa-solid fa-lock',
      q: 'Can PDFForge unlock any password-protected PDF?',
      a: 'PDFForge can unlock and decrypt PDFs locally as long as you provide the valid user/owner password or if the document uses standard PDF encryption supported by our local WebAssembly engine.',
    },
  ];

  readonly filteredFaqs = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    const cat = this.activeCategory();

    return this.faqs.filter((faq) => {
      const matchCat = cat === 'all' || faq.category === cat;
      const matchQuery =
        !q ||
        faq.q.toLowerCase().includes(q) ||
        faq.a.toLowerCase().includes(q);
      return matchCat && matchQuery;
    });
  });

  readonly filteredShortcuts = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    if (!q) return this.shortcuts;
    return this.shortcuts.filter(
      (s) =>
        s.action.toLowerCase().includes(q) ||
        s.category.toLowerCase().includes(q) ||
        s.keys.some((k) => k.toLowerCase().includes(q)),
    );
  });

  setCategory(cat: 'all' | 'general' | 'editor' | 'convert' | 'security'): void {
    this.activeCategory.set(cat);
  }

  clearSearch(): void {
    this.searchQuery.set('');
  }
}
