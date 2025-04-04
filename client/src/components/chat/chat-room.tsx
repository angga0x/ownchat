import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { User, MessageWithUser } from "@shared/schema";
import { ScrollArea } from "@/components/ui/scroll-area";
import ChatBubble from "./chat-bubble";
import MessageInput from "./message-input";
import { format } from "date-fns";
import { Loader2 } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { markMessagesAsRead } from "@/lib/socket";

interface ChatRoomProps {
  selectedUser: User | null;
  currentUser: User | null;
  getInitials: (username: string) => string;
}

export default function ChatRoom({ selectedUser, currentUser, getInitials }: ChatRoomProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  
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
    if (messages.length > 0) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    }
  }, [messages, selectedUser]);
  
  // Mark messages as read when user selects a conversation
  useEffect(() => {
    if (selectedUser && currentUser) {
      // Mark all messages from the selected user as read
      markMessagesAsRead(selectedUser.id);
    }
  }, [selectedUser, currentUser, messages]);
  
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
      <div className="h-full flex flex-col items-center justify-center bg-neutral-light p-4 md:p-8 text-center">
        <div className="w-20 h-20 md:w-24 md:h-24 bg-primary-light rounded-full flex items-center justify-center mb-6 shadow-md">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 md:h-12 md:w-12 text-primary" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" />
          </svg>
        </div>
        <h2 className="text-lg md:text-xl font-semibold text-gray-700 mb-2">Select a chat to start messaging</h2>
        <p className="text-sm md:text-base text-gray-500 max-w-md">Choose a contact to start a conversation</p>
      </div>
    );
  }
  
  return (
    <div className="h-full flex flex-col bg-neutral-light">
      {/* Chat Header - Hidden on Mobile as we show it in the main header instead */}
      {!isMobile && (
        <div className="bg-white border-b border-gray-200 p-3 flex items-center space-x-3 shadow-sm">
          <div className="relative">
            <div className={`w-10 h-10 ${getUserColor(selectedUser.username)} rounded-full flex items-center justify-center text-white font-medium shadow-sm`}>
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
      )}
      
      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent p-3 md:p-4" ref={scrollAreaRef}>
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="animate-spin h-6 w-6 text-primary" />
            <span className="ml-2 text-gray-500">Loading messages...</span>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 bg-neutral-medium rounded-full flex items-center justify-center mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-gray-500" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="text-gray-500 text-sm md:text-base">No messages yet. Start the conversation!</div>
          </div>
        ) : (
          <>
            {Object.entries(groupedMessages).map(([date, msgs]) => (
              <div key={date} className="mb-4 md:mb-6">
                <div className="text-center my-3 md:my-4 sticky top-0 z-10">
                  <span className="text-xs text-gray-500 bg-neutral-light px-2 py-1 rounded shadow-sm">
                    {date}
                  </span>
                </div>
                <div className="space-y-2 md:space-y-4">
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
            <div ref={messagesEndRef} className="h-4" />
          </>
        )}
      </div>
      
      {/* Message Input */}
      <MessageInput selectedUser={selectedUser} />
    </div>
  );
}
