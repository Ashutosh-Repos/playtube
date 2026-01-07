"use client";

import React from "react";
import { 
  Plus, 
  Trash2, 
  Youtube, 
  ListVideo, 
  User, 
  Link as LinkIcon, 
  BarChart3,
  Clock
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";

interface VideoCard {
  type: "VIDEO" | "PLAYLIST" | "CHANNEL" | "LINK" | "POLL";
  title?: string | null;
  startTime: number;
  endTime?: number | null;
  targetVideoId?: string | null;
  targetPlaylistId?: string | null;
  targetChannelId?: string | null;
  targetUrl?: string | null;
  pollOptions?: string[] | null;
}

interface CardManagerProps {
  value: VideoCard[];
  onChange: (cards: VideoCard[]) => void;
  videoDuration: number;
}

export function CardManager({ value, onChange, videoDuration }: CardManagerProps) {
  const addCard = () => {
    onChange([
      ...value,
      { type: "VIDEO", startTime: Math.floor(videoDuration * 0.8), title: "" }
    ]);
  };

  const removeCard = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  const updateCard = (index: number, updates: Partial<VideoCard>) => {
    const newVal = [...value];
    newVal[index] = { ...newVal[index], ...updates };
    onChange(newVal);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Add interactive elements to engage your viewers during the video.
        </p>
        <Button 
            type="button" 
            variant="outline" 
            size="sm" 
            onClick={addCard}
            disabled={value.length >= 5}
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Card
        </Button>
      </div>

      <AnimatePresence mode="popLayout">
        {value.length === 0 ? (
            <motion.div 
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }}
                className="py-12 border-2 border-dashed rounded-xl flex flex-col items-center justify-center text-neutral-400"
            >
                <div className="p-4 bg-neutral-100 dark:bg-neutral-800 rounded-full mb-4">
                    <Youtube className="h-8 w-8 opacity-20" />
                </div>
                <p className="text-sm font-medium">No cards added yet</p>
                <p className="text-xs">You can add up to 5 cards per video</p>
            </motion.div>
        ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {value.map((card, idx) => (
                    <motion.div
                        key={idx}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        layout
                    >
                        <Card className="overflow-hidden border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/30">
                            <CardContent className="p-4 space-y-4">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        <Badge variant="secondary" className="px-2 py-0 h-6">
                                            {getIcon(card.type)}
                                            <span className="ml-1.5 text-[10px] font-bold uppercase">{card.type}</span>
                                        </Badge>
                                        <span className="text-[10px] font-mono text-muted-foreground">#{idx + 1}</span>
                                    </div>
                                    <Button 
                                        type="button" 
                                        variant="ghost" 
                                        size="icon" 
                                        className="h-7 w-7 text-neutral-400 hover:text-red-500"
                                        onClick={() => removeCard(idx)}
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold uppercase text-muted-foreground ml-1">Type</label>
                                        <Select 
                                            value={card.type} 
                                            onValueChange={(val: any) => updateCard(idx, { type: val })}
                                        >
                                            <SelectTrigger className="h-9 text-xs bg-white dark:bg-neutral-950">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="VIDEO">Video</SelectItem>
                                                <SelectItem value="PLAYLIST">Playlist</SelectItem>
                                                <SelectItem value="CHANNEL">Channel</SelectItem>
                                                <SelectItem value="LINK">Link</SelectItem>
                                                <SelectItem value="POLL">Poll</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold uppercase text-muted-foreground ml-1">Start Time</label>
                                        <div className="relative">
                                            <Input 
                                                className="h-9 pl-8 font-mono text-xs bg-white dark:bg-neutral-950" 
                                                value={formatTime(card.startTime)}
                                                onChange={(e) => updateCard(idx, { startTime: parseTime(e.target.value) })}
                                            />
                                            <Clock className="absolute left-2.5 top-2.5 h-4 w-4 text-neutral-400" />
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold uppercase text-muted-foreground ml-1">Target / Content</label>
                                    <Input 
                                        placeholder={getPlaceholder(card.type)}
                                        className="h-9 text-xs bg-white dark:bg-neutral-950"
                                        value={card.targetVideoId || card.targetPlaylistId || card.targetChannelId || card.targetUrl || ""}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            const updates: any = {};
                                            if (card.type === 'VIDEO') updates.targetVideoId = val;
                                            else if (card.type === 'PLAYLIST') updates.targetPlaylistId = val;
                                            else if (card.type === 'CHANNEL') updates.targetChannelId = val;
                                            else if (card.type === 'LINK') updates.targetUrl = val;
                                            updateCard(idx, updates);
                                        }}
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold uppercase text-muted-foreground ml-1">Teaser Text (Optional)</label>
                                    <Input 
                                        placeholder="Add a custom teaser..."
                                        className="h-9 text-xs bg-white dark:bg-neutral-950"
                                        value={card.title || ""}
                                        onChange={(e) => updateCard(idx, { title: e.target.value })}
                                    />
                                </div>
                            </CardContent>
                        </Card>
                    </motion.div>
                ))}
            </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function getIcon(type: VideoCard["type"]) {
  switch (type) {
    case "VIDEO": return <Youtube className="h-3 w-3" />;
    case "PLAYLIST": return <ListVideo className="h-3 w-3" />;
    case "CHANNEL": return <User className="h-3 w-3" />;
    case "LINK": return <LinkIcon className="h-3 w-3" />;
    case "POLL": return <BarChart3 className="h-3 w-3" />;
  }
}

function getPlaceholder(type: VideoCard["type"]) {
    switch (type) {
      case "VIDEO": return "Video ID (e.g. vid-123)";
      case "PLAYLIST": return "Playlist ID";
      case "CHANNEL": return "Channel ID";
      case "LINK": return "https://...";
      case "POLL": return "Question for viewers";
      default: return "";
    }
}

function formatTime(seconds: number): string {
    if (isNaN(seconds)) return "0:00";
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m}:${s.toString().padStart(2, '0')}`;
}

function parseTime(str: string): number {
    if (!str) return 0;
    const parts = str.split(':').map(Number);
    if (parts.length === 3) return (parts[0] || 0) * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0);
    if (parts.length === 2) return (parts[0] || 0) * 60 + (parts[1] || 0);
    return parts[0] || 0;
}
