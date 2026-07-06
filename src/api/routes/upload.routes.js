/**
 * Upload Routes
 * Universal file upload endpoint (multipart/form-data)
 */

/**
 * @swagger
 * tags:
 *   name: Upload
 *   description: Universal file upload
 */

const { Router } = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { randomUUID } = require('crypto');

const uploadController = require('../../domains/upload/upload.controller');
const { requireAuth } = require('../middlewares/auth.middleware');

const router = Router();

// Ensure local upload dir exists (works for local/dev; production should swap to S3/Cloudinary)
const uploadDir = path.join(process.cwd(), 'uploads');
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').slice(0, 16);
    cb(null, `${randomUUID()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 15 * 1024 * 1024, // 15MB
    files: 1,
  },
});

/**
 * @swagger
 * /api/upload:
 *   post:
 *     summary: Upload a file and receive a public URL
 *     tags: [Upload]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Uploaded
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 url:
 *                   type: string
 */
router.post('/', requireAuth, upload.single('file'), uploadController.upload);

module.exports = router;
