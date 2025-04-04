import { queryClient } from "./queryClient";
import { io, Socket } from "socket.io-client";
import { addMessageToCache, updateMessageStatusInCache } from "./chatCache";

let socket: Socket | null = null;

// Debounce function to control event frequency
export function debounce<F extends (...args: any[]) => any>(func: F, waitFor: number) {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  
  return (...args: Parameters<F>): void => {
    if (timeout !== null) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(() => func(...args), waitFor);
  };
}

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
  
  socket.on("user_typing", (data) => {
    console.log("User typing:", data);
    updateUserTypingStatus(data.userId, true);
    
    // Automatically reset the typing status after 3 seconds
    // This ensures the indicator disappears if the user stops typing
    setTimeout(() => {
      updateUserTypingStatus(data.userId, false);
    }, 3000);
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

  // Log confirmation when message is sent (for debugging and confirmation)
  socket.once("message_sent", (message) => {
    console.log("Message sent confirmation:", message);
    
    // When a message is sent, update the messages query
    const queryKey = ["/api/messages", receiverId];
    
    // Invalidate the query to force a refetch with the new message
    queryClient.invalidateQueries({ queryKey });
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

  // Log confirmation and invalidate the query to refresh data
  socket.once("image_message_sent", (data) => {
    console.log("Image message sent confirmation:", data.message);
    
    // When a message is sent, update the messages query
    const queryKey = ["/api/messages", receiverId];
    
    // Invalidate the query to force a refetch with the new message
    queryClient.invalidateQueries({ queryKey });
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
  
  // Update the localStorage cache with the new message
  // Cari user ID dari data yang tersimpan
  const userQuery = queryClient.getQueryData<any>(["/api/user"]);
  if (userQuery && userQuery.id) {
    // Tambahkan pesan ke cache lokal
    addMessageToCache(userQuery.id, message.senderId, message);
  }
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
  
  // Update message status in localStorage cache
  updateMessageStatusInCache(messageId, status);
}

// Function to mark messages as read when a user views them
export function markMessagesAsRead(senderId: number) {
  if (!socket || !socket.connected) {
    console.warn("Socket.IO connection not open, can't mark messages as read");
    return;
  }
  
  socket.emit("mark_read", { senderId });
}

// Function to manage typing indicators
let typingTimeouts: Record<number, NodeJS.Timeout> = {};
let typingState: Record<number, boolean> = {};

// Update UI to show typing indicators
function updateUserTypingStatus(userId: number, isTyping: boolean) {
  // Use a query key specific to typing status
  const typingKey = ['typing-status'];
  
  // Get the current typing status map or initialize it
  const currentTypingStatus = queryClient.getQueryData<Record<number, boolean>>(typingKey) || {};
  
  // Update the status only if it changed
  if (currentTypingStatus[userId] !== isTyping) {
    queryClient.setQueryData(typingKey, {
      ...currentTypingStatus,
      [userId]: isTyping
    });
  }
}

// Function to notify when a user starts typing
export function sendTypingStatus(receiverId: number) {
  if (!socket || !socket.connected) {
    return;
  }
  
  // Don't emit event if we already sent one recently for this receiver
  if (typingState[receiverId]) {
    // Refresh the timeout
    clearTimeout(typingTimeouts[receiverId]);
    typingTimeouts[receiverId] = setTimeout(() => {
      typingState[receiverId] = false;
    }, 2000); // Stop typing indicator after 2 seconds of inactivity
    return;
  }
  
  // Otherwise, send the typing indicator and set the state
  socket.emit("typing", { receiverId });
  typingState[receiverId] = true;
  
  // Set timeout to reset the typing state after 2 seconds
  typingTimeouts[receiverId] = setTimeout(() => {
    typingState[receiverId] = false;
  }, 2000);
}

// Function to check if a user is currently typing
export function isUserTyping(userId: number): boolean {
  const typingKey = ['typing-status'];
  const typingStatus = queryClient.getQueryData<Record<number, boolean>>(typingKey) || {};
  return typingStatus[userId] || false;
}
