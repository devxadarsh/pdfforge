import { Injectable, inject } from '@angular/core';
import { Title, Meta } from '@angular/platform-browser';
import { DOCUMENT } from '@angular/common';
import { PageSeoConfig, SITE_NAME, SITE_URL, DEFAULT_OG_IMAGE } from '../../constants/seo-data';

@Injectable({ providedIn: 'root' })
export class SeoService {
  private readonly titleService = inject(Title);
  private readonly metaService = inject(Meta);
  private readonly doc = inject(DOCUMENT);

  private jsonLdScriptEl: HTMLScriptElement | null = null;

  /**
   * Updates all on-page metadata, Open Graph, Twitter Cards, canonical URL, and JSON-LD schema.
   */
  updatePage(config: PageSeoConfig): void {
    // 1. Title
    this.titleService.setTitle(config.title);

    // 2. Canonical URL
    const canonicalUrl = `${SITE_URL}${config.canonicalPath.startsWith('/') ? config.canonicalPath : '/' + config.canonicalPath}`;
    this.setCanonicalUrl(canonicalUrl);

    // 3. Robots directive
    const robots = config.robots || 'index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1';
    this.metaService.updateTag({ name: 'robots', content: robots });

    // 4. Standard Meta Tags
    this.metaService.updateTag({ name: 'description', content: config.metaDescription });
    this.metaService.updateTag({ name: 'keywords', content: config.keywords });
    this.metaService.updateTag({ name: 'author', content: SITE_NAME });

    // 5. Open Graph / Facebook
    this.metaService.updateTag({ property: 'og:type', content: config.ogType || 'website' });
    this.metaService.updateTag({ property: 'og:site_name', content: SITE_NAME });
    this.metaService.updateTag({ property: 'og:title', content: config.title });
    this.metaService.updateTag({ property: 'og:description', content: config.metaDescription });
    this.metaService.updateTag({ property: 'og:url', content: canonicalUrl });
    this.metaService.updateTag({ property: 'og:image', content: DEFAULT_OG_IMAGE });

    // 6. Twitter / X Card
    this.metaService.updateTag({ name: 'twitter:card', content: 'summary_large_image' });
    this.metaService.updateTag({ name: 'twitter:title', content: config.title });
    this.metaService.updateTag({ name: 'twitter:description', content: config.metaDescription });
    this.metaService.updateTag({ name: 'twitter:image', content: DEFAULT_OG_IMAGE });

    // 7. Inject Structured Data (Schema.org)
    this.injectStructuredData(config, canonicalUrl);
  }

  /**
   * Sets strict noindex, nofollow for private user-state pages (e.g. /recent and /settings).
   */
  setNoIndex(pageTitle: string): void {
    this.titleService.setTitle(`${pageTitle} — ${SITE_NAME}`);
    this.metaService.updateTag({ name: 'robots', content: 'noindex, nofollow' });
    this.removeStructuredData();
  }

  /**
   * Updates or creates the `<link rel="canonical">` element in `<head>`.
   */
  private setCanonicalUrl(url: string): void {
    let link: HTMLLinkElement | null = this.doc.querySelector("link[rel='canonical']");
    if (!link) {
      link = this.doc.createElement('link');
      link.setAttribute('rel', 'canonical');
      this.doc.head.appendChild(link);
    }
    link.setAttribute('href', url);
  }

  /**
   * Generates and injects JSON-LD scripts for WebApplication, BreadcrumbList, and FAQPage.
   */
  private injectStructuredData(config: PageSeoConfig, canonicalUrl: string): void {
    const schemas: object[] = [];

    // 1. WebApplication / SoftwareApplication schema
    schemas.push({
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: SITE_NAME,
      url: canonicalUrl,
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

    // 2. BreadcrumbList schema
    if (config.breadcrumbs && config.breadcrumbs.length > 0) {
      schemas.push({
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: config.breadcrumbs.map((b, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          name: b.label,
          item: `${SITE_URL}${b.path.startsWith('/') ? b.path : '/' + b.path}`,
        })),
      });
    }

    // 3. FAQPage schema
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

    // 4. HowTo schema (Rich SERP how-to snippets)
    if (config.steps && config.steps.length > 0) {
      schemas.push({
        '@context': 'https://schema.org',
        '@type': 'HowTo',
        name: config.howToTitle || config.heading,
        description: config.subHeading,
        step: config.steps.map((s, index) => ({
          '@type': 'HowToStep',
          position: s.stepNumber || index + 1,
          name: s.title,
          text: s.description,
          url: `${canonicalUrl}#step-${s.stepNumber || index + 1}`,
        })),
      });
    }

    // 5. Root Domain WebSite & Organization schemas
    if (config.canonicalPath === '/' || config.canonicalPath === '') {
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

    this.setJsonLdScript(schemas);
  }

  private setJsonLdScript(data: object[]): void {
    if (!this.jsonLdScriptEl) {
      this.jsonLdScriptEl = this.doc.getElementById('pf-dynamic-jsonld') as HTMLScriptElement;
      if (!this.jsonLdScriptEl) {
        this.jsonLdScriptEl = this.doc.createElement('script');
        this.jsonLdScriptEl.id = 'pf-dynamic-jsonld';
        this.jsonLdScriptEl.type = 'application/ld+json';
        this.doc.head.appendChild(this.jsonLdScriptEl);
      }
    }
    this.jsonLdScriptEl.text = JSON.stringify(data);
  }

  private removeStructuredData(): void {
    if (this.jsonLdScriptEl) {
      this.jsonLdScriptEl.remove();
      this.jsonLdScriptEl = null;
    }
    const existing = this.doc.getElementById('pf-dynamic-jsonld');
    if (existing) {
      existing.remove();
    }
  }
}
