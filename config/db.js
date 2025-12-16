  // const mongoose = require('mongoose');

  // const connectDB = async () => {
  //   try {
  //     await mongoose.connect(process.env.MONGO_URI, {
  //       useNewUrlParser: true,
  //       useUnifiedTopology: true,
  //     });
  //     console.log('MongoDB connected');
  //   } catch (error) {
  //     console.error('MongoDB connection error:', error);
  //     process.exit(1);
  //   } 
  // };

  // module.exports = { connectDB };



  const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI || process.env.MONGO_URI;
    
    if (!mongoURI) {
      throw new Error('MONGODB_URI or MONGO_URI environment variable is not defined');
    }

    const conn = await mongoose.connect(mongoURI, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      bufferCommands: false,
      retryWrites: true,
      w: 'majority'
    });

    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    console.log(`📊 Database: ${conn.connection.name}`);
    
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

module.exports = connectDB;