import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  online: boolean("online").default(false),
  pinnedChats: integer("pinned_chats").array().default([]),
  archivedChats: integer("archived_chats").array().default([]),
});

export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  senderId: integer("sender_id").notNull(),
  receiverId: integer("receiver_id").notNull(),
  content: text("content"),
  imagePath: text("image_path"),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  delivered: boolean("delivered").default(false),
  read: boolean("read").default(false),
  isDeleted: boolean("is_deleted").default(false),
  deletedBy: text("deleted_by").array().default([]),
});

// User schemas
export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(4, "PIN must be at least 4 digits"),
});

export const registerSchema = loginSchema.extend({
  confirmPassword: z.string(),
}).refine(data => data.password === data.confirmPassword, {
  message: "PINs don't match",
  path: ["confirmPassword"],
});

// Message schema
export const insertMessageSchema = createInsertSchema(messages).omit({
  id: true,
  delivered: true,
  read: true,
});

export const messageWithUser = z.object({
  id: z.number(),
  senderId: z.number(),
  receiverId: z.number(),
  content: z.string().nullable(),
  imagePath: z.string().nullable(),
  timestamp: z.union([z.date(), z.string()]).transform(val => 
    typeof val === 'string' ? new Date(val) : val
  ),
  delivered: z.boolean().default(false),
  read: z.boolean().default(false),
  isDeleted: z.boolean().default(false),
  deletedBy: z.array(z.string()).optional().default([]),
  senderUsername: z.string(),
  isCurrentUser: z.boolean(),
});

// Export types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messages.$inferSelect;
export type MessageWithUser = z.infer<typeof messageWithUser>;
