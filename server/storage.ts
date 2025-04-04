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
  
  // Chat management methods
  pinChat(userId: number, chatPartnerId: number): Promise<User>;
  unpinChat(userId: number, chatPartnerId: number): Promise<User>;
  archiveChat(userId: number, chatPartnerId: number): Promise<User>;
  unarchiveChat(userId: number, chatPartnerId: number): Promise<User>;
  
  // Message methods
  getMessages(senderId: number, receiverId: number): Promise<Message[]>;
  createMessage(message: InsertMessage): Promise<Message>;
  markMessagesAsDelivered(receiverId: number): Promise<number>;
  markMessagesAsRead(senderId: number, receiverId: number): Promise<number>;
  getUndeliveredMessages(receiverId: number): Promise<Message[]>;
  deleteMessageForMe(messageId: number, userId: string): Promise<Message>;
  deleteMessageForAll(messageId: number): Promise<Message>;
  
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
  
  // Chat management methods
  async pinChat(userId: number, chatPartnerId: number): Promise<User> {
    try {
      const user = await UserModel.findOne({ id: userId });
      if (!user) throw new Error('User not found');
      
      // Initialize pinnedChats if null
      if (!user.pinnedChats) {
        user.pinnedChats = [];
      }
      
      // Add to pinned chats if not already there
      if (!user.pinnedChats.includes(chatPartnerId)) {
        user.pinnedChats.push(chatPartnerId);
        await user.save();
      }
      
      return user.toObject();
    } catch (error) {
      log(`Error pinning chat: ${error}`, 'mongodb');
      throw error;
    }
  }
  
  async unpinChat(userId: number, chatPartnerId: number): Promise<User> {
    try {
      const user = await UserModel.findOne({ id: userId });
      if (!user) throw new Error('User not found');
      
      // Initialize pinnedChats if null
      if (!user.pinnedChats) {
        user.pinnedChats = [];
        return user.toObject();
      }
      
      // Remove from pinned chats
      user.pinnedChats = user.pinnedChats.filter(id => id !== chatPartnerId);
      await user.save();
      
      return user.toObject();
    } catch (error) {
      log(`Error unpinning chat: ${error}`, 'mongodb');
      throw error;
    }
  }
  
  async archiveChat(userId: number, chatPartnerId: number): Promise<User> {
    try {
      const user = await UserModel.findOne({ id: userId });
      if (!user) throw new Error('User not found');
      
      // Initialize archivedChats if null
      if (!user.archivedChats) {
        user.archivedChats = [];
      }
      
      // Add to archived chats if not already there
      if (!user.archivedChats.includes(chatPartnerId)) {
        user.archivedChats.push(chatPartnerId);
        await user.save();
      }
      
      return user.toObject();
    } catch (error) {
      log(`Error archiving chat: ${error}`, 'mongodb');
      throw error;
    }
  }
  
  async unarchiveChat(userId: number, chatPartnerId: number): Promise<User> {
    try {
      const user = await UserModel.findOne({ id: userId });
      if (!user) throw new Error('User not found');
      
      // Initialize archivedChats if null
      if (!user.archivedChats) {
        user.archivedChats = [];
        return user.toObject();
      }
      
      // Remove from archived chats
      user.archivedChats = user.archivedChats.filter(id => id !== chatPartnerId);
      await user.save();
      
      return user.toObject();
    } catch (error) {
      log(`Error unarchiving chat: ${error}`, 'mongodb');
      throw error;
    }
  }
  
  async deleteMessageForMe(messageId: number, userId: string): Promise<Message> {
    try {
      const message = await MessageModel.findOne({ id: messageId });
      if (!message) throw new Error('Message not found');
      
      // Initialize deletedBy if null
      if (!message.deletedBy) {
        message.deletedBy = [];
      }
      
      // Add userId to deletedBy array if not already there
      if (!message.deletedBy.includes(userId)) {
        message.deletedBy.push(userId);
        await message.save();
      }
      
      return message.toObject();
    } catch (error) {
      log(`Error deleting message for user: ${error}`, 'mongodb');
      throw error;
    }
  }
  
  async deleteMessageForAll(messageId: number): Promise<Message> {
    try {
      const message = await MessageModel.findOne({ id: messageId });
      if (!message) throw new Error('Message not found');
      
      message.isDeleted = true;
      
      // Initialize deletedBy if null
      if (!message.deletedBy) {
        message.deletedBy = [];
      }
      
      await message.save();
      
      return message.toObject();
    } catch (error) {
      log(`Error deleting message for all: ${error}`, 'mongodb');
      throw error;
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
      // Don't generate ID explicitly - let the pre-save hook handle it
      // to prevent race conditions that create duplicate IDs
      const newMessage = new MessageModel({
        ...insertMessage,
        timestamp: insertMessage.timestamp || new Date(),
        delivered: false,
        read: false,
        // Add a temporary ID to make the validator happy
        // This will be overwritten by the pre-save hook
        id: Date.now()
      });
      
      await newMessage.save();
      return newMessage.toObject();
    } catch (error) {
      log(`Error creating message: ${error}`, 'mongodb');
      throw error;
    }
  }
  
  async markMessagesAsDelivered(receiverId: number): Promise<number> {
    try {
      const result = await MessageModel.updateMany(
        { 
          receiverId, 
          delivered: false 
        },
        { 
          delivered: true 
        }
      );
      
      return result.modifiedCount;
    } catch (error) {
      log(`Error marking messages as delivered: ${error}`, 'mongodb');
      return 0;
    }
  }
  
  async markMessagesAsRead(senderId: number, receiverId: number): Promise<number> {
    try {
      const result = await MessageModel.updateMany(
        { 
          senderId, 
          receiverId, 
          read: false 
        },
        { 
          read: true 
        }
      );
      
      return result.modifiedCount;
    } catch (error) {
      log(`Error marking messages as read: ${error}`, 'mongodb');
      return 0;
    }
  }
  
  async getUndeliveredMessages(receiverId: number): Promise<Message[]> {
    try {
      const messages = await MessageModel.find({
        receiverId,
        delivered: false
      }).sort({ timestamp: 1 });
      
      return messages.map(msg => msg.toObject());
    } catch (error) {
      log(`Error fetching undelivered messages: ${error}`, 'mongodb');
      return [];
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
  
  // Chat management methods
  async pinChat(userId: number, chatPartnerId: number): Promise<User> {
    const user = await this.getUser(userId);
    if (!user) throw new Error('User not found');
    
    if (!user.pinnedChats) {
      user.pinnedChats = [];
    }
    
    if (!user.pinnedChats.includes(chatPartnerId)) {
      user.pinnedChats.push(chatPartnerId);
    }
    
    this.users.set(userId, user);
    return user;
  }
  
  async unpinChat(userId: number, chatPartnerId: number): Promise<User> {
    const user = await this.getUser(userId);
    if (!user) throw new Error('User not found');
    
    if (!user.pinnedChats) {
      user.pinnedChats = [];
      this.users.set(userId, user);
      return user;
    }
    
    user.pinnedChats = user.pinnedChats.filter(id => id !== chatPartnerId);
    this.users.set(userId, user);
    return user;
  }
  
  async archiveChat(userId: number, chatPartnerId: number): Promise<User> {
    const user = await this.getUser(userId);
    if (!user) throw new Error('User not found');
    
    if (!user.archivedChats) {
      user.archivedChats = [];
    }
    
    if (!user.archivedChats.includes(chatPartnerId)) {
      user.archivedChats.push(chatPartnerId);
    }
    
    this.users.set(userId, user);
    return user;
  }
  
  async unarchiveChat(userId: number, chatPartnerId: number): Promise<User> {
    const user = await this.getUser(userId);
    if (!user) throw new Error('User not found');
    
    if (!user.archivedChats) {
      user.archivedChats = [];
      this.users.set(userId, user);
      return user;
    }
    
    user.archivedChats = user.archivedChats.filter(id => id !== chatPartnerId);
    this.users.set(userId, user);
    return user;
  }
  
  async deleteMessageForMe(messageId: number, userId: string): Promise<Message> {
    const message = this.messages.get(messageId);
    if (!message) throw new Error('Message not found');
    
    if (!message.deletedBy) {
      message.deletedBy = [];
    }
    
    if (!message.deletedBy.includes(userId)) {
      message.deletedBy.push(userId);
    }
    
    this.messages.set(messageId, message);
    return message;
  }
  
  async deleteMessageForAll(messageId: number): Promise<Message> {
    const message = this.messages.get(messageId);
    if (!message) throw new Error('Message not found');
    
    message.isDeleted = true;
    
    if (!message.deletedBy) {
      message.deletedBy = [];
    }
    
    this.messages.set(messageId, message);
    return message;
  }

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
    const user: User = { 
      ...insertUser, 
      id, 
      online: false,
      pinnedChats: [],
      archivedChats: []
    };
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
      timestamp: insertMessage.timestamp || new Date(),
      delivered: false,
      read: false,
      isDeleted: false,
      deletedBy: []
    };
    this.messages.set(id, message);
    return message;
  }
  
  async markMessagesAsDelivered(receiverId: number): Promise<number> {
    let count = 0;
    const messages = Array.from(this.messages.values());
    
    for (const message of messages) {
      if (message.receiverId === receiverId && !message.delivered) {
        message.delivered = true;
        this.messages.set(message.id, message);
        count++;
      }
    }
    return count;
  }
  
  async markMessagesAsRead(senderId: number, receiverId: number): Promise<number> {
    let count = 0;
    const messages = Array.from(this.messages.values());
    
    for (const message of messages) {
      if (message.senderId === senderId && message.receiverId === receiverId && !message.read) {
        message.read = true;
        this.messages.set(message.id, message);
        count++;
      }
    }
    return count;
  }
  
  async getUndeliveredMessages(receiverId: number): Promise<Message[]> {
    return Array.from(this.messages.values())
      .filter(msg => msg.receiverId === receiverId && !msg.delivered)
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }
}

// Import MongoDB status to determine which storage to use
import { isMongoFailed } from './db-status';

// Export storage instance (MongoDB if connected, or MemStorage as fallback)
export const storage = isMongoFailed() ? new MemStorage() : new MongoStorage();
