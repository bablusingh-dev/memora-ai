import { StudioRepository, StudioArtifact } from '../repositories/studio.repository.js';
import { MemorybookRepository } from '../repositories/memorybook.repository.js';
import { NotFoundError } from '../utils/api-error.js';
import { inngest } from '../inngest/client.js';
import { studioArtifactRequested } from '../inngest/events.js';

export type StudioArtifactKind = 'flashcards' | 'quiz';

const KIND_TITLES: Record<StudioArtifactKind, string> = {
  flashcards: 'Flashcards',
  quiz: 'Quiz',
};

/**
 * Same two-phase shape as SourceService: this stays fast (validate + insert
 * a `generating` row + send an Inngest event) and hands the actual LLM work
 * off to server/src/inngest/functions/generate-studio-artifact.ts.
 */
export class StudioService {
  private studioRepo: StudioRepository;
  private memorybookRepo: MemorybookRepository;

  constructor() {
    this.studioRepo = new StudioRepository();
    this.memorybookRepo = new MemorybookRepository();
  }

  async listArtifacts(memorybookId: string, userId: string): Promise<StudioArtifact[]> {
    const memorybook = await this.memorybookRepo.findById(memorybookId, userId);
    if (!memorybook) {
      throw new NotFoundError(`Memorybook '${memorybookId}' not found`);
    }
    return await this.studioRepo.findByMemorybookId(memorybookId);
  }

  async getArtifact(memorybookId: string, artifactId: string, userId: string): Promise<StudioArtifact> {
    const memorybook = await this.memorybookRepo.findById(memorybookId, userId);
    if (!memorybook) {
      throw new NotFoundError(`Memorybook '${memorybookId}' not found`);
    }
    const artifact = await this.studioRepo.findById(artifactId, memorybookId);
    if (!artifact) {
      throw new NotFoundError(`Studio artifact '${artifactId}' not found`);
    }
    return artifact;
  }

  async requestGeneration(memorybookId: string, userId: string, kind: StudioArtifactKind): Promise<StudioArtifact> {
    const memorybook = await this.memorybookRepo.findById(memorybookId, userId);
    if (!memorybook) {
      throw new NotFoundError(`Memorybook '${memorybookId}' not found`);
    }

    const artifact = await this.studioRepo.createArtifact({
      memorybookId,
      kind,
      title: KIND_TITLES[kind],
      status: 'generating',
    });

    await inngest.send(studioArtifactRequested.create({ artifactId: artifact.id, memorybookId, userId, kind }));

    return artifact;
  }

  async deleteArtifact(memorybookId: string, artifactId: string, userId: string): Promise<boolean> {
    const memorybook = await this.memorybookRepo.findById(memorybookId, userId);
    if (!memorybook) {
      throw new NotFoundError(`Memorybook '${memorybookId}' not found`);
    }
    const deleted = await this.studioRepo.deleteArtifact(artifactId, memorybookId);
    if (!deleted) {
      throw new NotFoundError(`Studio artifact '${artifactId}' not found`);
    }
    return true;
  }
}
