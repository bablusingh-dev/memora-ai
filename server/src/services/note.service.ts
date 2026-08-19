import { NoteRepository } from '../repositories/note.repository.js';
import { MemorybookRepository } from '../repositories/memorybook.repository.js';
import { NotFoundError } from '../utils/api-error.js';

export class NoteService {
  private noteRepo: NoteRepository;
  private memorybookRepo: MemorybookRepository;

  constructor() {
    this.noteRepo = new NoteRepository();
    this.memorybookRepo = new MemorybookRepository();
  }

  async getNotes(memorybookId: string, userId: string) {
    const memorybook = await this.memorybookRepo.findById(memorybookId, userId);
    if (!memorybook) {
      throw new NotFoundError(`Memorybook '${memorybookId}' not found`);
    }
    return await this.noteRepo.findByMemorybookId(memorybookId);
  }

  async createNote(memorybookId: string, userId: string, title: string, content: string, type = 'user_note') {
    const memorybook = await this.memorybookRepo.findById(memorybookId, userId);
    if (!memorybook) {
      throw new NotFoundError(`Memorybook '${memorybookId}' not found`);
    }
    return await this.noteRepo.createNote({
      memorybookId,
      title,
      content,
      type,
    });
  }

  async deleteNote(memorybookId: string, noteId: string, userId: string) {
    const memorybook = await this.memorybookRepo.findById(memorybookId, userId);
    if (!memorybook) {
      throw new NotFoundError(`Memorybook '${memorybookId}' not found`);
    }
    const deleted = await this.noteRepo.deleteNote(noteId, memorybookId);
    if (!deleted) {
      throw new NotFoundError(`Note '${noteId}' not found`);
    }
    return true;
  }
}
