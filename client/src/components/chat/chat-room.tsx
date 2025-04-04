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
        <p className="text-muted-foreground text-sm md:text-base max-w-md">
          Kirim pesan pertama dan buat harimu lebih berwarna 🌈
        </p>
        <div className="mt-8 flex flex-wrap gap-4 justify-center max-w-md">
          <div className="bg-blue-100 dark:bg-blue-900/30 p-4 rounded-lg text-center w-40">
            <span className="block text-2xl mb-2">💬</span>
            <p className="text-sm font-medium text-blue-700 dark:text-blue-300">Chat dengan teman</p>
          </div>
          <div className="bg-purple-100 dark:bg-purple-900/30 p-4 rounded-lg text-center w-40">
            <span className="block text-2xl mb-2">🎭</span>
            <p className="text-sm font-medium text-purple-700 dark:text-purple-300">Kirim emoji & stiker</p>
          </div>
          <div className="bg-green-100 dark:bg-green-900/30 p-4 rounded-lg text-center w-40">
            <span className="block text-2xl mb-2">📸</span>
            <p className="text-sm font-medium text-green-700 dark:text-green-300">Bagikan foto</p>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="h-full flex flex-col bg-white dark:bg-[#1e1e1e] theme-transition messenger-chat-area">
      {/* Chat Header - Facebook Messenger Style */}
      {!isMobile && (
        <div className="bg-white dark:bg-[#1e1e1e] border-b border-gray-200 dark:border-zinc-800 p-4 flex items-center shadow-sm messenger-header">
          <div className="w-full flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="relative">
                <div className={`w-10 h-10 ${getUserColor(selectedUser.username)} rounded-full flex items-center justify-center text-white font-medium shadow-sm`}>
                  <span>{getInitials(selectedUser.username)}</span>
                </div>
                <span className={`absolute bottom-0 right-0 ${selectedUser.online ? "bg-green-500" : "bg-zinc-500"} h-2.5 w-2.5 rounded-full border-2 border-[#1e1e1e]`}></span>
              </div>
              <div>
                <h2 className="font-medium text-foreground">{selectedUser.username}</h2>
                <div className="text-xs flex items-center">
                  {selectedUser.online ? (
                    <>
                      <span className="text-green-500">Active now</span>
                      {isUserTyping(selectedUser.id) && (
                        <span className="ml-2 text-zinc-400">• typing...</span>
                      )}
                    </>
                  ) : (
                    <span className="text-zinc-400">Offline</span>
                  )}
                </div>
              </div>
            </div>
            
            {/* Header Actions */}
            <div className="flex space-x-1">
              <button className="w-9 h-9 rounded-full flex items-center justify-center text-zinc-400 hover:bg-zinc-800 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
                </svg>
              </button>
              <button className="w-9 h-9 rounded-full flex items-center justify-center text-zinc-400 hover:bg-zinc-800 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
                </svg>
              </button>
              <button className="w-9 h-9 rounded-full flex items-center justify-center text-zinc-400 hover:bg-zinc-800 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 12.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 18.75a.75.75 0 110-1.5.75.75 0 010 1.5z" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto p-4 md:px-6" ref={scrollAreaRef}>
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="animate-spin h-6 w-6 text-messenger-yellow" />
            <span className="ml-2 text-zinc-400">Loading messages...</span>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-20 h-20 messenger-gradient rounded-full flex items-center justify-center mb-6 shadow-md">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-10 h-10 text-white">
                <path fillRule="evenodd" d="M4.848 2.771A49.144 49.144 0 0112 2.25c2.43 0 4.817.178 7.152.52 1.978.292 3.348 2.024 3.348 3.97v6.02c0 1.946-1.37 3.678-3.348 3.97a48.901 48.901 0 01-3.476.383.39.39 0 00-.297.17l-2.755 4.133a.75.75 0 01-1.248 0l-2.755-4.133a.39.39 0 00-.297-.17 48.9 48.9 0 01-3.476-.384c-1.978-.29-3.348-2.024-3.348-3.97V6.741c0-1.946 1.37-3.68 3.348-3.97zM6.75 8.25a.75.75 0 01.75-.75h9a.75.75 0 010 1.5h-9a.75.75 0 01-.75-.75zm.75 2.25a.75.75 0 000 1.5H12a.75.75 0 000-1.5H7.5z" clipRule="evenodd" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-foreground mb-2">Belum ada pesan</h3>
            <div className="text-muted-foreground text-sm mb-8">
              Mulailah percakapan sekarang!
            </div>
            <div className="bg-primary/10 dark:bg-primary/20 p-4 rounded-lg max-w-xs">
              <p className="text-sm text-primary font-medium">"Hai, apa kabar? Senang bisa mengobrol denganmu!" 👋</p>
            </div>
          </div>
        ) : (
          <>
            {Object.entries(groupedMessages).map(([date, msgs]) => (
              <div key={date} className="mb-4">
                <div className="text-center mb-4 sticky top-0 z-10">
                  <span className="text-xs bg-zinc-800 text-zinc-400 px-4 py-1.5 rounded-full shadow-sm">
                    {date}
                  </span>
                </div>
                <div className="space-y-0.5">
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
                    <span className="text-[10px] text-zinc-500 leading-none">{selectedUser.username} is typing...</span>
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
