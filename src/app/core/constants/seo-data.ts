export interface BreadcrumbItem {
  readonly label: string;
  readonly path: string;
}

export interface SeoStep {
  readonly stepNumber: number;
  readonly title: string;
  readonly description: string;
  readonly icon: string;
}

export interface SeoFaq {
  readonly question: string;
  readonly answer: string;
}

export interface SeoBenefit {
  readonly title: string;
  readonly description: string;
  readonly icon: string;
}

export interface RelatedTool {
  readonly title: string;
  readonly description: string;
  readonly icon: string;
  readonly path: string;
  readonly badge?: string;
}

export interface PageSeoConfig {
  readonly title: string;
  readonly metaDescription: string;
  readonly keywords: string;
  readonly canonicalPath: string;
  readonly robots?: string;
  readonly ogType?: string;
  readonly breadcrumbs: BreadcrumbItem[];
  readonly heading: string;
  readonly subHeading: string;
  readonly howToTitle?: string;
  readonly steps?: SeoStep[];
  readonly benefitsTitle?: string;
  readonly benefits?: SeoBenefit[];
  readonly faqsTitle?: string;
  readonly faqs?: SeoFaq[];
  readonly relatedTools?: RelatedTool[];
}

export const SITE_NAME = 'iPDFEditor';
export const SITE_URL = 'https://ipdfeditor.pages.dev';
export const DEFAULT_OG_IMAGE = 'https://ipdfeditor.pages.dev/assets/og-image.svg';

export const SEO_CONFIGS: Record<string, PageSeoConfig> = {
  home: {
    title: 'iPDFEditor — Free Private PDF Editor & PDF Tools Online',
    metaDescription:
      'Professional free PDF editor & utility suite running 100% locally in your browser. Edit, annotate, merge, split, compress, convert, sign, and protect PDFs with zero server uploads.',
    keywords:
      'free pdf editor, edit pdf online, private pdf editor, browser pdf tools, merge pdf free, compress pdf, sign pdf online, no upload pdf editor',
    canonicalPath: '/',
    breadcrumbs: [{ label: 'Home', path: '/' }],
    heading: 'Professional PDF Studio. Zero Server Uploads.',
    subHeading:
      'Edit, annotate, merge, compress, sign, and inspect PDF documents directly inside your browser. Powered by local WebAssembly for maximum privacy.',
    howToTitle: 'How to Work with PDFs on iPDFEditor',
    steps: [
      {
        stepNumber: 1,
        title: 'Select a PDF Tool',
        description: 'Choose from PDF Editor, Merge, Split, Compress, Convert, or Security tools depending on your document needs.',
        icon: 'fa-solid fa-toolbox',
      },
      {
        stepNumber: 2,
        title: 'Load Files Locally',
        description: 'Drag and drop your PDF files. Processing runs immediately inside your browser RAM using WebAssembly.',
        icon: 'fa-solid fa-file-shield',
      },
      {
        stepNumber: 3,
        title: 'Process & Download',
        description: 'Perform your edits, conversions, or merges and download the resulting PDF instantly without waiting for cloud queues.',
        icon: 'fa-solid fa-circle-down',
      },
    ],
    benefitsTitle: 'Why Choose iPDFEditor?',
    benefits: [
      {
        title: '100% Client-Side Privacy',
        description: 'Documents never touch a remote server, database, or third-party cloud. Complete confidentiality guaranteed.',
        icon: 'fa-solid fa-shield-halved',
      },
      {
        title: 'Zero Subscriptions & Free',
        description: 'Every tool is completely free with no hidden paywalls, page limits, watermarks, or account registration required.',
        icon: 'fa-solid fa-circle-check',
      },
      {
        title: 'WebAssembly Performance',
        description: 'Fast local processing powered by QPDF WebAssembly, Tesseract OCR, and multi-threaded Web Workers.',
        icon: 'fa-solid fa-bolt',
      },
      {
        title: 'Works Completely Offline',
        description: 'Once loaded in your browser cache, you can edit and process sensitive documents even without an internet connection.',
        icon: 'fa-solid fa-wifi',
      },
    ],
    faqsTitle: 'Frequently Asked Questions about iPDFEditor',
    faqs: [
      {
        question: 'Is iPDFEditor really completely free to use?',
        answer:
          'Yes, iPDFEditor is 100% free with no trial periods, no subscription tiers, no page count restrictions, and no watermarks added to your documents.',
      },
      {
        question: 'Are my PDF files uploaded to any servers?',
        answer:
          'No. Unlike traditional PDF websites, iPDFEditor executes all processing locally on your device via client-side WebAssembly, JavaScript, and HTML5 APIs. Your confidential files never leave your browser.',
      },
      {
        question: 'Can I use iPDFEditor offline without an internet connection?',
        answer:
          'Yes! Because all core PDF libraries and WebAssembly binaries run directly within your browser, once cached you can edit, merge, split, and sign PDFs offline.',
      },
      {
        question: 'Is there a limit on PDF file size?',
        answer:
          'There are no arbitrary cloud upload caps. File capacity is limited only by your computer or device’s available memory (RAM), allowing you to process large files with ease.',
      },
      {
        question: 'What PDF operations are supported in iPDFEditor?',
        answer:
          'iPDFEditor supports visual editing (text, shapes, drawing, stamps, highlights), page management (reorder, duplicate, rotate, delete), merging, splitting, QPDF-powered compression, conversion (Word, JPG, PNG, Text OCR), digital signatures, and 256-bit AES encryption.',
      },
    ],
  },

  editor: {
    title: 'Free PDF Editor Online — Edit & Annotate PDFs Privately | iPDFEditor',
    metaDescription:
      'Edit PDF files directly in your web browser for free. Add text, highlights, freehand drawing, shapes, images, signatures, and stamps. 100% private with no file upload.',
    keywords:
      'free pdf editor online, edit pdf in browser, annotate pdf free, add text to pdf, draw on pdf, private pdf editor, pdf editor no upload, sign pdf document',
    canonicalPath: '/editor',
    breadcrumbs: [
      { label: 'Home', path: '/' },
      { label: 'Tools', path: '/tools' },
      { label: 'PDF Editor', path: '/editor' },
    ],
    heading: 'Free Online PDF Editor & Annotator',
    subHeading:
      'A full-featured studio to add text, signatures, drawings, highlights, and shapes to your PDF documents locally.',
    howToTitle: 'How to Edit a PDF Online for Free',
    steps: [
      {
        stepNumber: 1,
        title: 'Open Your PDF',
        description: 'Drag and drop your PDF file or select it from your device. The document loads instantly into your browser’s local RAM.',
        icon: 'fa-solid fa-folder-open',
      },
      {
        stepNumber: 2,
        title: 'Annotate & Modify',
        description: 'Use the top toolbar to insert text, highlight passages, draw with the pen, place geometric shapes, or add an electronic signature.',
        icon: 'fa-solid fa-pen-to-square',
      },
      {
        stepNumber: 3,
        title: 'Export & Download',
        description: 'Click "Export PDF" to compile all changes into a clean, high-resolution document. Your new file downloads instantly with zero watermarks.',
        icon: 'fa-solid fa-download',
      },
    ],
    benefitsTitle: 'Why Choose iPDFEditor to Edit Your PDFs?',
    benefits: [
      {
        title: '100% Private Sandbox',
        description: 'Unlike traditional cloud editors, your PDF never uploads to remote servers. All rendering and edits happen securely on your device.',
        icon: 'fa-solid fa-shield-halved',
      },
      {
        title: 'Complete Annotation Suite',
        description: 'Full support for custom fonts, stroke colors, geometric shapes, highlighters, digital stamps, and multi-page thumbnails.',
        icon: 'fa-solid fa-layer-group',
      },
      {
        title: 'Unlimited & Free',
        description: 'No page quotas, no subscriptions, no credit card required, and absolutely no promotional watermarks added to your documents.',
        icon: 'fa-solid fa-infinity',
      },
    ],
    faqsTitle: 'Frequently Asked Questions About Editing PDFs',
    faqs: [
      {
        question: 'Are my PDF documents uploaded to your servers when I edit them?',
        answer: 'No. iPDFEditor operates on a 100% client-side architecture. Your PDF files are read into local browser memory using HTML5 File APIs and processed with WebAssembly. No document content or metadata is ever transmitted across the network.',
      },
      {
        question: 'Can I edit the existing embedded text in a PDF?',
        answer: 'iPDFEditor allows you to add overlay text, whiteout/redact sections, insert shapes, and annotate documents. Modifying embedded binary vector font glyphs directly is restricted to protect document layout integrity, but you can effortlessly add new text layers anywhere.',
      },
      {
        question: 'Does iPDFEditor add a watermark to my exported PDF?',
        answer: 'Never. All PDF exports are 100% clean, professional, and free of any watermarks or branding.',
      },
      {
        question: 'What file size limit applies to the PDF Editor?',
        answer: 'Because processing happens on your local device, file sizes are limited only by your browser’s available memory (RAM). Standard documents up to hundreds of megabytes process smoothly.',
      },
    ],
    relatedTools: [
      {
        title: 'Merge PDF',
        description: 'Combine multiple PDF files into one ordered document.',
        icon: 'fa-solid fa-object-group',
        path: '/merge',
        badge: 'Combine',
      },
      {
        title: 'Signature Studio',
        description: 'Draw or type your signature and save as transparent PNG.',
        icon: 'fa-solid fa-signature',
        path: '/signature',
        badge: 'Sign',
      },
      {
        title: 'Compress PDF',
        description: 'Reduce PDF file size without sacrificing readability.',
        icon: 'fa-solid fa-compress',
        path: '/compress',
        badge: 'Optimize',
      },
    ],
  },

  merge: {
    title: 'Merge PDF Files Online Free — Combine PDFs Privately | iPDFEditor',
    metaDescription:
      'Merge multiple PDF documents into a single ordered file online for free. Reorder files and pages with drag-and-drop. 100% local processing with zero server uploads.',
    keywords:
      'merge pdf, merge pdf online, combine pdf files, join pdfs free, merge pdf no upload, combine pdf documents, local pdf merger',
    canonicalPath: '/merge',
    breadcrumbs: [
      { label: 'Home', path: '/' },
      { label: 'Tools', path: '/tools' },
      { label: 'Merge PDF', path: '/merge' },
    ],
    heading: 'Merge Multiple PDF Files Online',
    subHeading:
      'Easily combine 2 or more PDF documents into a single unified file. Reorder pages, preview content, and download instantly without cloud uploads.',
    howToTitle: 'How to Merge PDF Files in 3 Simple Steps',
    steps: [
      {
        stepNumber: 1,
        title: 'Select Multiple PDFs',
        description: 'Drag and drop two or more PDF files into the dropzone or click "Choose Files".',
        icon: 'fa-solid fa-files',
      },
      {
        stepNumber: 2,
        title: 'Arrange Document Order',
        description: 'Drag and drop files to change their sequence, use the A-Z / Reverse sort buttons, or click "Preview Pages" to inspect each file.',
        icon: 'fa-solid fa-arrow-down-a-z',
      },
      {
        stepNumber: 3,
        title: 'Merge & Download',
        description: 'Click "Merge Files". The multi-threaded Web Worker joins your files in seconds for immediate download.',
        icon: 'fa-solid fa-file-arrow-down',
      },
    ],
    benefitsTitle: 'Key Advantages of Merging PDFs with iPDFEditor',
    benefits: [
      {
        title: 'Zero Cloud Queues',
        description: 'Files merge locally in your browser memory using WebAssembly. You never have to wait for uploads or server processing queues.',
        icon: 'fa-solid fa-bolt',
      },
      {
        title: 'Built-in Page Preview',
        description: 'Browse the exact pages of each PDF before merging to ensure every page is oriented and ordered properly.',
        icon: 'fa-solid fa-eye',
      },
      {
        title: 'Strict Data Privacy',
        description: 'Ideal for legal, financial, healthcare, and sensitive contracts. Documents never leave your computer or phone.',
        icon: 'fa-solid fa-lock',
      },
    ],
    faqsTitle: 'Frequently Asked Questions About Merging PDFs',
    faqs: [
      {
        question: 'Is there a limit on how many PDFs I can merge at once?',
        answer: 'No arbitrary limits exist. You can merge 2, 5, 20, or more documents simultaneously as long as your device has adequate browser memory.',
      },
      {
        question: 'Will merging PDFs reduce the quality of text or images?',
        answer: 'No. iPDFEditor performs direct binary stream concatenation using pdf-lib. All vectors, embedded fonts, and images retain their original crisp quality.',
      },
      {
        question: 'Can I reorder individual pages within the merged document?',
        answer: 'Yes! After merging, you can click "Open in PDF Editor" to rotate, rearrange, or remove individual pages before your final save.',
      },
    ],
    relatedTools: [
      {
        title: 'Split PDF',
        description: 'Extract pages or split a PDF into separate files.',
        icon: 'fa-solid fa-scissors',
        path: '/split',
        badge: 'Organize',
      },
      {
        title: 'Compress PDF',
        description: 'Shrink your newly merged PDF for easy emailing.',
        icon: 'fa-solid fa-compress',
        path: '/compress',
        badge: 'Reduce Size',
      },
      {
        title: 'Protect PDF',
        description: 'Add a password and restrict permissions on your document.',
        icon: 'fa-solid fa-lock',
        path: '/security/protect',
        badge: 'AES-256',
      },
    ],
  },

  split: {
    title: 'Split PDF Online Free — Extract Pages & Separate PDFs | iPDFEditor',
    metaDescription:
      'Split PDF documents or extract custom page ranges online for free. Split every page into separate files or package extracted pages in a ZIP. 100% private.',
    keywords:
      'split pdf, split pdf online, extract pages from pdf, separate pdf pages, split pdf into multiple files free, extract pdf pages no upload',
    canonicalPath: '/split',
    breadcrumbs: [
      { label: 'Home', path: '/' },
      { label: 'Tools', path: '/tools' },
      { label: 'Split PDF', path: '/split' },
    ],
    heading: 'Split & Extract PDF Pages Online',
    subHeading:
      'Separate PDF documents into individual pages or extract custom page selections into a new document with zero server uploads.',
    howToTitle: 'How to Split or Extract Pages from a PDF',
    steps: [
      {
        stepNumber: 1,
        title: 'Upload Your Document',
        description: 'Select or drop your PDF document to load all page thumbnails and metrics into the interactive visual grid.',
        icon: 'fa-solid fa-file-pdf',
      },
      {
        stepNumber: 2,
        title: 'Select Pages or Range',
        description: 'Click page thumbnails, type page ranges (e.g. 1-3, 5), or use quick presets like Odd, Even, or First Half.',
        icon: 'fa-solid fa-table-cells-large',
      },
      {
        stepNumber: 3,
        title: 'Split & Save',
        description: 'Choose "Extract Selected" for a single combined PDF, or "Split Every Page" for individual files packaged cleanly in a ZIP archive.',
        icon: 'fa-solid fa-file-zipper',
      },
    ],
    benefitsTitle: 'Why Split PDFs with iPDFEditor?',
    benefits: [
      {
        title: 'Live Synchronized Preview',
        description: 'Examine high-resolution page previews before confirming your extraction to avoid missing critical content.',
        icon: 'fa-solid fa-magnifying-glass',
      },
      {
        title: 'Convenient ZIP Packaging',
        description: 'When splitting large multi-page documents, iPDFEditor automatically packages all individual page files into a single ZIP file.',
        icon: 'fa-solid fa-box-archive',
      },
      {
        title: 'Fast Client-Side Execution',
        description: 'Page splitting runs inside dedicated background Web Workers, keeping your browser UI responsive.',
        icon: 'fa-solid fa-microchip',
      },
    ],
    faqsTitle: 'Frequently Asked Questions About Splitting PDFs',
    faqs: [
      {
        question: 'How do I extract only specific non-consecutive pages?',
        answer: 'You can either click individual page cards in the visual grid or type comma-separated ranges into the range input (e.g. "1-3, 7, 10-12").',
      },
      {
        question: 'Can I split a password-protected PDF?',
        answer: 'If the PDF is password-protected, use our "Unlock PDF" tool first with your known password, then split the resulting document.',
      },
      {
        question: 'Is there any compression or quality loss during splitting?',
        answer: 'No. Extracted pages are copied losslessly using pdf-lib, preserving exact resolution, fonts, and vector quality.',
      },
    ],
    relatedTools: [
      {
        title: 'Merge PDF',
        description: 'Combine multiple extracted documents into one file.',
        icon: 'fa-solid fa-object-group',
        path: '/merge',
        badge: 'Combine',
      },
      {
        title: 'PDF Editor',
        description: 'Reorder, rotate, or annotate pages directly.',
        icon: 'fa-solid fa-pen-to-square',
        path: '/editor',
        badge: 'Studio',
      },
      {
        title: 'Convert PDF',
        description: 'Convert extracted PDF pages to Word or image formats.',
        icon: 'fa-solid fa-arrows-rotate',
        path: '/convert',
        badge: 'Convert',
      },
    ],
  },

  compress: {
    title: 'Compress PDF Online Free — Reduce PDF File Size | iPDFEditor',
    metaDescription:
      'Reduce PDF file size locally in your browser for free. WebAssembly-powered stream compression and image optimization. Honest before/after metrics with zero file uploads.',
    keywords:
      'compress pdf, compress pdf online, reduce pdf size, shrink pdf file, compress pdf free no upload, offline pdf compressor, optimize pdf',
    canonicalPath: '/compress',
    breadcrumbs: [
      { label: 'Home', path: '/' },
      { label: 'Tools', path: '/tools' },
      { label: 'Compress PDF', path: '/compress' },
    ],
    heading: 'Compress PDF File Size Online',
    subHeading:
      'Shrink your PDF documents for email attachments and web portals using local WebAssembly stream compression. 100% private.',
    howToTitle: 'How to Reduce PDF File Size in 3 Steps',
    steps: [
      {
        stepNumber: 1,
        title: 'Choose PDF File',
        description: 'Drop or select your PDF to instantly display its exact byte size and page details.',
        icon: 'fa-solid fa-file-arrow-up',
      },
      {
        stepNumber: 2,
        title: 'Select Compression Level',
        description: 'Choose Recommended (best quality/size balance), Strong (smaller file), or Extreme (maximum byte reduction).',
        icon: 'fa-solid fa-sliders',
      },
      {
        stepNumber: 3,
        title: 'Download Optimized PDF',
        description: 'View real-time byte savings and reduction percentage, then download your optimized document immediately.',
        icon: 'fa-solid fa-circle-arrow-down',
      },
    ],
    benefitsTitle: 'Honest, Client-Side PDF Compression',
    benefits: [
      {
        title: 'Real WebAssembly Engine',
        description: 'Powered by QPDF WebAssembly and object stream regeneration for genuine byte-level optimization.',
        icon: 'fa-solid fa-gears',
      },
      {
        title: 'No Fabricated Percentages',
        description: 'Unlike commercial websites that show fake 90% banners, iPDFEditor calculates and reports true mathematical byte reductions.',
        icon: 'fa-solid fa-calculator',
      },
      {
        title: 'Text Remains Razor Sharp',
        description: 'Vector fonts and structural definitions are preserved while internal object overhead and duplicate font descriptors are purged.',
        icon: 'fa-solid fa-font',
      },
    ],
    faqsTitle: 'Frequently Asked Questions About PDF Compression',
    faqs: [
      {
        question: 'Why does my PDF only compress by a small amount?',
        answer: 'If your PDF consists entirely of pre-compressed JPEG images or scanned photos that are already tightly encoded, further lossless reduction is minimal. iPDFEditor reports honest results rather than modifying your document destructively.',
      },
      {
        question: 'Will compressed PDFs still open in standard readers like Adobe Acrobat?',
        answer: 'Yes. All outputs strictly follow standard ISO 32000 PDF specifications and open seamlessly in Adobe Acrobat, Chrome, Preview, and mobile readers.',
      },
      {
        question: 'Are my confidential documents uploaded during compression?',
        answer: 'No. Compression is executed entirely inside your browser via WebAssembly. Your documents never touch external servers or third-party APIs.',
      },
    ],
    relatedTools: [
      {
        title: 'PDF to Word',
        description: 'Convert PDF into an editable Microsoft Word document.',
        icon: 'fa-solid fa-file-word',
        path: '/convert',
        badge: 'Docx',
      },
      {
        title: 'Merge PDF',
        description: 'Combine multiple PDFs before compressing.',
        icon: 'fa-solid fa-object-group',
        path: '/merge',
        badge: 'Organize',
      },
      {
        title: 'Protect PDF',
        description: 'Encrypt your compressed document with a password.',
        icon: 'fa-solid fa-lock',
        path: '/security/protect',
        badge: 'Security',
      },
    ],
  },

  convert: {
    title: 'Convert PDF Online Free — PDF to Word, OCR, Images | iPDFEditor',
    metaDescription:
      'Free multi-format PDF converter running locally in your browser. Convert PDF to Word (.docx), extract text via Tesseract OCR, convert Images to PDF, or export PDF to PNG/JPG.',
    keywords:
      'convert pdf, pdf to word, pdf to docx online free, images to pdf, jpg to pdf, pdf ocr text extractor, pdf to png, private pdf converter',
    canonicalPath: '/convert',
    breadcrumbs: [
      { label: 'Home', path: '/' },
      { label: 'Tools', path: '/tools' },
      { label: 'Convert PDF', path: '/convert' },
    ],
    heading: 'Multi-Format PDF Converter & OCR Studio',
    subHeading:
      'Convert PDFs to editable Word (.docx), extract text with local Tesseract OCR, combine images into PDF, or rasterize pages to PNG and JPG.',
    howToTitle: 'How to Convert PDF Documents Locally',
    steps: [
      {
        stepNumber: 1,
        title: 'Select Conversion Mode',
        description: 'Choose between PDF to Word (.docx), PDF to Text (OCR), Images to PDF, PDF to PNG, or PDF to JPG.',
        icon: 'fa-solid fa-arrows-rotate',
      },
      {
        stepNumber: 2,
        title: 'Drop Your Files',
        description: 'Upload your PDF or image files. Everything stays local in your browser memory.',
        icon: 'fa-solid fa-file-arrow-up',
      },
      {
        stepNumber: 3,
        title: 'Convert & Save',
        description: 'Click Convert to run the client-side engine. Download your converted Word doc, text file, or image archive immediately.',
        icon: 'fa-solid fa-download',
      },
    ],
    benefitsTitle: 'Browser-Based Conversion Capabilities',
    benefits: [
      {
        title: 'Local Tesseract.js OCR',
        description: 'Extract machine-readable text from scanned PDFs and images using neural network OCR models running entirely in your browser.',
        icon: 'fa-solid fa-brain',
      },
      {
        title: 'Direct Word (.docx) Generation',
        description: 'Generates genuine Microsoft Word .docx files client-side without sending your confidential text to third-party conversion servers.',
        icon: 'fa-solid fa-file-word',
      },
      {
        title: 'High-Resolution Image Support',
        description: 'Combine PNG, JPEG, and WebP images into a single crisp PDF or extract high-DPI raster images from PDF pages.',
        icon: 'fa-solid fa-images',
      },
    ],
    faqsTitle: 'Frequently Asked Questions About Converting PDFs',
    faqs: [
      {
        question: 'How does PDF to Word conversion work without a server?',
        answer: 'iPDFEditor uses client-side optical character recognition (OCR) and layout parsers to extract document text and build an OpenXML (.docx) ZIP structure directly in browser memory.',
      },
      {
        question: 'Can I combine multiple photos into a single PDF?',
        answer: 'Yes! Select the "Images → PDF" mode, upload your JPG, PNG, or WebP images, and iPDFEditor will embed each image as a full-resolution PDF page.',
      },
      {
        question: 'Does the OCR tool support scanned documents?',
        answer: 'Yes. The Tesseract.js engine analyzes visual page scans to detect printed characters and convert them into copyable, editable text.',
      },
    ],
    relatedTools: [
      {
        title: 'PDF Editor',
        description: 'Annotate and modify your PDF before converting.',
        icon: 'fa-solid fa-pen-to-square',
        path: '/editor',
        badge: 'Studio',
      },
      {
        title: 'Merge PDF',
        description: 'Combine multiple PDFs into a single file.',
        icon: 'fa-solid fa-object-group',
        path: '/merge',
        badge: 'Organize',
      },
      {
        title: 'Compress PDF',
        description: 'Reduce the file size of your converted PDF.',
        icon: 'fa-solid fa-compress',
        path: '/compress',
        badge: 'Optimize',
      },
    ],
  },

  protect: {
    title: 'Protect PDF with Password Online Free — AES-256 Encryption | iPDFEditor',
    metaDescription:
      'Password-protect your PDF document locally with industry-standard AES-256 encryption. Restrict printing, text copying, and modifications without uploading your file.',
    keywords:
      'protect pdf, encrypt pdf online, password protect pdf free, aes 256 pdf encryption, lock pdf file, secure pdf document no upload',
    canonicalPath: '/security/protect',
    breadcrumbs: [
      { label: 'Home', path: '/' },
      { label: 'Tools', path: '/tools' },
      { label: 'Protect PDF', path: '/security/protect' },
    ],
    heading: 'Protect PDF with AES-256 Password Encryption',
    subHeading:
      'Add a secure user password and granular permission restrictions to your PDF file locally using WebAssembly. 100% private.',
    howToTitle: 'How to Encrypt & Protect a PDF File',
    steps: [
      {
        stepNumber: 1,
        title: 'Choose PDF File',
        description: 'Drop or select your unprotected PDF document.',
        icon: 'fa-solid fa-file-shield',
      },
      {
        stepNumber: 2,
        title: 'Set Password & Permissions',
        description: 'Enter a strong password and toggle permission settings for printing, text extraction/copying, and editing.',
        icon: 'fa-solid fa-key',
      },
      {
        stepNumber: 3,
        title: 'Encrypt & Download',
        description: 'Click "Protect PDF". The QPDF WebAssembly engine applies AES-256 encryption and delivers your secured document.',
        icon: 'fa-solid fa-lock',
      },
    ],
    benefitsTitle: 'Enterprise-Grade PDF Protection',
    benefits: [
      {
        title: 'Authentic AES-256 Encryption',
        description: 'Uses military-grade 256-bit AES encryption supported by all modern PDF viewers and operating systems.',
        icon: 'fa-solid fa-shield-halved',
      },
      {
        title: 'Granular Document Permissions',
        description: 'Control whether recipients can print the document, copy text to clipboard, or alter form fields.',
        icon: 'fa-solid fa-list-check',
      },
      {
        title: 'Your Password Never Leaves Your Device',
        description: 'Unlike online services where passwords pass through cloud servers, encryption happens entirely on your local machine.',
        icon: 'fa-solid fa-user-lock',
      },
    ],
    faqsTitle: 'Frequently Asked Questions About PDF Protection',
    faqs: [
      {
        question: 'What encryption standard is used to protect the PDF?',
        answer: 'iPDFEditor uses standard 256-bit AES (Advanced Encryption Standard) encryption via QPDF WebAssembly, the industry gold standard for PDF document security.',
      },
      {
        question: 'Can iPDFEditor recover my password if I forget it?',
        answer: 'No. Because encryption is performed locally and no data is ever transmitted to a server, we do not have access to your document or your password.',
      },
      {
        question: 'Will recipients need special software to open the protected PDF?',
        answer: 'No. Any standard PDF reader (Chrome, Safari, Edge, Adobe Acrobat, Preview) will prompt for the password upon opening.',
      },
    ],
    relatedTools: [
      {
        title: 'Unlock PDF',
        description: 'Remove a password from a protected PDF document.',
        icon: 'fa-solid fa-lock-open',
        path: '/security/unlock',
        badge: 'Decrypt',
      },
      {
        title: 'Verify & Forensics',
        description: 'Check digital signature validity and document tampering.',
        icon: 'fa-solid fa-shield-halved',
        path: '/security/verify',
        badge: 'Forensics',
      },
      {
        title: 'Edit Metadata',
        description: 'Sanitize author information before sharing.',
        icon: 'fa-solid fa-circle-info',
        path: '/security/metadata',
        badge: 'Sanitize',
      },
    ],
  },

  unlock: {
    title: 'Unlock PDF Online Free — Remove PDF Password Decrypt | iPDFEditor',
    metaDescription:
      'Remove password security from your PDF documents online for free. Decrypt password-protected PDFs locally using browser WebAssembly with zero server uploads.',
    keywords:
      'unlock pdf, remove password from pdf, decrypt pdf online, unlock protected pdf free, remove pdf security no upload',
    canonicalPath: '/security/unlock',
    breadcrumbs: [
      { label: 'Home', path: '/' },
      { label: 'Tools', path: '/tools' },
      { label: 'Unlock PDF', path: '/security/unlock' },
    ],
    heading: 'Unlock & Decrypt PDF Documents Online',
    subHeading:
      'Remove password restrictions from your PDF document for unrestricted editing, copying, and printing. 100% private.',
    howToTitle: 'How to Remove Password from a PDF',
    steps: [
      {
        stepNumber: 1,
        title: 'Select Locked PDF',
        description: 'Drop or select your password-protected PDF file.',
        icon: 'fa-solid fa-file-circle-question',
      },
      {
        stepNumber: 2,
        title: 'Enter Correct Password',
        description: 'Type the document password to authorize decryption.',
        icon: 'fa-solid fa-key',
      },
      {
        stepNumber: 3,
        title: 'Decrypt & Save',
        description: 'Click "Unlock PDF" to strip encryption locally and download an unrestricted, permanent copy.',
        icon: 'fa-solid fa-lock-open',
      },
    ],
    benefitsTitle: 'Safe & Legal PDF Decryption',
    benefits: [
      {
        title: 'Permanent Password Removal',
        description: 'Removes the password prompt so you and your team can access, print, and search the file freely.',
        icon: 'fa-solid fa-circle-check',
      },
      {
        title: 'Local Browser Decryption',
        description: 'The decryption process runs inside your device’s WebAssembly sandbox. Your password is never logged or transmitted.',
        icon: 'fa-solid fa-shield-halved',
      },
      {
        title: 'Lossless Export',
        description: 'Retains all original page layouts, bookmarks, vector graphics, and embedded fonts without degradation.',
        icon: 'fa-solid fa-gem',
      },
    ],
    faqsTitle: 'Frequently Asked Questions About Unlocking PDFs',
    faqs: [
      {
        question: 'Do I need to know the password to unlock the PDF?',
        answer: 'Yes. iPDFEditor is designed for legitimate document owners to remove passwords and security restrictions. You must enter the valid password to authorize decryption.',
      },
      {
        question: 'Is my password sent to any remote server?',
        answer: 'Never. Decryption is performed entirely within your web browser using QPDF WebAssembly. Neither the file nor the password leaves your device.',
      },
    ],
    relatedTools: [
      {
        title: 'Protect PDF',
        description: 'Add a new password and restrict permissions.',
        icon: 'fa-solid fa-lock',
        path: '/security/protect',
        badge: 'Encrypt',
      },
      {
        title: 'PDF Editor',
        description: 'Edit and annotate your unlocked document.',
        icon: 'fa-solid fa-pen-to-square',
        path: '/editor',
        badge: 'Studio',
      },
      {
        title: 'Merge PDF',
        description: 'Combine unlocked documents with other files.',
        icon: 'fa-solid fa-object-group',
        path: '/merge',
        badge: 'Organize',
      },
    ],
  },

  verify: {
    title: 'Verify PDF Digital Signature & Forensics Online | iPDFEditor',
    metaDescription:
      'Verify digital signatures and inspect PDF document integrity locally in your browser. Check certificate validity, detect tampering, and extract isolated historical revisions.',
    keywords:
      'verify pdf signature, check digital signature pdf, pdf forensics online, verify pdf tampering, inspect pdf revisions, pdf authenticity check',
    canonicalPath: '/security/verify',
    breadcrumbs: [
      { label: 'Home', path: '/' },
      { label: 'Tools', path: '/tools' },
      { label: 'Verify & Forensics', path: '/security/verify' },
    ],
    heading: 'Verify Digital Signatures & Document Forensics',
    subHeading:
      'Inspect cryptographic certificate signatures, check for post-signing alterations, and extract historical incremental document revisions locally.',
    howToTitle: 'How to Verify a Signed PDF Document',
    steps: [
      {
        stepNumber: 1,
        title: 'Upload Signed Document',
        description: 'Select or drop any digitally signed PDF contract or legal agreement.',
        icon: 'fa-solid fa-file-contract',
      },
      {
        stepNumber: 2,
        title: 'Cryptographic Audit',
        description: 'iPDFEditor inspects the byte-range signature dictionary, certificates, signer name, and signing timestamp.',
        icon: 'fa-solid fa-magnifying-glass-chart',
      },
      {
        stepNumber: 3,
        title: 'Forensic Revision History',
        description: 'View the timeline of incremental updates and download isolated earlier revisions to verify if the file was modified after signing.',
        icon: 'fa-solid fa-clock-rotate-left',
      },
    ],
    benefitsTitle: 'Forensic Precision for Legal & Financial Compliance',
    benefits: [
      {
        title: 'Tamper Detection',
        description: 'Instantly highlights whether document bytes were altered or appended after the digital signature was applied.',
        icon: 'fa-solid fa-triangle-exclamation',
      },
      {
        title: 'Revision Extraction',
        description: 'Download the exact state of the document at Revision 1 as it existed when the original author signed it.',
        icon: 'fa-solid fa-code-compare',
      },
      {
        title: 'Private Document Verification',
        description: 'Verify confidential contracts, NDAs, and corporate audits with zero risk of document leakage.',
        icon: 'fa-solid fa-shield-halved',
      },
    ],
    faqsTitle: 'Frequently Asked Questions About PDF Signature Verification',
    faqs: [
      {
        question: 'What is the difference between an electronic stamp and a digital signature?',
        answer: 'An electronic stamp is a visual drawing or image placed on a page. A cryptographic digital signature contains an encrypted mathematical hash (PKCS#7 / CMS) tying the signer’s certificate to the exact byte content of the document.',
      },
      {
        question: 'Can this tool extract the original document if changes were made after signing?',
        answer: 'Yes! PDF documents use incremental updates for signatures. iPDFEditor locates the historical EOF markers and allows you to isolate and download the original Revision 1 document.',
      },
    ],
    relatedTools: [
      {
        title: 'Signature Studio',
        description: 'Create and draw custom signatures.',
        icon: 'fa-solid fa-signature',
        path: '/signature',
        badge: 'Sign',
      },
      {
        title: 'Edit Metadata',
        description: 'Inspect and clean hidden document properties.',
        icon: 'fa-solid fa-circle-info',
        path: '/security/metadata',
        badge: 'Exif',
      },
      {
        title: 'Protect PDF',
        description: 'Add password encryption to your verified document.',
        icon: 'fa-solid fa-lock',
        path: '/security/protect',
        badge: 'Encrypt',
      },
    ],
  },

  metadata: {
    title: 'Edit & Sanitize PDF Metadata Online Free — Clean Exif | iPDFEditor',
    metaDescription:
      'View, edit, and wipe hidden PDF metadata properties locally in your browser. Clean author names, creation dates, software producer tags, and XMP streams for total privacy.',
    keywords:
      'edit pdf metadata, sanitize pdf, remove metadata from pdf, clean pdf exif, view pdf metadata, strip author from pdf online free',
    canonicalPath: '/security/metadata',
    breadcrumbs: [
      { label: 'Home', path: '/' },
      { label: 'Tools', path: '/tools' },
      { label: 'Edit Metadata', path: '/security/metadata' },
    ],
    heading: 'PDF Metadata Inspector & Sanitizer',
    subHeading:
      'View and edit document properties, or sanitize all hidden author tags, creation timestamps, and software signatures with one click. 100% private.',
    howToTitle: 'How to Inspect & Sanitize PDF Metadata',
    steps: [
      {
        stepNumber: 1,
        title: 'Load PDF File',
        description: 'Drop or select your PDF to immediately extract and display all embedded Info and XMP metadata fields.',
        icon: 'fa-solid fa-file-circle-exclamation',
      },
      {
        stepNumber: 2,
        title: 'Edit or Strip Properties',
        description: 'Update Title, Author, Subject, Keywords, Creator, and Dates — or click "Strip All Metadata" for 1-click anonymization.',
        icon: 'fa-solid fa-eraser',
      },
      {
        stepNumber: 3,
        title: 'Save Clean Document',
        description: 'Download your updated or sanitized PDF document with full confidence that hidden tracking tags have been purged.',
        icon: 'fa-solid fa-file-circle-check',
      },
    ],
    benefitsTitle: 'Why Sanitizing PDF Metadata Matters',
    benefits: [
      {
        title: 'Protect Personal Anonymity',
        description: 'PDFs automatically store your computer user name, file paths, company name, and software versions. Sanitizing wipes these personal traces.',
        icon: 'fa-solid fa-user-secret',
      },
      {
        title: 'Clean Hidden XMP Streams',
        description: 'Purges XML Metadata Packaging streams that standard PDF editors frequently leave behind.',
        icon: 'fa-solid fa-broom',
      },
      {
        title: 'Undo & Redo History',
        description: 'Easily test modifications with full keyboard shortcut support (`Cmd/Ctrl+Z`) and instant revert options.',
        icon: 'fa-solid fa-rotate-left',
      },
    ],
    faqsTitle: 'Frequently Asked Questions About PDF Metadata',
    faqs: [
      {
        question: 'What metadata is stored inside a typical PDF?',
        answer: 'PDF files routinely store Document Title, Author Name, Company/Creator Software, PDF Producer engine, Creation Timestamp, Modification Timestamp, and XMP metadata containing printer profiles and editing history.',
      },
      {
        question: 'Will stripping metadata alter the visible pages of my document?',
        answer: 'No. Sanitizing only purges hidden metadata dictionaries and XML streams. All visible text, fonts, images, and vectors remain completely untouched.',
      },
    ],
    relatedTools: [
      {
        title: 'Verify & Forensics',
        description: 'Audit digital signatures and document alterations.',
        icon: 'fa-solid fa-shield-halved',
        path: '/security/verify',
        badge: 'Forensics',
      },
      {
        title: 'Protect PDF',
        description: 'Lock your sanitized file with a password.',
        icon: 'fa-solid fa-lock',
        path: '/security/protect',
        badge: 'Security',
      },
      {
        title: 'Compress PDF',
        description: 'Reduce file size after cleaning metadata.',
        icon: 'fa-solid fa-compress',
        path: '/compress',
        badge: 'Optimize',
      },
    ],
  },

  signature: {
    title: 'Create Signature Online Free — Draw, Type & Sign PDFs | iPDFEditor',
    metaDescription:
      'Create and draw electronic signatures online for free. Draw with pen smoothing, type in elegant calligraphy script fonts, or upload your signature. Export as transparent PNG.',
    keywords:
      'create signature online, draw digital signature, free signature generator, type signature font, sign pdf online, transparent signature png free',
    canonicalPath: '/signature',
    breadcrumbs: [
      { label: 'Home', path: '/' },
      { label: 'Tools', path: '/tools' },
      { label: 'Signature', path: '/signature' },
    ],
    heading: 'Electronic Signature Studio & Generator',
    subHeading:
      'Draw smooth handwritten signatures, type in elegant script typography, or upload your signature image. Download as transparent PNG or place directly on any PDF.',
    howToTitle: 'How to Create & Use Your Signature',
    steps: [
      {
        stepNumber: 1,
        title: 'Choose Creation Method',
        description: 'Select Draw to hand-sign on canvas, Type to pick from calligraphy fonts, or Upload to load an existing photo.',
        icon: 'fa-solid fa-pen-nib',
      },
      {
        stepNumber: 2,
        title: 'Customize Appearance',
        description: 'Adjust stroke thickness, ink color (slate, navy, black), and font family (Caveat, Dancing Script, Sacramento).',
        icon: 'fa-solid fa-palette',
      },
      {
        stepNumber: 3,
        title: 'Save or Apply to PDF',
        description: 'Download your signature as a transparent PNG image or open directly in the PDF Editor to place it on documents.',
        icon: 'fa-solid fa-signature',
      },
    ],
    benefitsTitle: 'Signature Creation Built for Privacy & Speed',
    benefits: [
      {
        title: 'Zero Signature Storage',
        description: 'Your handwritten signature never leaves your device. Nothing is saved to remote databases or cloud servers.',
        icon: 'fa-solid fa-shield-halved',
      },
      {
        title: 'Transparent PNG Export',
        description: 'Signatures are exported with clean transparent backgrounds, making them ready to paste seamlessly onto any contract or form.',
        icon: 'fa-solid fa-image',
      },
      {
        title: 'Seamless Editor Integration',
        description: 'One click transfers your newly created signature directly into iPDFEditor Studio for instant document placement.',
        icon: 'fa-solid fa-file-pen',
      },
    ],
    faqsTitle: 'Frequently Asked Questions About Electronic Signatures',
    faqs: [
      {
        question: 'Is my drawn signature legally valid on documents?',
        answer: 'In most jurisdictions (including the US ESIGN Act and EU eIDAS regulations), an electronic signature placed with intent to sign is legally binding for commercial contracts, leases, and agreements.',
      },
      {
        question: 'Does iPDFEditor save my signature on a server?',
        answer: 'No. iPDFEditor runs entirely in your local web browser. Your signature exists only in your local browser memory and is discarded when you close the tab.',
      },
    ],
    relatedTools: [
      {
        title: 'PDF Editor',
        description: 'Place your signature directly onto any document.',
        icon: 'fa-solid fa-pen-to-square',
        path: '/editor',
        badge: 'Studio',
      },
      {
        title: 'Protect PDF',
        description: 'Encrypt your signed document with a password.',
        icon: 'fa-solid fa-lock',
        path: '/security/protect',
        badge: 'Security',
      },
      {
        title: 'Merge PDF',
        description: 'Combine signed agreements with supporting files.',
        icon: 'fa-solid fa-object-group',
        path: '/merge',
        badge: 'Organize',
      },
    ],
  },

  tools: {
    title: 'All Free PDF Tools Online — Privacy-First Browser Toolkit | iPDFEditor',
    metaDescription:
      'Discover all free browser-based PDF tools. Edit, merge, split, compress, convert, sign, password protect, and inspect PDF files locally with zero cloud uploads.',
    keywords:
      'all pdf tools, free online pdf tools, pdf utilities, private pdf toolkit, merge, split, compress, convert pdf online free',
    canonicalPath: '/tools',
    breadcrumbs: [
      { label: 'Home', path: '/' },
      { label: 'All Tools', path: '/tools' },
    ],
    heading: 'Complete Suite of Privacy-First PDF Tools',
    subHeading:
      'Every tool runs 100% client-side in your web browser. Zero server uploads, zero wait queues, and zero watermarks.',
  },

  help: {
    title: 'iPDFEditor Help, Guides & FAQ — Master Local PDF Editing',
    metaDescription:
      'Comprehensive guides, frequently asked questions, and keyboard shortcut reference for iPDFEditor. Learn how our 100% private client-side PDF sandbox protects your files.',
    keywords:
      'pdf editor help, how to edit pdf guide, pdf keyboard shortcuts, private pdf processing faq, client side pdf editor help',
    canonicalPath: '/help',
    breadcrumbs: [
      { label: 'Home', path: '/' },
      { label: 'Help & FAQ', path: '/help' },
    ],
    heading: 'Help Center, Guides & Frequently Asked Questions',
    subHeading:
      'Master client-side PDF editing, explore keyboard shortcuts, and learn how our zero-trust local browser sandbox keeps your documents confidential.',
  },

  pdfToWord: {
    title: 'Convert PDF to Word Online Free (.docx) — 100% Private | iPDFEditor',
    metaDescription:
      'Convert PDF documents to editable Microsoft Word (.docx) files online for free. In-browser OCR extraction with zero server uploads. 100% private and secure.',
    keywords:
      'pdf to word, convert pdf to docx online free, pdf to word converter, edit pdf in word, pdf to docx no upload, free pdf to word',
    canonicalPath: '/pdf-to-word',
    breadcrumbs: [
      { label: 'Home', path: '/' },
      { label: 'Tools', path: '/tools' },
      { label: 'Convert', path: '/convert' },
      { label: 'PDF to Word', path: '/pdf-to-word' },
    ],
    heading: 'Convert PDF to Word (.docx) Online Free',
    subHeading:
      'Transform PDF documents into editable Microsoft Word (.docx) documents with local OCR. Zero server uploads, zero wait queues.',
    howToTitle: 'How to Convert PDF to Word (.docx)',
    steps: [
      {
        stepNumber: 1,
        title: 'Upload PDF Document',
        description: 'Drop or select your PDF file. The file is read directly into your browser memory.',
        icon: 'fa-solid fa-file-arrow-up',
      },
      {
        stepNumber: 2,
        title: 'OCR & Text Extraction',
        description: 'Our in-browser Tesseract OCR parses text blocks and builds a genuine Word OpenXML (.docx) structure.',
        icon: 'fa-solid fa-brain',
      },
      {
        stepNumber: 3,
        title: 'Download Word Doc',
        description: 'Click Convert to generate and download your editable .docx document immediately.',
        icon: 'fa-solid fa-file-word',
      },
    ],
    benefitsTitle: 'Why Convert PDF to Word with iPDFEditor?',
    benefits: [
      {
        title: 'Genuine .docx Output',
        description: 'Creates real Microsoft Word OpenXML documents compatible with Word, Google Docs, and LibreOffice.',
        icon: 'fa-solid fa-file-word',
      },
      {
        title: 'Total Document Privacy',
        description: 'Contracts, resumes, and bank statements never leave your computer. OCR runs in client-side WebAssembly.',
        icon: 'fa-solid fa-shield-halved',
      },
      {
        title: 'Free & Unlimited',
        description: 'No daily limits, no page caps, and no email registration required.',
        icon: 'fa-solid fa-infinity',
      },
    ],
    faqsTitle: 'Frequently Asked Questions About PDF to Word',
    faqs: [
      {
        question: 'Can I edit the converted document in Microsoft Word?',
        answer: 'Yes! The output is a standard Microsoft Word (.docx) file containing editable paragraphs and extracted text ready for editing in Word, Pages, or Google Docs.',
      },
      {
        question: 'Does this work on scanned documents?',
        answer: 'Yes. iPDFEditor utilizes local Tesseract.js optical character recognition (OCR) to detect printed text on scanned documents.',
      },
      {
        question: 'Are my confidential documents uploaded to a cloud server?',
        answer: 'Never. Processing happens 100% inside your browser session. Files are never transmitted over the internet.',
      },
    ],
    relatedTools: [
      {
        title: 'PDF to Text (OCR)',
        description: 'Extract raw text from PDF for instant copying.',
        icon: 'fa-solid fa-file-lines',
        path: '/pdf-to-text',
        badge: 'OCR',
      },
      {
        title: 'PDF Editor',
        description: 'Edit PDF text and annotations directly in browser.',
        icon: 'fa-solid fa-pen-to-square',
        path: '/editor',
        badge: 'Studio',
      },
      {
        title: 'Merge PDF',
        description: 'Combine multiple PDFs before converting.',
        icon: 'fa-solid fa-object-group',
        path: '/merge',
        badge: 'Organize',
      },
    ],
  },

  jpgToPdf: {
    title: 'Convert JPG to PDF Online Free — Images to PDF Converter | iPDFEditor',
    metaDescription:
      'Convert JPG, PNG, and WebP images to PDF online for free. Combine multiple photos into a high-quality, printable PDF document locally in your browser.',
    keywords:
      'jpg to pdf, convert image to pdf, png to pdf online free, photos to pdf, combine images into pdf, convert jpg to pdf no upload',
    canonicalPath: '/jpg-to-pdf',
    breadcrumbs: [
      { label: 'Home', path: '/' },
      { label: 'Tools', path: '/tools' },
      { label: 'Convert', path: '/convert' },
      { label: 'Images to PDF', path: '/jpg-to-pdf' },
    ],
    heading: 'Convert JPG & Images to PDF Online Free',
    subHeading:
      'Combine multiple JPEG, PNG, or WebP images into a single high-quality PDF document. 100% private and instant.',
    howToTitle: 'How to Convert Images to PDF',
    steps: [
      {
        stepNumber: 1,
        title: 'Select Image Files',
        description: 'Select or drop one or multiple JPG, PNG, or WebP image files from your device.',
        icon: 'fa-solid fa-images',
      },
      {
        stepNumber: 2,
        title: 'Order & Embed',
        description: 'Images are placed in sequence, scaled to full resolution, and compiled into document pages.',
        icon: 'fa-solid fa-layer-group',
      },
      {
        stepNumber: 3,
        title: 'Download PDF',
        description: 'Click "Convert Images to PDF" to generate and download your unified PDF document.',
        icon: 'fa-solid fa-file-pdf',
      },
    ],
    benefitsTitle: 'Fast, High-Resolution Image Conversion',
    benefits: [
      {
        title: 'Original Image Quality',
        description: 'Embedded images retain their original pixel dimensions and color profiles without blurriness.',
        icon: 'fa-solid fa-gem',
      },
      {
        title: 'Multi-Image Batch',
        description: 'Select as many photos, receipts, or scans as you need. They are compiled into a multi-page PDF.',
        icon: 'fa-solid fa-file-circle-plus',
      },
      {
        title: 'Zero Cloud Uploads',
        description: 'Personal photos and receipts remain private on your computer or phone.',
        icon: 'fa-solid fa-lock',
      },
    ],
    faqsTitle: 'Frequently Asked Questions About Converting Images to PDF',
    faqs: [
      {
        question: 'Which image formats are supported?',
        answer: 'iPDFEditor supports JPEG (.jpg, .jpeg), PNG (.png), WebP (.webp), and all standard web photo formats.',
      },
      {
        question: 'Can I combine multiple pictures into one PDF file?',
        answer: 'Yes! Select multiple image files simultaneously, and each photo will be embedded as an individual page in the final PDF.',
      },
    ],
    relatedTools: [
      {
        title: 'PDF to JPG',
        description: 'Extract PDF pages as individual image files.',
        icon: 'fa-solid fa-image',
        path: '/pdf-to-jpg',
        badge: 'Images',
      },
      {
        title: 'Compress PDF',
        description: 'Shrink your newly created image PDF file size.',
        icon: 'fa-solid fa-compress',
        path: '/compress',
        badge: 'Optimize',
      },
      {
        title: 'Merge PDF',
        description: 'Combine multiple PDF documents together.',
        icon: 'fa-solid fa-object-group',
        path: '/merge',
        badge: 'Organize',
      },
    ],
  },

  pdfToText: {
    title: 'Extract Text from PDF Online (OCR) — Free PDF to Text | iPDFEditor',
    metaDescription:
      'Extract readable, copyable text from scanned PDFs using in-browser Tesseract OCR. Free, local text extraction with zero cloud uploads. 100% private.',
    keywords:
      'pdf to text, pdf ocr online free, extract text from scanned pdf, pdf to txt converter, browser ocr, text recognition pdf',
    canonicalPath: '/pdf-to-text',
    breadcrumbs: [
      { label: 'Home', path: '/' },
      { label: 'Tools', path: '/tools' },
      { label: 'Convert', path: '/convert' },
      { label: 'PDF to Text (OCR)', path: '/pdf-to-text' },
    ],
    heading: 'Extract Text from PDF with Local OCR',
    subHeading:
      'Extract clean, editable text from native and scanned PDF documents using in-browser neural network OCR.',
    howToTitle: 'How to Extract Text from a PDF',
    steps: [
      {
        stepNumber: 1,
        title: 'Upload PDF Document',
        description: 'Select or drop any PDF document or scanned contract.',
        icon: 'fa-solid fa-file-arrow-up',
      },
      {
        stepNumber: 2,
        title: 'Run In-Browser OCR',
        description: 'Tesseract.js WebAssembly scans the pages and identifies character patterns locally.',
        icon: 'fa-solid fa-eye',
      },
      {
        stepNumber: 3,
        title: 'Copy or Download Text',
        description: 'Copy extracted text with one click or download it as a standard .txt file.',
        icon: 'fa-solid fa-file-lines',
      },
    ],
    benefitsTitle: 'Client-Side Neural Network OCR',
    benefits: [
      {
        title: 'Scanned Document Support',
        description: 'Extracts words from scanned paper documents, screenshots, and image-based PDFs.',
        icon: 'fa-solid fa-scanner',
      },
      {
        title: 'Instant Clipboard Copy',
        description: 'One-click copy button to paste extracted text directly into your notes, emails, or spreadsheets.',
        icon: 'fa-solid fa-copy',
      },
      {
        title: 'Private & Secure',
        description: 'OCR neural models execute directly on your CPU/GPU without transmitting text to external servers.',
        icon: 'fa-solid fa-shield-halved',
      },
    ],
    faqsTitle: 'Frequently Asked Questions About PDF Text Extraction',
    faqs: [
      {
        question: 'Does the OCR tool work on scanned receipts and contracts?',
        answer: 'Yes. The Tesseract.js engine visually recognizes letterforms and symbols on image-based and scanned pages.',
      },
      {
        question: 'Can I copy the text directly without downloading a file?',
        answer: 'Yes! iPDFEditor displays the extracted text right on the screen with a "Copy to Clipboard" button.',
      },
    ],
    relatedTools: [
      {
        title: 'PDF to Word',
        description: 'Convert PDF directly into an editable .docx file.',
        icon: 'fa-solid fa-file-word',
        path: '/pdf-to-word',
        badge: 'Docx',
      },
      {
        title: 'PDF Editor',
        description: 'Annotate and edit PDF files in browser.',
        icon: 'fa-solid fa-pen-to-square',
        path: '/editor',
        badge: 'Studio',
      },
      {
        title: 'Edit Metadata',
        description: 'Inspect and clean hidden document properties.',
        icon: 'fa-solid fa-circle-info',
        path: '/security/metadata',
        badge: 'Sanitize',
      },
    ],
  },

  pdfToJpg: {
    title: 'Convert PDF to JPG / PNG Online Free — Save PDF Pages as Images | iPDFEditor',
    metaDescription:
      'Convert PDF pages into high-resolution JPG or PNG images online for free. Extract images from PDF documents locally in your browser with zero server uploads.',
    keywords:
      'pdf to jpg, convert pdf to image, pdf to png online free, extract pdf pages as photos, save pdf as image, pdf to jpg converter',
    canonicalPath: '/pdf-to-jpg',
    breadcrumbs: [
      { label: 'Home', path: '/' },
      { label: 'Tools', path: '/tools' },
      { label: 'Convert', path: '/convert' },
      { label: 'PDF to Images', path: '/pdf-to-jpg' },
    ],
    heading: 'Convert PDF Pages to JPG & PNG Images',
    subHeading:
      'Rasterize PDF pages into crisp high-resolution PNG or compact JPG images directly inside your browser.',
    howToTitle: 'How to Convert PDF to Images',
    steps: [
      {
        stepNumber: 1,
        title: 'Select PDF Document',
        description: 'Drop or select your PDF file to begin extraction.',
        icon: 'fa-solid fa-file-pdf',
      },
      {
        stepNumber: 2,
        title: 'Choose Image Format',
        description: 'Select PNG for lossless graphics and diagrams or JPG for compact photo file sizes.',
        icon: 'fa-solid fa-image',
      },
      {
        stepNumber: 3,
        title: 'Extract & Download',
        description: 'Pages are rendered at high DPI and downloaded directly to your device.',
        icon: 'fa-solid fa-download',
      },
    ],
    benefitsTitle: 'High-Resolution Document Rasterization',
    benefits: [
      {
        title: 'Crystal Clear Resolution',
        description: 'Pages render with sharp typography and vibrant colors suitable for presentations and sharing.',
        icon: 'fa-solid fa-gem',
      },
      {
        title: 'Lossless PNG & Compact JPG',
        description: 'Choose between lossless PNG format or lightweight JPG photos based on your use case.',
        icon: 'fa-solid fa-sliders',
      },
      {
        title: 'Private & Local',
        description: 'Document pages are rendered onto local browser canvases without any external server processing.',
        icon: 'fa-solid fa-shield-halved',
      },
    ],
    faqsTitle: 'Frequently Asked Questions About Converting PDF to Images',
    faqs: [
      {
        question: 'What is the difference between PDF to PNG and PDF to JPG?',
        answer: 'PNG is lossless and best for text, charts, diagrams, and digital documents. JPG produces smaller file sizes ideal for photos and web sharing.',
      },
      {
        question: 'Are my images stored on your servers?',
        answer: 'No. Rasterization happens on your computer or phone using HTML5 Canvas. No data is sent to any server.',
      },
    ],
    relatedTools: [
      {
        title: 'Images to PDF',
        description: 'Combine photos back into a single PDF document.',
        icon: 'fa-solid fa-file-pdf',
        path: '/jpg-to-pdf',
        badge: 'PDF',
      },
      {
        title: 'Split PDF',
        description: 'Extract specific pages from your PDF.',
        icon: 'fa-solid fa-scissors',
        path: '/split',
        badge: 'Organize',
      },
      {
        title: 'Compress PDF',
        description: 'Reduce PDF file size before converting.',
        icon: 'fa-solid fa-compress',
        path: '/compress',
        badge: 'Optimize',
      },
    ],
  },
};

