import { MessageWithUser } from "@shared/schema";
import { format } from "date-fns";
import { useState } from "react";

interface ChatBubbleProps {
  message: MessageWithUser;
  isCurrentUser: boolean;
}

export default function ChatBubble({ message, isCurrentUser }: ChatBubbleProps) {
  const formattedTime = format(new Date(message.timestamp), "h:mm a");
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  
  // Text-only message
  if (message.content && !message.imagePath) {
    return (
      <div className={`flex items-end ${isCurrentUser ? "justify-end" : "justify-start"} mb-2 md:mb-3`}>
        <div className={`flex flex-col space-y-1 ${isCurrentUser ? "items-end" : "items-start"} max-w-[75%] sm:max-w-[65%] md:max-w-xs`}>
          <div className={`px-3 py-2 rounded-2xl
            ${isCurrentUser 
              ? "rounded-br-none bg-primary text-white shadow-md" 
              : "rounded-bl-none bg-white text-gray-800 shadow-sm border border-gray-100"
            }`}>
            <p className="text-sm break-words whitespace-pre-wrap">{message.content}</p>
          </div>
          <span className="text-[10px] text-gray-500 leading-none px-1">{formattedTime}</span>
        </div>
      </div>
    );
  }
  
  // Image-only or image-with-text message
  if (message.imagePath) {
    return (
      <div className={`flex items-end ${isCurrentUser ? "justify-end" : "justify-start"} mb-2 md:mb-3`}>
        <div className={`flex flex-col space-y-1 ${isCurrentUser ? "items-end" : "items-start"} max-w-[75%] sm:max-w-[65%] md:max-w-xs`}>
          <div className={`rounded-2xl overflow-hidden
            ${isCurrentUser 
              ? "rounded-br-none bg-primary shadow-md" 
              : "rounded-bl-none bg-white shadow-sm border border-gray-100"
            }`}>
            <div className={`relative ${!imageLoaded && !imageError ? 'bg-neutral-medium animate-pulse' : ''}`}>
              <img 
                src={message.imagePath} 
                alt="Shared image" 
                className={`w-full h-auto object-contain rounded-t-2xl max-h-[300px]
                  ${imageLoaded ? 'opacity-100' : 'opacity-0'} 
                  transition-opacity duration-200`}
                onLoad={() => setImageLoaded(true)}
                onError={(e) => {
                  setImageError(true);
                  // Handle image load error with a more attractive fallback
                  (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9IiNmM2YzZjMiLz48dGV4dCB4PSI1MCUiIHk9IjUwJSIgZm9udC1zaXplPSIxNCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iIGZpbGw9IiM5OTk5OTkiIGZvbnQtZmFtaWx5PSJzYW5zLXNlcmlmIj5JbWFnZSBub3QgYXZhaWxhYmxlPC90ZXh0Pjwvc3ZnPg==';
                }}
              />
              
              {/* Loading placeholder */}
              {!imageLoaded && !imageError && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <svg className="animate-spin h-8 w-8 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                </div>
              )}
            </div>
            
            {message.content && (
              <div className={`p-3 ${isCurrentUser ? "text-white" : "text-gray-800"}`}>
                <p className="text-sm break-words whitespace-pre-wrap">{message.content}</p>
              </div>
            )}
          </div>
          <span className="text-[10px] text-gray-500 leading-none px-1">{formattedTime}</span>
        </div>
      </div>
    );
  }
  
  // Fallback for empty messages (shouldn't happen)
  return null;
}
