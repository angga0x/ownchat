import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User as SelectUser } from "@shared/schema";
import jwt from "jsonwebtoken";

declare global {
  namespace Express {
    interface User extends SelectUser {}
  }
}

const scryptAsync = promisify(scrypt);
const JWT_SECRET = process.env.JWT_SECRET || "telechat_jwt_secret";

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

export function setupAuth(app: Express) {
  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET || "telechat_session_secret",
    resave: false,
    saveUninitialized: false,
    store: storage.sessionStore,
    cookie: { 
      secure: process.env.NODE_ENV === "production",
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());

  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        const user = await storage.getUserByUsername(username);
        if (!user || !(await comparePasswords(password, user.password))) {
          return done(null, false);
        } else {
          return done(null, user);
        }
      } catch (err) {
        return done(err);
      }
    }),
  );

  app.post("/api/register", async (req, res) => {
    try {
      const { username, password } = req.body;
      
      // Validate input
      if (!username || !password) {
        return res.status(400).json({ message: "Username and PIN are required" });
      }
      
      // Check if username exists
      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        return res.status(400).json({ message: "Username already exists" });
      }
      
      // Hash the password (PIN)
      const hashedPassword = await hashPassword(password);
      
      // Create new user
      const user = await storage.createUser({
        username,
        password: hashedPassword,
      });
      
      // Generate JWT token
      const token = jwt.sign(
        { id: user.id, username: user.username },
        JWT_SECRET,
        { expiresIn: "7d" }
      );
      
      // Return user data (excluding password) and token
      res.status(201).json({
        user: { id: user.id, username: user.username, online: user.online },
        token,
      });
    } catch (error) {
      console.error("Registration error:", error);
      res.status(500).json({ message: "Server error during registration" });
    }
  });

  app.post("/api/login", (req, res, next) => {
    passport.authenticate("local", { session: false }, async (err: Error | null, user: SelectUser | false) => {
      if (err) return next(err);
      if (!user) {
        return res.status(401).json({ message: "Invalid username or PIN" });
      }
      
      try {
        // Set user as online
        await storage.setUserOnlineStatus(user.id, true);
        
        // Generate JWT
        const token = jwt.sign(
          { id: user.id, username: user.username },
          JWT_SECRET,
          { expiresIn: "7d" }
        );
        
        // Return user data and token
        res.json({
          user: { id: user.id, username: user.username, online: user.online },
          token,
        });
      } catch (error) {
        console.error("Login error:", error);
        res.status(500).json({ message: "Server error during login" });
      }
    })(req, res, next);
  });

  app.post("/api/logout", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return res.status(401).json({ message: "No token provided" });
      }
      
      const token = authHeader.split(" ")[1];
      const decoded = jwt.verify(token, JWT_SECRET) as { id: number };
      
      // Set user as offline
      await storage.setUserOnlineStatus(decoded.id, false);
      
      res.status(200).json({ message: "Successfully logged out" });
    } catch (error) {
      console.error("Logout error:", error);
      res.status(500).json({ message: "Server error during logout" });
    }
  });

  // Middleware to authenticate JWT tokens
  const authenticateJWT = (req: any, res: any, next: any) => {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return res.status(401).json({ message: "No token provided" });
    }
    
    const token = authHeader.split(" ")[1];
    
    jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
      if (err) {
        return res.status(403).json({ message: "Invalid or expired token" });
      }
      
      req.user = user;
      next();
    });
  };
  
  // API to get current user
  app.get("/api/user", authenticateJWT, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      res.json({ id: user.id, username: user.username, online: user.online });
    } catch (error) {
      console.error("Get user error:", error);
      res.status(500).json({ message: "Server error fetching user data" });
    }
  });
  
  // API to get all users
  app.get("/api/users", authenticateJWT, async (_req, res) => {
    try {
      const allUsers = await storage.getAllUsers();
      // Filter out sensitive information
      const safeUsers = allUsers.map(user => ({
        id: user.id,
        username: user.username,
        online: user.online
      }));
      
      res.json(safeUsers);
    } catch (error) {
      console.error("Get users error:", error);
      res.status(500).json({ message: "Server error fetching users" });
    }
  });
  
  return { authenticateJWT };
}

// Utility to verify JWT token for Socket.IO
export function verifySocketToken(token: string): { id: number, username: string } | null {
  try {
    return jwt.verify(token, JWT_SECRET) as { id: number, username: string };
  } catch (error) {
    console.error("Invalid socket token:", error);
    return null;
  }
}
