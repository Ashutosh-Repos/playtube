"use client"
import { DropdownMenu } from "@/components/ui/dropdown-menu";
import { Check, ChevronsDown, ChevronsUpDown, Plus } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { useState } from "react";
import { useChannel } from "@/context/channel-context";
import { CreateChannelForm } from "@/components/studio/create-channel-form";
import { Modal, ModalBody, ModalContent } from "@/components/ui/animated-modal";
import Image from "next/image";
import { IconCaretDownFilled } from "@tabler/icons-react";

export function ChannelSwitcher() {
    const { channels, currentChannel, isLoading, switchChannel } = useChannel();
    const [open, setOpen] = useState(false);
    const [isCreateChannelOpen, setCreateChannelOpen] = useState(false);
    const [value, setValue] = useState(currentChannel?.id || "");

    if (isLoading) {
        return <div>Loading...</div>
    }

    const currentChannelData = channels.find((channel) => channel.id === value);

    return (
        <>
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild className="border rounded-full p-0">
                    <Button
                        variant="ghost"
                        role="combobox"
                        aria-expanded={open}
                        className="w-max flex items-center justify-between p-0 rounded-full m-0"
                        style={{padding: "0.4rem"}}
                    >
                        {value && currentChannelData
                            ? (
                            <div className="flex items-center">
                                {currentChannelData.image ? (
                                    <Image 
                                        src={currentChannelData.image} 
                                        alt="Channel Logo" 
                                        width={24} 
                                        height={24} 
                                        className="rounded-full mr-2"
                                        unoptimized
                                    />
                                ) : (
                                    <div className="w-6 h-6 rounded-full bg-neutral-200 dark:bg-neutral-800 flex items-center justify-center mr-2">
                                        <span className="text-xs font-bold">{currentChannelData.name.charAt(0).toUpperCase()}</span>
                                    </div>
                                )}
                                <span className="text-sm font-medium">{currentChannelData.name}</span>
                            </div>
                            )
                            : "Select Channel..."}
                        <IconCaretDownFilled className="opacity-50 ml-2 h-4 w-4" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-max p-0">
                    <Command className="rounded-xl">
                        <CommandInput placeholder="Search your channel..." className="h-9" />
                        <CommandList>
                            <CommandEmpty>No channel found.</CommandEmpty>
                            <CommandGroup>
                                {channels.map((channel) => (
                                    <CommandItem
                                        key={channel.id}
                                        value={channel.name}
                                        onSelect={() => {
                                        if (currentChannel && currentChannel.id !== channel.id) {
                                            setValue(channel.id);
                                            setOpen(false);
                                            switchChannel(channel.id);
                                        }
                                    }}
                                    >
                                        <div className="flex items-center w-full">
                                            {channel.image ? (
                                    <Image 
                                        src={channel.image} 
                                        alt="Channel Logo" 
                                        width={24} 
                                        height={24} 
                                        className="rounded-full mr-2"
                                        unoptimized
                                    />
                                ) : (
                                    <div className="w-6 h-6 rounded-full bg-neutral-200 dark:bg-neutral-800 flex items-center justify-center mr-2">
                                        <span className="text-xs font-bold">{channel.name.charAt(0).toUpperCase()}</span>
                                    </div>
                                )}
                                            <span className="truncate">{channel.name}</span>
                                            <Check
                                                className={cn(
                                                        "ml-auto h-4 w-4",
                                                        value === channel.id ? "opacity-100" : "opacity-0"
                                                )}
                                            />
                                        </div>
                                    </CommandItem>
                                ))}
                                <CommandItem 
                                    key="create" 
                                    onSelect={() => {
                                        setOpen(false);
                                        setCreateChannelOpen(true);
                                    }}
                                    className="cursor-pointer text-primary"
                                >
                                    <div className="flex items-center gap-2">
                                        <Plus className="h-4 w-4"/>
                                        <span>Create Channel</span>
                                    </div>
                                </CommandItem>
                            </CommandGroup>
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>

            <Modal open={isCreateChannelOpen} setOpen={setCreateChannelOpen}>
                <ModalBody>
                    <ModalContent className="overflow-y-auto max-h-[85vh]">
                        <CreateChannelForm />
                    </ModalContent>
                </ModalBody>
            </Modal>
        </>
    );
}