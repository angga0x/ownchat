import { useState, useEffect } from 'react';
import { queryClient } from '@/lib/queryClient';

/**
 * A custom hook to track typing status updates
 * @param userId The ID of the user whose typing status we want to monitor
 * @returns A boolean indicating if the user is currently typing
 */
export function useTypingIndicator(userId: number): boolean {
  const [isTyping, setIsTyping] = useState(false);
  
  useEffect(() => {
    // Function to check the typing status
    const checkTypingStatus = () => {
      const typingKey = ['typing-status'];
      const typingStatus = queryClient.getQueryData<Record<number, boolean>>(typingKey) || {};
      setIsTyping(typingStatus[userId] || false);
    };
    
    // Check initially
    checkTypingStatus();
    
    // Set up interval to check typing status
    const interval = setInterval(checkTypingStatus, 500);
    
    // Create a subscription to query cache changes
    const unsubscribe = queryClient.getQueryCache().subscribe(() => {
      checkTypingStatus();
    });
    
    // Clean up
    return () => {
      clearInterval(interval);
      unsubscribe();
    };
  }, [userId]);
  
  return isTyping;
}