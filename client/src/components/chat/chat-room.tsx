import { useState, useEffect, useRef } from "react";
import { User, MessageWithUser } from "@shared/schema";
import { ScrollArea } from "@/components/ui/scroll-area";
import ChatBubble from "./chat-bubble";
import MessageInput from "./message-input";
import { format } from "date-fns";
import { Loader2, MessageCircle } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { markMessagesAsRead, isUserTyping } from "@/lib/socket";
import { useChatCache } from "@/hooks/use-chat-cache";

interface ChatRoomProps {
  selectedUser: User | null;
  currentUser: User | null;
  getInitials: (username: string) => string;
}

export default function ChatRoom({ selectedUser, currentUser, getInitials }: ChatRoomProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  
  // Use chat cache hook untuk mendapatkan pesan baik dari cache lokal maupun server
  const { 
    messages = [], 
    isLoading,
    error, 
    addMessage 
  } = useChatCache(currentUser, selectedUser);
  
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
  const groupedMessages = messages.reduce((groups: Record<string, MessageWithUser[]>, message: MessageWithUser) => {
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
      <div className="h-full flex flex-col items-center justify-center bg-background p-4 md:p-8 text-center theme-transition">
        <div className="w-20 h-20 md:w-24 md:h-24 messenger-gradient rounded-full flex items-center justify-center mb-6 shadow-md">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 md:h-12 md:w-12 text-white" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" />
          </svg>
        </div>
        <h2 className="text-lg md:text-xl font-semibold text-foreground mb-2">Select a chat to start messaging</h2>
        <p className="text-sm md:text-base text-muted-foreground max-w-md">Choose a contact to start a conversation</p>
      </div>
    );
  }
  
  return (
    <div className="h-full flex flex-col bg-background theme-transition">
      {/* Chat Header - Hidden on Mobile as we show it in the main header instead */}
      {!isMobile && (
        <div className="bg-background border-b border-border p-3 sm:p-4 flex items-center space-x-3 shadow-sm">
          <div className="relative">
            <div className={`w-10 h-10 ${getUserColor(selectedUser.username)} rounded-full flex items-center justify-center text-white font-medium shadow-sm`}>
              <span>{getInitials(selectedUser.username)}</span>
            </div>
            <span className={`absolute bottom-0 right-0 ${selectedUser.online ? "bg-green-500" : "bg-muted-foreground"} h-2.5 w-2.5 rounded-full border-2 border-background`}></span>
          </div>
          <div className="flex-1">
            <h2 className="font-medium text-foreground">@{selectedUser.username}</h2>
            <div className="text-xs flex items-center">
              {selectedUser.online ? (
                <>
                  <span className="inline-block h-2 w-2 rounded-full bg-green-500 mr-1.5"></span>
                  <span className="text-green-600">Online</span>
                  {isUserTyping(selectedUser.id) && (
                    <span className="ml-2 text-muted-foreground">(sedang mengetik...)</span>
                  )}
                </>
              ) : (
                <span className="text-muted-foreground">Offline</span>
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-4 md:pr-8" ref={scrollAreaRef}>
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="animate-spin h-6 w-6 text-primary" />
            <span className="ml-2 text-muted-foreground">Loading messages...</span>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-muted-foreground" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="text-muted-foreground text-sm md:text-base">No messages yet. Start the conversation!</div>
          </div>
        ) : (
          <>
            {Object.entries(groupedMessages).map(([date, msgs]) => (
              <div key={date} className="mb-4 md:mb-6">
                <div className="text-center my-3 md:my-4 sticky top-0 z-10">
                  <span className="text-xs text-muted-foreground bg-background px-2 py-1 rounded shadow-sm">
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
            {/* Typing indicator - Facebook Messenger Style */}
            {selectedUser && isUserTyping(selectedUser.id) && (
              <div className={`flex items-end mb-1.5 md:mb-2 ml-4 bubble-appear`}>
                <div className="flex flex-col space-y-1 items-start">
                  <div className="px-3 py-2 messenger-bubble-received rounded-t-[20px] rounded-br-[20px] rounded-bl-[4px] flex items-center">
                    <div className="messenger-typing-indicator">
                      <span></span>
                      <span></span>
                      <span></span>
                    </div>
                  </div>
                  <div className="flex items-center px-1 space-x-1">
                    <span className="text-[10px] text-muted-foreground leading-none">@{selectedUser.username} is typing...</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} className="h-4" />
          </>
        )}
      </div>
      
      {/* Message Input */}
      <MessageInput selectedUser={selectedUser} />
    </div>
  );
}
