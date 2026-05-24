'use client';

import { useAppStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Bot,
  LayoutDashboard,
  Shield,
  LogOut,
  Moon,
  Sun,
} from "lucide-react";
import { useTheme } from "next-themes";

export function Navbar() {
  const {
    view,
    setView,
    isAuthenticated,
    user,
    setUser,
    setIsAuthenticated,
  } = useAppStore();
  const { theme, setTheme } = useTheme();

  const handleSignOut = () => {
    setUser(null);
    setIsAuthenticated(false);
    setView("landing");
    fetch("/api/auth/signout", { method: "POST" }).catch(() => {});
  };

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur-md">
        <div className="flex h-14 items-center px-4 md:px-6 max-w-7xl mx-auto">
          {/* Logo */}
          <button
            onClick={() => setView(isAuthenticated ? "dashboard" : "landing")}
            className="flex items-center gap-2 font-bold text-lg mr-4 hover:opacity-80 transition-opacity"
          >
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <span className="hidden sm:inline">AgentForge</span>
          </button>

          {/* Desktop nav */}
          {isAuthenticated && (
            <nav className="hidden md:flex items-center gap-1 flex-1">
              <Button
                variant={view === "dashboard" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setView("dashboard")}
                className="gap-1.5"
              >
                <LayoutDashboard className="w-4 h-4" />
                Dashboard
              </Button>
              {user?.role === "admin" && (
                <Button
                  variant={view === "admin" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setView("admin")}
                  className="gap-1.5"
                >
                  <Shield className="w-4 h-4" />
                  Admin
                </Button>
              )}
            </nav>
          )}

          <div className="flex-1 md:hidden" />

          {/* Right side */}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="h-9 w-9"
            >
              <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            </Button>

            {isAuthenticated ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="gap-2 h-9 px-2">
                    <Avatar className="h-7 w-7">
                      <AvatarFallback className="bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 text-xs">
                        {user?.name?.[0]?.toUpperCase() || "U"}
                      </AvatarFallback>
                    </Avatar>
                    <span className="hidden sm:inline text-sm font-medium">
                      {user?.name}
                    </span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem className="flex-col items-start">
                    <span className="font-medium">{user?.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {user?.email}
                    </span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setView("dashboard")}>
                    <LayoutDashboard className="w-4 h-4 mr-2" />
                    Dashboard
                  </DropdownMenuItem>
                  {user?.role === "admin" && (
                    <DropdownMenuItem onClick={() => setView("admin")}>
                      <Shield className="w-4 h-4 mr-2" />
                      Admin Panel
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
                    <LogOut className="w-4 h-4 mr-2" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
          </div>
        </div>
      </header>

      {/* Mobile bottom nav */}
      {isAuthenticated && (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background/95 backdrop-blur-md safe-area-bottom">
          <div className="flex items-center justify-around h-14">
            <Button
              variant={view === "dashboard" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setView("dashboard")}
              className="flex-col gap-0.5 h-auto py-1.5 px-3"
            >
              <LayoutDashboard className="w-5 h-5" />
              <span className="text-[10px]">Dashboard</span>
            </Button>
            {user?.role === "admin" && (
              <Button
                variant={view === "admin" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setView("admin")}
                className="flex-col gap-0.5 h-auto py-1.5 px-3"
              >
                <Shield className="w-5 h-5" />
                <span className="text-[10px]">Admin</span>
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSignOut}
              className="flex-col gap-0.5 h-auto py-1.5 px-3 text-destructive"
            >
              <LogOut className="w-5 h-5" />
              <span className="text-[10px]">Sign Out</span>
            </Button>
          </div>
        </nav>
      )}
    </>
  );
}
