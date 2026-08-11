import { Request, Response } from 'express';
import { Webhook } from 'svix';
import { env } from '../config/env.js';
import { UserService } from '../services/user.service.js';
import { ApiResponse } from '../utils/api-response.js';
import { BadRequestError } from '../utils/api-error.js';
import { asyncHandler } from '../utils/async-handler.js';
import { logger } from '../utils/logger.js';

const userService = new UserService();

export const handleClerkWebhook = asyncHandler(async (req: Request, res: Response) => {
  const webhookSecret = env.CLERK_WEBHOOK_SECRET;

  if (!webhookSecret || webhookSecret === 'whsec_placeholder') {
    logger.warn('Clerk Webhook Secret is missing or set to placeholder.');
  }

  const svixId = req.headers['svix-id'] as string;
  const svixTimestamp = req.headers['svix-timestamp'] as string;
  const svixSignature = req.headers['svix-signature'] as string;

  if (!svixId || !svixTimestamp || !svixSignature) {
    throw new BadRequestError('Missing Svix signature headers');
  }

  // Get raw body for Svix verification
  const payloadBuffer = req.body;
  const payloadString = typeof payloadBuffer === 'string' ? payloadBuffer : JSON.stringify(payloadBuffer);

  let evt: any;

  try {
    const wh = new Webhook(webhookSecret);
    evt = wh.verify(payloadString, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    });
  } catch (err: any) {
    logger.error({ err: err.message }, 'Failed to verify Clerk webhook Svix signature');
    throw new BadRequestError(`Webhook signature verification failed: ${err.message}`);
  }

  await userService.handleClerkWebhook(evt);

  return ApiResponse.success({
    res,
    message: 'Webhook processed successfully',
    data: { received: true },
  });
});
