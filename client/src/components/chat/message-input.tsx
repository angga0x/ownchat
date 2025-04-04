import { useState, useRef, useEffect } from "react";
import { User } from "@shared/schema";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { sendMessage, getSocket } from "@/lib/socket";
import { Image, Send, X } from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import { apiRequest } from "@/lib/queryClient";

interface MessageInputProps {
  selectedUser: User;
}

export default function MessageInput({ selectedUser }: MessageInputProps) {
  const [messageText, setMessageText] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  
  // Reset state when selected user changes
  useEffect(() => {
    setMessageText("");
    setImageFile(null);
    setImagePreviewUrl(null);
  }, [selectedUser]);
  
  // Handle text input change
  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessageText(e.target.value);
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
        const response = await fetch("/api/upload", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${token}`
          },
          body: formData,
        });
        
        if (!response.ok) {
          throw new Error("Failed to upload image");
        }
        
        const data = await response.json();
        
        // Send image message
        await apiRequest("POST", "/api/messages/image", {
          receiverId: selectedUser.id,
          imagePath: data.imagePath
        });
        
        // Clear image preview after upload
        removePreviewImage();
      }
      
      // Send text message if there's text
      if (messageText.trim()) {
        const socket = getSocket();
        if (!socket || socket.readyState !== WebSocket.OPEN) {
          throw new Error("WebSocket connection not open");
        }
        
        sendMessage(selectedUser.id, messageText);
        setMessageText("");
      }
      
      // Invalidate messages query to update UI
      queryClient.invalidateQueries({ queryKey: ["/api/messages", selectedUser.id] });
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
    <div className="bg-white border-t border-gray-200 p-4">
      <div className="flex items-end space-x-2">
        {/* Image Upload */}
        <div className="relative">
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
            className="flex items-center justify-center w-10 h-10 bg-neutral-light text-gray-600 rounded-full cursor-pointer hover:bg-neutral-medium transition-colors duration-200"
          >
            <Image className="h-5 w-5" />
          </label>
        </div>
        
        {/* Text Input */}
        <div className="flex-1 relative">
          <Textarea 
            id="message-input"
            rows={1}
            className="block w-full resize-none rounded-md border border-gray-300 py-2 pl-3 pr-10 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary" 
            placeholder="Type a message..."
            value={messageText}
            onChange={handleTextChange}
            onKeyPress={handleKeyPress}
            disabled={isUploading}
          />
          
          {/* Image Preview */}
          {imagePreviewUrl && (
            <div className="absolute bottom-full left-0 mb-2 w-48 h-48 bg-white border border-gray-300 rounded-md overflow-hidden">
              <div className="relative w-full h-full">
                <img 
                  className="w-full h-full object-cover" 
                  src={imagePreviewUrl} 
                  alt="Preview" 
                />
                <button 
                  type="button" 
                  className="absolute top-1 right-1 bg-gray-800 bg-opacity-70 text-white rounded-full p-1"
                  onClick={removePreviewImage}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
        
        {/* Send Button */}
        <Button 
          className="flex items-center justify-center w-10 h-10 rounded-full p-0" 
          onClick={handleSendMessage}
          disabled={(!messageText.trim() && !imageFile) || isUploading}
        >
          <Send className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
}
