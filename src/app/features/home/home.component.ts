import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { NgClass } from '@angular/common';
import { TOOL_CATEGORIES, ToolCard } from '../../core/constants/tools';
import { FileService } from '../../core/services/file/file.service';
import { LoadedFile } from '../../core/models/file.models';
import { FileDropzoneComponent } from '../../shared/components/dropzone/file-dropzone.component';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink, NgClass, FileDropzoneComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss'
})
export class HomeComponent {
  private readonly router = inject(Router);
  private readonly files = inject(FileService);
  readonly categories = TOOL_CATEGORIES;

  readonly stats = [
    { value: '100%', label: 'Client-Side Processing' },
    { value: '0 Bytes', label: 'Uploaded to Any Server' },
    { value: '< 15ms', label: 'Local Tool Latency' },
    { value: 'Free Forever', label: 'No Limits or Subscriptions' },
  ];

  readonly featuredTools: ToolCard[] = [
    {
      title: 'PDF Editor',
      description: 'Add text, shapes, freehand annotations, signatures, and images with real-time vector canvas.',
      icon: 'fa-solid fa-pen-to-square',
      path: '/editor',
      badge: 'All-in-One',
      category: 'edit',
    },
    {
      title: 'Merge PDF',
      description: 'Combine multiple PDF documents into a clean, unified document with easy visual reordering.',
      icon: 'fa-solid fa-object-group',
      path: '/merge',
      badge: 'Batch',
      category: 'organize',
    },
    {
      title: 'Compress PDF',
      description: 'Dramatically reduce PDF file size with honest, local browser compression algorithms.',
      icon: 'fa-solid fa-compress',
      path: '/compress',
      badge: 'Up to 80%',
      category: 'optimize',
    },
    {
      title: 'Add Signature',
      description: 'Draw, type, or upload verifiable digital signatures and place them anywhere on your pages.',
      icon: 'fa-solid fa-signature',
      path: '/signature',
      badge: 'Verified',
      category: 'edit',
    },
    {
      title: 'Split PDF',
      description: 'Extract specific page ranges or burst all pages into standalone files in seconds.',
      icon: 'fa-solid fa-scissors',
      path: '/split',
      badge: 'Precision',
      category: 'organize',
    },
    {
      title: 'Verify & Forensics',
      description: 'Validate cryptographic signatures, detect tampering, and inspect revision history.',
      icon: 'fa-solid fa-shield-halved',
      path: '/security/verify',
      badge: 'Forensics',
      category: 'security',
    },
  ];

  readonly pillars = [
    {
      icon: 'fa-solid fa-shield-halved',
      title: 'Absolute Privacy & Zero Storage',
      description: 'Traditional PDF tools upload sensitive contracts, tax records, and medical files to remote servers. PDFForge computes everything in your browser memory sandbox.',
      tag: 'Zero Cloud',
    },
    {
      icon: 'fa-solid fa-bolt',
      title: 'Blazing WebAssembly Speed',
      description: 'Powered by native WASM and multi-threaded Web Workers. Eliminate waiting in upload/download queues and enjoy near-instant rendering.',
      tag: 'Native WASM',
    },
    {
      icon: 'fa-solid fa-infinity',
      title: 'Zero Paywalls or Watermarks',
      description: 'No monthly page caps, no artificial resolution downscaling, and no intrusive watermarks stamped onto your exported documents.',
      tag: '100% Free',
    },
    {
      icon: 'fa-solid fa-wifi',
      title: 'Works Completely Offline',
      description: 'Once loaded, the entire PDF suite runs flawlessly even when you have no internet access on flights or in high-security environments.',
      tag: 'Offline Ready',
    },
  ];

  readonly steps = [
    {
      num: '01',
      icon: 'fa-solid fa-arrow-up-from-bracket',
      title: 'Select or Drop Document',
      text: 'Open any PDF from your device into secure browser RAM. Nothing ever touches a server.',
    },
    {
      num: '02',
      icon: 'fa-solid fa-wand-magic-sparkles',
      title: 'Edit, Arrange & Perfect',
      text: 'Annotate, sign, merge, compress, or inspect with precision vector and crypto tools.',
    },
    {
      num: '03',
      icon: 'fa-solid fa-file-arrow-down',
      title: 'Save Directly to Device',
      text: 'Export pristine, high-resolution PDFs instantly without cloud lag or watermarks.',
    },
  ];

  readonly privacyPoints = [
    { icon: 'fa-solid fa-shield-halved', text: 'No account or sign up required' },
    { icon: 'fa-solid fa-server', text: 'Zero cloud servers, zero uploads' },
    { icon: 'fa-solid fa-lock', text: '100% client-side WebAssembly' },
    { icon: 'fa-solid fa-certificate', text: 'No watermarks on export' },
  ];

  async openPdf(): Promise<void> {
    const picked = await this.files.pickFile(false);
    if (picked.length) {
      await this.files.openInEditor(picked);
    }
  }

  onFilesLoaded(loaded: LoadedFile[]): void {
    if (loaded.length) {
      void this.router.navigate(['/editor']);
    }
  }
}
