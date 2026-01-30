// const express = require("express");
// const mongoose = require("mongoose");
// const cors = require("cors");
// const helmet = require("helmet");
// const rateLimit = require("express-rate-limit");
// const mongoSanitize = require("express-mongo-sanitize");
// const hpp = require("hpp");
// const compression = require("compression");
// const morgan = require("morgan");
// require("dotenv").config();

// // Import database config
// const connectDB = require("./config/db");

// // Import routes
// const blogRoutes = require("./routes/blogRoutes");
// const errorHandler = require("./middlewares/errorHandler");

// const app = express();

// // Trust proxy for rate limiting behind reverse proxy
// app.set("trust proxy", 1);

// // Security middleware
// app.use(
//   helmet({
//     contentSecurityPolicy: {
//       directives: {
//         defaultSrc: ["'self'"],
//         styleSrc: ["'self'", "'unsafe-inline'"],
//         scriptSrc: ["'self'"],
//         imgSrc: ["'self'", "data:", "https:"],
//       },
//     },
//   })
// );

// // CORS configuration
// app.use(
//   cors({
//     origin: function (origin, callback) {
//       // Allow requests with no origin (like mobile apps or curl requests)
//       if (!origin) return callback(null, true);

//       const allowedOrigins = [
//         process.env.FRONTEND_URL || "http://localhost:5173",
//         "https://zwolfconsultancyservice-blog-dashboard.onrender.com",
//         "https://zwolfconsultancyservice.onrender.com",
//       ];

//       if (allowedOrigins.indexOf(origin) !== -1) {
//         callback(null, true);
//       } else {
//         callback(new Error("Not allowed by CORS"));
//       }
//     },
//     credentials: true,
//     methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
//     allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
//   })
// );

// // Rate limiting
// const limiter = rateLimit({
//   windowMs: 15 * 60 * 1000, // 15 minutes
//   max: process.env.NODE_ENV === "production" ? 100 : 1000,
//   message: {
//     error: "Too many requests from this IP, please try again later.",
//     retryAfter: 15 * 60,
//   },
//   standardHeaders: true,
//   legacyHeaders: false,
// });
// app.use("/api/", limiter);

// app.get("/", (req, res) => {
//   res.json({
//     message: "Backend is running 🚀",
//     endpoints: {
//       health: "/health",
//       blogs: "/api/blogs",
//     },
//   });
// });
// // Body parsing middleware
// app.use(
//   express.json({
//     limit: "10mb",
//     verify: (req, res, buf) => {
//       try {
//         JSON.parse(buf);
//       } catch (e) {
//         res.status(400).json({ error: "Invalid JSON" });
//         throw new Error("Invalid JSON");
//       }
//     },
//   })
// );
// app.use(
//   express.urlencoded({
//     extended: true,
//     limit: "10mb",
//     parameterLimit: 50,
//   })
// );

// // Data sanitization against NoSQL query injection
// app.use(
//   mongoSanitize({
//     replaceWith: "_",
//   })
// );

// // Prevent HTTP Parameter Pollution attacks
// app.use(
//   hpp({
//     whitelist: ["tags", "categories"],
//   })
// );

// // Compression middleware
// app.use(
//   compression({
//     filter: (req, res) => {
//       if (req.headers["x-no-compression"]) {
//         return false;
//       }
//       return compression.filter(req, res);
//     },
//     threshold: 1024,
//   })
// );

// // Logging middleware
// if (process.env.NODE_ENV === "development") {
//   app.use(morgan("dev"));
// } else {
//   app.use(morgan("combined"));
// }

// // API Routes
// app.use("/api/blogs", blogRoutes);

// // Health check endpoint
// app.get("/health", (req, res) => {
//   res.status(200).json({
//     status: "OK",
//     timestamp: new Date().toISOString(),
//     uptime: process.uptime(),
//     environment: process.env.NODE_ENV || "development",
//     version: process.env.npm_package_version || "1.0.0",
//   });
// });

// // API info endpoint
// app.get("/api", (req, res) => {
//   res.status(200).json({
//     message: "Law Firm Backend API",
//     version: "1.0.0",
//     endpoints: {
//       blogs: "/api/blogs",
//       health: "/health",
//     },
//     documentation: "https://your-api-docs-url.com",
//   });
// });

// // Error handling middleware (must be after routes)
// app.use(errorHandler);

// // 404 handler (must be last)
// app.use("*", (req, res) => {
//   res.status(404).json({
//     error: "Route not found",
//     message: `Cannot ${req.method} ${req.originalUrl}`,
//     availableEndpoints: {
//       blogs: "/api/blogs",
//       health: "/health",
//     },
//   });
// });

// // Graceful shutdown
// const gracefulShutdown = () => {
//   console.log("\n🔄 Received kill signal, shutting down gracefully");

//   server.close(() => {
//     console.log("✅ HTTP server closed");

//     mongoose.connection.close(false, () => {
//       console.log("✅ MongoDB connection closed");
//       process.exit(0);
//     });
//   });

//   // Force close server after 10 seconds
//   setTimeout(() => {
//     console.error(
//       "❌ Could not close connections in time, forcefully shutting down"
//     );
//     process.exit(1);
//   }, 10000);
// };

// // Handle process termination
// process.on("SIGTERM", gracefulShutdown);
// process.on("SIGINT", gracefulShutdown);

// // Handle uncaught exceptions
// process.on("uncaughtException", (err) => {
//   console.error("❌ Uncaught Exception:", err);
//   process.exit(1);
// });

// // Handle unhandled promise rejections
// process.on("unhandledRejection", (err) => {
//   console.error("❌ Unhandled Rejection:", err);
//   process.exit(1);
// });

// // Start server
// const PORT = process.env.PORT || 8000;
// let server;

// const startServer = async () => {
//   try {
//     // Connect to database first
//     await connectDB();

//     // Start HTTP server
//     server = app.listen(PORT, () => {
//       console.log(`🚀 Server running on port ${PORT}`);
//       console.log(`📱 Environment: ${process.env.NODE_ENV || "development"}`);
//       console.log(`🌐 API available at: http://localhost:${PORT}/api`);
//       console.log(`❤️ Health check: http://localhost:${PORT}/health`);
//     });

//     server.on("error", (err) => {
//       if (err.code === "EADDRINUSE") {
//         console.error(`❌ Port ${PORT} is already in use`);
//         process.exit(1);
//       } else {
//         console.error("❌ Server error:", err);
//         process.exit(1);
//       }
//     });
//   } catch (error) {
//     console.error("❌ Failed to start server:", error);
//     process.exit(1);
//   }
// };

// // Start the application
// startServer();

// module.exports = app;






const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const mongoSanitize = require("express-mongo-sanitize");
const hpp = require("hpp");
const compression = require("compression");
const morgan = require("morgan");
require("dotenv").config();

// Import database config
const connectDB = require("./config/db");

// Import routes
const blogRoutes = require("./routes/blogRoutes");
const errorHandler = require("./middlewares/errorHandler");

const app = express();

// Trust proxy for rate limiting behind reverse proxy
app.set("trust proxy", 1);

// Security middleware
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
      },
    },
  })
);

// ⭐ FIXED CORS CONFIGURATION - ADD YOUR DOMAIN HERE ⭐
app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);

      const allowedOrigins = [
        // 🔥 YOUR PRODUCTION DOMAIN - MUST ADD THIS! 🔥
        "https://zwolfconsultancy.com",
        "http://zwolfconsultancy.com", // If you redirect HTTP to HTTPS
        
        // Development
        process.env.FRONTEND_URL || "http://localhost:5173",
        "http://localhost:3000",
        
        // Render deployments (if any)
        "https://zwolfconsultancyservice-blog-dashboard.onrender.com",
        "https://zwolfconsultancyservice.onrender.com",
      ];

      if (allowedOrigins.indexOf(origin) !== -1 || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.log('❌ CORS blocked origin:', origin); // Debug log
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
    exposedHeaders: ["Content-Range", "X-Content-Range"],
    maxAge: 600, // Cache preflight for 10 minutes
  })
);

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === "production" ? 100 : 1000,
  message: {
    error: "Too many requests from this IP, please try again later.",
    retryAfter: 15 * 60,
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Don't rate limit health checks
    return req.path === '/health' || req.path === '/';
  }
});
app.use("/api/", limiter);

app.get("/", (req, res) => {
  res.json({
    message: "Backend is running 🚀",
    endpoints: {
      health: "/health",
      blogs: "/api/blogs",
      blogsFetch: "/api/blogs/fetch", // Added this
    },
  });
});

// Body parsing middleware
app.use(
  express.json({
    limit: "10mb",
    verify: (req, res, buf) => {
      try {
        JSON.parse(buf);
      } catch (e) {
        res.status(400).json({ error: "Invalid JSON" });
        throw new Error("Invalid JSON");
      }
    },
  })
);
app.use(
  express.urlencoded({
    extended: true,
    limit: "10mb",
    parameterLimit: 50,
  })
);

// Data sanitization against NoSQL query injection
app.use(
  mongoSanitize({
    replaceWith: "_",
  })
);

// Prevent HTTP Parameter Pollution attacks
app.use(
  hpp({
    whitelist: ["tags", "categories"],
  })
);

// Compression middleware
app.use(
  compression({
    filter: (req, res) => {
      if (req.headers["x-no-compression"]) {
        return false;
      }
      return compression.filter(req, res);
    },
    threshold: 1024,
  })
);

// Logging middleware
if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
} else {
  app.use(morgan("combined"));
}

// API Routes
app.use("/api/blogs", blogRoutes);

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "OK",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || "development",
    version: process.env.npm_package_version || "1.0.0",
  });
});

// API info endpoint
app.get("/api", (req, res) => {
  res.status(200).json({
    message: "Zwolf Consultancy Backend API",
    version: "1.0.0",
    endpoints: {
      blogs: "/api/blogs",
      blogsFetch: "/api/blogs/fetch",
      health: "/health",
    },
    documentation: "https://your-api-docs-url.com",
  });
});

// Error handling middleware (must be after routes)
app.use(errorHandler);

// 404 handler (must be last)
app.use("*", (req, res) => {
  res.status(404).json({
    error: "Route not found",
    message: `Cannot ${req.method} ${req.originalUrl}`,
    availableEndpoints: {
      blogs: "/api/blogs",
      blogsFetch: "/api/blogs/fetch",
      health: "/health",
    },
  });
});

// Graceful shutdown
const gracefulShutdown = () => {
  console.log("\n🔄 Received kill signal, shutting down gracefully");

  server.close(() => {
    console.log("✅ HTTP server closed");

    mongoose.connection.close(false, () => {
      console.log("✅ MongoDB connection closed");
      process.exit(0);
    });
  });

  // Force close server after 10 seconds
  setTimeout(() => {
    console.error(
      "❌ Could not close connections in time, forcefully shutting down"
    );
    process.exit(1);
  }, 10000);
};

// Handle process termination
process.on("SIGTERM", gracefulShutdown);
process.on("SIGINT", gracefulShutdown);

// Handle uncaught exceptions
process.on("uncaughtException", (err) => {
  console.error("❌ Uncaught Exception:", err);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on("unhandledRejection", (err) => {
  console.error("❌ Unhandled Rejection:", err);
  process.exit(1);
});

// Start server
const PORT = process.env.PORT || 8000;
let server;

const startServer = async () => {
  try {
    // Connect to database first
    await connectDB();

    // Start HTTP server
    server = app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📱 Environment: ${process.env.NODE_ENV || "development"}`);
      console.log(`🌐 API available at: http://localhost:${PORT}/api`);
      console.log(`❤️ Health check: http://localhost:${PORT}/health`);
      console.log(`🔥 Allowed origins: https://zwolfconsultancy.com`);
    });

    server.on("error", (err) => {
      if (err.code === "EADDRINUSE") {
        console.error(`❌ Port ${PORT} is already in use`);
        process.exit(1);
      } else {
        console.error("❌ Server error:", err);
        process.exit(1);
      }
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
};

// Start the application
startServer();

module.exports = app;