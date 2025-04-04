import { createContext, ReactNode, useContext, useEffect } from "react";
import {
  useQuery,
  useMutation,
  UseMutationResult,
} from "@tanstack/react-query";
import { User as SelectUser } from "@shared/schema";
import { apiRequest, queryClient } from "../lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { setupSocket, disconnectSocket } from "@/lib/socket";
import { clearAllChatCaches } from "@/lib/chatCache";

type AuthContextType = {
  user: SelectUser | null;
  isLoading: boolean;
  error: Error | null;
  loginMutation: UseMutationResult<AuthResponse, Error, LoginData>;
  logoutMutation: UseMutationResult<void, Error, void>;
  registerMutation: UseMutationResult<AuthResponse, Error, RegisterData>;
};

type LoginData = {
  username: string;
  password: string;
};

type RegisterData = LoginData & {
  confirmPassword: string;
};

type AuthResponse = {
  user: SelectUser;
  token: string;
};

export const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();

  // Check for token in localStorage
  const token = localStorage.getItem("token");

  const {
    data: user,
    error,
    isLoading,
    refetch,
  } = useQuery<SelectUser | null>({
    queryKey: ["/api/user"],
    queryFn: async () => {
      if (!token) return null;
      
      try {
        const res = await fetch("/api/user", {
          headers: {
            "Authorization": `Bearer ${token}`
          }
        });
        
        if (!res.ok) {
          if (res.status === 401 || res.status === 403) {
            localStorage.removeItem("token");
            return null;
          }
          throw new Error("Failed to fetch user");
        }
        
        return await res.json();
      } catch (error) {
        console.error("Error fetching user:", error);
        return null;
      }
    },
    staleTime: Infinity,
  });

  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginData) => {
      const res = await apiRequest("POST", "/api/login", credentials);
      return await res.json();
    },
    onSuccess: (data: AuthResponse) => {
      // Store token in localStorage
      localStorage.setItem("token", data.token);
      
      // Update user in cache
      queryClient.setQueryData(["/api/user"], data.user);
      
      // Connect to WebSocket
      setupSocket(data.token);
      
      toast({
        title: "Login successful",
        description: `Welcome back, @${data.user.username}!`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Login failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (credentials: RegisterData) => {
      const { username, password } = credentials;
      const res = await apiRequest("POST", "/api/register", { username, password });
      return await res.json();
    },
    onSuccess: (data: AuthResponse) => {
      // Store token in localStorage
      localStorage.setItem("token", data.token);
      
      // Update user in cache
      queryClient.setQueryData(["/api/user"], data.user);
      
      // Connect to WebSocket
      setupSocket(data.token);
      
      toast({
        title: "Registration successful",
        description: `Welcome, @${data.user.username}!`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Registration failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      const token = localStorage.getItem("token");
      if (!token) return;
      
      await apiRequest("POST", "/api/logout", undefined, {
        "Authorization": `Bearer ${token}`
      });
    },
    onSuccess: () => {
      // Disconnect WebSocket
      disconnectSocket();
      
      // Remove token and user
      localStorage.removeItem("token");
      queryClient.setQueryData(["/api/user"], null);
      
      // Clear all chat message caches
      clearAllChatCaches();
      
      toast({
        title: "Logged out",
        description: "You have been logged out successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Logout failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Initialize WebSocket connection if token exists
  useEffect(() => {
    if (token && user) {
      setupSocket(token);
    }
    
    return () => {
      if (user) {
        disconnectSocket();
      }
    };
  }, [token, user]);

  return (
    <AuthContext.Provider
      value={{
        user: user || null,
        isLoading,
        error,
        loginMutation,
        logoutMutation,
        registerMutation,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
