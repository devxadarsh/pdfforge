import { EditorTool, PdfToolId } from '../models/pdf.models';

export interface NavItem {
  readonly label: string;
  readonly path: string;
  readonly icon: string;
}

export const NAV_ITEMS: NavItem[] = [
  { label: 'Home', path: '/', icon: 'fa-solid fa-house' },
  { label: 'Tools', path: '/tools', icon: 'fa-solid fa-toolbox' },
  { label: 'Editor', path: '/editor', icon: 'fa-solid fa-pen-to-square' },
  { label: 'Merge', path: '/merge', icon: 'fa-solid fa-object-group' },
  { label: 'Split', path: '/split', icon: 'fa-solid fa-scissors' },
  { label: 'Compress', path: '/compress', icon: 'fa-solid fa-compress' },
  { label: 'Convert', path: '/convert', icon: 'fa-solid fa-arrows-rotate' },
  {
    label: 'Protect',
    path: '/security/protect',
    icon: 'fa-solid fa-lock',
  },
  {
    label: 'Unlock',
    path: '/security/unlock',
    icon: 'fa-solid fa-lock-open',
  },
  { label: 'Signature', path: '/signature', icon: 'fa-solid fa-signature' },
  { label: 'Recent', path: '/recent', icon: 'fa-solid fa-clock-rotate-left' },
  { label: 'Settings', path: '/settings', icon: 'fa-solid fa-gear' },
  { label: 'Help', path: '/help', icon: 'fa-solid fa-circle-question' },
];

export const EDITOR_TOOLS: EditorTool[] = [
  {
    id: 'select',
    label: 'Select',
    icon: 'fa-solid fa-arrow-pointer',
    shortcut: 'V',
    group: 'navigation',
  },
  {
    id: 'hand',
    label: 'Hand',
    icon: 'fa-solid fa-hand',
    shortcut: 'H',
    group: 'navigation',
  },
  {
    id: 'text',
    label: 'Text',
    icon: 'fa-solid fa-font',
    shortcut: 'T',
    group: 'content',
  },
  {
    id: 'highlight',
    label: 'Highlight',
    icon: 'fa-solid fa-highlighter',
    shortcut: 'Shift+H',
    group: 'content',
  },
  {
    id: 'underline',
    label: 'Underline',
    icon: 'fa-solid fa-underline',
    group: 'content',
  },
  {
    id: 'strikethrough',
    label: 'Strikethrough',
    icon: 'fa-solid fa-strikethrough',
    group: 'content',
  },
  {
    id: 'pen',
    label: 'Pen',
    icon: 'fa-solid fa-pen',
    group: 'drawing',
  },
  {
    id: 'freehand',
    label: 'Freehand',
    icon: 'fa-solid fa-pen-ruler',
    group: 'drawing',
  },
  {
    id: 'eraser',
    label: 'Eraser',
    icon: 'fa-solid fa-eraser',
    group: 'drawing',
  },
  {
    id: 'shape',
    label: 'Shapes',
    icon: 'fa-solid fa-shapes',
    shortcut: 'S',
    group: 'shapes',
  },
  {
    id: 'icon',
    label: 'Icons',
    icon: 'fa-solid fa-icons',
    shortcut: 'I',
    group: 'shapes',
  },
  {
    id: 'image',
    label: 'Image',
    icon: 'fa-solid fa-image',
    group: 'media',
  },
  {
    id: 'signature',
    label: 'Signature',
    icon: 'fa-solid fa-signature',
    group: 'media',
  },
  {
    id: 'stamp',
    label: 'Stamp',
    icon: 'fa-solid fa-stamp',
    group: 'media',
  },
  {
    id: 'comment',
    label: 'Comment',
    icon: 'fa-solid fa-comment',
    group: 'media',
  },
];

export interface ToolCategory {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly icon: string;
  readonly items: ToolCard[];
}

export interface ToolCard {
  readonly title: string;
  readonly description: string;
  readonly icon: string;
  readonly path: string;
  readonly badge?: string;
  readonly category?: 'edit' | 'organize' | 'optimize' | 'security';
}

export const TOOL_CATEGORIES: ToolCategory[] = [
  {
    id: 'edit',
    title: 'Edit & Annotate',
    description: 'Open a PDF and modify it directly in your browser.',
    icon: 'fa-solid fa-pen-to-square',
    items: [
      {
        title: 'PDF Editor',
        description:
          'Add text, shapes, highlights, signatures and images. All locally.',
        icon: 'fa-solid fa-pen-to-square',
        path: '/editor',
        badge: 'Full Studio',
        category: 'edit',
      },
      {
        title: 'Add Signature',
        description: 'Draw, type, or upload your signature and place it.',
        icon: 'fa-solid fa-signature',
        path: '/signature',
        badge: 'Sign & Save',
        category: 'edit',
      },
    ],
  },
  {
    id: 'organize',
    title: 'Organize',
    description: 'Reorder, combine and split documents.',
    icon: 'fa-solid fa-object-group',
    items: [
      {
        title: 'Merge PDF',
        description: 'Combine multiple PDFs into a single document.',
        icon: 'fa-solid fa-object-group',
        path: '/merge',
        badge: 'Combine Files',
        category: 'organize',
      },
      {
        title: 'Split PDF',
        description: 'Extract pages or split by range into new files.',
        icon: 'fa-solid fa-scissors',
        path: '/split',
        badge: 'Page Ranges',
        category: 'organize',
      },
    ],
  },
  {
    id: 'optimize',
    title: 'Optimize',
    description: 'Reduce size and convert formats.',
    icon: 'fa-solid fa-compress',
    items: [
      {
        title: 'Compress PDF',
        description: 'Shrink file size with honest, local compression.',
        icon: 'fa-solid fa-compress',
        path: '/compress',
        badge: 'Reduce Size',
        category: 'optimize',
      },
      {
        title: 'Convert PDF',
        description: 'PDF to PNG/JPG/Text and images back to PDF.',
        icon: 'fa-solid fa-arrows-rotate',
        path: '/convert',
        badge: 'Multi-Format',
        category: 'optimize',
      },
    ],
  },
  {
    id: 'security',
    title: 'Security',
    description: 'Protect and unlock documents.',
    icon: 'fa-solid fa-lock',
    items: [
      {
        title: 'Protect PDF',
        description: 'Add a password and permission restrictions.',
        icon: 'fa-solid fa-lock',
        path: '/security/protect',
        badge: 'AES-256',
        category: 'security',
      },
      {
        title: 'Unlock PDF',
        description: 'Remove a password from a supported PDF.',
        icon: 'fa-solid fa-lock-open',
        path: '/security/unlock',
        badge: 'Decrypt',
        category: 'security',
      },
      {
        title: 'Verify & Forensics',
        description: 'Verify digital signatures, check tampering, and inspect revision history.',
        icon: 'fa-solid fa-shield-halved',
        path: '/security/verify',
        badge: 'Forensics',
        category: 'security',
      },
      {
        title: 'Edit Metadata',
        description: 'View, edit, or sanitize hidden PDF author and document properties.',
        icon: 'fa-solid fa-circle-info',
        path: '/security/metadata',
        badge: 'Clean Exif',
        category: 'security',
      },
    ],
  },
];
