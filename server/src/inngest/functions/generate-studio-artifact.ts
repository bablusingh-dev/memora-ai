import { inngest } from '../client.js';
import { studioArtifactRequested } from '../events.js';
import { StudioRepository } from '../../repositories/studio.repository.js';
import { buildStudioContext, StudioContext } from '../../services/studio-context.service.js';
import { generateFlashcards } from '../../services/studio-generators/flashcards.service.js';
import { generateQuiz } from '../../services/studio-generators/quiz.service.js';
import { generateDataTable } from '../../services/studio-generators/data-table.service.js';
import { generateReport } from '../../services/studio-generators/report.service.js';
import { logger } from '../../utils/logger.js';

const studioRepo = new StudioRepository();

type StudioArtifactKind = 'flashcards' | 'quiz' | 'data_table' | 'report';

/**
 * One entry per Studio output kind. Adding a new kind (Mind Map, Slide
 * Deck, Report, Quiz, Data Table) is: write its generator service, add one
 * entry here, add the kind to the `studioArtifactRequested` event enum and
 * `studioKindParamSchema` — the function body below stays unchanged.
 */
const studioGenerators: Record<StudioArtifactKind, (ctx: StudioContext) => Promise<{ title: string; payload: unknown }>> = {
  flashcards: generateFlashcards,
  quiz: generateQuiz,
  data_table: generateDataTable,
  report: generateReport,
};

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
    const { artifactId, memorybookId, kind } = event.data;

    const context = await step.run('fetch-source-context', () => buildStudioContext(memorybookId));

    if (context.chunkCount === 0) {
      throw new Error('This memorybook has no indexed sources yet — add some sources and wait for them to finish processing first.');
    }

    const generator = studioGenerators[kind as StudioArtifactKind];
    const { title, payload } = await step.run(`generate-${kind}`, () => generator(context));

    await step.run('persist-artifact', () =>
      studioRepo.updateArtifact(artifactId, { status: 'ready', title, payload, errorMessage: null })
    );
  }
);
