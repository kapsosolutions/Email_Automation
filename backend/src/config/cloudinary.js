import { v2 as cloudinary } from 'cloudinary';
import env, { cloudinaryEnabled } from './env.js';

if (cloudinaryEnabled) {
  cloudinary.config({
    cloud_name: env.cloudinary.cloudName,
    api_key: env.cloudinary.apiKey,
    api_secret: env.cloudinary.apiSecret,
    secure: true,
  });
}

/**
 * Archive the original uploaded spreadsheet so a campaign can always be traced
 * back to its source file. Non-fatal: ingestion continues if this fails.
 */
export async function archiveSourceFile(buffer, filename) {
  if (!cloudinaryEnabled) return null;

  try {
    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          resource_type: 'raw',
          folder: 'email-automation/imports',
          public_id: `${Date.now()}-${filename.replace(/\.[^.]+$/, '')}`,
          use_filename: true,
          unique_filename: true,
        },
        (error, uploaded) => (error ? reject(error) : resolve(uploaded)),
      );
      stream.end(buffer);
    });

    return { url: result.secure_url, publicId: result.public_id };
  } catch (error) {
    console.warn('[cloudinary] archive failed:', error.message);
    return null;
  }
}

export { cloudinary, cloudinaryEnabled };
