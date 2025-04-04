import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { User, MessageWithUser } from "@shared/schema";
import { ScrollArea } from "@/components/ui/scroll-area";
import ChatBubble from "./chat-bubble";
import MessageInput from "./message-input";
import { format } from "date-fns";

interface ChatRoomProps {
  selectedUser: User | null;
  currentUser: User | null;
  getInitials: (username: string) => string;
}

export default function ChatRoom({ selectedUser, currentUser, getInitials }: ChatRoomProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Fetch messages when a user is selected
  const { data: messages = [], isLoading } = useQuery<MessageWithUser[]>({
    queryKey: ["/api/messages", selectedUser?.id],
    queryFn: async () => {
      if (!selectedUser) return [];
      
      const token = localStorage.getItem("token");
      if (!token) throw new Error("No authentication token");
      
      const res = await fetch(`/api/messages/${selectedUser.id}`, {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      
      if (!res.ok) {
        throw new Error("Failed to fetch messages");
      }
      
      return res.json();
    },
    // Only run query if a user is selected
    enabled: !!selectedUser,
  });
  
  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);
  
  // Function to determine background color based on username
  const getUserColor = (username: string) => {
    const colors = [
      "bg-primary-light", "bg-purple-500", "bg-green-500", 
      "bg-yellow-500", "bg-red-500", "bg-indigo-500", 
      "bg-pink-500", "bg-blue-500"
    ];
    
    // Simple hash function to get consistent color for a username
    const hash = username.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
  };
  
  // Group messages by date
  const groupedMessages = messages.reduce((groups: any, message) => {
    const date = format(new Date(message.timestamp), 'MMMM d, yyyy');
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(message);
    return groups;
  }, {});
  
  // Empty state when no user is selected
  if (!selectedUser) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-neutral-light p-8 text-center">
        <div className="w-24 h-24 bg-primary-light rounded-full flex items-center justify-center mb-6">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-primary" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-gray-700 mb-2">Select a chat to start messaging</h2>
        <p className="text-gray-500 max-w-md">Choose a contact from the left sidebar to start a conversation</p>
      </div>
    );
  }
  
  return (
    <div className="flex-1 flex flex-col bg-neutral-light">
      {/* Chat Header */}
      <div className="bg-white border-b border-gray-200 p-4 flex items-center space-x-3 shadow-sm">
        <div className="relative">
          <div className={`w-10 h-10 ${getUserColor(selectedUser.username)} rounded-full flex items-center justify-center text-white font-medium`}>
            <span>{getInitials(selectedUser.username)}</span>
          </div>
          <span className={`absolute bottom-0 right-0 ${selectedUser.online ? "bg-green-500" : "bg-gray-400"} h-2.5 w-2.5 rounded-full border-2 border-white`}></span>
        </div>
        <div className="flex-1">
          <h2 className="font-medium text-gray-900">@{selectedUser.username}</h2>
          <p className={`text-xs ${selectedUser.online ? "text-green-600" : "text-gray-500"}`}>
            {selectedUser.online ? "Online" : "Offline"}
          </p>
        </div>
      </div>
      
      {/* Messages Container */}
      <ScrollArea className="flex-1 p-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-gray-500">Loading messages...</div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-gray-500">No messages yet. Start the conversation!</div>
          </div>
        ) : (
          <>
            {Object.entries(groupedMessages).map(([date, msgs]) => (
              <div key={date} className="mb-6">
                <div className="text-center my-4">
                  <span className="text-xs text-gray-500 bg-neutral-light px-2 py-1 rounded">
                    {date}
                  </span>
                </div>
                <div className="space-y-4">
                  {(msgs as MessageWithUser[]).map((message) => (
                    <ChatBubble
                      key={message.id}
                      message={message}
                      isCurrentUser={message.senderId === currentUser?.id}
                    />
                  ))}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </>
        )}
      </ScrollArea>
      
      {/* Message Input */}
      <MessageInput selectedUser={selectedUser} />
    </div>
  );
}
