import { useState, useRef, useEffect } from "react";
import { User, MessageWithUser } from "@shared/schema";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { sendMessage, getSocket, sendTypingStatus, debounce } from "@/lib/socket";
import { Image, Loader2, Send, X, Smile } from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import { apiRequest } from "@/lib/queryClient";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/hooks/use-auth";
import { addMessageToCache } from "@/lib/chatCache";
import EmojiPicker, { EmojiClickData, Theme } from "emoji-picker-react";

interface MessageInputProps {
  selectedUser: User;
}

export default function MessageInput({ selectedUser }: MessageInputProps) {
  const [messageText, setMessageText] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [emojiShortcutActive, setEmojiShortcutActive] = useState(false);
  const [emojiSearch, setEmojiSearch] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  
  // Reset state when selected user changes
  useEffect(() => {
    setMessageText("");
    setImageFile(null);
    setImagePreviewUrl(null);
    setShowEmojiPicker(false);
  }, [selectedUser]);
  
  // Close emoji picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node)) {
        setShowEmojiPicker(false);
        // Reset shortcut mode if active
        if (emojiShortcutActive) {
          setEmojiShortcutActive(false);
          setEmojiSearch("");
        }
      }
    };
    
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [emojiShortcutActive]);
  
  // Effect untuk mengatur fokus pada emoji search ketika mode shortcut aktif
  useEffect(() => {
    if (emojiShortcutActive && showEmojiPicker) {
      // Berikan waktu untuk emoji picker untuk render
      const timerId = setTimeout(() => {
        // Cari elemen input pencarian di dalam emoji picker
        const searchInput = document.querySelector('.epr-search-container input') as HTMLInputElement;
        if (searchInput) {
          searchInput.focus();
          
          // Jika ada term pencarian, isi input dengan term tersebut
          if (emojiSearch) {
            searchInput.value = emojiSearch;
            
            // Trigger event untuk memicu pencarian
            const event = new Event('input', { bubbles: true });
            searchInput.dispatchEvent(event);
          }
        }
      }, 50);
      
      return () => clearTimeout(timerId);
    }
  }, [emojiShortcutActive, showEmojiPicker, emojiSearch]);

  // Handle emoji selection
  const handleEmojiClick = (emojiData: EmojiClickData) => {
    const emoji = emojiData.emoji;
    
    // If in shortcut mode, replace the shortcut text with the emoji
    if (emojiShortcutActive) {
      const colonIndex = messageText.lastIndexOf(':');
      if (colonIndex !== -1) {
        const updatedText = messageText.substring(0, colonIndex) + emoji;
        setMessageText(updatedText);
        setEmojiShortcutActive(false);
      } else {
        // Fallback if somehow we're in shortcut mode but there's no colon
        const cursorPosition = textareaRef.current?.selectionStart || messageText.length;
        const updatedText = messageText.slice(0, cursorPosition) + emoji + messageText.slice(cursorPosition);
        setMessageText(updatedText);
      }
    } else {
      // Normal emoji insertion at cursor position
      const cursorPosition = textareaRef.current?.selectionStart || messageText.length;
      const updatedText = messageText.slice(0, cursorPosition) + emoji + messageText.slice(cursorPosition);
      setMessageText(updatedText);
    }
    
    // Close the emoji picker after selection
    setShowEmojiPicker(false);
    setEmojiShortcutActive(false);
    setEmojiSearch("");
    
    // Focus back on the textarea after selecting an emoji
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.selectionStart = textareaRef.current.value.length;
        textareaRef.current.selectionEnd = textareaRef.current.value.length;
      }
    }, 10);
  };
  
  // Auto-focus textarea when component mounts
  useEffect(() => {
    // Don't auto-focus on mobile to prevent keyboard from popping up
    if (!isMobile && textareaRef.current) {
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 300);
    }
  }, [selectedUser, isMobile]);
  
  // Auto-resize the textarea based on content
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    
    // Reset height to calculate new height
    textarea.style.height = "36px";
    const newHeight = Math.min(textarea.scrollHeight, 120); // Max height of 120px
    textarea.style.height = `${newHeight}px`;
  }, [messageText]);
  
  // Create debounced typing notification (only send typing status every 500ms)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const debouncedTypingNotification = useRef(
    debounce(() => {
      if (selectedUser && selectedUser.id) {
        sendTypingStatus(selectedUser.id);
      }
    }, 500)
  ).current;
  
  // Handle text input change
  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setMessageText(value);

    // Check for emoji shortcut trigger with ":"
    const lastChar = value.charAt(value.length - 1);
    if (lastChar === ':' && !emojiShortcutActive) {
      setEmojiShortcutActive(true);
      setShowEmojiPicker(true);
      setEmojiSearch("");
    } else if (emojiShortcutActive) {
      // If user deletes the colon, deactivate shortcut mode
      if (!value.includes(':')) {
        setEmojiShortcutActive(false);
        setShowEmojiPicker(false);
      } else {
        // Extract the search term after the last colon
        const colonIndex = value.lastIndexOf(':');
        if (colonIndex !== -1 && colonIndex < value.length - 1) {
          const searchTerm = value.substring(colonIndex + 1);
          setEmojiSearch(searchTerm);
        }
      }
    }
    
    // Only send typing notification if there's text
    if (value.trim()) {
      debouncedTypingNotification();
    }
  };
  
  // Handle image upload
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      
      // Validate file size (5MB max)
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: "Image must be less than 5MB",
          variant: "destructive",
        });
        return;
      }
      
      // Validate file type
      if (!file.type.startsWith("image/")) {
        toast({
          title: "Invalid file type",
          description: "Only image files are allowed",
          variant: "destructive",
        });
        return;
      }
      
      setImageFile(file);
      
      // Generate preview URL
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };
  
  // Remove preview image
  const removePreviewImage = () => {
    setImageFile(null);
    setImagePreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };
  
  // Send message
  const handleSendMessage = async () => {
    // Validate input
    if (!messageText.trim() && !imageFile) {
      return;
    }
    
    try {
      // Handle image upload first if there's an image
      if (imageFile) {
        setIsUploading(true);
        
        // Create form data for image upload
        const formData = new FormData();
        formData.append("image", imageFile);
        
        // Get token for authentication
        const token = localStorage.getItem("token");
        if (!token) {
          throw new Error("No authentication token");
        }
        
        // Upload image
        const uploadResponse = await fetch("/api/upload", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${token}`
          },
          body: formData,
        });
        
        if (!uploadResponse.ok) {
          throw new Error("Failed to upload image");
        }
        
        const data = await uploadResponse.json();
        
        // Send image message
        await apiRequest("POST", "/api/messages/image", {
          receiverId: selectedUser.id,
          imagePath: data.imagePath
        });
        
        // Create optimistic image message for local caching and UI update
        if (currentUser) {
          // Buat optimistic message untuk cache lokal dan UI
          const tempId = Date.now();
          const imageMessage: MessageWithUser = {
            id: tempId,
            senderId: currentUser.id,
            senderUsername: currentUser.username,
            receiverId: selectedUser.id,
            content: null,
            imagePath: data.imagePath,
            timestamp: new Date(),
            delivered: false,
            read: false,
            isDeleted: false,
            deletedBy: [],
            isCurrentUser: true
          };
          
          // Tambahkan ke cache lokal dan update UI
          addMessageToCache(currentUser.id, selectedUser.id, imageMessage);
          
          // Add to React Query cache for immediate UI update
          const queryKey = ["/api/messages", selectedUser.id];
          const existingMessages = queryClient.getQueryData<MessageWithUser[]>(queryKey) || [];
          queryClient.setQueryData(queryKey, [...existingMessages, imageMessage]);
        }
        
        // Clear image preview after upload
        removePreviewImage();
      }
      
      // Send text message if there's text
      if (messageText.trim()) {
        const socket = getSocket();
        if (!socket || !socket.connected) {
          throw new Error("Socket.IO connection not open");
        }
        
        // Create optimistic message for immediate UI update
        if (currentUser) {
          // Create an optimistic message 
          const tempId = Date.now(); // Temporary ID sampai server mengirim ID sebenarnya
          const optimisticMessage: MessageWithUser = {
            id: tempId,
            senderId: currentUser.id,
            senderUsername: currentUser.username,
            receiverId: selectedUser.id,
            content: messageText,
            imagePath: null,
            timestamp: new Date(),
            delivered: false,
            read: false,
            isDeleted: false,
            deletedBy: [],
            isCurrentUser: true
          };
          
          // Add to local cache
          addMessageToCache(currentUser.id, selectedUser.id, optimisticMessage);
          
          // Add to React Query cache for immediate UI update
          const queryKey = ["/api/messages", selectedUser.id];
          const existingMessages = queryClient.getQueryData<MessageWithUser[]>(queryKey) || [];
          queryClient.setQueryData(queryKey, [...existingMessages, optimisticMessage]);
          
          // Save message text before clearing input
          const messageContent = messageText;
          
          // Clear input field immediately for better UX
          setMessageText("");
          
          // Reset textarea height
          if (textareaRef.current) {
            textareaRef.current.style.height = "40px";
          }
          
          // Send message via socket
          sendMessage(selectedUser.id, messageContent);
        }
      }
    } catch (error) {
      console.error("Error sending message:", error);
      toast({
        title: "Failed to send message",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };
  
  // Handle key press (send on Enter without Shift, or ESC to close emoji picker)
  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    } else if (e.key === "Escape" && (showEmojiPicker || emojiShortcutActive)) {
      // Close emoji picker on ESC key
      setShowEmojiPicker(false);
      setEmojiShortcutActive(false);
      setEmojiSearch("");
    }
  };
  
  return (
    <div className="bg-white dark:bg-[#1e1e1e] p-3 sm:p-4 theme-transition messenger-input-container shadow-sm">
      <div className="flex items-center space-x-3 w-full">
        {/* Image Upload - Facebook Messenger Style */}
        <div className="relative flex-shrink-0">
          <input 
            type="file" 
            id="image-upload" 
            className="hidden" 
            accept="image/*"
            onChange={handleImageChange}
            ref={fileInputRef}
          />
          <label 
            htmlFor="image-upload" 
            className={`flex items-center justify-center w-10 h-10 rounded-full cursor-pointer transition-colors duration-200
              ${isUploading ? 'cursor-not-allowed text-muted-foreground' : 'text-messenger-blue hover:bg-gray-100 dark:hover:bg-zinc-800/50'}`}
            aria-label="Attach image"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
            </svg>
          </label>
        </div>
        
        {/* Text Input - Facebook Messenger Style */}
        <div className="w-full max-w-[calc(100%-5.5rem)] relative messenger-input">
          <div className="relative rounded-full overflow-hidden bg-gray-50 dark:bg-zinc-800/80 border-0 focus-within:ring-0 focus-within:shadow-md transition-shadow duration-200">
            <Textarea 
              ref={textareaRef}
              id="message-input"
              rows={1}
              className="block w-full resize-none border-0 bg-transparent py-[11px] pl-4 pr-12 focus:outline-none min-h-[42px] max-h-[120px] text-base shadow-none text-gray-800 dark:text-white" 
              placeholder="Aa (type : for emoji)"
              value={messageText}
              onChange={handleTextChange}
              onKeyPress={handleKeyPress}
              disabled={isUploading}
              style={{ height: '42px' }}
            />
            
            {/* Emoji Button */}
            <div className="absolute right-3 bottom-2.5">
              <div 
                className="text-messenger-blue cursor-pointer hover:text-messenger-blue-light transition-colors"
                onClick={() => {
                  if (showEmojiPicker) {
                    // If closing, reset shortcut mode
                    setEmojiShortcutActive(false);
                    setEmojiSearch("");
                  }
                  setShowEmojiPicker(!showEmojiPicker);
                }}
              >
                <Smile className="h-5 w-5" />
              </div>
            </div>
            
            {/* Emoji Picker */}
            {showEmojiPicker && (
              <div 
                className="absolute bottom-full right-0 mb-2 z-50" 
                ref={emojiPickerRef}
              >
                <EmojiPicker
                  onEmojiClick={handleEmojiClick}
                  theme={Theme.AUTO}
                  width={320}
                  height={400}
                  previewConfig={{ showPreview: false }}
                  searchPlaceHolder={emojiShortcutActive ? "Type to search..." : "Search emoji..."}
                  autoFocusSearch={emojiShortcutActive}
                />
                {emojiShortcutActive && (
                  <div className="bg-gray-700/80 text-white text-xs p-2 rounded-b-md">
                    <div className="flex items-center gap-1">
                      <span className="bg-gray-600 text-xs px-1 py-0.5 rounded">:</span>
                      <span>Shortcut mode active. Select an emoji or click outside to cancel.</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          
          {/* Image Preview - Updated for Messenger Style */}
          {imagePreviewUrl && (
            <div className="absolute bottom-full left-0 mb-2 w-52 h-52 bg-zinc-800 rounded-lg overflow-hidden shadow-lg border border-zinc-700">
              <div className="relative w-full h-full">
                <img 
                  className="w-full h-full object-cover" 
                  src={imagePreviewUrl} 
                  alt="Preview" 
                />
                <button 
                  type="button" 
                  className="absolute top-2 right-2 bg-zinc-900/80 text-white rounded-full p-1.5 hover:bg-zinc-800 transition-colors"
                  onClick={removePreviewImage}
                  aria-label="Remove image"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
        
        {/* Voice message button */}
        <button 
          className="flex items-center justify-center w-10 h-10 rounded-full text-messenger-blue hover:bg-gray-100 dark:hover:bg-zinc-800/50 transition-colors"
          aria-label="Voice message"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
          </svg>
        </button>
        
        {/* Send Button - Facebook Messenger Style */}
        <Button 
          className={`flex items-center justify-center w-10 h-10 rounded-full p-0 flex-shrink-0 transition-all duration-200
            ${(!messageText.trim() && !imageFile) || isUploading 
              ? 'bg-transparent text-muted-foreground cursor-not-allowed' 
              : 'text-messenger-blue hover:bg-gray-100 dark:hover:bg-zinc-800/50'}`}
          onClick={handleSendMessage}
          disabled={(!messageText.trim() && !imageFile) || isUploading}
          variant="ghost"
          aria-label="Send message"
        >
          <Send className="h-5 w-5 rotate-45" />
        </Button>
      </div>
    </div>
  );
}
