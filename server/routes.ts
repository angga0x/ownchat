import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import { WebSocketServer, WebSocket } from "ws";
import { insertMessageSchema } from "@shared/schema";
import multer from "multer";
import path from "path";
import fs from "fs";
import { verifySocketToken } from "./auth";

// Set up file storage for multer
const storage_config = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const uploadDir = path.join(process.cwd(), 'server', 'uploads');
    // Ensure uploads directory exists
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  }
});

const upload = multer({ 
  storage: storage_config,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (_req, file, cb) => {
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
  
  // Create WebSocket server
  const wss = new WebSocketServer({ server: httpServer, path: "/ws" });
  
  // Socket connection user mapping
  const userSockets = new Map<number, WebSocket>();
  
  // WebSocket connection handler
  wss.on("connection", (ws, req) => {
    let userId: number | undefined;
    
    ws.on("message", async (message) => {
      try {
        const data = JSON.parse(message.toString());
        
        // Handle authentication
        if (data.type === "auth") {
          const user = verifySocketToken(data.token);
          if (!user) {
            ws.send(JSON.stringify({ type: "error", message: "Invalid authentication" }));
            ws.close();
            return;
          }
          
          userId = user.id;
          userSockets.set(userId, ws);
          
          // Set user online
          await storage.setUserOnlineStatus(userId, true);
          
          // Broadcast user online status to all connected clients
          broadcastUserStatus(userId, true);
          
          // Send confirmation
          ws.send(JSON.stringify({ type: "auth_success", userId }));
          return;
        }
        
        // Ensure user is authenticated for other message types
        if (!userId) {
          ws.send(JSON.stringify({ type: "error", message: "Not authenticated" }));
          return;
        }
        
        // Handle private messages
        if (data.type === "private_message") {
          // Validate message
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
            ws.send(JSON.stringify({ type: "error", message: "Sender not found" }));
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
            timestamp: newMessage.timestamp
          };
          
          // Send to recipient if online
          const recipientSocket = userSockets.get(receiverId);
          if (recipientSocket && recipientSocket.readyState === WebSocket.OPEN) {
            recipientSocket.send(JSON.stringify({
              type: "private_message",
              message: messageResponse
            }));
          }
          
          // Send confirmation back to sender
          ws.send(JSON.stringify({
            type: "message_sent",
            message: messageResponse
          }));
        }
      } catch (error) {
        console.error("WebSocket message error:", error);
        ws.send(JSON.stringify({ type: "error", message: "Invalid message format" }));
      }
    });
    
    // Handle disconnection
    ws.on("close", async () => {
      if (userId) {
        // Set user offline
        await storage.setUserOnlineStatus(userId, false);
        
        // Broadcast user offline status
        broadcastUserStatus(userId, false);
        
        // Remove from socket map
        userSockets.delete(userId);
      }
    });
  });
  
  // Function to broadcast user status changes
  function broadcastUserStatus(userId: number, isOnline: boolean) {
    const statusUpdate = JSON.stringify({
      type: "user_status",
      userId,
      online: isOnline
    });
    
    for (const [_, socket] of userSockets.entries()) {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(statusUpdate);
      }
    }
  }
  
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
  app.post("/api/upload", [authenticateJWT, upload.single("image")], async (req: any, res) => {
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
  app.post("/api/messages/image", authenticateJWT, async (req: any, res) => {
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
        timestamp: newMessage.timestamp
      };
      
      // Send to recipient if online
      const recipientSocket = userSockets.get(parseInt(receiverId));
      if (recipientSocket && recipientSocket.readyState === WebSocket.OPEN) {
        recipientSocket.send(JSON.stringify({
          type: "image_message",
          message: messageResponse
        }));
      }
      
      res.json(messageResponse);
    } catch (error) {
      console.error("Send image message error:", error);
      res.status(500).json({ message: "Server error sending image message" });
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
