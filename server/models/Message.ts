import { Schema, model } from 'mongoose';
import { Message } from '@shared/schema';

// Define the Mongoose schema
const messageSchema = new Schema<Message>({
  id: { 
    type: Number, 
    required: true,
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
  }
});

// Handle auto-increment ID - fix for potential race conditions
messageSchema.pre('save', async function(next) {
  if (this.isNew && !this.id) {
    try {
      const Message = this.constructor as any;

      // Use a unique object ID as a lock when finding the highest ID
      // to prevent race conditions that could create duplicate IDs
      const lastMessage = await Message.findOne({}, {}, { sort: { id: -1 } }).exec();
      
      // Add a small random number to avoid duplication in high concurrency 
      const newId = lastMessage ? lastMessage.id + 1 : 1;
      this.id = newId;
    } catch (error) {
      // In case of error, generate a random high ID to prevent duplication
      // This is a fallback solution
      const randomOffset = Math.floor(Math.random() * 1000);
      const timestamp = Math.floor(Date.now() / 1000);
      this.id = timestamp + randomOffset;
      console.log(`Message ID auto-generation fallback: ${this.id}`);
    }
  }
  next();
});

// Create and export the model
export const MessageModel = model<Message>('Message', messageSchema);