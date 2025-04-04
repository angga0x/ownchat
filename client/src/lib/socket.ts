import { queryClient } from "./queryClient";

let socket: WebSocket | null = null;

export function setupSocket(token: string) {
  // Close existing socket if any
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.close();
  }
  
  // Create new WebSocket connection
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const wsUrl = `${protocol}//${window.location.host}/ws`;
  socket = new WebSocket(wsUrl);
  
  socket.onopen = () => {
    console.log("WebSocket connection established");
    
    // Authenticate the connection with JWT
    if (socket) {
      socket.send(JSON.stringify({
        type: "auth",
        token
      }));
    }
  };
  
  socket.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      
      console.log("WebSocket message received:", data);
      
      switch (data.type) {
        case "auth_success":
          console.log("WebSocket authentication successful");
          break;
        
        case "private_message":
        case "image_message":
          // Handle incoming message
          handleIncomingMessage(data.message);
          break;
        
        case "user_status":
          // Handle user status change
          handleUserStatusChange(data.userId, data.online);
          break;
        
        case "error":
          console.error("WebSocket error:", data.message);
          break;
          
        default:
          console.log("Unknown message type:", data.type);
      }
    } catch (error) {
      console.error("Error parsing WebSocket message:", error);
    }
  };
  
  socket.onerror = (error) => {
    console.error("WebSocket error:", error);
  };
  
  socket.onclose = () => {
    console.log("WebSocket connection closed");
  };
  
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.close();
    socket = null;
  }
}

export function getSocket() {
  return socket;
}

export function sendMessage(receiverId: number, content: string) {
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    throw new Error("WebSocket connection not open");
  }
  
  socket.send(JSON.stringify({
    type: "private_message",
    receiverId,
    content
  }));
}

function handleIncomingMessage(message: any) {
  // When receiving a new message, invalidate the messages query to trigger a refetch
  const queryKey = ["/api/messages", message.senderId];
  
  // Optimistically update cache
  const existingMessages = queryClient.getQueryData(queryKey) || [];
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
