import { NotebookRepository, NewNotebook } from '../repositories/notebook.repository.js';
import { NotFoundError, BadRequestError } from '../utils/api-error.js';
import { logger } from '../utils/logger.js';

export class NotebookService {
  private repo: NotebookRepository;

  constructor() {
    this.repo = new NotebookRepository();
  }

  async getAllNotebooks(userId: string) {
    return await this.repo.findAllByUserId(userId);
  }

  async getNotebookById(id: string, userId: string) {
    const notebook = await this.repo.findById(id, userId);
    if (!notebook) {
      throw new NotFoundError(`Notebook with ID '${id}' not found`);
    }
    const sources = await this.repo.getSourcesByNotebookId(id);
    return {
      ...notebook,
      sources,
    };
  }

  async createNotebook(data: NewNotebook) {
    if (!data.title || data.title.trim() === '') {
      throw new BadRequestError('Notebook title is required');
    }
    if (!data.userId) {
      throw new BadRequestError('User ID is required');
    }
    logger.info({ title: data.title, userId: data.userId }, 'Creating new notebook');
    return await this.repo.create(data);
  }

  async updateNotebook(id: string, userId: string, data: Partial<NewNotebook>) {
    const updated = await this.repo.update(id, userId, data);
    if (!updated) {
      throw new NotFoundError(`Notebook with ID '${id}' not found`);
    }
    return updated;
  }

  async deleteNotebook(id: string, userId: string) {
    const deleted = await this.repo.delete(id, userId);
    if (!deleted) {
      throw new NotFoundError(`Notebook with ID '${id}' not found`);
    }
    return true;
  }
}
