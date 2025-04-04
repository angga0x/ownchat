import mongoose from 'mongoose';
import { log } from './vite';
import { setMongoFailed } from './db-status';

// Function to connect to MongoDB
export async function connectToDatabase() {
  try {
    // Get MongoDB URI from environment variables
    const mongoUri = process.env.MONGO_URI;
    
    if (!mongoUri) {
      log('MONGO_URI environment variable not set. Skipping MongoDB connection.', 'mongodb');
      // Mark MongoDB as failed so we use MemStorage instead
      setMongoFailed(true);
      return;
    }
    
    // Check if we already have an active connection
    if (mongoose.connection.readyState === 1) {
      log('MongoDB connection already established', 'mongodb');
      return;
    }
    
    // Set MongoDB connection options
    const mongooseOptions = {
      autoIndex: true,
      serverSelectionTimeoutMS: 5000, // 5 seconds timeout for server selection
      socketTimeoutMS: 45000, // 45 seconds timeout for socket operations
    };
    
    log('Attempting to connect to MongoDB...', 'mongodb');
    await mongoose.connect(mongoUri, mongooseOptions);
    log('MongoDB connection established successfully', 'mongodb');
    
    // Handle connection events
    mongoose.connection.on('error', err => {
      log(`MongoDB connection error: ${err}`, 'mongodb');
    });
    
    mongoose.connection.on('disconnected', () => {
      log('MongoDB disconnected', 'mongodb');
    });
    
    // Handle process termination
    process.on('SIGINT', async () => {
      await mongoose.connection.close();
      log('MongoDB connection closed due to app termination', 'mongodb');
      process.exit(0);
    });
    
  } catch (error) {
    log(`Failed to connect to MongoDB: ${error}`, 'mongodb');
    log('Continuing without MongoDB connection. Using in-memory storage instead.', 'mongodb');
    
    // Mark MongoDB as failed so we use MemStorage instead
    setMongoFailed(true);
  }
}