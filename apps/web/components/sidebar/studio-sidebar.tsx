"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  PlaySquare,
  BarChart2,
  MessageSquare,
  Copyright,
  DollarSign,
  Settings,
  PenTool,
  Upload,
  ListVideo,
  Menu,
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetHeader } from "@/components/ui/sheet";
import { useAuth } from "@/context/auth-context";

const sidebarItems = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/studio" },
  { icon: PlaySquare, label: "Content", href: "/studio/content" },
  { icon: ListVideo, label: "Playlists", href: "/studio/playlists" },
  { icon: Settings, label: "Settings", href: "/studio/settings" },
];

function SidebarContent({ onItemClick }: { onItemClick?: () => void }) {
  const pathname = usePathname();
  const { user } = useAuth();
  return (
    <>
      {/* Channel Summary (Top of Sidebar) */}
      {user && (
        <div className="p-6 flex flex-col items-center text-center border-b">
          <Avatar className="w-20 h-20 mb-4 border-2 border-border">
            <AvatarFallback>
                {user.email?.charAt(0).toUpperCase() ?? "U"}
              </AvatarFallback>
          </Avatar>
          <h3 className="font-semibold text-sm">Your Channel</h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-[150px] truncate">
            { "Creator"}
          </p>
        </div>
      )}

      {/* Nav Items */}
      <nav className="flex-1 overflow-y-auto py-2">
        <div className="px-2 space-y-1">
          {sidebarItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Button
                key={item.href}
                variant={isActive ? "secondary" : "ghost"}
                className={cn(
                  "w-full justify-start gap-4 px-6 h-12 rounded-none border-l-4",
                  isActive
                    ? "border-primary font-semibold text-primary bg-secondary/50"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
                asChild
                onClick={onItemClick}
              >
                <Link href={item.href}>
                  <item.icon className={cn("w-5 h-5", isActive ? "text-primary" : "text-muted-foreground")} />
                  {item.label}
                </Link>
              </Button>
            );
          })}
        </div>
      </nav>

      {/* Bottom Actions */}
      <div className="p-4 border-t">
        <Button variant="outline" className="w-full gap-2" asChild onClick={onItemClick}>
          <Link href="/studio/upload">
            <Upload className="w-4 h-4" /> Upload Video
          </Link>
        </Button>
      </div>
    </>
  );
}

// Mobile Menu Button (exported for use in layout)
export function StudioMobileMenuButton() {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden">
          <Menu className="h-5 w-5" />
          <span className="sr-only">Toggle menu</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="p-0 w-72">
        <SheetHeader className="sr-only">
          <SheetTitle>Studio Navigation</SheetTitle>
        </SheetHeader>
        <div className="flex flex-col h-full">
          <SidebarContent onItemClick={() => setOpen(false)} />
        </div>
      </SheetContent>
    </Sheet>
  );
}

// Desktop Sidebar
export function StudioSidebar() {
  return (
    <aside className="fixed left-0 top-16 bottom-0 w-64 border-r bg-background hidden md:flex flex-col z-30">
      <SidebarContent />
    </aside>
  );
}

