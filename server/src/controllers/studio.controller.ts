import { Response } from 'express';
import { StudioService, StudioArtifactKind } from '../services/studio.service.js';
import { ApiResponse } from '../utils/api-response.js';
import { asyncHandler } from '../utils/async-handler.js';
import { AuthenticatedRequest } from '../middlewares/auth.middleware.js';

const studioService = new StudioService();

export const getArtifacts = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const memorybookId = req.params.memorybookId as string;
  const userId = req.userId!;
  const artifacts = await studioService.listArtifacts(memorybookId, userId);

  return ApiResponse.success({
    res,
    data: artifacts,
    message: 'Studio artifacts fetched successfully',
  });
});

export const getArtifactById = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const memorybookId = req.params.memorybookId as string;
  const artifactId = req.params.id as string;
  const userId = req.userId!;
  const artifact = await studioService.getArtifact(memorybookId, artifactId, userId);

  return ApiResponse.success({
    res,
    data: artifact,
    message: 'Studio artifact fetched successfully',
  });
});

export const generateArtifact = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const memorybookId = req.params.memorybookId as string;
  const kind = req.params.kind as StudioArtifactKind;
  const userId = req.userId!;
  const artifact = await studioService.requestGeneration(memorybookId, userId, kind);

  return ApiResponse.accepted({
    res,
    data: artifact,
    message: 'Studio artifact generation started',
  });
});

export const deleteArtifact = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const memorybookId = req.params.memorybookId as string;
  const artifactId = req.params.id as string;
  const userId = req.userId!;
  await studioService.deleteArtifact(memorybookId, artifactId, userId);

  return ApiResponse.success({
    res,
    message: 'Studio artifact deleted successfully',
  });
});
