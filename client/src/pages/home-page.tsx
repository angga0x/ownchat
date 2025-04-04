import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { User } from "@shared/schema";
import UserList from "@/components/chat/user-list";
import ChatRoom from "@/components/chat/chat-room";
import { ArrowLeft, LogOut, Users, UserCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

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
      {/* Header - Facebook Messenger Style */}
      <header className="bg-white dark:bg-[#1e1e1e] border-b border-gray-200 dark:border-zinc-800 py-3 px-4 sm:px-6 flex items-center justify-between shadow-sm z-10 theme-transition">
        <div className="flex items-center">
          {isMobile && selectedUser && !showUserList ? (
            <Button variant="ghost" size="icon" onClick={handleBackToUserList} className="mr-2 text-gray-500 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800 hover:text-gray-700 dark:hover:text-zinc-200">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          ) : (
            <div className="flex items-center">
              <h1 className="text-xl font-bold text-messenger-blue">
                TeleChat
              </h1>
              {isMobile && (
                <Button variant="ghost" size="icon" onClick={() => setShowUserList(!showUserList)} className="ml-2 text-gray-500 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800 hover:text-gray-700 dark:hover:text-zinc-200">
                  <Users className="h-5 w-5" />
                </Button>
              )}
            </div>
          )}
        </div>
        {(!isMobile || (isMobile && !selectedUser)) && (
          <div className="flex items-center space-x-2">
            <div className="flex items-center">
              <Avatar className="h-9 w-9 border border-gray-200 dark:border-zinc-700 bg-gray-100 dark:bg-zinc-800">
                <AvatarFallback className="bg-gray-100 dark:bg-zinc-800 text-messenger-blue font-medium">
                  {getInitials(user?.username || '')}
                </AvatarFallback>
              </Avatar>
              <div className="ml-2 hidden sm:block">
                <p className="text-sm font-medium text-gray-900 dark:text-white">{user?.username}</p>
                <div className="flex items-center">
                  <span className="bg-green-500 rounded-full h-2 w-2 mr-1.5"></span>
                  <span className="text-xs text-gray-500 dark:text-zinc-400">Active now</span>
                </div>
              </div>
              <span className="ml-2 bg-green-500 rounded-full h-2 w-2 sm:hidden"></span>
            </div>
            <ThemeToggle />
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={handleLogout} 
              disabled={logoutMutation.isPending}
              className="rounded-full w-9 h-9 bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 text-gray-500 dark:text-zinc-400"
            >
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        )}
        {isMobile && selectedUser && !showUserList && (
          <div className="flex items-center space-x-2">
            <div className="flex items-center">
              <Avatar className="h-9 w-9 border border-gray-200 dark:border-zinc-700 bg-gray-100 dark:bg-zinc-800">
                <AvatarFallback className="bg-gray-100 dark:bg-zinc-800 text-messenger-blue font-medium">
                  {getInitials(selectedUser.username)}
                </AvatarFallback>
              </Avatar>
              <div className="ml-2">
                <p className="text-sm font-medium text-gray-900 dark:text-white">{selectedUser.username}</p>
                <div className="flex items-center">
                  <span className={`${selectedUser.online ? "bg-green-500" : "bg-gray-400 dark:bg-zinc-500"} rounded-full h-2 w-2 mr-1.5`}></span>
                  <span className="text-xs text-gray-500 dark:text-zinc-400">{selectedUser.online ? 'Active now' : 'Offline'}</span>
                </div>
              </div>
            </div>
            <ThemeToggle />
          </div>
        )}
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* User List */}
        <div className={`${isMobile ? 'absolute inset-0 z-20 transition-transform duration-300 transform' : 'relative'} 
          ${(isMobile && !showUserList) ? '-translate-x-full' : 'translate-x-0'} 
          ${!isMobile ? 'w-full md:w-80 lg:w-96 flex-shrink-0 border-r border-gray-200 dark:border-zinc-800' : 'w-full'}`}>
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
          ${!isMobile ? 'flex-1 mx-auto w-full max-w-screen-xl' : 'w-full'}`}>
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
