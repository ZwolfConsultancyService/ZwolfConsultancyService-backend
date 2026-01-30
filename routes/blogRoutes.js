const express = require('express');
const { body } = require('express-validator');
const multer = require('multer');
const blogController = require('../controllers/blogController');

const router = express.Router();

// Configure multer for image uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

// Validation rules for blog creation/update
const blogValidation = [
  body('title')
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Title must be between 1 and 200 characters'),
  body('content')
    .trim()
    .isLength({ min: 10 })
    .withMessage('Content must be at least 10 characters long'),
  body('author')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Author must be between 1 and 100 characters'),
  body('tags')
    .optional()
    .isArray()
    .withMessage('Tags must be an array'),
  body('tags.*')
    .optional()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Each tag must be between 1 and 50 characters')
];
router.get('/fetch', blogController.getAllBlogs);
router.get('/tags', blogController.getTags);
router.get('/authors', blogController.getAuthors);

// POST routes
router.post('/create', blogValidation, blogController.createBlog);
router.post('/upload-image', upload.single('image'), blogController.uploadImage);

// Dynamic routes MUST come last
router.get('/:id', blogController.getBlogById);
router.put('/:id', blogValidation, blogController.updateBlog);
router.delete('/:id', blogController.deleteBlog);

module.exports = router;