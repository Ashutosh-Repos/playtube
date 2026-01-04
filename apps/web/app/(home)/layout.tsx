import { SearchForm } from "@/components/search-form";
import { ModeToggle } from "@/components/theme-toogle";
import { TopBar } from "@/components/TopBar";
import { UserNav } from "@/components/user-nav";
import { IconLayoutDashboard, IconSettings, IconRadio, IconVideoPlusFilled, IconFlame, IconFlameFilled, IconHome, IconHomeFilled, IconHours12,IconBrandStripeFilled} from "@tabler/icons-react";
import { SideNav } from "@/components/navigation/sidenav";
export default function HomeLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const navItems = [
    { icon: IconHomeFilled, title: "Home", href: "/" },
    { icon: IconFlameFilled, title: "Trending", href: "/trending" },
    { icon: IconVideoPlusFilled, title: "Studio", href: "/studio" },
    { icon: IconBrandStripeFilled, title: "Subscription", href: "/subscription" },
  ];
  return (
    <div className="w-screen h-screen flex flex-col overflow-hidden">
      <TopBar>
        <SearchForm/>
        <ModeToggle/>
        <UserNav/>
      </TopBar>
      <div className="w-full h-full flex flex-col-reverse sm:flex-row items-center justify-center overflow-hidden">
       <SideNav navLinks={navItems}/>
       <div className="w-full h-full overflow-scroll">{children}</div>
      </div>
    </div>
  )
}