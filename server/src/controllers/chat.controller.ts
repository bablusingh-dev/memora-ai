import { Response } from 'express';
import { AgentService } from '../services/agent.service.js';
import { asyncHandler } from '../utils/async-handler.js';
import { AuthenticatedRequest } from '../middlewares/auth.middleware.js';
import { BadRequestError } from '../utils/api-error.js';
import { ApiResponse } from '../utils/api-response.js';

const agentService = new AgentService();

export const handleGetChatHistory = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const notebookId = req.params.notebookId as string;
  const userId = req.userId!;

  const messages = await agentService.getChatHistory(notebookId, userId);

  return ApiResponse.success({
    res,
    message: 'Chat history retrieved successfully',
    data: { messages },
  });
});

export const handleClearChatHistory = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const notebookId = req.params.notebookId as string;
  const userId = req.userId!;

  await agentService.clearChatHistory(notebookId, userId);

  return ApiResponse.success({
    res,
    message: 'Chat history cleared successfully',
    data: { cleared: true },
  });
});

export const handleAgentChatStream = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const notebookId = req.params.notebookId as string;
  const userId = req.userId!;
  const { messages } = req.body;

  if (!messages || !Array.isArray(messages)) {
    throw new BadRequestError('Request body must include an array of chat messages');
  }

  // Disable Nagle's algorithm — without this, TCP batches all small SSE chunks and
  // sends them together at the same timestamp, making streaming appear frozen then
  // dumping all content at once.
  res.socket?.setNoDelay(true);

  const result = await agentService.streamAgentChat(notebookId, userId, messages);

  result.pipeUIMessageStreamToResponse(res);
});
