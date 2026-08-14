import { NoteRepository } from '../repositories/note.repository.js';
import { NotebookRepository } from '../repositories/notebook.repository.js';
import { NotFoundError } from '../utils/api-error.js';

export class NoteService {
  private noteRepo: NoteRepository;
  private notebookRepo: NotebookRepository;

  constructor() {
    this.noteRepo = new NoteRepository();
    this.notebookRepo = new NotebookRepository();
  }

  async getNotes(notebookId: string, userId: string) {
    const notebook = await this.notebookRepo.findById(notebookId, userId);
    if (!notebook) {
      throw new NotFoundError(`Notebook '${notebookId}' not found`);
    }
    return await this.noteRepo.findByNotebookId(notebookId);
  }

  async createNote(notebookId: string, userId: string, title: string, content: string, type = 'user_note') {
    const notebook = await this.notebookRepo.findById(notebookId, userId);
    if (!notebook) {
      throw new NotFoundError(`Notebook '${notebookId}' not found`);
    }
    return await this.noteRepo.createNote({
      notebookId,
      title,
      content,
      type,
    });
  }

  async deleteNote(notebookId: string, noteId: string, userId: string) {
    const notebook = await this.notebookRepo.findById(notebookId, userId);
    if (!notebook) {
      throw new NotFoundError(`Notebook '${notebookId}' not found`);
    }
    const deleted = await this.noteRepo.deleteNote(noteId, notebookId);
    if (!deleted) {
      throw new NotFoundError(`Note '${noteId}' not found`);
    }
    return true;
  }
}
