import { inngest } from '../client.js';
import { studioArtifactRequested } from '../events.js';
import { StudioRepository } from '../../repositories/studio.repository.js';
import { buildStudioContext, StudioContext } from '../../services/studio-context.service.js';
import { generateFlashcards } from '../../services/studio-generators/flashcards.service.js';
import { generateQuiz } from '../../services/studio-generators/quiz.service.js';
import { generateDataTable } from '../../services/studio-generators/data-table.service.js';
import { generateReport } from '../../services/studio-generators/report.service.js';
import { generateMindMap } from '../../services/studio-generators/mind-map.service.js';
import { generateSlideDeck } from '../../services/studio-generators/slide-deck.service.js';
import {
  generatePodcastScript,
  synthesizeTurnsBatch,
  stitchAndUploadPodcast,
} from '../../services/studio-generators/podcast.service.js';
import { logger } from '../../utils/logger.js';

const studioRepo = new StudioRepository();

type StudioArtifactKind = 'flashcards' | 'quiz' | 'data_table' | 'report' | 'mind_map' | 'slide_deck' | 'podcast';

/**
 * One entry per Studio output kind that fits the generic "one LLM call
 * produces the whole payload" shape. Adding a kind like that (Mind Map,
 * Slide Deck, Report, Quiz, Data Table) is: write its generator service, add
 * one entry here, add the kind to the `studioArtifactRequested` event enum
 * and `studioKindParamSchema` — the function body below stays unchanged.
 *
 * `podcast` is deliberately NOT in this record — script generation + many
 * sequential TTS calls + stitching doesn't fit the one-shot shape, so it's
 * handled by its own branch below with per-batch Inngest steps instead.
 */
const studioGenerators: Record<
  Exclude<StudioArtifactKind, 'podcast'>,
  (ctx: StudioContext) => Promise<{ title: string; payload: unknown }>
> = {
  flashcards: generateFlashcards,
  quiz: generateQuiz,
  data_table: generateDataTable,
  report: generateReport,
  mind_map: generateMindMap,
  slide_deck: generateSlideDeck,
};

// Turns synthesized per Inngest step for the podcast pipeline — small enough
// that a failure mid-run only re-pays for one batch's worth of TTS calls on
// retry, not the whole episode.
const PODCAST_SYNTHESIS_BATCH_SIZE = 5;

/**
 * Shared onFailure handler: after Inngest exhausts all retries, mark the
 * artifact `error` with the failure reason instead of leaving it stuck on
 * `generating` forever — same shape as handleIngestionFailure in
 * ingest-source.ts.
 */
async function handleGenerationFailure({ event, error }: { event: any; error: Error }): Promise<void> {
  const artifactId: string | undefined = event?.data?.event?.data?.artifactId;
  if (!artifactId) {
    logger.error({ error: error?.message }, '[StudioArtifact] onFailure fired without a resolvable artifactId');
    return;
  }
  try {
    await studioRepo.updateArtifact(artifactId, {
      status: 'error',
      errorMessage: (error?.message || 'Generation failed after multiple retries').slice(0, 500),
    });
    logger.error({ artifactId, error: error?.message }, '[StudioArtifact] Marked artifact as error after exhausting retries');
  } catch (err) {
    logger.error({ err, artifactId }, '[StudioArtifact] Failed to mark artifact as error in onFailure handler');
  }
}

export const generateStudioArtifactFunction = inngest.createFunction(
  {
    id: 'generate-studio-artifact',
    triggers: [{ event: studioArtifactRequested.event }],
    retries: 3,
    idempotency: 'event.data.artifactId',
    onFailure: handleGenerationFailure,
  },
  async ({ event, step }) => {
    const { artifactId, memorybookId, kind, focus } = event.data;

    const context = await step.run('fetch-source-context', () => buildStudioContext(memorybookId));

    if (context.chunkCount === 0) {
      throw new Error('This memorybook has no indexed sources yet — add some sources and wait for them to finish processing first.');
    }

    if (kind === 'podcast') {
      const script = await step.run('generate-podcast-script', () => generatePodcastScript(context, { focus }));

      const turnAudios: Awaited<ReturnType<typeof synthesizeTurnsBatch>> = [];
      for (let i = 0; i < script.turns.length; i += PODCAST_SYNTHESIS_BATCH_SIZE) {
        const batch = script.turns.slice(i, i + PODCAST_SYNTHESIS_BATCH_SIZE);
        const batchAudios = await step.run(`synthesize-turns-${i}`, () => synthesizeTurnsBatch(batch));
        turnAudios.push(...batchAudios);
      }

      const { title, payload } = await step.run('stitch-and-upload-podcast', () =>
        stitchAndUploadPodcast(script.title, turnAudios)
      );

      await step.run('persist-artifact', () =>
        studioRepo.updateArtifact(artifactId, { status: 'ready', title, payload, errorMessage: null })
      );
      return;
    }

    const generator = studioGenerators[kind as Exclude<StudioArtifactKind, 'podcast'>];
    const { title, payload } = await step.run(`generate-${kind}`, () => generator(context));

    await step.run('persist-artifact', () =>
      studioRepo.updateArtifact(artifactId, { status: 'ready', title, payload, errorMessage: null })
    );
  }
);
