import { ModeToggle } from "@/components/theme-toogle";
import { BackgroundBeamsWithCollision } from "@/components/ui/background-beams-with-collision";
import { BackgroundLines } from "@/components/ui/background-lines";
export default function AuthLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
     
      <BackgroundLines className="flex items-center justify-center flex-col px-4 w-screen h-screen">
        <div className="w-screen h-screen flex items-center justify-center">
            <div className="absolute top-2 right-2">
                <ModeToggle/>
            </div>
            {children}
        </div>
        </BackgroundLines>

    );
}