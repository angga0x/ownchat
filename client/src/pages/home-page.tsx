import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { User } from "@shared/schema";
import UserList from "@/components/chat/user-list";
import ChatRoom from "@/components/chat/chat-room";
import { ArrowLeft, LogOut, Menu, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import { ThemeToggle } from "@/components/ui/theme-toggle";

export default function HomePage() {
  const { user, logoutMutation } = useAuth();
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showUserList, setShowUserList] = useState(true);
  const isMobile = useIsMobile();
  
  // Show/hide user list based on screen size and selection
  useEffect(() => {
    if (isMobile && selectedUser) {
      setShowUserList(false);
    } else if (!isMobile) {
      setShowUserList(true);
    }
  }, [selectedUser, isMobile]);
  
  // Reset selected user when going back to user list on mobile
  const handleBackToUserList = () => {
    if (isMobile) {
      setSelectedUser(null);
      setShowUserList(true);
    }
  };
  
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
    if (isMobile) {
      setShowUserList(false);
    }
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
    <div className="h-screen flex flex-col bg-background theme-transition">
      {/* Header */}
      <header className="bg-background border-b border-border py-3 px-4 sm:px-6 flex items-center justify-between shadow-sm z-10 theme-transition">
        <div className="flex items-center">
          {isMobile && selectedUser && !showUserList ? (
            <Button variant="ghost" size="icon" onClick={handleBackToUserList} className="mr-2">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          ) : (
            <div className="flex items-center">
              <h1 className="text-xl font-semibold text-foreground bg-clip-text bg-gradient-to-r from-primary to-primary/80">TeleChat</h1>
              {isMobile && (
                <Button variant="ghost" size="icon" onClick={() => setShowUserList(!showUserList)} className="ml-2">
                  <Users className="h-5 w-5" />
                </Button>
              )}
            </div>
          )}
        </div>
        {(!isMobile || (isMobile && !selectedUser)) && (
          <div className="flex items-center space-x-3">
            <div className="flex items-center">
              <span className="bg-green-500 rounded-full h-2 w-2 mr-2"></span>
              <span className="text-sm font-medium text-muted-foreground hidden sm:inline">
                @{user?.username}
              </span>
            </div>
            <ThemeToggle />
            <Button variant="ghost" size="icon" onClick={handleLogout} disabled={logoutMutation.isPending}>
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        )}
        {isMobile && selectedUser && !showUserList && (
          <div className="flex items-center space-x-3">
            <h2 className="font-medium text-foreground">@{selectedUser.username}</h2>
            <span className={`ml-2 ${selectedUser.online ? "bg-green-500" : "bg-muted"} h-2 w-2 rounded-full`}></span>
            <ThemeToggle />
          </div>
        )}
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* User List */}
        <div className={`${isMobile ? 'absolute inset-0 z-20 transition-transform duration-300 transform' : 'relative'} 
          ${(isMobile && !showUserList) ? '-translate-x-full' : 'translate-x-0'} 
          ${!isMobile ? 'w-full md:w-80 flex-shrink-0' : 'w-full'}`}>
          <UserList 
            users={filteredUsers} 
            isLoading={isLoadingUsers}
            selectedUser={selectedUser}
            onSelectUser={handleSelectUser}
            getInitials={getInitials}
          />
        </div>
        
        {/* Chat Area */}
        <div className={`${isMobile ? 'absolute inset-0 z-10 transition-transform duration-300 transform' : 'relative'} 
          ${(isMobile && showUserList) ? 'translate-x-full' : 'translate-x-0'} 
          ${!isMobile ? 'flex-1' : 'w-full'}`}>
          <ChatRoom 
            selectedUser={selectedUser}
            currentUser={user}
            getInitials={getInitials}
          />
        </div>
      </div>
    </div>
  );
}
