const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const hpp = require('hpp');
const compression = require('compression');
const morgan = require('morgan');
require('dotenv').config();

// Import routes
const blogRoutes = require('./routes/blogRoutes');
const errorHandler = require('./middlewares/errorHandler');

const app = express();

// Trust proxy for rate limiting behind reverse proxy
app.set('trust proxy', 1);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// CORS configuration
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      process.env.FRONTEND_URL || 'http://localhost:5173',
      'https://zwolfconsultancyservice-blog-dashboard.onrender.com', // Development frontend
      
    ];
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 100 : 1000, // More lenient in development
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: 15 * 60 // 15 minutes in seconds
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});
app.use('/api/', limiter);

// Body parsing middleware
app.use(express.json({ 
  limit: '10mb',
  verify: (req, res, buf) => {
    try {
      JSON.parse(buf);
    } catch (e) {
      res.status(400).json({ error: 'Invalid JSON' });
      throw new Error('Invalid JSON');
    }
  }
}));
app.use(express.urlencoded({ 
  extended: true, 
  limit: '10mb',
  parameterLimit: 50
}));

// Data sanitization against NoSQL query injection
app.use(mongoSanitize({
  replaceWith: '_'
}));

// Prevent HTTP Parameter Pollution attacks
app.use(hpp({
  whitelist: ['tags', 'categories'] // Allow arrays for these parameters
}));

// Compression middleware
app.use(compression({
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  },
  threshold: 1024 // Only compress responses larger than 1KB
}));

// Logging middleware
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// API Routes
app.use('/api/blogs', blogRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    version: process.env.npm_package_version || '1.0.0'
  });
});

// API info endpoint
app.get('/api', (req, res) => {
  res.status(200).json({
    message: 'Law Firm Backend API',
    version: '1.0.0',
    endpoints: {
      blogs: '/api/blogs',
      health: '/health'
    },
    documentation: 'https://your-api-docs-url.com'
  });
});

// Error handling middleware (must be after routes)
app.use(errorHandler);

// 404 handler (must be last)
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Route not found',
    message: `Cannot ${req.method} ${req.originalUrl}`,
    availableEndpoints: {
      blogs: '/api/blogs',
      health: '/health'
    }
  });
});

// Database connection with retry logic
const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI;
    
    if (!mongoURI) {
      throw new Error('MONGODB_URI environment variable is not defined');
    }

    // ✅ Updated connection options for Mongoose 8.x (removed deprecated options)
    const conn = await mongoose.connect(mongoURI, {
      // Remove these deprecated options:
      // useNewUrlParser: true,        // ❌ Deprecated in Mongoose 8.x
      // useUnifiedTopology: true,     // ❌ Deprecated in Mongoose 8.x
      // bufferMaxEntries: 0           // ❌ Not supported in Mongoose 8.x
      
      // Keep only these supported options:
      maxPoolSize: 10, // Maintain up to 10 socket connections
      serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
      socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
      bufferCommands: false, // Disable mongoose buffering
      retryWrites: true, // Retry writes automatically
      w: 'majority' // Write concern for MongoDB Atlas
    });

    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    console.log(`📊 Database: ${conn.connection.name}`);
    
    // Handle connection events
    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('⚠️ MongoDB disconnected');
    });

    mongoose.connection.on('reconnected', () => {
      console.log('✅ MongoDB reconnected');
    });

  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
    
    // More detailed error logging for Atlas connection issues
    if (error.message.includes('ENOTFOUND')) {
      console.error('🔍 Check your MongoDB Atlas cluster URL');
    } else if (error.message.includes('authentication failed')) {
      console.error('🔐 Check your MongoDB Atlas username and password');
    } else if (error.message.includes('IP not in whitelist')) {
      console.error('🌐 Check your MongoDB Atlas Network Access settings');
    }
    
    process.exit(1);
  }
};

// Graceful shutdown
const gracefulShutdown = () => {
  console.log('\n🔄 Received kill signal, shutting down gracefully');
  
  server.close(() => {
    console.log('✅ HTTP server closed');
    
    mongoose.connection.close(false, () => {
      console.log('✅ MongoDB connection closed');
      process.exit(0);
    });
  });

  // Force close server after 10 seconds
  setTimeout(() => {
    console.error('❌ Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
};

// Handle process termination
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('❌ Unhandled Rejection:', err);
  process.exit(1);
});

// Start server
const PORT = process.env.PORT || 5000;
let server;

const startServer = async () => {
  try {
    // Connect to database first
    await connectDB();
    
    // Start HTTP server
    server = app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📱 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🌐 API available at: http://localhost:${PORT}/api`);
      console.log(`❤️ Health check: http://localhost:${PORT}/health`);
    });

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`❌ Port ${PORT} is already in use`);
        process.exit(1);
      } else {
        console.error('❌ Server error:', err);
        process.exit(1);
      }
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

// Start the application
startServer();

module.exports = app;