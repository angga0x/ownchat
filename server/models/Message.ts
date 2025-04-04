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

// Handle auto-increment ID
messageSchema.pre('save', async function(next) {
  if (this.isNew && !this.id) {
    const Message = this.constructor as any;
    const lastMessage = await Message.findOne().sort({ id: -1 });
    this.id = lastMessage ? lastMessage.id + 1 : 1;
  }
  next();
});

// Create and export the model
export const MessageModel = model<Message>('Message', messageSchema);