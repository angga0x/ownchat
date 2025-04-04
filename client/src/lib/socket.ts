import { queryClient } from "./queryClient";
import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

export function setupSocket(token: string) {
  // Close existing socket if any
  if (socket) {
    socket.disconnect();
  }
  
  // Create new Socket.IO connection - WebSocket only, no polling
  socket = io({
    transports: ['websocket'], // Force WebSocket only mode
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
  });
  
  // Connection events
  socket.on("connect", () => {
    console.log("Socket.IO connection established");
    
    // Authenticate the connection with JWT
    socket?.emit("auth", { token });
  });
  
  // Set up event handlers
  socket.on("auth_success", (data) => {
    console.log("Socket.IO authentication successful", data);
  });
  
  socket.on("private_message", (data) => {
    console.log("Private message received:", data);
    handleIncomingMessage(data);
  });
  
  socket.on("image_message", (data) => {
    console.log("Image message received:", data);
    handleIncomingMessage(data.message);
  });
  
  socket.on("message_sent", (data) => {
    console.log("Message sent confirmation:", data);
    // This will be handled by the sender's UI
  });
  
  socket.on("user_status", (data) => {
    console.log("User status change:", data);
    handleUserStatusChange(data.userId, data.online);
  });
  
  socket.on("error", (data) => {
    console.error("Socket.IO error:", data.message);
  });
  
  socket.on("disconnect", () => {
    console.log("Socket.IO disconnected");
  });
  
  socket.on("reconnect", (attemptNumber) => {
    console.log(`Socket.IO reconnected after ${attemptNumber} attempts`);
    // Reauthenticate after reconnection
    socket?.emit("auth", { token });
  });
  
  socket.on("reconnect_error", (error) => {
    console.error("Socket.IO reconnection error:", error);
  });
  
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export function getSocket() {
  return socket;
}

export function sendMessage(receiverId: number, content: string) {
  if (!socket || !socket.connected) {
    throw new Error("Socket.IO connection not open");
  }
  
  socket.emit("private_message", {
    receiverId,
    content
  });
}

export function sendImageMessage(receiverId: number, imagePath: string) {
  if (!socket || !socket.connected) {
    throw new Error("Socket.IO connection not open");
  }
  
  socket.emit("image_message", {
    receiverId,
    imagePath
  });
}

function handleIncomingMessage(message: any) {
  // When receiving a new message, invalidate the messages query to trigger a refetch
  const queryKey = ["/api/messages", message.senderId];
  
  // Optimistically update cache
  const existingMessages = queryClient.getQueryData<any[]>(queryKey) || [];
  queryClient.setQueryData(queryKey, [...existingMessages, message]);
  
  // Also invalidate to ensure we have the latest data
  queryClient.invalidateQueries({ queryKey });
}

function handleUserStatusChange(userId: number, online: boolean) {
  // When a user status changes, update users list
  const usersKey = ["/api/users"];
  const users = queryClient.getQueryData<any[]>(usersKey);
  
  if (users) {
    // Update the user's online status
    const updatedUsers = users.map(user => 
      user.id === userId ? { ...user, online } : user
    );
    
    queryClient.setQueryData(usersKey, updatedUsers);
  }
}
