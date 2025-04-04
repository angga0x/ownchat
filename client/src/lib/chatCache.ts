import { MessageWithUser } from "@shared/schema";

// Konstanta untuk local storage
const CACHE_PREFIX = 'chat_cache_';
const MAX_CACHED_MESSAGES = 100;
const CACHE_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 hari

interface CacheMetadata {
  timestamp: number;
  lastMessageId?: number;
}

interface CacheEntry {
  messages: MessageWithUser[];
  metadata: CacheMetadata;
}

/**
 * Menyimpan pesan-pesan chat ke local storage untuk room tertentu
 * @param userId ID pengguna yang sedang chat
 * @param receiverId ID penerima pesan
 * @param messages Daftar pesan yang akan disimpan
 */
export const cacheMessages = (userId: number, receiverId: number, messages: MessageWithUser[]): void => {
  try {
    // Ambil hanya MAX_CACHED_MESSAGES pesan terbaru
    const latestMessages = [...messages].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    ).slice(0, MAX_CACHED_MESSAGES);

    // Urutkan kembali berdasarkan timestamp (lama ke baru)
    const sortedMessages = latestMessages.sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    // Buat metadata cache
    const metadata: CacheMetadata = {
      timestamp: Date.now(),
      lastMessageId: sortedMessages.length > 0 
        ? sortedMessages[sortedMessages.length - 1].id 
        : undefined
    };

    // Buat entry cache
    const cacheEntry: CacheEntry = {
      messages: sortedMessages,
      metadata
    };

    // Simpan ke localStorage
    const cacheKey = getCacheKey(userId, receiverId);
    localStorage.setItem(cacheKey, JSON.stringify(cacheEntry));
  } catch (error) {
    console.error('Error caching messages:', error);
    // Jika terjadi error, hapus cache yang mungkin rusak
    clearChatCache(userId, receiverId);
  }
};

/**
 * Mengambil pesan-pesan chat dari local storage
 * @param userId ID pengguna yang sedang chat
 * @param receiverId ID penerima pesan
 * @returns Daftar pesan dari cache atau null jika tidak ditemukan
 */
export const getCachedMessages = (userId: number, receiverId: number): MessageWithUser[] | null => {
  try {
    const cacheKey = getCacheKey(userId, receiverId);
    const cachedData = localStorage.getItem(cacheKey);
    
    if (!cachedData) return null;
    
    const cacheEntry: CacheEntry = JSON.parse(cachedData);
    
    // Periksa apakah cache sudah kedaluwarsa
    if (Date.now() - cacheEntry.metadata.timestamp > CACHE_EXPIRY_MS) {
      // Cache sudah kedaluwarsa, hapus dan kembalikan null
      clearChatCache(userId, receiverId);
      return null;
    }
    
    return cacheEntry.messages;
  } catch (error) {
    console.error('Error getting cached messages:', error);
    // Jika terjadi error, hapus cache yang mungkin rusak
    clearChatCache(userId, receiverId);
    return null;
  }
};

/**
 * Menambahkan pesan baru ke cache yang sudah ada
 * @param userId ID pengguna yang sedang chat
 * @param receiverId ID penerima pesan
 * @param newMessage Pesan baru yang akan ditambahkan
 */
export const addMessageToCache = (userId: number, receiverId: number, newMessage: MessageWithUser): void => {
  try {
    const cachedMessages = getCachedMessages(userId, receiverId) || [];
    
    // Periksa apakah pesan sudah ada di cache (hindari duplikasi)
    const messageExists = cachedMessages.some(msg => msg.id === newMessage.id);
    if (messageExists) return;
    
    // Tambahkan pesan baru dan simpan kembali ke cache
    const updatedMessages = [...cachedMessages, newMessage];
    cacheMessages(userId, receiverId, updatedMessages);
  } catch (error) {
    console.error('Error adding message to cache:', error);
  }
};

/**
 * Menghapus cache pesan untuk room chat tertentu
 * @param userId ID pengguna yang sedang chat
 * @param receiverId ID penerima pesan
 */
export const clearChatCache = (userId: number, receiverId: number): void => {
  try {
    const cacheKey = getCacheKey(userId, receiverId);
    localStorage.removeItem(cacheKey);
  } catch (error) {
    console.error('Error clearing chat cache:', error);
  }
};

/**
 * Menghapus semua cache pesan chat
 */
export const clearAllChatCaches = (): void => {
  try {
    // Hapus semua item yang dimulai dengan CACHE_PREFIX
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith(CACHE_PREFIX)) {
        localStorage.removeItem(key);
      }
    });
  } catch (error) {
    console.error('Error clearing all chat caches:', error);
  }
};

/**
 * Mendapatkan ID terakhir dari pesan yang di-cache
 * @param userId ID pengguna yang sedang chat
 * @param receiverId ID penerima pesan
 * @returns ID pesan terakhir atau undefined jika tidak ada cache
 */
export const getLastCachedMessageId = (userId: number, receiverId: number): number | undefined => {
  try {
    const cacheKey = getCacheKey(userId, receiverId);
    const cachedData = localStorage.getItem(cacheKey);
    
    if (!cachedData) return undefined;
    
    const cacheEntry: CacheEntry = JSON.parse(cachedData);
    return cacheEntry.metadata.lastMessageId;
  } catch (error) {
    console.error('Error getting last cached message ID:', error);
    return undefined;
  }
};

/**
 * Update status pesan (delivered/read) dalam cache
 * @param messageId ID pesan yang akan diupdate
 * @param status Status baru 'delivered' atau 'read'
 */
export const updateMessageStatusInCache = (messageId: number, status: 'delivered' | 'read'): void => {
  try {
    // Cek semua cache yang mungkin berisi pesan ini
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith(CACHE_PREFIX)) {
        try {
          const cachedData = localStorage.getItem(key);
          if (!cachedData) return;
          
          const cacheEntry: CacheEntry = JSON.parse(cachedData);
          let updated = false;
          
          // Update status pesan jika ditemukan
          const updatedMessages = cacheEntry.messages.map(msg => {
            if (msg.id === messageId) {
              updated = true;
              if (status === 'delivered') {
                return { ...msg, delivered: true };
              } else if (status === 'read') {
                return { ...msg, delivered: true, read: true };
              }
            }
            return msg;
          });
          
          // Simpan kembali jika ada pembaruan
          if (updated) {
            cacheEntry.messages = updatedMessages;
            localStorage.setItem(key, JSON.stringify(cacheEntry));
          }
        } catch (e) {
          // Jika terjadi error pada satu cache, hapus saja cache tersebut
          localStorage.removeItem(key);
        }
      }
    });
  } catch (error) {
    console.error('Error updating message status in cache:', error);
  }
};

/**
 * Menghasilkan key unik untuk menyimpan cache di localStorage
 */
function getCacheKey(userId: number, receiverId: number): string {
  // Pastikan ID selalu diurutkan agar conversation yang sama memiliki kunci yang sama 
  // terlepas dari siapa yang memulai percakapan
  const ids = [userId, receiverId].sort((a, b) => a - b);
  return `${CACHE_PREFIX}${ids[0]}_${ids[1]}`;
}