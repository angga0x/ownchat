import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { User } from "@shared/schema";
import UserList from "@/components/chat/user-list";
import ChatRoom from "@/components/chat/chat-room";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  const { user, logoutMutation } = useAuth();
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  
  // Fetch all users
  const { data: users = [], isLoading: isLoadingUsers } = useQuery<User[]>({
    queryKey: ["/api/users"],
    queryFn: async () => {
      const token = localStorage.getItem("token");
      if (!token) throw new Error("No authentication token");
      
      const res = await fetch("/api/users", {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      
      if (!res.ok) {
        throw new Error("Failed to fetch users");
      }
      
      return res.json();
    }
  });
  
  // Filter out current user from the list and sort by online status
  const filteredUsers = users
    .filter((u) => u.id !== user?.id)
    .sort((a, b) => {
      // Sort by online status first (online users first)
      if (a.online && !b.online) return -1;
      if (!a.online && b.online) return 1;
      // Then sort alphabetically by username
      return a.username.localeCompare(b.username);
    });
  
  // Handle user selection
  const handleSelectUser = (selectedUser: User) => {
    setSelectedUser(selectedUser);
  };
  
  // Handle logout
  const handleLogout = () => {
    logoutMutation.mutate();
  };
  
  // Get initials from username
  const getInitials = (username: string) => {
    if (!username) return '';
    const parts = username.replace('@', '').split(/[-_.\s]/);
    if (parts.length > 1) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return username.slice(0, 2).toUpperCase();
  };
  
  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 py-3 px-4 sm:px-6 flex items-center justify-between shadow-sm">
        <div className="flex items-center">
          <h1 className="text-xl font-semibold text-gray-800">TeleChat</h1>
        </div>
        <div className="flex items-center space-x-4">
          <div className="flex items-center">
            <span className="bg-green-500 rounded-full h-2 w-2 mr-2"></span>
            <span className="text-sm font-medium text-gray-700">
              @{user?.username}
            </span>
          </div>
          <Button variant="ghost" size="icon" onClick={handleLogout} disabled={logoutMutation.isPending}>
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* User List */}
        <UserList 
          users={filteredUsers} 
          isLoading={isLoadingUsers}
          selectedUser={selectedUser}
          onSelectUser={handleSelectUser}
          getInitials={getInitials}
        />
        
        {/* Chat Area */}
        <ChatRoom 
          selectedUser={selectedUser}
          currentUser={user}
          getInitials={getInitials}
        />
      </div>
    </div>
  );
}
