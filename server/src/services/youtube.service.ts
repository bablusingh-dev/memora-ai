import { YoutubeTranscript } from 'youtube-transcript';
import { logger } from '../utils/logger.js';

export class YoutubeService {
  /**
   * Extract video ID from YouTube URL
   */
  public static extractVideoId(url: string): string | null {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return match && match[2].length === 11 ? match[2] : null;
  }

  /**
   * Fetch video transcript for YouTube URL
   */
  async getTranscript(url: string): Promise<{ title: string; text: string }> {
    const videoId = YoutubeService.extractVideoId(url);
    if (!videoId) {
      throw new Error('Invalid YouTube video URL');
    }

    logger.info({ videoId, url }, 'Extracting transcript for YouTube video');

    try {
      const items = await YoutubeTranscript.fetchTranscript(videoId);
      const transcriptText = items.map((item) => item.text).join(' ');
      const title = `YouTube Transcript [${videoId}]`;

      return {
        title,
        text: `# ${title}\n\nURL: ${url}\n\n${transcriptText}`,
      };
    } catch (err: any) {
      logger.error({ err: err.message, videoId }, 'Failed to fetch YouTube transcript, using fallback');
      return {
        title: `YouTube Video (${videoId})`,
        text: `# YouTube Video Overview\n\nURL: ${url}\n\nTranscript unavailable for this video (or closed captions disabled). Key metadata saved for reference.`,
      };
    }
  }
}
