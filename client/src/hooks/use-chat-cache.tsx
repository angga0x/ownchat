import { useEffect, useState } from 'react';
import { MessageWithUser, User } from '@shared/schema';
import { apiRequest } from '@/lib/queryClient';
import { 
  getCachedMessages, 
  cacheMessages,
  addMessageToCache,
  clearChatCache,
  getLastCachedMessageId
} from '@/lib/chatCache';

interface UseChatCacheResult {
  messages: MessageWithUser[];
  isLoading: boolean;
  error: Error | null;
  fetchMessages: () => Promise<void>;
  addMessage: (message: MessageWithUser) => void;
  clearCache: () => void;
}

/**
 * Hook untuk mengelola pesan chat dengan caching
 * @param currentUser Pengguna yang sedang login
 * @param selectedUser Pengguna yang dipilih untuk chat
 * @returns Object berisi pesan-pesan dan fungsi untuk mengelolanya
 */
export function useChatCache(
  currentUser: User | null,
  selectedUser: User | null
): UseChatCacheResult {
  const [messages, setMessages] = useState<MessageWithUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Fungsi untuk mengambil pesan dari API
  const fetchFromAPI = async () => {
    if (!currentUser || !selectedUser) return [];
    
    try {
      const res = await apiRequest('GET', `/api/messages/${selectedUser.id}`);
      
      if (!res.ok) {
        throw new Error(`Failed to fetch messages: ${res.status}`);
      }
      
      const fetchedMessages: MessageWithUser[] = await res.json();
      
      // Simpan ke cache
      cacheMessages(currentUser.id, selectedUser.id, fetchedMessages);
      
      return fetchedMessages;
    } catch (err) {
      console.error('Error fetching messages:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch messages'));
      return [];
    }
  };

  // Fungsi utama untuk mendapatkan pesan
  const fetchMessages = async () => {
    if (!currentUser || !selectedUser) {
      setMessages([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Coba ambil dari cache dulu
      let messageData = getCachedMessages(currentUser.id, selectedUser.id);
      let fromCache = !!messageData;
      
      // Jika tidak ada di cache, ambil dari API
      if (!messageData) {
        messageData = await fetchFromAPI();
      }
      
      setMessages(messageData);
      
      // Jika data dari cache, ambil juga dari API untuk update cache dengan data terbaru
      // tapi hanya tampilkan jika ada pesan baru
      if (fromCache) {
        const lastCachedId = getLastCachedMessageId(currentUser.id, selectedUser.id);
        
        // Fetch dalam background untuk update cache
        fetchFromAPI().then(freshMessages => {
          // Jika ada pesan baru (ID lebih besar dari yang terakhir di cache)
          const hasNewMessages = freshMessages.some(msg => 
            lastCachedId === undefined || msg.id > lastCachedId
          );
          
          if (hasNewMessages) {
            setMessages(freshMessages);
          }
        }).catch(e => console.error('Background fetch error:', e));
      }
    } catch (err) {
      console.error('Error in useChatCache:', err);
      setError(err instanceof Error ? err : new Error('Failed to load messages'));
      
      // Fallback ke API jika cache gagal
      const apiMessages = await fetchFromAPI();
      setMessages(apiMessages);
    } finally {
      setIsLoading(false);
    }
  };

  // Fungsi untuk menambahkan pesan baru
  const addMessage = (message: MessageWithUser) => {
    if (!currentUser || !selectedUser) return;
    
    // Update state
    setMessages(prev => [...prev, message]);
    
    // Update cache
    addMessageToCache(currentUser.id, selectedUser.id, message);
  };

  // Fungsi untuk menghapus cache
  const clearCache = () => {
    if (!currentUser || !selectedUser) return;
    clearChatCache(currentUser.id, selectedUser.id);
  };

  // Load messages ketika user berubah
  useEffect(() => {
    fetchMessages();
  }, [selectedUser?.id, currentUser?.id]);

  return {
    messages,
    isLoading,
    error,
    fetchMessages,
    addMessage,
    clearCache
  };
}