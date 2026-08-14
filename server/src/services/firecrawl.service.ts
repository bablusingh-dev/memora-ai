import FirecrawlApp from '@mendable/firecrawl-js';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { BadRequestError, InternalServerError } from '../utils/api-error.js';

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

    if (!this.firecrawl) {
      throw new BadRequestError(
        'Firecrawl API key is unconfigured. Please set FIRECRAWL_API_KEY in server/.env to enable website crawling.'
      );
    }

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

      throw new InternalServerError(`Firecrawl failed to extract markdown content from URL '${url}'`);
    } catch (err: any) {
      logger.error({ err: err.message, url }, 'Firecrawl API scraping failed');
      throw new InternalServerError(`Failed to scrape URL '${url}': ${err.message}`);
    }
  }
}
