import { UserRepository } from '../repositories/user.repository.js';
import { logger } from '../utils/logger.js';

export interface ClerkUserWebhookPayload {
  data: {
    id: string;
    email_addresses?: Array<{ email_address: string; id: string }>;
    first_name?: string;
    last_name?: string;
    image_url?: string;
  };
  type: string;
}

export class UserService {
  private userRepo: UserRepository;

  constructor() {
    this.userRepo = new UserRepository();
  }

  async handleClerkWebhook(payload: ClerkUserWebhookPayload) {
    const { type, data } = payload;
    const userId = data.id;

    logger.info({ type, userId }, 'Processing Clerk user webhook event');

    if (type === 'user.created' || type === 'user.updated') {
      const primaryEmail = data.email_addresses?.[0]?.email_address || '';
      
      const user = await this.userRepo.upsertUser({
        id: userId,
        email: primaryEmail,
        firstName: data.first_name || null,
        lastName: data.last_name || null,
        imageUrl: data.image_url || null,
      });

      logger.info({ userId: user.id, email: user.email }, `User successfully ${type === 'user.created' ? 'synced' : 'updated'}`);
      return user;
    }

    if (type === 'user.deleted') {
      await this.userRepo.deleteUser(userId);
      logger.info({ userId }, 'User profile deleted successfully');
      return { deleted: true };
    }

    logger.warn({ type }, 'Unhandled Clerk webhook event type');
    return null;
  }
}
