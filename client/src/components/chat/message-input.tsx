import { useState, useRef, useEffect } from "react";
import { User, MessageWithUser } from "@shared/schema";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { sendMessage, getSocket, sendTypingStatus, debounce } from "@/lib/socket";
import { Image, Loader2, Send, X } from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import { apiRequest } from "@/lib/queryClient";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/hooks/use-auth";
import { addMessageToCache } from "@/lib/chatCache";

interface MessageInputProps {
  selectedUser: User;
}

export default function MessageInput({ selectedUser }: MessageInputProps) {
  const [messageText, setMessageText] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isMobile = useIsMobile();
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  
  // Reset state when selected user changes
  useEffect(() => {
    setMessageText("");
    setImageFile(null);
    setImagePreviewUrl(null);
  }, [selectedUser]);
  
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
  
  // Handle key press (send on Enter without Shift)
  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };
  
  return (
    <div className="bg-background border-t border-border p-3 sm:p-4 theme-transition">
      <div className="flex items-end space-x-2">
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
              ${isUploading ? 'cursor-not-allowed text-muted-foreground' : 'text-messenger-blue hover:bg-muted/50'}`}
            aria-label="Attach image"
          >
            {isUploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Image className="h-5 w-5" />}
          </label>
        </div>
        
        {/* Text Input - Facebook Messenger Style */}
        <div className="flex-1 relative">
          <div className="relative rounded-full overflow-hidden bg-muted/50 dark:bg-muted/30 border-0 focus-within:ring-1 focus-within:ring-messenger-blue focus-within:bg-background">
            <Textarea 
              ref={textareaRef}
              id="message-input"
              rows={1}
              className="block w-full resize-none border-0 bg-transparent py-2 pl-4 pr-12 focus:outline-none min-h-[40px] max-h-[120px] text-base shadow-none" 
              placeholder="Aa"
              value={messageText}
              onChange={handleTextChange}
              onKeyPress={handleKeyPress}
              disabled={isUploading}
              style={{ height: '40px' }}
            />
            
            {/* Emoji button placeholder - for visual authenticity */}
            <div className="absolute right-3 bottom-2">
              <div className="text-messenger-blue cursor-pointer">
                <svg viewBox="0 0 16 16" height="20" width="20" className="fill-current">
                  <path d="M8 16A8 8 0 1 1 8 0a8 8 0 0 1 0 16zM7 6.5C7 7.328 6.552 8 6 8s-1-.672-1-1.5S5.448 5 6 5s1 .672 1 1.5zM8.45 4h-.9a.45.45 0 0 0-.45.45v.9c0 .248.203.45.45.45h.9a.45.45 0 0 0 .45-.45v-.9a.45.45 0 0 0-.45-.45zm2.5 1c-.552 0-1 .672-1 1.5S10.448 8 11 8s1-.672 1-1.5S11.552 5 11 5zM7.243 9.857a.5.5 0 0 0-.742.146.5.5 0 0 0 .72.678c.49-.521 1.335-.851 2.28-.848.942.005 1.792.356 2.29.91a.5.5 0 0 0 .737-.166.5.5 0 0 0-.171-.707c-.687-.443-1.635-.845-2.86-.852-1.131-.008-2.177.355-2.854.839z" />
                </svg>
              </div>
            </div>
          </div>
          
          {/* Image Preview - Updated for Messenger Style */}
          {imagePreviewUrl && (
            <div className="absolute bottom-full left-0 mb-2 w-52 h-52 bg-background rounded-lg overflow-hidden shadow-lg border border-border">
              <div className="relative w-full h-full">
                <img 
                  className="w-full h-full object-cover" 
                  src={imagePreviewUrl} 
                  alt="Preview" 
                />
                <button 
                  type="button" 
                  className="absolute top-2 right-2 bg-background/80 text-foreground rounded-full p-1.5 hover:bg-background transition-colors"
                  onClick={removePreviewImage}
                  aria-label="Remove image"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
        
        {/* Send Button - Facebook Messenger Style */}
        <Button 
          className={`flex items-center justify-center w-10 h-10 rounded-full p-0 flex-shrink-0 transition-all duration-200
            ${(!messageText.trim() && !imageFile) || isUploading 
              ? 'bg-transparent text-muted-foreground cursor-not-allowed' 
              : 'text-messenger-blue hover:bg-muted/50'}`}
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
