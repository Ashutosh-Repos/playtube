import { ModeToggle } from "@/components/theme-toogle";
import { TopBar } from "@/components/TopBar";
import { IconLayoutDashboardFilled, IconBrandYoutubeFilled, IconCoinRupeeFilled} from "@tabler/icons-react";
import { SideNav } from "@/components/navigation/sidenav";
import { ChannelProvider } from "@/context/channel-context";
import { getStudioBootstrap } from "./data";
import { NoChannel } from "./no-channel";
import { redirect } from "next/navigation";
import { StudioHeaderActions } from "@/components/studio/studio-header-actions";
import { UploadTray } from "@/components/studio/upload/upload-tray";

export default async function StudioLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const bootstrap = await getStudioBootstrap();

  if (!bootstrap) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p>Loading Studio...</p>
      </div>
    );
  }

  // Check if channel exists
  const hasChannel = !!bootstrap.activeChannel;

  if (!hasChannel) {
      return <NoChannel />;
  }

  const navItems = [
    { icon: IconLayoutDashboardFilled, title: "Dashboard", href: "/studio" },
    { icon: IconBrandYoutubeFilled, title: "Content", href: "/studio/content" },
    { icon: IconCoinRupeeFilled, title: "Earnings", href: "/studio/earnings" },
  ];
  
  return (
      <ChannelProvider 
        initialChannels={bootstrap.channels} 
        initialChannel={bootstrap.activeChannel}
      >
        <div className="w-screen h-screen flex flex-col overflow-hidden">
          <TopBar>
            <StudioHeaderActions />
            <ModeToggle/>
          </TopBar>
         <div className="w-full h-full flex flex-col-reverse sm:flex-row items-center justify-center overflow-hidden">
           <SideNav navLinks={navItems}/>
           <div className="w-full h-full overflow-scroll">{children}</div>
          </div>
          
          {/* Global Upload Tray */}
          <UploadTray />
        </div>
      </ChannelProvider>
  );
}
