import { v2 as cloudinary } from 'cloudinary';
import { env } from '../config/env.js';
import { logger } from './logger.js';
import { BadRequestError } from './api-error.js';

cloudinary.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME,
  api_key: env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET,
});

export async function uploadToCloudinary(
  fileBuffer: Buffer,
  fileName: string,
  folder = 'memora-ai/sources'
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
          return reject(error || new Error('Cloudinary asset upload failed'));
        }
        logger.info({ publicId: result.public_id, url: result.secure_url }, 'Asset uploaded to Cloudinary successfully');
        resolve(result.secure_url);
      }
    );

    uploadStream.end(fileBuffer);
  });
}
