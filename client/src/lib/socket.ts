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
    
    // Mark messages as delivered when user comes online
    socket?.emit("mark_delivered");
  });
  
  socket.on("private_message", (data) => {
    console.log("Private message received:", data);
    handleIncomingMessage(data);
    
    // Mark the message as delivered immediately
    socket?.emit("message_delivered", { messageId: data.id, senderId: data.senderId });
  });
  
  socket.on("image_message", (data) => {
    console.log("Image message received:", data);
    handleIncomingMessage(data.message);
    
    // Mark the message as delivered immediately
    socket?.emit("message_delivered", { messageId: data.message.id, senderId: data.message.senderId });
  });
  
  socket.on("message_sent", (data) => {
    console.log("Message sent confirmation:", data);
    // This will be handled by the sender's UI
  });
  
  socket.on("message_delivered", (data) => {
    console.log("Message delivery status updated:", data);
    updateMessageDeliveryStatus(data.messageId, 'delivered');
  });
  
  socket.on("message_read", (data) => {
    console.log("Message read status updated:", data);
    updateMessageDeliveryStatus(data.messageId, 'read');
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

  // Optimistically update the UI immediately with the sent message
  socket.once("message_sent", (message) => {
    // When a message is sent, update the messages query
    const queryKey = ["/api/messages", receiverId];
    
    // Optimistically update cache with the new message
    const existingMessages = queryClient.getQueryData<any[]>(queryKey) || [];
    queryClient.setQueryData(queryKey, [...existingMessages, message]);
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

  // Optimistically update the UI immediately with the sent image message
  socket.once("image_message_sent", (data) => {
    // When a message is sent, update the messages query
    const queryKey = ["/api/messages", receiverId];
    
    // Optimistically update cache with the new message
    const existingMessages = queryClient.getQueryData<any[]>(queryKey) || [];
    queryClient.setQueryData(queryKey, [...existingMessages, data.message]);
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

// Function to update message delivery or read status
function updateMessageDeliveryStatus(messageId: number, status: 'delivered' | 'read') {
  // We need to search through all active conversations for this message
  const allQueryKeys = queryClient.getQueryCache().getAll();
  
  allQueryKeys.forEach(query => {
    const queryKey = query.queryKey;
    if (Array.isArray(queryKey) && queryKey[0] === '/api/messages') {
      const messages = queryClient.getQueryData<any[]>(queryKey);
      
      if (messages) {
        const updatedMessages = messages.map(msg => {
          if (msg.id === messageId) {
            if (status === 'delivered') {
              return { ...msg, delivered: true };
            } else if (status === 'read') {
              return { ...msg, delivered: true, read: true };
            }
          }
          return msg;
        });
        
        queryClient.setQueryData(queryKey, updatedMessages);
      }
    }
  });
}

// Function to mark messages as read when a user views them
export function markMessagesAsRead(senderId: number) {
  if (!socket || !socket.connected) {
    console.warn("Socket.IO connection not open, can't mark messages as read");
    return;
  }
  
  socket.emit("mark_read", { senderId });
}
