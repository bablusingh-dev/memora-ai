import { NotebookRepository, NewNotebook } from '../repositories/notebook.repository.js';
import { NotFoundError, BadRequestError } from '../utils/api-error.js';
import { logger } from '../utils/logger.js';

export class NotebookService {
  private repo: NotebookRepository;

  constructor() {
    this.repo = new NotebookRepository();
  }

  async getAllNotebooks() {
    return await this.repo.findAll();
  }

  async getNotebookById(id: string) {
    const notebook = await this.repo.findById(id);
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
    logger.info({ title: data.title }, 'Creating new notebook');
    return await this.repo.create(data);
  }

  async deleteNotebook(id: string) {
    const deleted = await this.repo.delete(id);
    if (!deleted) {
      throw new NotFoundError(`Notebook with ID '${id}' not found`);
    }
    return true;
  }
}
