import express, { Express, Response, Request, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import { Server as SocketIOServer } from "socket.io";
import { insertMessageSchema } from "@shared/schema";
import multer from "multer";
import path from "path";
import fs from "fs";
import { verifySocketToken } from "./auth";

// Set up file storage for multer
const storage_config = multer.diskStorage({
  destination: (_req: Express.Request, _file: Express.Multer.File, cb: (error: Error | null, destination: string) => void) => {
    const uploadDir = path.join(process.cwd(), 'server', 'uploads');
    // Ensure uploads directory exists
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (_req: Express.Request, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  }
});

const upload = multer({ 
  storage: storage_config,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (_req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    const allowedTypes = /jpeg|jpg|png|gif/;
    const mimetype = allowedTypes.test(file.mimetype);
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error("Only image files (jpeg, jpg, png, gif) are allowed"));
  }
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup auth routes
  const { authenticateJWT } = setupAuth(app);
  
  // Create HTTP server
  const httpServer = createServer(app);
  
  // Create Socket.IO server
  const io = new SocketIOServer(httpServer, {
    transports: ['websocket'], // Force WebSocket only, no polling
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });
  
  // Socket connection user mapping
  const userSockets = new Map<number, string>(); // userId -> socketId
  
  // Join user to a room based on their ID
  function joinUserRoom(socket: any, userId: number) {
    socket.join(`user_${userId}`);
  }
  
  // Socket.IO connection handler
  io.on("connection", (socket) => {
    console.log(`New socket connection: ${socket.id}`);
    let userId: number | undefined;
    
    // Handle authentication
    socket.on("auth", async (data) => {
      try {
        const user = verifySocketToken(data.token);
        if (!user) {
          socket.emit("error", { message: "Invalid authentication" });
          socket.disconnect();
          return;
        }
        
        userId = user.id;
        userSockets.set(userId, socket.id);
        
        // Join user room for direct messaging
        joinUserRoom(socket, userId);
        
        // Set user online
        await storage.setUserOnlineStatus(userId, true);
        
        // Broadcast user online status to all connected clients
        io.emit("user_status", { userId, online: true });
        
        // Send confirmation
        socket.emit("auth_success", { userId });
        
        console.log(`User ${userId} (${user.username}) authenticated`);
      } catch (error) {
        console.error("Socket authentication error:", error);
        socket.emit("error", { message: "Authentication error" });
      }
    });
    
    // Handle private messages
    socket.on("private_message", async (data) => {
      try {
        // Ensure user is authenticated
        if (!userId) {
          socket.emit("error", { message: "Not authenticated" });
          return;
        }
        
        const { receiverId, content } = data;
        
        // Store message in database
        const newMessage = await storage.createMessage({
          senderId: userId,
          receiverId,
          content,
          imagePath: null,
          timestamp: new Date()
        });
        
        // Get sender data for response
        const sender = await storage.getUser(userId);
        
        if (!sender) {
          socket.emit("error", { message: "Sender not found" });
          return;
        }
        
        // Prepare message response
        const messageResponse = {
          id: newMessage.id,
          senderId: newMessage.senderId,
          senderUsername: sender.username,
          receiverId: newMessage.receiverId,
          content: newMessage.content,
          imagePath: newMessage.imagePath,
          timestamp: newMessage.timestamp,
          isCurrentUser: false
        };
        
        // Send to recipient if online
        const recipientSocketId = userSockets.get(receiverId);
        if (recipientSocketId) {
          const recipientSocket = io.sockets.sockets.get(recipientSocketId);
          if (recipientSocket) {
            recipientSocket.emit("private_message", {
              ...messageResponse,
              isCurrentUser: false
            });
          }
        }
        
        // Send confirmation back to sender
        socket.emit("message_sent", {
          ...messageResponse,
          isCurrentUser: true
        });
        
      } catch (error) {
        console.error("Private message error:", error);
        socket.emit("error", { message: "Error sending message" });
      }
    });
    
    // Handle image messages
    socket.on("image_message", async (data) => {
      try {
        // Ensure user is authenticated
        if (!userId) {
          socket.emit("error", { message: "Not authenticated" });
          return;
        }
        
        const { receiverId, imagePath } = data;
        
        // Store message in database
        const newMessage = await storage.createMessage({
          senderId: userId,
          receiverId,
          content: null,
          imagePath,
          timestamp: new Date()
        });
        
        // Get sender data for response
        const sender = await storage.getUser(userId);
        
        if (!sender) {
          socket.emit("error", { message: "Sender not found" });
          return;
        }
        
        // Prepare message response
        const messageResponse = {
          id: newMessage.id,
          senderId: newMessage.senderId,
          senderUsername: sender.username,
          receiverId: newMessage.receiverId,
          content: newMessage.content,
          imagePath: newMessage.imagePath,
          timestamp: newMessage.timestamp,
          isCurrentUser: false
        };
        
        // Send to recipient if online
        const recipientSocketId = userSockets.get(receiverId);
        if (recipientSocketId) {
          const recipientSocket = io.sockets.sockets.get(recipientSocketId);
          if (recipientSocket) {
            recipientSocket.emit("image_message", {
              ...messageResponse,
              isCurrentUser: false
            });
          }
        }
        
        // Send confirmation back to sender
        socket.emit("message_sent", {
          ...messageResponse,
          isCurrentUser: true
        });
        
      } catch (error) {
        console.error("Image message error:", error);
        socket.emit("error", { message: "Error sending image message" });
      }
    });
    
    // Handle marking messages as delivered
    socket.on("mark_delivered", async () => {
      try {
        if (!userId) {
          socket.emit("error", { message: "Not authenticated" });
          return;
        }
        
        // Mark all undelivered messages to this user as delivered
        const count = await storage.markMessagesAsDelivered(userId);
        
        if (count > 0) {
          console.log(`Marked ${count} messages as delivered for user ${userId}`);
          
          // Get undelivered messages to know which senders to notify
          const undeliveredMessages = await storage.getUndeliveredMessages(userId);
          
          // Group by sender and notify each sender their messages were delivered
          const senderIdsSet = new Set(undeliveredMessages.map(msg => msg.senderId));
          const senderIds = Array.from(senderIdsSet);
          
          for (const senderId of senderIds) {
            const senderSocketId = userSockets.get(senderId);
            if (senderSocketId) {
              const senderSocket = io.sockets.sockets.get(senderSocketId);
              if (senderSocket) {
                // Find messages from this sender
                const messages = undeliveredMessages.filter(msg => msg.senderId === senderId);
                
                // Notify for each message
                for (const message of messages) {
                  senderSocket.emit("message_delivered", { 
                    messageId: message.id,
                    receiverId: userId
                  });
                }
              }
            }
          }
        }
      } catch (error) {
        console.error("Mark delivered error:", error);
      }
    });
    
    // Handle typing indicator
    socket.on("typing", async (data) => {
      try {
        if (!userId) {
          socket.emit("error", { message: "Not authenticated" });
          return;
        }
        
        const { receiverId } = data;
        
        // Get receiver's socket
        const receiverSocketId = userSockets.get(receiverId);
        if (receiverSocketId) {
          const receiverSocket = io.sockets.sockets.get(receiverSocketId);
          if (receiverSocket) {
            // Notify the receiver that the user is typing
            receiverSocket.emit("user_typing", { 
              userId,
              senderUsername: socket.data.username 
            });
          }
        }
      } catch (error) {
        console.error("Typing indicator error:", error);
      }
    });
    
    // Handle marking messages as read
    socket.on("mark_read", async (data) => {
      try {
        if (!userId) {
          socket.emit("error", { message: "Not authenticated" });
          return;
        }
        
        const { senderId } = data;
        
        // Mark messages from the specified sender as read
        const count = await storage.markMessagesAsRead(senderId, userId);
        
        if (count > 0) {
          console.log(`Marked ${count} messages from ${senderId} as read for user ${userId}`);
          
          // Notify the sender their messages were read
          const senderSocketId = userSockets.get(senderId);
          if (senderSocketId) {
            const senderSocket = io.sockets.sockets.get(senderSocketId);
            if (senderSocket) {
              // Get all messages that were marked as read
              const messages = await storage.getMessages(senderId, userId);
              const readMessages = messages.filter(msg => 
                msg.senderId === senderId && 
                msg.receiverId === userId && 
                msg.read
              );
              
              // Notify for each message
              for (const message of readMessages) {
                senderSocket.emit("message_read", { 
                  messageId: message.id,
                  receiverId: userId
                });
              }
            }
          }
        }
      } catch (error) {
        console.error("Mark read error:", error);
      }
    });
    
    // Handle individual message delivered notification
    socket.on("message_delivered", async (data) => {
      try {
        if (!userId) {
          socket.emit("error", { message: "Not authenticated" });
          return;
        }
        
        const { messageId, senderId } = data;
        
        // Find the sender socket
        const senderSocketId = userSockets.get(senderId);
        if (senderSocketId) {
          const senderSocket = io.sockets.sockets.get(senderSocketId);
          if (senderSocket) {
            // Notify sender that message was delivered
            senderSocket.emit("message_delivered", { 
              messageId,
              receiverId: userId
            });
          }
        }
      } catch (error) {
        console.error("Message delivered notification error:", error);
      }
    });
    
    // Handle disconnection
    socket.on("disconnect", async () => {
      if (userId) {
        console.log(`User ${userId} disconnected`);
        
        // Set user offline
        await storage.setUserOnlineStatus(userId, false);
        
        // Broadcast user offline status
        io.emit("user_status", { userId, online: false });
        
        // Remove from socket map
        userSockets.delete(userId);
      }
    });
  });
  
  // API routes
  
  // Get chat messages between users
  app.get("/api/messages/:receiverId", authenticateJWT, async (req: any, res) => {
    try {
      const senderId = req.user.id;
      const receiverId = parseInt(req.params.receiverId);
      
      if (isNaN(receiverId)) {
        return res.status(400).json({ message: "Invalid receiver ID" });
      }
      
      const messages = await storage.getMessages(senderId, receiverId);
      
      // Add username information to messages
      const messagesWithUsernames = await Promise.all(
        messages.map(async (msg) => {
          const sender = await storage.getUser(msg.senderId);
          return {
            ...msg,
            senderUsername: sender?.username || "Unknown",
            isCurrentUser: msg.senderId === senderId
          };
        })
      );
      
      res.json(messagesWithUsernames);
    } catch (error) {
      console.error("Get messages error:", error);
      res.status(500).json({ message: "Server error fetching messages" });
    }
  });
  
  // Upload image
  app.post("/api/upload", [authenticateJWT, upload.single("image")], async (req: any, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No image file provided" });
      }
      
      // The file path that can be used to retrieve the image
      const filePath = `/api/uploads/${path.basename(req.file.path)}`;
      
      res.json({ imagePath: filePath });
    } catch (error) {
      console.error("Image upload error:", error);
      res.status(500).json({ message: "Server error uploading image" });
    }
  });
  
  // Send image message
  app.post("/api/messages/image", authenticateJWT, async (req: any, res: Response) => {
    try {
      const { receiverId, imagePath } = req.body;
      
      if (!receiverId || !imagePath) {
        return res.status(400).json({ message: "Receiver ID and image path are required" });
      }
      
      // Create new message with image
      const newMessage = await storage.createMessage({
        senderId: req.user.id,
        receiverId,
        content: null,
        imagePath,
        timestamp: new Date()
      });
      
      // Get sender data
      const sender = await storage.getUser(req.user.id);
      
      // Prepare message response
      const messageResponse = {
        id: newMessage.id,
        senderId: newMessage.senderId,
        senderUsername: sender?.username || "Unknown",
        receiverId: newMessage.receiverId,
        content: newMessage.content,
        imagePath: newMessage.imagePath,
        timestamp: newMessage.timestamp,
        isCurrentUser: false
      };
      
      // Send to recipient if online
      const recipientSocketId = userSockets.get(parseInt(receiverId));
      if (recipientSocketId) {
        const recipientSocket = io.sockets.sockets.get(recipientSocketId);
        if (recipientSocket) {
          recipientSocket.emit("image_message", messageResponse);
        }
      }
      
      // Add isCurrentUser flag for the sender's response
      res.json({
        ...messageResponse,
        isCurrentUser: true
      });
    } catch (error) {
      console.error("Send image message error:", error);
      res.status(500).json({ message: "Server error sending image message" });
    }
  });
  
  // Message management endpoints
  
  // Delete message for me
  app.delete("/api/messages/:messageId/for-me", authenticateJWT, async (req: any, res: Response) => {
    try {
      const messageId = parseInt(req.params.messageId);
      const userId = req.user.id.toString();
      
      const message = await storage.deleteMessageForMe(messageId, userId);
      
      // Notify other user that message has been deleted for this user
      io.to(`user_${req.user.id}`).emit('message_deleted_for_me', { 
        messageId, 
        userId 
      });
      
      res.status(200).json(message);
    } catch (error) {
      console.error(`Error deleting message for user: ${error}`);
      res.status(500).json({ message: "Failed to delete message" });
    }
  });
  
  // Delete message for all
  app.delete("/api/messages/:messageId/for-all", authenticateJWT, async (req: any, res: Response) => {
    try {
      const messageId = parseInt(req.params.messageId);
      
      // Get message first to check if user is the sender
      const getMessage = await storage.getMessages(req.user.id, 0);
      const message = getMessage.find(m => m.id === messageId);
      
      if (!message) {
        return res.status(404).json({ message: "Message not found" });
      }
      
      // Only message sender can delete for all
      if (message.senderId !== req.user.id) {
        return res.status(403).json({ message: "You can only delete your own messages for all users" });
      }
      
      const updatedMessage = await storage.deleteMessageForAll(messageId);
      
      // Notify all relevant users that message has been deleted
      if (message.senderId && message.receiverId) {
        const senderSocketId = userSockets.get(message.senderId);
        const receiverSocketId = userSockets.get(message.receiverId);
        
        if (senderSocketId) {
          const senderSocket = io.sockets.sockets.get(senderSocketId);
          if (senderSocket) {
            senderSocket.emit('message_deleted_for_all', { messageId });
          }
        }
        
        if (receiverSocketId) {
          const receiverSocket = io.sockets.sockets.get(receiverSocketId);
          if (receiverSocket) {
            receiverSocket.emit('message_deleted_for_all', { messageId });
          }
        }
      }
      
      res.status(200).json(updatedMessage);
    } catch (error) {
      console.error(`Error deleting message for all: ${error}`);
      res.status(500).json({ message: "Failed to delete message for all" });
    }
  });
  
  // Chat management endpoints
  
  // Pin chat
  app.post("/api/chats/:partnerId/pin", authenticateJWT, async (req: any, res: Response) => {
    try {
      const partnerId = parseInt(req.params.partnerId);
      const userId = req.user.id;
      
      const user = await storage.pinChat(userId, partnerId);
      
      res.status(200).json({ pinnedChats: user.pinnedChats });
    } catch (error) {
      console.error(`Error pinning chat: ${error}`);
      res.status(500).json({ message: "Failed to pin chat" });
    }
  });
  
  // Unpin chat
  app.post("/api/chats/:partnerId/unpin", authenticateJWT, async (req: any, res: Response) => {
    try {
      const partnerId = parseInt(req.params.partnerId);
      const userId = req.user.id;
      
      const user = await storage.unpinChat(userId, partnerId);
      
      res.status(200).json({ pinnedChats: user.pinnedChats });
    } catch (error) {
      console.error(`Error unpinning chat: ${error}`);
      res.status(500).json({ message: "Failed to unpin chat" });
    }
  });
  
  // Archive chat
  app.post("/api/chats/:partnerId/archive", authenticateJWT, async (req: any, res: Response) => {
    try {
      const partnerId = parseInt(req.params.partnerId);
      const userId = req.user.id;
      
      const user = await storage.archiveChat(userId, partnerId);
      
      res.status(200).json({ archivedChats: user.archivedChats });
    } catch (error) {
      console.error(`Error archiving chat: ${error}`);
      res.status(500).json({ message: "Failed to archive chat" });
    }
  });
  
  // Unarchive chat
  app.post("/api/chats/:partnerId/unarchive", authenticateJWT, async (req: any, res: Response) => {
    try {
      const partnerId = parseInt(req.params.partnerId);
      const userId = req.user.id;
      
      const user = await storage.unarchiveChat(userId, partnerId);
      
      res.status(200).json({ archivedChats: user.archivedChats });
    } catch (error) {
      console.error(`Error unarchiving chat: ${error}`);
      res.status(500).json({ message: "Failed to unarchive chat" });
    }
  });
  
  // Serve uploaded images
  app.get("/api/uploads/:filename", (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join(process.cwd(), 'server', 'uploads', filename);
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: "Image not found" });
    }
    
    res.sendFile(filePath);
  });

  return httpServer;
}
