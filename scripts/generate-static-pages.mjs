import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist', 'ipdfeditor', 'browser');
const templatePath = path.join(distDir, 'index.html');

function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

async function run() {
  console.log('🚀 Starting iPDFEditor Static Route Pre-generation (SSG Engine)...');

  if (!fs.existsSync(templatePath)) {
    console.error(`❌ Error: Template not found at ${templatePath}. Ensure "ng build" has run first.`);
    process.exit(1);
  }

  const baseHtml = fs.readFileSync(templatePath, 'utf8');

  // Load SEO configs directly from TypeScript constant
  const seoModule = await import('../src/app/core/constants/seo-data.ts');
  const { SEO_CONFIGS, SITE_NAME, SITE_URL, DEFAULT_OG_IMAGE } = seoModule;

  const entries = Object.entries(SEO_CONFIGS);
  console.log(`📄 Found ${entries.length} SEO-configured routes to pre-generate.`);

  let generatedCount = 0;

  for (const [key, config] of entries) {
    const rawPath = config.canonicalPath || '/';
    const canonicalPath = rawPath.startsWith('/') ? rawPath : `/${rawPath}`;
    const fullCanonicalUrl = `${SITE_URL}${canonicalPath === '/' ? '/' : canonicalPath}`;

    let html = baseHtml;

    // 1. Replace <title>
    html = html.replace(/<title>.*?<\/title>/s, `<title>${escapeHtml(config.title)}</title>`);

    // 2. Replace canonical link
    html = html.replace(
      /<link rel="canonical" href=".*?">/,
      `<link rel="canonical" href="${fullCanonicalUrl}">`
    );

    // 3. Replace Meta Description
    html = html.replace(
      /<meta name="description" content=".*?">/,
      `<meta name="description" content="${escapeHtml(config.metaDescription)}">`
    );

    // 4. Replace Meta Keywords
    if (config.keywords) {
      html = html.replace(
        /<meta name="keywords" content=".*?">/,
        `<meta name="keywords" content="${escapeHtml(config.keywords)}">`
      );
    }

    // 5. Replace Open Graph Tags
    html = html.replace(
      /<meta property="og:url" content=".*?">/,
      `<meta property="og:url" content="${fullCanonicalUrl}">`
    );
    html = html.replace(
      /<meta property="og:title" content=".*?">/,
      `<meta property="og:title" content="${escapeHtml(config.title)}">`
    );
    html = html.replace(
      /<meta property="og:description" content=".*?">/,
      `<meta property="og:description" content="${escapeHtml(config.metaDescription)}">`
    );

    // 6. Replace Twitter Tags
    html = html.replace(
      /<meta name="twitter:title" content=".*?">/,
      `<meta name="twitter:title" content="${escapeHtml(config.title)}">`
    );
    html = html.replace(
      /<meta name="twitter:description" content=".*?">/,
      `<meta name="twitter:description" content="${escapeHtml(config.metaDescription)}">`
    );

    // 7. Generate Rich Structured Data (Schema.org)
    const schemas = [];

    // WebApplication
    schemas.push({
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: SITE_NAME,
      url: fullCanonicalUrl,
      description: config.metaDescription,
      applicationCategory: 'UtilitiesApplication',
      operatingSystem: 'All',
      browserRequirements: 'Requires HTML5 and WebAssembly compatible web browser',
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'USD',
      },
    });

    // Breadcrumbs
    if (config.breadcrumbs && config.breadcrumbs.length > 0) {
      schemas.push({
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: config.breadcrumbs.map((b, idx) => ({
          '@type': 'ListItem',
          position: idx + 1,
          name: b.label,
          item: `${SITE_URL}${b.path.startsWith('/') ? b.path : '/' + b.path}`,
        })),
      });
    }

    // FAQPage
    if (config.faqs && config.faqs.length > 0) {
      schemas.push({
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: config.faqs.map((faq) => ({
          '@type': 'Question',
          name: faq.question,
          acceptedAnswer: {
            '@type': 'Answer',
            text: faq.answer,
          },
        })),
      });
    }

    // HowTo
    if (config.steps && config.steps.length > 0) {
      schemas.push({
        '@context': 'https://schema.org',
        '@type': 'HowTo',
        name: config.howToTitle || config.heading,
        description: config.subHeading,
        step: config.steps.map((s, idx) => ({
          '@type': 'HowToStep',
          position: s.stepNumber || idx + 1,
          name: s.title,
          text: s.description,
          url: `${fullCanonicalUrl}#step-${s.stepNumber || idx + 1}`,
        })),
      });
    }

    // WebSite & Organization for homepage
    if (canonicalPath === '/') {
      schemas.push({
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: SITE_NAME,
        url: SITE_URL,
        description: config.metaDescription,
        potentialAction: {
          '@type': 'SearchAction',
          target: `${SITE_URL}/tools?q={search_term_string}`,
          'query-input': 'required name=search_term_string',
        },
      });

      schemas.push({
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: SITE_NAME,
        url: SITE_URL,
        logo: DEFAULT_OG_IMAGE,
      });
    }

    const jsonLdMarkup = `<script type="application/ld+json">\n  ${JSON.stringify(schemas, null, 2).replace(/\n/g, '\n  ')}\n  </script>`;
    html = html.replace(/<script type="application\/ld\+json">.*?<\/script>/s, jsonLdMarkup);

    // 8. Build rich crawler pre-hydration fallback inside <app-root>
    let bodyFallback = `\n    <!-- Pre-hydration semantic crawler fallback for ${escapeHtml(config.heading)} -->\n`;
    bodyFallback += `    <div id="pf-crawler-fallback" style="max-width: 960px; margin: 0 auto; padding: 40px 20px; font-family: system-ui, -apple-system, sans-serif; color: #334155; line-height: 1.6;">\n`;
    bodyFallback += `      <header>\n`;
    bodyFallback += `        <h1 style="font-size: 2rem; color: #0f172a; margin-bottom: 8px;">${escapeHtml(config.heading)}</h1>\n`;
    bodyFallback += `        <p style="font-size: 1.125rem; color: #64748b; margin-top: 0;">${escapeHtml(config.subHeading)}</p>\n`;
    bodyFallback += `      </header>\n\n`;

    bodyFallback += `      <main>\n`;

    // How-To Steps
    if (config.steps && config.steps.length > 0) {
      bodyFallback += `        <section style="margin-top: 28px;">\n`;
      bodyFallback += `          <h2 style="font-size: 1.35rem; color: #1e293b;">${escapeHtml(config.howToTitle || 'How to Use This Tool')}</h2>\n`;
      bodyFallback += `          <ol style="padding-left: 20px; margin-top: 12px;">\n`;
      for (const step of config.steps) {
        bodyFallback += `            <li style="margin-bottom: 12px;" id="step-${step.stepNumber}">\n`;
        bodyFallback += `              <strong>${escapeHtml(step.title)}:</strong> ${escapeHtml(step.description)}\n`;
        bodyFallback += `            </li>\n`;
      }
      bodyFallback += `          </ol>\n`;
      bodyFallback += `        </section>\n\n`;
    }

    // Benefits
    if (config.benefits && config.benefits.length > 0) {
      bodyFallback += `        <section style="margin-top: 28px;">\n`;
      bodyFallback += `          <h2 style="font-size: 1.35rem; color: #1e293b;">${escapeHtml(config.benefitsTitle || 'Technical Advantages')}</h2>\n`;
      bodyFallback += `          <ul style="padding-left: 20px; margin-top: 12px;">\n`;
      for (const benefit of config.benefits) {
        bodyFallback += `            <li style="margin-bottom: 8px;">\n`;
        bodyFallback += `              <strong>${escapeHtml(benefit.title)}:</strong> ${escapeHtml(benefit.description)}\n`;
        bodyFallback += `            </li>\n`;
      }
      bodyFallback += `          </ul>\n`;
      bodyFallback += `        </section>\n\n`;
    }

    // FAQs
    if (config.faqs && config.faqs.length > 0) {
      bodyFallback += `        <section style="margin-top: 28px;">\n`;
      bodyFallback += `          <h2 style="font-size: 1.35rem; color: #1e293b;">${escapeHtml(config.faqsTitle || 'Frequently Asked Questions')}</h2>\n`;
      bodyFallback += `          <dl style="margin-top: 12px;">\n`;
      for (const faq of config.faqs) {
        bodyFallback += `            <dt style="font-weight: 700; color: #0f172a; margin-top: 16px;">${escapeHtml(faq.question)}</dt>\n`;
        bodyFallback += `            <dd style="margin-left: 0; margin-top: 4px; color: #475569;">${escapeHtml(faq.answer)}</dd>\n`;
      }
      bodyFallback += `          </dl>\n`;
      bodyFallback += `        </section>\n\n`;
    }

    // Navigation Directory
    bodyFallback += `        <nav style="margin-top: 36px; padding-top: 24px; border-top: 1px solid #e2e8f0;">\n`;
    bodyFallback += `          <h3 style="font-size: 1.1rem; color: #1e293b;">Explore Other Free Client-Side Tools</h3>\n`;
    bodyFallback += `          <ul style="list-style: none; padding-left: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px; margin-top: 12px;">\n`;
    bodyFallback += `            <li><a href="/editor" style="color: #2563eb; text-decoration: none;">PDF Editor</a></li>\n`;
    bodyFallback += `            <li><a href="/merge" style="color: #2563eb; text-decoration: none;">Merge PDF</a></li>\n`;
    bodyFallback += `            <li><a href="/split" style="color: #2563eb; text-decoration: none;">Split PDF</a></li>\n`;
    bodyFallback += `            <li><a href="/compress" style="color: #2563eb; text-decoration: none;">Compress PDF</a></li>\n`;
    bodyFallback += `            <li><a href="/pdf-to-word" style="color: #2563eb; text-decoration: none;">PDF to Word</a></li>\n`;
    bodyFallback += `            <li><a href="/jpg-to-pdf" style="color: #2563eb; text-decoration: none;">Images to PDF</a></li>\n`;
    bodyFallback += `            <li><a href="/pdf-to-text" style="color: #2563eb; text-decoration: none;">Extract Text (OCR)</a></li>\n`;
    bodyFallback += `            <li><a href="/security/protect" style="color: #2563eb; text-decoration: none;">Protect PDF</a></li>\n`;
    bodyFallback += `            <li><a href="/signature" style="color: #2563eb; text-decoration: none;">Signature Studio</a></li>\n`;
    bodyFallback += `            <li><a href="/tools" style="color: #2563eb; text-decoration: none;">All Tools</a></li>\n`;
    bodyFallback += `          </ul>\n`;
    bodyFallback += `        </nav>\n`;
    bodyFallback += `      </main>\n\n`;

    bodyFallback += `      <footer style="margin-top: 36px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 0.875rem; color: #94a3b8;">\n`;
    bodyFallback += `        <p>&copy; 2026 iPDFEditor. 100% Private Client-Side PDF Processing.</p>\n`;
    bodyFallback += `      </footer>\n`;
    bodyFallback += `    </div>\n  `;

    html = html.replace(/<app-root>.*?<\/app-root>/s, `<app-root>${bodyFallback}</app-root>`);

    // Determine target location
    let targetPath;
    if (canonicalPath === '/' || canonicalPath === '') {
      targetPath = templatePath;
    } else {
      const targetDir = path.join(distDir, canonicalPath.replace(/^\//, ''));
      fs.mkdirSync(targetDir, { recursive: true });
      targetPath = path.join(targetDir, 'index.html');
    }

    fs.writeFileSync(targetPath, html, 'utf8');
    generatedCount++;
    console.log(`  ✓ Generated: ${canonicalPath} -> ${path.relative(distDir, targetPath)}`);
  }

  console.log(`✨ Successfully pre-generated ${generatedCount} static routes for Google Search Engine indexing!`);
}

run().catch((err) => {
  console.error('Fatal error during static page generation:', err);
  process.exit(1);
});
