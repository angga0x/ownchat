import { Schema, model } from 'mongoose';
import { User } from '@shared/schema';

// Define the Mongoose schema
const userSchema = new Schema<User>({
  id: { 
    type: Number, 
    required: true,
    unique: true 
  },
  username: { 
    type: String, 
    required: true, 
    unique: true 
  },
  password: { 
    type: String, 
    required: true 
  },
  online: { 
    type: Boolean, 
    default: false 
  }
}, { 
  timestamps: true 
});

// Handle auto-increment ID
userSchema.pre('save', async function(next) {
  if (this.isNew && !this.id) {
    const User = this.constructor as any;
    const lastUser = await User.findOne().sort({ id: -1 });
    this.id = lastUser ? lastUser.id + 1 : 1;
  }
  next();
});

// Create and export the model
export const UserModel = model<User>('User', userSchema);