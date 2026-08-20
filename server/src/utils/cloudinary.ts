import { v2 as cloudinary } from 'cloudinary';
import { env } from '../config/env.js';
import { logger } from './logger.js';
import { BadRequestError, InternalServerError } from './api-error.js';

// Cloudinary's plan-level max asset size (10MB on the free/default tier).
// Keep this in sync with the multer `limits.fileSize` in source.routes.ts —
// there's no point accepting a file at the multer layer that Cloudinary will
// reject after the round trip.
export const MAX_UPLOAD_FILE_SIZE_BYTES = 10 * 1024 * 1024;

cloudinary.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME,
  api_key: env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET,
});

export async function uploadToCloudinary(
  fileBuffer: Buffer,
  fileName: string,
  folder = 'memorybook/sources'
): Promise<string> {
  if (
    !env.CLOUDINARY_CLOUD_NAME ||
    env.CLOUDINARY_CLOUD_NAME === 'placeholder' ||
    !env.CLOUDINARY_API_KEY ||
    env.CLOUDINARY_API_KEY === 'placeholder'
  ) {
    throw new BadRequestError(
      'Cloudinary API credentials are missing or set to placeholder. Please configure CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in server/.env.'
    );
  }

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: 'auto',
        public_id: `${Date.now()}_${fileName.replace(/[^a-zA-Z0-9]/g, '_')}`,
      },
      (error, result) => {
        if (error || !result) {
          logger.error({ error }, 'Failed to upload asset to Cloudinary');
          // Cloudinary's SDK rejects with a plain { message, http_code } object,
          // not an Error instance — wrap it in an ApiError so the real reason
          // (e.g. "File size too large") reaches the client instead of being
          // swallowed as a generic 500.
          if (error) {
            const httpCode = (error as any).http_code;
            if (httpCode && httpCode >= 400 && httpCode < 500) {
              return reject(new BadRequestError(error.message || 'Cloudinary rejected the file'));
            }
            return reject(new InternalServerError(error.message || 'Cloudinary asset upload failed'));
          }
          return reject(new InternalServerError('Cloudinary asset upload failed'));
        }
        logger.info({ publicId: result.public_id, url: result.secure_url }, 'Asset uploaded to Cloudinary successfully');
        resolve(result.secure_url);
      }
    );

    uploadStream.end(fileBuffer);
  });
}
