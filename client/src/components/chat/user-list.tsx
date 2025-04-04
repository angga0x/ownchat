import { useState, useEffect } from "react";
import { User } from "@shared/schema";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useIsMobile } from "@/hooks/use-mobile";

interface UserListProps {
  users: User[];
  isLoading: boolean;
  selectedUser: User | null;
  onSelectUser: (user: User) => void;
  getInitials: (username: string) => string;
}

export default function UserList({ 
  users, 
  isLoading, 
  selectedUser, 
  onSelectUser,
  getInitials 
}: UserListProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const isMobile = useIsMobile();
  
  // Filter users based on search query
  const filteredUsers = users.filter(user => 
    user.username.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
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
  
  // Auto-focus search input on desktop but not on mobile (to prevent virtual keyboard from popping up)
  useEffect(() => {
    if (!isMobile) {
      const searchInput = document.getElementById('user-search');
      if (searchInput) {
        searchInput.focus();
      }
    }
  }, [isMobile]);
  
  return (
    <div className="h-full w-full bg-white dark:bg-[#1e1e1e] border-r border-gray-200 dark:border-zinc-800 flex flex-col theme-transition messenger-sidebar">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-zinc-800 flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-800 dark:text-white">Chats</h1>
        <div className="flex space-x-2">
          <button className="w-9 h-9 rounded-full bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 flex items-center justify-center text-gray-600 dark:text-zinc-400 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          </button>
          <button className="w-9 h-9 rounded-full bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 flex items-center justify-center text-gray-600 dark:text-zinc-400 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM12.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM18.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
            </svg>
          </button>
        </div>
      </div>
      
      {/* Tabs - Facebook Messenger Style */}
      <div className="flex border-b border-gray-200 dark:border-zinc-800">
        <button className="flex-1 py-3 text-sm font-medium text-gray-800 dark:text-white messenger-active-tab">
          Inbox
        </button>
        <button className="flex-1 py-3 text-sm font-medium text-gray-500 dark:text-zinc-400">
          Communities
        </button>
        <button className="flex-1 py-3 text-sm font-medium text-gray-500 dark:text-zinc-400">
          Archive
        </button>
      </div>
      
      {/* Search */}
      <div className="p-3">
        <div className="relative">
          <Input
            id="user-search"
            type="text"
            placeholder="Search in Messenger"
            className="pl-10 py-2 h-10 bg-gray-100 dark:bg-zinc-800 border-0 text-gray-700 dark:text-zinc-200 rounded-full focus-visible:ring-1 focus-visible:ring-messenger-blue"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-500 dark:text-zinc-400" />
          </div>
        </div>
      </div>
      
      {/* User List */}
      <ScrollArea className="flex-1 overflow-y-auto">
        <div className="p-2 space-y-1">
          {isLoading ? (
            // Loading skeletons
            Array(5).fill(0).map((_, index) => (
              <div key={index} className="p-3 flex items-center space-x-3 animate-pulse">
                <Skeleton className="w-12 h-12 rounded-full bg-gray-200 dark:bg-zinc-800" />
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-4 w-24 bg-gray-200 dark:bg-zinc-800" />
                  <Skeleton className="h-3 w-32 bg-gray-200 dark:bg-zinc-800" />
                </div>
              </div>
            ))
          ) : filteredUsers.length === 0 ? (
            // No users found
            <div className="p-8 text-center">
              <div className="w-16 h-16 bg-gray-100 dark:bg-zinc-800 rounded-full mx-auto flex items-center justify-center mb-3">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 text-gray-500 dark:text-zinc-500">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18 12H6" />
                </svg>
              </div>
              <p className="text-gray-800 dark:text-white text-sm font-medium">No results found</p>
              <p className="text-gray-500 dark:text-zinc-400 text-xs mt-1">Try a different search term</p>
            </div>
          ) : (
            // User list
            filteredUsers.map((user) => (
              <div
                key={user.id}
                className={`messenger-user-item ${selectedUser?.id === user.id ? "active" : ""}`}
                onClick={() => onSelectUser(user)}
              >
                <div className="relative flex-shrink-0">
                  <div className={`w-12 h-12 ${getUserColor(user.username)} rounded-full flex items-center justify-center text-white font-medium shadow-sm`}>
                    <span>{getInitials(user.username)}</span>
                  </div>
                  <span className={`absolute bottom-0 right-0 ${user.online ? "bg-green-500" : "bg-zinc-500"} h-3 w-3 rounded-full border-2 ${user.online ? "border-white dark:border-[#1e1e1e]" : "border-white dark:border-[#1e1e1e]"} shadow-sm`}></span>
                </div>
                <div className="flex-1 min-w-0 ml-3">
                  <p className="font-medium text-gray-800 dark:text-white truncate">{user.username}</p>
                  <p className="text-sm text-gray-500 dark:text-zinc-400 truncate">
                    {user.online ? "Active now" : "Offline"}
                  </p>
                </div>
                <div className="flex-shrink-0 flex flex-col items-end">
                  <div className="text-xs text-gray-500 dark:text-zinc-500">2m</div>
                  {/* <div className="h-5 w-5 rounded-full bg-messenger-blue flex items-center justify-center text-[10px] font-bold mt-1 text-white">
                    3
                  </div> */}
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
