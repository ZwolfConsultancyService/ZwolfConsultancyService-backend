const mongoose = require('mongoose');

const blogSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  content: {
    type: String,
    required: [true, 'Content is required'],
    trim: true
  },
  author: {
    type: String,
    required: [true, 'Author is required'],
    trim: true,
    maxlength: [100, 'Author name cannot exceed 100 characters']
  },
  tags: [{
    type: String,
    trim: true,
    lowercase: true,
    maxlength: [50, 'Tag cannot exceed 50 characters']
  }],
  images: [{
    url: {
      type: String,
      required: true
    },
    fileId: {
      type: String,
      required: true
    },
    name: {
      type: String,
      required: true
    }
  }],
  isPublished: {
    type: Boolean,
    default: true
  },
  publishedAt: {
    type: Date,
    default: Date.now
  },
  views: {
    type: Number,
    default: 0
  },
  likes: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Create text index for search functionality
blogSchema.index({ 
  title: 'text', 
  content: 'text',
  author: 'text' 
});

// Create other indexes for performance
blogSchema.index({ tags: 1 });
blogSchema.index({ author: 1 });
blogSchema.index({ createdAt: -1 });
blogSchema.index({ publishedAt: -1 });

// Virtual for excerpt
blogSchema.virtual('excerpt').get(function() {
  return this.content.length > 150 
    ? this.content.substring(0, 150) + '...'
    : this.content;
});

// Pre-save middleware to update publishedAt when isPublished changes
blogSchema.pre('save', function(next) {
  if (this.isModified('isPublished') && this.isPublished) {
    this.publishedAt = new Date();
  }
  next();
});

// Static method to get published blogs
blogSchema.statics.getPublished = function() {
  return this.find({ isPublished: true }).sort({ publishedAt: -1 });
};

// Instance method to increment views
blogSchema.methods.incrementViews = function() {
  this.views += 1;
  return this.save();
};

module.exports = mongoose.model('Blog', blogSchema);