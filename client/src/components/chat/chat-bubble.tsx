import { MessageWithUser } from "@shared/schema";
import { format } from "date-fns";

interface ChatBubbleProps {
  message: MessageWithUser;
  isCurrentUser: boolean;
}

export default function ChatBubble({ message, isCurrentUser }: ChatBubbleProps) {
  const formattedTime = format(new Date(message.timestamp), "h:mm a");
  
  // Text-only message
  if (message.content && !message.imagePath) {
    return (
      <div className={`flex items-end ${isCurrentUser ? "justify-end" : "mb-4"}`}>
        <div className={`flex flex-col space-y-2 max-w-xs mx-2 ${isCurrentUser ? "items-end" : "items-start"}`}>
          <div className={`px-4 py-2 rounded-lg ${
            isCurrentUser 
              ? "rounded-br-none bg-primary text-white chat-bubble-right" 
              : "rounded-bl-none bg-white text-gray-800 chat-bubble-left"
          } shadow-sm`}>
            <p className="text-sm">{message.content}</p>
          </div>
          <span className="text-xs text-gray-500 leading-none">{formattedTime}</span>
        </div>
      </div>
    );
  }
  
  // Image-only or image-with-text message
  if (message.imagePath) {
    return (
      <div className={`flex items-end ${isCurrentUser ? "justify-end" : "mb-4"}`}>
        <div className={`flex flex-col space-y-2 max-w-xs mx-2 ${isCurrentUser ? "items-end" : "items-start"}`}>
          <div className={`rounded-lg ${
            isCurrentUser 
              ? "rounded-br-none bg-primary chat-bubble-right" 
              : "rounded-bl-none bg-white chat-bubble-left"
          } shadow-sm overflow-hidden`}>
            <img 
              src={message.imagePath} 
              alt="Shared image" 
              className="w-full h-auto rounded-t-lg" 
              onError={(e) => {
                // Handle image load error
                (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9IiNlZWVlZWUiLz48dGV4dCB4PSI1MCUiIHk9IjUwJSIgZm9udC1zaXplPSIxNCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iIGZpbGw9IiM5OTk5OTkiPkltYWdlIGxvYWQgZXJyb3I8L3RleHQ+PC9zdmc+';
              }}
            />
            {message.content && (
              <div className={`p-3 ${isCurrentUser ? "text-white" : "text-gray-800"}`}>
                <p className="text-sm">{message.content}</p>
              </div>
            )}
          </div>
          <span className="text-xs text-gray-500 leading-none">{formattedTime}</span>
        </div>
      </div>
    );
  }
  
  // Fallback for empty messages (shouldn't happen)
  return null;
}
