import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-help',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './help.component.html',
  styleUrl: './help.component.scss',
})
export class HelpComponent {
  readonly faqs = [
    {
      q: 'Are my files uploaded anywhere?',
      a: 'No. PDFForge runs entirely in your browser. Files are read from your device and processed locally; they never leave it.',
    },
    {
      q: 'Do I need an account?',
      a: 'No account, no login, no signup. Open a PDF and start working immediately.',
    },
    {
      q: 'Which formats are supported?',
      a: 'PDF in, and out. You can also convert PDF to PNG/JPG/Text and turn images into PDF.',
    },
    {
      q: 'Is there a file size limit?',
      a: 'Processing is limited by your browser memory. Very large files may be slower but stay on your device.',
    },
  ];
}
