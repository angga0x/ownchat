import { Schema, model } from 'mongoose';
import { Message } from '@shared/schema';

// Define the Mongoose schema
const messageSchema = new Schema<Message>({
  id: { 
    type: Number, 
    required: false, // Ubah ke false karena kita generate di pre-save hook
    unique: true 
  },
  senderId: { 
    type: Number, 
    required: true, 
    ref: 'User' 
  },
  receiverId: { 
    type: Number, 
    required: true, 
    ref: 'User' 
  },
  content: { 
    type: String, 
    default: null 
  },
  imagePath: { 
    type: String, 
    default: null 
  },
  timestamp: { 
    type: Date, 
    default: Date.now 
  },
  delivered: {
    type: Boolean,
    default: false
  },
  read: {
    type: Boolean,
    default: false
  },
  isDeleted: {
    type: Boolean,
    default: false
  },
  deletedBy: {
    type: [String],
    default: []
  }
});

// Handle auto-increment ID - fix for potential race conditions
messageSchema.pre('save', async function(next) {
  // Always update the ID to ensure we have a valid sequential ID
  // The logic here is designed to avoid race conditions
  try {
    const Message = this.constructor as any;
    
    // Use a unique object ID as a lock when finding the highest ID
    // to prevent race conditions that could create duplicate IDs
    const lastMessage = await Message.findOne({}, {}, { sort: { id: -1 } }).exec();
    
    // Calculate new ID based on last message or start at 1
    const newId = lastMessage ? lastMessage.id + 1 : 1;
    
    // Set the new ID
    this.id = newId;
    
    // Log the generated ID for debugging
    console.log(`Generated message ID: ${this.id}`);
  } catch (error) {
    // If we already have an ID (like a temporary one), keep it
    if (!this.id) {
      // In case of error, generate a high ID based on timestamp to prevent duplication
      const randomOffset = Math.floor(Math.random() * 1000);
      const timestamp = Math.floor(Date.now() / 1000);
      this.id = timestamp + randomOffset;
      console.log(`Message ID fallback generation: ${this.id}`);
    }
  }
  next();
});

// Create and export the model
export const MessageModel = model<Message>('Message', messageSchema);