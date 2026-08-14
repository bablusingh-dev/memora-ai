import { Response } from 'express';
import { AgentService } from '../services/agent.service.js';
import { asyncHandler } from '../utils/async-handler.js';
import { AuthenticatedRequest } from '../middlewares/auth.middleware.js';
import { BadRequestError } from '../utils/api-error.js';

const agentService = new AgentService();

export const handleAgentChatStream = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const notebookId = req.params.notebookId as string;
  const userId = req.userId!;
  const { messages } = req.body;

  if (!messages || !Array.isArray(messages)) {
    throw new BadRequestError('Request body must include an array of chat messages');
  }

  const result = await agentService.streamAgentChat(notebookId, userId, messages);

  // Use pipeTextStreamToResponse to stream text & tool outputs to Express HTTP Response
  result.pipeTextStreamToResponse(res);
});
