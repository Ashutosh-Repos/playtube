

import { Button } from "@/components/ui/button";
import { IconBrandYoutubeFilled } from "@tabler/icons-react";
import Link from "next/link";
import {BackgroundLines} from "@/components/ui/background-lines";
import { ModeToggle } from "@/components/theme-toogle";
import { CardBody, CardContainer, CardItem } from "@/components/ui/3d-card";
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalTrigger,
} from "@/components/ui/animated-modal";
import { CreateChannelForm } from "@/components/studio/create-channel-form";
export function NoChannel() {
  return (
     <BackgroundLines className="flex items-center justify-center flex-col px-4 w-screen h-screen">
      <div className="absolute top-2 right-2">
        <ModeToggle/>
      </div>
      <Modal>
      <CardContainer>
        <CardBody className="bg-transparent relative group/card md:p-10 p-6 rounded-xl w-max h-max md:w-lg flex flex-col items-center text-center">
        <CardItem
          translateZ="0"
          className="absolute inset-0 w-full h-full backdrop-blur-[5px] rounded-xl -z-10"
        >
          <></>
        </CardItem>
          <CardItem translateZ="50" className="h-24 w-24 bg-primary/10 rounded-full flex items-center justify-center text-primary mb-4">
              <IconBrandYoutubeFilled className="h-12 w-12" />
          </CardItem>
          <CardItem translateZ="80" className="text-3xl font-bold tracking-tight">
            Welcome to Studio
          </CardItem>
          <CardItem translateZ="60" className="text-muted-foreground text-sm">
            You need a channel to upload videos, manage content, and view analytics. Create your first channel to get started.
          </CardItem>
          <CardItem translateZ="100" className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto pt-4">
              <ModalTrigger className="p-0 m-0">
                <div className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all bg-primary text-primary-foreground hover:bg-primary/90 h-9 px-4 py-2 border border-primary">Create Channel</div>
              </ModalTrigger> 
              <Link href="/" passHref>
                  <Button variant="outline" size="lg" className="w-full sm:w-auto">
                      Go to Home
                  </Button>
              </Link>
          </CardItem>
        </CardBody>
      </CardContainer>
      <ModalBody>
        <ModalContent>
          <CreateChannelForm/>
        </ModalContent>
      </ModalBody>
      </Modal>
    </BackgroundLines>
  );
}
