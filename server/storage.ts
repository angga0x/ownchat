import { users, type User, type InsertUser, type Message, messages, type InsertMessage } from "@shared/schema";
import session from "express-session";
import createMemoryStore from "memorystore";
import fs from "fs";
import path from "path";
import { UserModel, MessageModel } from "./models";
import { log } from "./vite";

const MemoryStore = createMemoryStore(session);

// Storage interface for the application
export interface IStorage {
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getAllUsers(): Promise<User[]>;
  setUserOnlineStatus(id: number, status: boolean): Promise<void>;
  
  // Message methods
  getMessages(senderId: number, receiverId: number): Promise<Message[]>;
  createMessage(message: InsertMessage): Promise<Message>;
  
  // Session store
  sessionStore: any; // Using any type to avoid session.SessionStore issue
}

// MongoDB implementation
export class MongoStorage implements IStorage {
  sessionStore: any; // Using any type to avoid session.SessionStore issue
  
  constructor() {
    // Initialize session store
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000, // 24 hours
    });
    
    // Create uploads directory if it doesn't exist
    const uploadsDir = path.join(process.cwd(), 'server', 'uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
  }
  
  // User methods
  async getUser(id: number): Promise<User | undefined> {
    try {
      const user = await UserModel.findOne({ id });
      return user ? user.toObject() : undefined;
    } catch (error) {
      log(`Error fetching user by ID: ${error}`, 'mongodb');
      return undefined;
    }
  }
  
  async getUserByUsername(username: string): Promise<User | undefined> {
    try {
      const user = await UserModel.findOne({ username });
      return user ? user.toObject() : undefined;
    } catch (error) {
      log(`Error fetching user by username: ${error}`, 'mongodb');
      return undefined;
    }
  }
  
  async createUser(insertUser: InsertUser): Promise<User> {
    try {
      const lastUser = await UserModel.findOne().sort({ id: -1 });
      const newId = lastUser ? lastUser.id + 1 : 1;
      
      const newUser = new UserModel({
        ...insertUser,
        id: newId,
        online: false
      });
      
      await newUser.save();
      return newUser.toObject();
    } catch (error) {
      log(`Error creating user: ${error}`, 'mongodb');
      throw error;
    }
  }
  
  async getAllUsers(): Promise<User[]> {
    try {
      const users = await UserModel.find();
      return users.map(user => user.toObject());
    } catch (error) {
      log(`Error fetching all users: ${error}`, 'mongodb');
      return [];
    }
  }
  
  async setUserOnlineStatus(id: number, status: boolean): Promise<void> {
    try {
      await UserModel.updateOne({ id }, { online: status });
    } catch (error) {
      log(`Error updating user online status: ${error}`, 'mongodb');
      throw error;
    }
  }
  
  // Message methods
  async getMessages(senderId: number, receiverId: number): Promise<Message[]> {
    try {
      // Get messages between these two users (in either direction)
      const messages = await MessageModel.find({
        $or: [
          { senderId, receiverId },
          { senderId: receiverId, receiverId: senderId }
        ]
      }).sort({ timestamp: 1 });
      
      return messages.map(msg => msg.toObject());
    } catch (error) {
      log(`Error fetching messages: ${error}`, 'mongodb');
      return [];
    }
  }
  
  async createMessage(insertMessage: InsertMessage): Promise<Message> {
    try {
      const lastMessage = await MessageModel.findOne().sort({ id: -1 });
      const newId = lastMessage ? lastMessage.id + 1 : 1;
      
      const newMessage = new MessageModel({
        ...insertMessage,
        id: newId,
        timestamp: insertMessage.timestamp || new Date()
      });
      
      await newMessage.save();
      return newMessage.toObject();
    } catch (error) {
      log(`Error creating message: ${error}`, 'mongodb');
      throw error;
    }
  }
}

// In-memory implementation (fallback)
export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private messages: Map<number, Message>;
  sessionStore: any; // Using any type to avoid session.SessionStore issue
  currentUserId: number;
  currentMessageId: number;

  constructor() {
    this.users = new Map();
    this.messages = new Map();
    this.currentUserId = 1;
    this.currentMessageId = 1;
    
    // Initialize session store
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000, // 24 hours
    });
    
    // Create uploads directory if it doesn't exist
    const uploadsDir = path.join(process.cwd(), 'server', 'uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
  }

  // User methods
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentUserId++;
    const user: User = { ...insertUser, id, online: false };
    this.users.set(id, user);
    return user;
  }
  
  async getAllUsers(): Promise<User[]> {
    return Array.from(this.users.values());
  }
  
  async setUserOnlineStatus(id: number, status: boolean): Promise<void> {
    const user = await this.getUser(id);
    if (user) {
      user.online = status;
      this.users.set(id, user);
    }
  }
  
  // Message methods
  async getMessages(senderId: number, receiverId: number): Promise<Message[]> {
    return Array.from(this.messages.values()).filter(msg => 
      (msg.senderId === senderId && msg.receiverId === receiverId) || 
      (msg.senderId === receiverId && msg.receiverId === senderId)
    ).sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }
  
  async createMessage(insertMessage: InsertMessage): Promise<Message> {
    const id = this.currentMessageId++;
    const message: Message = { 
      id,
      senderId: insertMessage.senderId,
      receiverId: insertMessage.receiverId,
      content: insertMessage.content || null,
      imagePath: insertMessage.imagePath || null,
      timestamp: insertMessage.timestamp || new Date() 
    };
    this.messages.set(id, message);
    return message;
  }
}

// Import MongoDB status to determine which storage to use
import { isMongoFailed } from './db-status';

// Export storage instance (MongoDB if connected, or MemStorage as fallback)
export const storage = isMongoFailed() ? new MemStorage() : new MongoStorage();
