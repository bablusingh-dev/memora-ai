import { MemorybookRepository, NewMemorybook } from '../repositories/memorybook.repository.js';
import { NotFoundError, BadRequestError } from '../utils/api-error.js';
import { logger } from '../utils/logger.js';

export class MemorybookService {
  private repo: MemorybookRepository;

  constructor() {
    this.repo = new MemorybookRepository();
  }

  async getAllMemorybooks(userId: string) {
    return await this.repo.findAllByUserId(userId);
  }

  async getMemorybookById(id: string, userId: string) {
    const memorybook = await this.repo.findById(id, userId);
    if (!memorybook) {
      throw new NotFoundError(`Memorybook with ID '${id}' not found`);
    }
    const sources = await this.repo.getSourcesByMemorybookId(id);
    return {
      ...memorybook,
      sources,
    };
  }

  async createMemorybook(data: NewMemorybook) {
    if (!data.title || data.title.trim() === '') {
      throw new BadRequestError('Memorybook title is required');
    }
    if (!data.userId) {
      throw new BadRequestError('User ID is required');
    }
    logger.info({ title: data.title, userId: data.userId }, 'Creating new memorybook');
    return await this.repo.create(data);
  }

  async updateMemorybook(id: string, userId: string, data: Partial<NewMemorybook>) {
    const updated = await this.repo.update(id, userId, data);
    if (!updated) {
      throw new NotFoundError(`Memorybook with ID '${id}' not found`);
    }
    return updated;
  }

  async deleteMemorybook(id: string, userId: string) {
    const deleted = await this.repo.delete(id, userId);
    if (!deleted) {
      throw new NotFoundError(`Memorybook with ID '${id}' not found`);
    }
    return true;
  }
}
