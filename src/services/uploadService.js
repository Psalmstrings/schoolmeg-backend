import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import { config } from '../config/env.js';
import fs from 'fs';
import path from 'path';

// Configure Cloudinary if credentials provided
const isCloudinaryConfigured = Boolean(
  config.cloudinary.cloudName &&
  config.cloudinary.apiKey &&
  config.cloudinary.apiSecret
);

if (isCloudinaryConfigured) {
  cloudinary.config({
    cloud_name: config.cloudinary.cloudName,
    api_key: config.cloudinary.apiKey,
    api_secret: config.cloudinary.apiSecret
  });
}

// Memory storage for buffer processing
const storage = multer.memoryStorage();

// File filter: JPG, JPEG, PNG, WEBP
const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file format. Only JPG, JPEG, PNG, and WebP images are allowed.'), false);
  }
};

export const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter
});

/**
 * Uploads an image buffer to Cloudinary or falls back to local data URL / filesystem
 */
export const uploadImage = async (fileBuffer, mimetype, folder = 'schoolmag_uploads') => {
  if (isCloudinaryConfigured) {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: `${config.cloudinary.folder}/${folder}`,
          resource_type: 'image',
          transformation: [{ width: 500, height: 600, crop: 'fill', gravity: 'face' }]
        },
        (error, result) => {
          if (error) return reject(error);
          resolve({
            url: result.secure_url,
            publicId: result.public_id
          });
        }
      );
      uploadStream.end(fileBuffer);
    });
  }

  // Fallback for development/testing when Cloudinary credentials are not set:
  // Convert to high-fidelity Base64 Data URI with virtual publicId
  const base64Data = fileBuffer.toString('base64');
  const dataUrl = `data:${mimetype};base64,${base64Data}`;
  const publicId = `local_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  return {
    url: dataUrl,
    publicId
  };
};

/**
 * Deletes an image from Cloudinary if configured
 */
export const deleteImage = async (publicId) => {
  if (isCloudinaryConfigured && publicId && !publicId.startsWith('local_')) {
    try {
      await cloudinary.uploader.destroy(publicId);
    } catch (err) {
      console.warn('[Cloudinary Delete Warning]:', err.message);
    }
  }
};
