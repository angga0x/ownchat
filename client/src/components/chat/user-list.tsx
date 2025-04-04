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
    <div className="h-full w-full bg-white border-r border-gray-200 flex flex-col">
      {/* Search */}
      <div className="p-3 border-b border-gray-200">
        <div className="relative">
          <Input
            id="user-search"
            type="text"
            placeholder="Search users..."
            className="pl-10 py-2 h-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
        </div>
      </div>
      
      {/* User List */}
      <ScrollArea className="flex-1 overflow-y-auto">
        <div className="divide-y divide-gray-200">
          {isLoading ? (
            // Loading skeletons
            Array(5).fill(0).map((_, index) => (
              <div key={index} className="p-3 flex items-center space-x-3 animate-pulse">
                <Skeleton className="w-12 h-12 rounded-full" />
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-32" />
                </div>
              </div>
            ))
          ) : filteredUsers.length === 0 ? (
            // No users found
            <div className="p-8 text-center text-gray-500">
              No users found
            </div>
          ) : (
            // User list
            filteredUsers.map((user) => (
              <div
                key={user.id}
                className={`p-3 cursor-pointer flex items-center space-x-3 transition-all duration-150 active:bg-neutral-medium
                  ${selectedUser?.id === user.id 
                    ? "bg-neutral-light border-l-4 border-primary" 
                    : "hover:bg-neutral-light"
                  }`}
                onClick={() => onSelectUser(user)}
              >
                <div className="relative flex-shrink-0">
                  <div className={`w-12 h-12 ${getUserColor(user.username)} rounded-full flex items-center justify-center text-white font-medium shadow-sm`}>
                    <span>{getInitials(user.username)}</span>
                  </div>
                  <span className={`absolute bottom-0 right-0 ${user.online ? "bg-green-500" : "bg-gray-400"} h-3 w-3 rounded-full border-2 border-white shadow-sm`}></span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate">@{user.username}</p>
                  <p className="text-sm text-gray-500 truncate">
                    {user.online ? "Online" : "Offline"}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
