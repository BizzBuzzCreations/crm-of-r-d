'use strict';
// Dedicated multer config for social post media — same diskStorage-to-
// /uploads pattern as middleware/upload.js, but with a realistic
// social-video ceiling (Instagram/Facebook video posts routinely run
// 20-80MB, well past the shared middleware's 10MB general-purpose limit).
// Needs a matching nginx `client_max_body_size` bump in production — same
// class of issue already hit once with the CSV importer.
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadDir = path.join(__dirname, '../../../../uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `social-${unique}${path.extname(file.originalname)}`);
  },
});

const fileFilter = (_req, file, cb) => {
  const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/quicktime', 'video/webm'];
  if (allowed.includes(file.mimetype)) cb(null, true);
  else cb(new Error(`File type ${file.mimetype} not supported for social posts`), false);
};

const socialUpload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB
});

module.exports = socialUpload;
