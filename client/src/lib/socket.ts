import { queryClient } from "./queryClient";
import { io, Socket } from "socket.io-client";
import { addMessageToCache, updateMessageStatusInCache } from "./chatCache";

let socket: Socket | null = null;

// Event handlers for message deletion
const messageDeletedForMeHandlers: ((data: { messageId: number, userId: string }) => void)[] = [];
const messageDeletedForAllHandlers: ((data: { messageId: number }) => void)[] = [];

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
  
  // Set up message deletion handlers
  socket.on("message_deleted_for_me", (data) => {
    console.log("Message deleted for me:", data);
    // Notify all registered handlers
    messageDeletedForMeHandlers.forEach(handler => handler(data));
    
    // Update UI by removing the message from all conversations directly
    // Update all active conversations by filtering out the deleted message
    const allQueryKeys = queryClient.getQueryCache().getAll();
    const currentUserId = queryClient.getQueryData<any>(["/api/user"])?.id?.toString();
    
    // Only apply the deletion if the current user is the one who deleted the message
    if (currentUserId === data.userId) {
      allQueryKeys.forEach(query => {
        const queryKey = query.queryKey;
        if (Array.isArray(queryKey) && queryKey[0] === '/api/messages') {
          const messages = queryClient.getQueryData<any[]>(queryKey);
          
          if (messages) {
            // Filter out the deleted message
            const updatedMessages = messages.filter(msg => msg.id !== data.messageId);
            
            // Update the query cache with the filtered messages
            queryClient.setQueryData(queryKey, updatedMessages);
          }
        }
      });
    }
  });
  
  socket.on("message_deleted_for_all", (data) => {
    console.log("Message deleted for all:", data);
    // Notify all registered handlers
    messageDeletedForAllHandlers.forEach(handler => handler(data));
    
    // Update UI by removing the message from all conversations directly
    // Update all active conversations by filtering out the deleted message
    const allQueryKeys = queryClient.getQueryCache().getAll();
    
    allQueryKeys.forEach(query => {
      const queryKey = query.queryKey;
      if (Array.isArray(queryKey) && queryKey[0] === '/api/messages') {
        const messages = queryClient.getQueryData<any[]>(queryKey);
        
        if (messages) {
          // Filter out the deleted message
          const updatedMessages = messages.filter(msg => msg.id !== data.messageId);
          
          // Update the query cache with the filtered messages
          queryClient.setQueryData(queryKey, updatedMessages);
        }
      }
    });
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
  
  // Hapus semua listener 'message_sent' sebelumnya untuk mencegah penumpukan
  socket.off("message_sent");
  
  // Tambahkan listener baru
  socket.on("message_sent", (message) => {
    console.log("Message sent confirmation:", message);
    
    const userQuery = queryClient.getQueryData<any>(["/api/user"]);
    if (!userQuery || !userQuery.id) return;
    
    // Update both sides of the conversation immediately
    // 1. Update receiver's side
    const receiverQueryKey = ["/api/messages", receiverId];
    const receiverMessages = queryClient.getQueryData<any[]>(receiverQueryKey) || [];
    queryClient.setQueryData(receiverQueryKey, [...receiverMessages, message]);
    
    // 2. Update sender's side (current user's view of the conversation)
    const senderQueryKey = ["/api/messages", message.senderId];
    const senderMessages = queryClient.getQueryData<any[]>(senderQueryKey) || [];
    queryClient.setQueryData(senderQueryKey, [...senderMessages, message]);
    
    // Invalidate both queries to ensure data consistency
    queryClient.invalidateQueries({ queryKey: receiverQueryKey });
    queryClient.invalidateQueries({ queryKey: senderQueryKey });
  });
  
  // Kirim pesan
  socket.emit("private_message", {
    receiverId,
    content
  });
}

export function sendImageMessage(receiverId: number, imagePath: string) {
  if (!socket || !socket.connected) {
    throw new Error("Socket.IO connection not open");
  }
  
  // Hapus semua listener 'image_message_sent' sebelumnya untuk mencegah penumpukan
  socket.off("image_message_sent");
  
  // Tambahkan listener baru
  socket.on("image_message_sent", (data) => {
    console.log("Image message sent confirmation:", data.message);
    
    const userQuery = queryClient.getQueryData<any>(["/api/user"]);
    if (!userQuery || !userQuery.id) return;
    
    const message = data.message;
    
    // Update both sides of the conversation immediately
    // 1. Update receiver's side
    const receiverQueryKey = ["/api/messages", receiverId];
    const receiverMessages = queryClient.getQueryData<any[]>(receiverQueryKey) || [];
    queryClient.setQueryData(receiverQueryKey, [...receiverMessages, message]);
    
    // 2. Update sender's side (current user's view of the conversation)
    const senderQueryKey = ["/api/messages", message.senderId];
    const senderMessages = queryClient.getQueryData<any[]>(senderQueryKey) || [];
    queryClient.setQueryData(senderQueryKey, [...senderMessages, message]);
    
    // Invalidate both queries to ensure data consistency
    queryClient.invalidateQueries({ queryKey: receiverQueryKey });
    queryClient.invalidateQueries({ queryKey: senderQueryKey });
  });
  
  // Kirim pesan gambar
  socket.emit("image_message", {
    receiverId,
    imagePath
  });
}

function handleIncomingMessage(message: any) {
  const userQuery = queryClient.getQueryData<any>(["/api/user"]);
  if (!userQuery || !userQuery.id) return;
  
  const currentUserId = userQuery.id;
  
  // Perbarui cache untuk conversation penerima
  const receiverQueryKey = ["/api/messages", message.senderId];
  const existingReceiverMessages = queryClient.getQueryData<any[]>(receiverQueryKey) || [];
  queryClient.setQueryData(receiverQueryKey, [...existingReceiverMessages, message]);
  
  // Perbarui juga cache untuk conversation pengirim
  const senderQueryKey = ["/api/messages", message.receiverId];
  const existingSenderMessages = queryClient.getQueryData<any[]>(senderQueryKey) || [];
  queryClient.setQueryData(senderQueryKey, [...existingSenderMessages, message]);
  
  // Invalidate both query caches to ensure we have the latest data
  queryClient.invalidateQueries({ queryKey: receiverQueryKey });
  queryClient.invalidateQueries({ queryKey: senderQueryKey });
  
  // Tambahkan pesan ke cache lokal
  addMessageToCache(currentUserId, message.senderId, message);
  
  // Jika pesan dikirim ke user saat ini, tambahkan juga ke cache konversasi tersebut
  if (message.receiverId === currentUserId) {
    addMessageToCache(currentUserId, message.senderId, message);
  } else if (message.senderId === currentUserId) {
    // Jika pesan dikirim oleh user saat ini, tambahkan ke cache konversasi penerima
    addMessageToCache(currentUserId, message.receiverId, message);
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

// Register event handlers for message deletion
export function onMessageDeletedForMe(handler: (data: { messageId: number, userId: string }) => void) {
  messageDeletedForMeHandlers.push(handler);
  return () => {
    const index = messageDeletedForMeHandlers.indexOf(handler);
    if (index !== -1) {
      messageDeletedForMeHandlers.splice(index, 1);
    }
  };
}

export function onMessageDeletedForAll(handler: (data: { messageId: number }) => void) {
  messageDeletedForAllHandlers.push(handler);
  return () => {
    const index = messageDeletedForAllHandlers.indexOf(handler);
    if (index !== -1) {
      messageDeletedForAllHandlers.splice(index, 1);
    }
  };
}

// Function to update UI when a message is deleted for a specific user
function updateMessageDeletedForMe(messageId: number, userId: string) {
  // Update all active conversations by filtering out the deleted message
  const allQueryKeys = queryClient.getQueryCache().getAll();
  const currentUserId = queryClient.getQueryData<any>(["/api/user"])?.id?.toString();
  
  // Only apply the deletion if the current user is the one who deleted the message
  if (currentUserId !== userId) return;
  
  allQueryKeys.forEach(query => {
    const queryKey = query.queryKey;
    if (Array.isArray(queryKey) && queryKey[0] === '/api/messages') {
      const messages = queryClient.getQueryData<any[]>(queryKey);
      
      if (messages) {
        // Filter out the deleted message
        const updatedMessages = messages.filter(msg => msg.id !== messageId);
        
        // Update the query cache with the filtered messages
        queryClient.setQueryData(queryKey, updatedMessages);
      }
    }
  });
}

// Function to update UI when a message is deleted for all users
function updateMessageDeletedForAll(messageId: number) {
  // Update all active conversations by filtering out the deleted message
  const allQueryKeys = queryClient.getQueryCache().getAll();
  
  allQueryKeys.forEach(query => {
    const queryKey = query.queryKey;
    if (Array.isArray(queryKey) && queryKey[0] === '/api/messages') {
      const messages = queryClient.getQueryData<any[]>(queryKey);
      
      if (messages) {
        // Filter out the deleted message
        const updatedMessages = messages.filter(msg => msg.id !== messageId);
        
        // Update the query cache with the filtered messages
        queryClient.setQueryData(queryKey, updatedMessages);
      }
    }
  });
}

// Function to delete a message for the current user only
export function deleteMessageForMe(messageId: number) {
  return fetch(`/api/messages/${messageId}/for-me`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    }
  }).then(res => {
    if (!res.ok) {
      throw new Error("Failed to delete message");
    }
    return res.json();
  });
}

// Function to delete a message for all users
export function deleteMessageForAll(messageId: number) {
  return fetch(`/api/messages/${messageId}/for-all`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    }
  }).then(res => {
    if (!res.ok) {
      throw new Error("Failed to delete message for all");
    }
    return res.json();
  });
}

// Functions for chat management
export function pinChat(partnerId: number) {
  return fetch(`/api/chats/${partnerId}/pin`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    }
  }).then(res => {
    if (!res.ok) {
      throw new Error("Failed to pin chat");
    }
    return res.json();
  });
}

export function unpinChat(partnerId: number) {
  return fetch(`/api/chats/${partnerId}/unpin`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    }
  }).then(res => {
    if (!res.ok) {
      throw new Error("Failed to unpin chat");
    }
    return res.json();
  });
}

export function archiveChat(partnerId: number) {
  return fetch(`/api/chats/${partnerId}/archive`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    }
  }).then(res => {
    if (!res.ok) {
      throw new Error("Failed to archive chat");
    }
    return res.json();
  });
}

export function unarchiveChat(partnerId: number) {
  return fetch(`/api/chats/${partnerId}/unarchive`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    }
  }).then(res => {
    if (!res.ok) {
      throw new Error("Failed to unarchive chat");
    }
    return res.json();
  });
}
