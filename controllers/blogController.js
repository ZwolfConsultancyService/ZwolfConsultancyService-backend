const Blog = require('../models/Blog');
const { validationResult } = require('express-validator');
const ImageKit = require('imagekit');
  
// Initialize ImageKit
const imagekit = new ImageKit({
  publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
  urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT
});

// Get all blogs with pagination, search, and filters
exports.getAllBlogs = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    // Build query object
    let query = {};
    
    // Search functionality
    if (req.query.search) {
      query.$text = { $search: req.query.search };
    }
    
    // Filter by author
    if (req.query.author) {
      query.author = new RegExp(req.query.author, 'i');
    }
    
    // Filter by tags
    if (req.query.tags) {
      const tags = req.query.tags.split(',').map(tag => tag.trim().toLowerCase());
      query.tags = { $in: tags };
    }
    
    // Sort options
    let sortOption = { createdAt: -1 }; // Default sort by newest
    if (req.query.sortBy) {
      switch (req.query.sortBy) {
        case 'title':
          sortOption = { title: 1 };
          break;
        case 'author':
          sortOption = { author: 1 };
          break;
        case 'oldest':
          sortOption = { createdAt: 1 };
          break;
        default:
          sortOption = { createdAt: -1 };
      }
    }
    
    const blogs = await Blog.find(query)
      .sort(sortOption)
      .limit(limit)
      .skip(skip)
      .lean();
    
    const total = await Blog.countDocuments(query);
    const totalPages = Math.ceil(total / limit);
    
    res.status(200).json({
      success: true,
      data: blogs,
      pagination: {
        currentPage: page,
        totalPages,
        totalBlogs: total,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching blogs',
      error: error.message
    });
  }
};

// Get single blog by ID
exports.getBlogById = async (req, res) => {
  try {
    const blog = await Blog.findById(req.params.id);
    
    if (!blog) {
      return res.status(404).json({
        success: false,
        message: 'Blog not found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: blog
    });
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid blog ID'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Error fetching blog',
      error: error.message
    });
  }
};

// Create new blog
exports.createBlog = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }
    
    const { title, content, author, tags, images } = req.body;
    
    const blog = new Blog({
      title,
      content,
      author,
      tags: tags || [],
      images: images || []
    });
    
    const savedBlog = await blog.save();
    
    res.status(201).json({
      success: true,
      message: 'Blog created successfully',
      data: savedBlog
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error creating blog',
      error: error.message
    });
  }
};

// Update blog
exports.updateBlog = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }
    
    const blog = await Blog.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    
    if (!blog) {
      return res.status(404).json({
        success: false,
        message: 'Blog not found'
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Blog updated successfully',
      data: blog
    });
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid blog ID'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Error updating blog',
      error: error.message
    });
  }
};

// Delete blog
exports.deleteBlog = async (req, res) => {
  try {
    const blog = await Blog.findById(req.params.id);
    
    if (!blog) {
      return res.status(404).json({
        success: false,
        message: 'Blog not found'
      });
    }
    
    // Delete associated images from ImageKit
    if (blog.images && blog.images.length > 0) {
      const deletePromises = blog.images.map(image => 
        imagekit.deleteFile(image.fileId).catch(err => 
          console.error('Error deleting image:', err)
        )
      );
      await Promise.allSettled(deletePromises);
    }
    
    await Blog.findByIdAndDelete(req.params.id);
    
    res.status(200).json({
      success: true,
      message: 'Blog deleted successfully'
    });
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid blog ID'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Error deleting blog',
      error: error.message
    });
  }
};

// Upload image to ImageKit
exports.uploadImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No image file provided'
      });
    }
    
    const result = await imagekit.upload({
      file: req.file.buffer,
      fileName: req.file.originalname,
      folder: '/blog-images'
    });
    
    res.status(200).json({
      success: true,
      message: 'Image uploaded successfully',
      data: {
        url: result.url,
        fileId: result.fileId,
        name: result.name
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error uploading image',
      error: error.message
    });
  }
};

// Get unique tags
exports.getTags = async (req, res) => {
  try {
    const tags = await Blog.distinct('tags');
    res.status(200).json({
      success: true,
      data: tags.filter(tag => tag && tag.length > 0)
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching tags',
      error: error.message
    });
  }
};

// Get unique authors
exports.getAuthors = async (req, res) => {
  try {
    const authors = await Blog.distinct('author');
    res.status(200).json({
      success: true,
      data: authors.filter(author => author && author.length > 0)
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching authors',
      error: error.message
    });
  }
};