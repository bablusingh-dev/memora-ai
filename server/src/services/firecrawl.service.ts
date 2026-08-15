import Firecrawl from '@mendable/firecrawl-js';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { BadRequestError, InternalServerError } from '../utils/api-error.js';

export interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
  content?: string;
}

export class FirecrawlService {
  private firecrawl: Firecrawl | null = null;

  constructor() {
    if (env.FIRECRAWL_API_KEY && env.FIRECRAWL_API_KEY !== 'fc-placeholder') {
      this.firecrawl = new Firecrawl({ apiKey: env.FIRECRAWL_API_KEY });
    }
  }

  /**
   * Search the live internet for queries, returning web pages, snippets, and URLs
   */
  async searchWeb(query: string, limit = 5): Promise<WebSearchResult[]> {
    logger.info({ query, limit }, 'Agent performing live web search');

    // 1. Try Firecrawl Search API if configured
    if (this.firecrawl) {
      try {
        const response: any = await (this.firecrawl as any).search(query, {
          limit,
          scrapeOptions: { formats: ['markdown'] },
        });

        const items = response?.data || response?.results || [];
        if (Array.isArray(items) && items.length > 0) {
          return items.slice(0, limit).map((item: any) => ({
            title: item.title || item.metadata?.title || 'Web Search Result',
            url: item.url || item.metadata?.url || '',
            snippet: item.description || item.snippet || item.markdown?.slice(0, 300) || '',
            content: item.markdown ? item.markdown.slice(0, 1500) : undefined,
          }));
        }
      } catch (err) {
        logger.warn({ err, query }, 'Firecrawl search API failed, falling back to zero-key search provider');
      }
    }

    // 2. Zero-key live web search fallback (DuckDuckGo instant answer / HTML search)
    try {
      const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
      const res = await fetch(searchUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
      });

      if (res.ok) {
        const html = await res.text();
        const results: WebSearchResult[] = [];

        // Match result links and snippets from HTML
        const resultRegex = /<a class="result__url"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi;
        let match;
        while ((match = resultRegex.exec(html)) !== null && results.length < limit) {
          const rawUrl = match[1];
          const cleanUrl = rawUrl.includes('uddg=') ? decodeURIComponent(rawUrl.split('uddg=')[1].split('&')[0]) : rawUrl;
          const snippet = match[3].replace(/<[^>]+>/g, '').trim();
          results.push({
            title: match[2].replace(/<[^>]+>/g, '').trim() || 'Web Result',
            url: cleanUrl,
            snippet,
          });
        }

        if (results.length > 0) {
          return results;
        }
      }
    } catch (err) {
      logger.error({ err, query }, 'DuckDuckGo search fallback failed');
    }

    return [];
  }

  /**
   * Scrape website content into clean Markdown text using Firecrawl or direct fetch fallback
   */
  async scrapeUrl(url: string): Promise<{ title: string; markdown: string }> {
    logger.info({ url }, 'Scraping website URL');

    if (this.firecrawl) {
      try {
        const response: any = await this.firecrawl.scrape(url, {
          formats: ['markdown'],
        });

        const markdown = response?.markdown || response?.data?.markdown;
        if (markdown && typeof markdown === 'string' && markdown.trim().length > 0) {
          const title =
            response.metadata?.title ||
            response.metadata?.ogTitle ||
            response.data?.metadata?.title ||
            response.data?.metadata?.ogTitle ||
            new URL(url).hostname;

          return {
            title,
            markdown: markdown.trim(),
          };
        }
      } catch (err: any) {
        logger.warn({ err: err.message, url }, 'Firecrawl scrape failed, trying direct webpage fetch');
      }
    }

    // Direct fetch fallback
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status} ${res.statusText}`);
      }

      const html = await res.text();
      const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
      const title = titleMatch ? titleMatch[1].trim() : new URL(url).hostname;

      // Strip scripts, styles, and tags for clean text content
      const cleanText = html
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      return {
        title,
        markdown: cleanText.slice(0, 8000),
      };
    } catch (err: any) {
      logger.error({ err, url }, 'Webpage scraping failed');
      throw new InternalServerError(`Failed to scrape URL '${url}': ${err.message}`);
    }
  }
}
