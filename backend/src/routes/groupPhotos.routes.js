// X4 group photo gallery, mounted at /api/groups/:groupId/photos (members only, after booking).
const { Router } = require('express');
const multer = require('multer');
const controller = require('../controllers/groupPhotos.controller.ts');
const { requireTraveller } = require('../middleware/currentTraveller');
const HttpError = require('../utils/HttpError');

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_FILES = 10;

// Files stay in memory (max 10 × 5 MB); the service checks their real type before storing them.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_FILE_BYTES, files: MAX_FILES, fields: 20 } });

const MULTER_MESSAGES = {
  LIMIT_FILE_SIZE: 'Each photo must be 5 MB or smaller',
  LIMIT_FILE_COUNT: `Upload at most ${MAX_FILES} photos at a time`,
  LIMIT_UNEXPECTED_FILE: 'Send the photos in the "photos" field',
};

/** Runs multer and turns its errors into the usual 400 { error: { fields } } shape. */
function receivePhotos(req, res, next) {
  upload.array('photos', MAX_FILES)(req, res, (err) => {
    if (!err) return next();
    if (err instanceof multer.MulterError) {
      return next(HttpError.badRequest('Please check the highlighted fields', { photos: MULTER_MESSAGES[err.code] ?? 'The upload could not be read' }));
    }
    return next(err);
  });
}

const router = Router({ mergeParams: true });
router.use(requireTraveller); // before multer, so anonymous requests never upload a body
router.get('/', controller.listPhotos);
router.post('/', receivePhotos, controller.uploadPhotos);
router.get('/:photoId', controller.getPhoto);
router.delete('/:photoId', controller.deletePhoto);
module.exports = router;
