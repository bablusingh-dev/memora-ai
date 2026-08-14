import { v2 as cloudinary } from 'cloudinary';
import { env } from '../config/env.js';
import { logger } from './logger.js';

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
  // If Cloudinary keys are placeholders, fallback to a mock URL for seamless local testing
  if (
    !env.CLOUDINARY_CLOUD_NAME ||
    env.CLOUDINARY_CLOUD_NAME === 'placeholder' ||
    !env.CLOUDINARY_API_KEY ||
    env.CLOUDINARY_API_KEY === 'placeholder'
  ) {
    logger.info({ fileName }, 'Cloudinary keys not set, returning mock asset URL for local dev');
    return `https://res.cloudinary.com/demo/image/upload/v1/memora/${encodeURIComponent(fileName)}`;
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
          return reject(error || new Error('Cloudinary upload failed'));
        }
        logger.info({ publicId: result.public_id, url: result.secure_url }, 'Asset uploaded to Cloudinary successfully');
        resolve(result.secure_url);
      }
    );

    uploadStream.end(fileBuffer);
  });
}
