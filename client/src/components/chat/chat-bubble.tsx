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
  
  // Facebook Messenger style read/delivered indicators
  const ReadIndicator = () => (
    <span className="text-[10px] leading-none flex items-center">
      {message.read ? (
        // Blue filled circle for read (Messenger style)
        <svg width="14" height="14" viewBox="0 0 16 16" className="text-messenger-blue" fill="currentColor">
          <path d="M8 16A8 8 0 1 1 8 0a8 8 0 0 1 0 16zM5 7.8l2 2.2 4-4.2 1 1L7 12 4 9l1-1.2z"/>
        </svg>
      ) : message.delivered ? (
        // Gray filled circle for delivered
        <svg width="14" height="14" viewBox="0 0 16 16" className="text-muted-foreground" fill="currentColor">
          <path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0zm-3-5.5l-8 8-2-2L4 10l2 2 9-9-2-1.5z"/>
        </svg>
      ) : (
        // Clock icon for sent but not delivered
        <svg width="14" height="14" viewBox="0 0 24 24" className="text-muted-foreground/60" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 6v6l4 2" />
        </svg>
      )}
    </span>
  );
  
  // Text-only message
  if (message.content && !message.imagePath) {
    return (
      <div className={`flex items-end ${isCurrentUser ? "justify-end" : "justify-start"} mb-1.5 md:mb-2 bubble-appear`}>
        <div className={`flex flex-col space-y-1 ${isCurrentUser ? "items-end" : "items-start"} max-w-[75%] sm:max-w-[65%] md:max-w-xs`}>
          <div className={`px-3 py-2 
            ${isCurrentUser 
              ? "messenger-bubble-sent rounded-t-[20px] rounded-bl-[20px] rounded-br-[4px]" 
              : "messenger-bubble-received rounded-t-[20px] rounded-br-[20px] rounded-bl-[4px]"
            }`}>
            <p className={`text-sm break-words whitespace-pre-wrap ${isCurrentUser ? "text-white" : "text-foreground"}`}>{message.content}</p>
          </div>
          <div className="flex items-center px-1 space-x-1">
            <span className="text-[10px] text-muted-foreground leading-none">{formattedTime}</span>
            {isCurrentUser && <ReadIndicator />}
          </div>
        </div>
      </div>
    );
  }
  
  // Image-only or image-with-text message
  if (message.imagePath) {
    return (
      <div className={`flex items-end ${isCurrentUser ? "justify-end" : "justify-start"} mb-1.5 md:mb-2 bubble-appear`}>
        <div className={`flex flex-col space-y-1 ${isCurrentUser ? "items-end" : "items-start"} max-w-[75%] sm:max-w-[65%] md:max-w-xs`}>
          <div className={`overflow-hidden
            ${isCurrentUser 
              ? "messenger-bubble-sent rounded-t-[20px] rounded-bl-[20px] rounded-br-[4px]" 
              : "messenger-bubble-received rounded-t-[20px] rounded-br-[20px] rounded-bl-[4px]"
            }`}>
            <div className={`relative ${!imageLoaded && !imageError ? 'bg-muted animate-pulse' : ''}`}>
              <img 
                src={message.imagePath} 
                alt="Shared image" 
                className={`w-full h-auto object-contain max-h-[300px]
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
                  <svg className="animate-spin h-8 w-8 text-muted-foreground" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                </div>
              )}
            </div>
            
            {message.content && (
              <div className={`p-3 ${isCurrentUser ? "text-white" : "text-foreground"}`}>
                <p className="text-sm break-words whitespace-pre-wrap">{message.content}</p>
              </div>
            )}
          </div>
          <div className="flex items-center px-1 space-x-1">
            <span className="text-[10px] text-muted-foreground leading-none">{formattedTime}</span>
            {isCurrentUser && <ReadIndicator />}
          </div>
        </div>
      </div>
    );
  }
  
  // Fallback for empty messages (shouldn't happen)
  return null;
}
