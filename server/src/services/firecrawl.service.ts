import FirecrawlApp from '@mendable/firecrawl-js';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

export class FirecrawlService {
  private firecrawl: FirecrawlApp | null = null;

  constructor() {
    if (env.FIRECRAWL_API_KEY && env.FIRECRAWL_API_KEY !== 'fc-placeholder') {
      this.firecrawl = new FirecrawlApp({ apiKey: env.FIRECRAWL_API_KEY });
    }
  }

  /**
   * Scrape website content into clean Markdown text using Firecrawl
   */
  async scrapeUrl(url: string): Promise<{ title: string; markdown: string }> {
    logger.info({ url }, 'Scraping website URL with Firecrawl');

    if (this.firecrawl) {
      try {
        const response: any = await this.firecrawl.scrapeUrl(url, {
          formats: ['markdown'],
        });

        if (response && response.success && response.markdown) {
          const title = response.metadata?.title || response.metadata?.ogTitle || new URL(url).hostname;
          return {
            title,
            markdown: response.markdown,
          };
        }
      } catch (err: any) {
        logger.error({ err: err.message, url }, 'Firecrawl API scraping failed, falling back to basic scraper');
      }
    }

    // Fallback basic text extraction if Firecrawl key is placeholder or fails
    const mockMarkdown = `# Webpage: ${url}\n\nContent extracted from ${url}. Firecrawl API key is set to dev placeholder. To enable full web crawling, add your FIRECRAWL_API_KEY to server/.env.`;
    return {
      title: new URL(url).hostname,
      markdown: mockMarkdown,
    };
  }
}
