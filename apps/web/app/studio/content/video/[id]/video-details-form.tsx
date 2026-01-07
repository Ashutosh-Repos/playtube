"use client";

import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { 
  Form, 
  FormControl, 
  FormDescription, 
  FormField, 
  FormItem, 
  FormLabel, 
  FormMessage 
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { 
  Loader2, 
  Save, 
  Copy, 
  Globe, 
  Lock, 
  EyeOff, 
  FileVideo,
  Settings2,
  Clapperboard,
  Layout,
  Clock,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  Languages,
  ShieldCheck,
  AppWindow,
  Zap,
  Youtube
} from "lucide-react";
import { VideoDetails } from "@repo/shared";
import { updateVideoAction, getCategoriesAction } from "@/app/actions/video";
import { toast } from "sonner";
import { useUploadStore } from "@/store/upload-store";
import { ThumbnailUpload } from "@/components/studio/thumbnail-upload";
import { TagsInput } from "@/components/studio/tags-input";
import { CardManager } from "@/components/studio/card-manager";
import { motion, AnimatePresence } from "framer-motion";

// Validation schema matching backend
const updateVideoSchema = z.object({
  title: z.string().min(1, "Title is required").max(100),
  description: z.string().max(5000).optional().nullable(),
  visibility: z.enum(["PUBLIC", "PRIVATE", "UNLISTED", "SCHEDULED"]),
  categoryId: z.string().optional().nullable(),
  language: z.string().max(10).optional().nullable(),
  tags: z.array(z.string()).optional(),
  thumbnailUrl: z.string().optional().nullable(),
  allowComments: z.boolean().optional(),
  allowEmbedding: z.boolean().optional(),
  isAgeRestricted: z.boolean().optional(),
  chapters: z.array(z.object({
    title: z.string().min(1),
    startTime: z.number().min(0)
  })).optional(),
  cards: z.array(z.object({
    type: z.enum(["VIDEO", "PLAYLIST", "CHANNEL", "LINK", "POLL"]),
    title: z.string().optional().nullable(),
    startTime: z.number().min(0),
    endTime: z.number().optional().nullable(),
    targetVideoId: z.string().optional().nullable(),
    targetPlaylistId: z.string().optional().nullable(),
    targetChannelId: z.string().optional().nullable(),
    targetUrl: z.string().optional().nullable(),
    pollOptions: z.array(z.string()).optional().nullable(),
  })).optional(),
});

interface Props {
  video: VideoDetails;
}

const LANGUAGES = [
    { label: "English", value: "en" },
    { label: "Hindi", value: "hi" },
    { label: "Spanish", value: "es" },
    { label: "French", value: "fr" },
    { label: "German", value: "de" },
    { label: "Japanese", value: "ja" },
];

export function VideoDetailsForm({ video }: Props) {
  const [isSaving, setIsSaving] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [categories, setCategories] = useState<any[]>([]);
  const [mounted, setMounted] = useState(false);
  const { uploads } = useUploadStore();
  
  const activeUpload = uploads[video.id];
  const status = activeUpload?.status || video.processingStatus.toLowerCase();
  const progress = activeUpload?.status === 'uploading' 
    ? activeUpload.progress 
    : (activeUpload?.processingProgress ?? video.processingProgress ?? 0);

  const form = useForm<z.infer<typeof updateVideoSchema>>({
    resolver: zodResolver(updateVideoSchema),
    defaultValues: {
      title: video.title,
      description: video.description || "",
      visibility: (video.visibility as any) || "PRIVATE",
      categoryId: video.category?.id || undefined,
      tags: video.tags || [],
      thumbnailUrl: video.thumbnailUrl,
      language: video.language || "en",
      allowComments: video.allowComments ?? true,
      allowEmbedding: video.allowEmbedding ?? true,
      isAgeRestricted: video.isAgeRestricted ?? false,
      chapters: (video.chapters as any) || [],
      cards: (video.cards as any) || [],
    },
  });

  useEffect(() => {
    setMounted(true);
    getCategoriesAction().then(res => res.success && setCategories(res.data));
  }, []);

  const onSubmit = async (data: z.infer<typeof updateVideoSchema>) => {
    setIsSaving(true);
    try {
      const res = await updateVideoAction(video.id, data);
      if (res.success) {
        toast.success("Changes saved");
      } else {
        toast.error(res.error || "Failed to save changes");
      }
    } catch (error) {
      toast.error("An error occurred");
    } finally {
      setIsSaving(false);
    }
  };

  const videoUrl = mounted ? `${window.location.origin}/watch/${video.id}` : '';
  const copyLink = () => {
    navigator.clipboard.writeText(videoUrl);
    toast.success("Link copied");
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="max-w-[1400px] mx-auto pb-40">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          
          <div className="lg:col-span-2 space-y-12">
            
            {/* 1. Basic Details */}
            <section className="space-y-4">
               <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-blue-500/10 rounded-xl">
                    <Settings2 className="h-5 w-5 text-blue-500" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black tracking-tight">Basic Details</h2>
                    <p className="text-xs text-muted-foreground">The essential information about your video.</p>
                  </div>
               </div>
               <Card className="border-none shadow-sm bg-white dark:bg-neutral-900 overflow-visible">
                 <CardContent className="p-8 space-y-8">
                    <FormField
                      control={form.control}
                      name="title"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-black uppercase text-muted-foreground ml-1">Title (required)</FormLabel>
                          <FormControl>
                            <Input placeholder="Add a catchy title..." {...field} className="py-7 text-xl font-bold bg-neutral-50 dark:bg-black/40 border-neutral-200 dark:border-neutral-800 transition-all focus:ring-2 focus:ring-blue-500/20" />
                          </FormControl>
                          <FormMessage />
                          <FormDescription className="text-right text-[10px]">{field.value.length}/100</FormDescription>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-black uppercase text-muted-foreground ml-1">Description</FormLabel>
                          <FormControl>
                            <Textarea 
                                placeholder="What is your video about?" 
                                className="min-h-[220px] bg-neutral-50 dark:bg-black/40 border-neutral-200 dark:border-neutral-800 leading-relaxed text-base resize-none" 
                                {...field} 
                                value={field.value || ""} 
                            />
                          </FormControl>
                          <FormMessage />
                          <FormDescription className="text-right text-[10px]">{(field.value?.length || 0)}/5000</FormDescription>
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <FormField
                            control={form.control}
                            name="categoryId"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-xs font-black uppercase text-muted-foreground ml-1">Category</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value || undefined}>
                                        <FormControl>
                                            <SelectTrigger className="h-12 bg-neutral-50 dark:bg-black/40 border-neutral-200 dark:border-neutral-800">
                                                <SelectValue placeholder="Select a category" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {categories.map(c => (
                                                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="tags"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-xs font-black uppercase text-muted-foreground ml-1">Tags</FormLabel>
                                    <FormControl>
                                        <TagsInput 
                                            value={field.value || []} 
                                            onChange={field.onChange}
                                            placeholder="Add tags..."
                                        />
                                    </FormControl>
                                </FormItem>
                            )}
                        />
                    </div>
                 </CardContent>
               </Card>
            </section>

            {/* 2. Custom Thumbnail */}
            <section className="space-y-4">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-emerald-500/10 rounded-xl">
                        <Layout className="h-5 w-5 text-emerald-500" />
                    </div>
                    <div>
                        <h2 className="text-xl font-black tracking-tight">Thumbnail</h2>
                        <p className="text-xs text-muted-foreground">The first thing viewers see.</p>
                    </div>
                </div>
                <Card className="border-none shadow-sm bg-white dark:bg-neutral-900">
                    <CardContent className="p-8">
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                            <FormField
                                control={form.control}
                                name="thumbnailUrl"
                                render={({ field }) => (
                                    <div className="col-span-1">
                                         <ThumbnailUpload 
                                            onUpload={(key) => field.onChange(key)} 
                                            currentUrl={field.value} 
                                            videoId={video.id}
                                        />
                                    </div>
                                )}
                            />
                            
                            {[1, 2, 3].map(i => (
                                <div key={i} className="aspect-video bg-neutral-50 dark:bg-black/40 rounded-xl flex items-center justify-center border-2 border-dashed border-neutral-200 dark:border-neutral-800 group hover:border-emerald-500/50 transition-all cursor-pointer">
                                    <Clapperboard className="h-8 w-8 text-neutral-200 dark:text-neutral-800 group-hover:scale-110 transition-transform duration-500" />
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </section>

            {/* 3. Chapters Manager */}
            <section className="space-y-4">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-orange-500/10 rounded-xl">
                        <Clock className="h-5 w-5 text-orange-500" />
                    </div>
                    <div>
                        <h2 className="text-xl font-black tracking-tight">Chapters</h2>
                        <p className="text-xs text-muted-foreground">Help viewers navigate your content.</p>
                    </div>
                </div>
                <Card className="border-none shadow-sm bg-white dark:bg-neutral-900">
                    <CardContent className="p-8">
                        <FormField
                            control={form.control}
                            name="chapters"
                            render={({ field }) => (
                                <div className="space-y-4">
                                    {(field.value || []).map((ch, idx) => (
                                        <motion.div 
                                            initial={{ opacity: 0, y: 5 }} 
                                            animate={{ opacity: 1, y: 0 }} 
                                            key={idx} 
                                            className="flex gap-4 items-center group"
                                        >
                                            <div className="h-10 w-10 shrink-0 flex items-center justify-center bg-neutral-100 dark:bg-neutral-800 rounded-lg text-xs font-bold text-neutral-400">
                                                {idx + 1}
                                            </div>
                                            <Input 
                                                placeholder="0:00" 
                                                className="w-28 font-mono text-center h-12 bg-neutral-50 dark:bg-black/40" 
                                                value={formatTime(ch.startTime)}
                                                onChange={(e) => {
                                                    const newVal = [...field.value!];
                                                    newVal[idx].startTime = parseTime(e.target.value);
                                                    field.onChange(newVal);
                                                }}
                                            />
                                            <Input 
                                                placeholder="Chapter Title" 
                                                value={ch.title}
                                                className="h-12 bg-neutral-50 dark:bg-black/40"
                                                onChange={(e) => {
                                                    const newVal = [...field.value!];
                                                    newVal[idx].title = e.target.value;
                                                    field.onChange(newVal);
                                                }}
                                            />
                                            <Button 
                                                type="button"
                                                variant="ghost" 
                                                size="icon"
                                                className="h-12 w-12 text-neutral-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-xl"
                                                onClick={() => field.onChange(field.value!.filter((_, i) => i !== idx))}
                                            >
                                                <Trash2 className="h-5 w-5" />
                                            </Button>
                                        </motion.div>
                                    ))}
                                    <Button 
                                        type="button" 
                                        variant="outline" 
                                        className="w-full h-14 border-dashed border-2 rounded-xl text-neutral-400 hover:text-orange-500 hover:border-orange-500/50 hover:bg-orange-500/5 transition-all text-sm font-bold"
                                        onClick={() => field.onChange([...(field.value || []), { title: "", startTime: 0 }])}
                                    >
                                        <Plus className="h-5 w-5 mr-2" />
                                        Add Chapter
                                    </Button>
                                </div>
                            )}
                        />
                    </CardContent>
                </Card>
            </section>

             {/* 4. Interactive Cards Manager */}
             <section className="space-y-4">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-indigo-500/10 rounded-xl">
                        <Zap className="h-5 w-5 text-indigo-500" />
                    </div>
                    <div>
                        <h2 className="text-xl font-black tracking-tight">Video Cards</h2>
                        <p className="text-xs text-muted-foreground">Interactive overlays (Max 5).</p>
                    </div>
                </div>
                <Card className="border-none shadow-sm bg-white dark:bg-neutral-900">
                    <CardContent className="p-8">
                        <FormField
                            control={form.control}
                            name="cards"
                            render={({ field }) => (
                                <CardManager 
                                    value={field.value || []} 
                                    onChange={field.onChange} 
                                    videoDuration={video.duration || 600} 
                                />
                            )}
                        />
                    </CardContent>
                </Card>
            </section>

            {/* 5. Advanced Settings (Foldable) */}
            <section className="space-y-4">
                <Button 
                    type="button"
                    variant="ghost" 
                    className="w-full flex items-center justify-between p-6 h-auto bg-neutral-100 dark:bg-neutral-800/50 rounded-2xl hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-all font-bold"
                    onClick={() => setShowAdvanced(!showAdvanced)}
                >
                    <div className="flex items-center gap-3">
                        <Languages className="h-5 w-5" />
                        <span>Advanced Settings</span>
                    </div>
                    {showAdvanced ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                </Button>
                
                <AnimatePresence>
                    {showAdvanced && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                        >
                            <Card className="border-none shadow-sm bg-white dark:bg-neutral-900 mt-2">
                                <CardContent className="p-8 space-y-8">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                        
                                        <div className="space-y-6">
                                            <FormField
                                                control={form.control}
                                                name="language"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <div className="flex items-center gap-2 mb-2">
                                                              <Languages className="h-4 w-4 text-neutral-400" />
                                                              <FormLabel className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Video Language</FormLabel>
                                                        </div>
                                                        <Select onValueChange={field.onChange} value={field.value || "en"}>
                                                            <FormControl>
                                                                <SelectTrigger className="h-12 bg-neutral-50 dark:bg-black/40">
                                                                    <SelectValue />
                                                                </SelectTrigger>
                                                            </FormControl>
                                                            <SelectContent>
                                                                {LANGUAGES.map(l => (
                                                                    <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </FormItem>
                                                )}
                                            />

                                             <FormField
                                                control={form.control}
                                                name="allowComments"
                                                render={({ field }) => (
                                                    <FormItem className="flex items-center justify-between p-4 bg-neutral-50 dark:bg-black/40 rounded-xl">
                                                        <div className="space-y-0.5">
                                                            <div className="flex items-center gap-2">
                                                                <Zap className="h-4 w-4 text-yellow-500" />
                                                                <FormLabel className="font-bold">Allow Comments</FormLabel>
                                                            </div>
                                                            <p className="text-[10px] text-muted-foreground">Viewers can comment on your video</p>
                                                        </div>
                                                        <FormControl>
                                                            <Switch 
                                                                checked={field.value} 
                                                                onCheckedChange={field.onChange} 
                                                            />
                                                        </FormControl>
                                                    </FormItem>
                                                )}
                                            />
                                        </div>

                                        <div className="space-y-6">
                                            <FormField
                                                control={form.control}
                                                name="allowEmbedding"
                                                render={({ field }) => (
                                                    <FormItem className="flex items-center justify-between p-4 bg-neutral-50 dark:bg-black/40 rounded-xl">
                                                        <div className="space-y-0.5">
                                                            <div className="flex items-center gap-2">
                                                                <AppWindow className="h-4 w-4 text-blue-500" />
                                                                <FormLabel className="font-bold">Allow Embedding</FormLabel>
                                                            </div>
                                                            <p className="text-[10px] text-muted-foreground">Let others embed yours on their sites</p>
                                                        </div>
                                                        <FormControl>
                                                            <Switch 
                                                                checked={field.value} 
                                                                onCheckedChange={field.onChange} 
                                                            />
                                                        </FormControl>
                                                    </FormItem>
                                                )}
                                            />

                                            <FormField
                                                control={form.control}
                                                name="isAgeRestricted"
                                                render={({ field }) => (
                                                    <FormItem className="flex items-center justify-between p-4 bg-neutral-50 dark:bg-black/40 rounded-xl">
                                                        <div className="space-y-0.5">
                                                            <div className="flex items-center gap-2">
                                                                <ShieldCheck className="h-4 w-4 text-red-500" />
                                                                <FormLabel className="font-bold">18+ Only</FormLabel>
                                                            </div>
                                                            <p className="text-[10px] text-muted-foreground">Apply age restriction to this video</p>
                                                        </div>
                                                        <FormControl>
                                                            <Switch 
                                                                checked={field.value} 
                                                                onCheckedChange={field.onChange} 
                                                            />
                                                        </FormControl>
                                                    </FormItem>
                                                )}
                                            />
                                        </div>

                                    </div>
                                </CardContent>
                            </Card>
                        </motion.div>
                    )}
                </AnimatePresence>
            </section>

          </div>

          {/* Sidebar Area */}
          <div className="space-y-8">
            <div className="sticky top-24 space-y-8">
                <Card className="overflow-hidden border-none shadow-2xl bg-white dark:bg-neutral-950 ring-1 ring-neutral-200 dark:ring-neutral-800">
                    <div className="aspect-video bg-black relative flex items-center justify-center group overflow-hidden">
                        {video.hlsPlaylistUrl ? (
                            <div className="absolute inset-0 flex items-center justify-center">
                                {/* Placeholder for Player */}
                                <Clapperboard className="h-16 w-16 text-white/5 animate-pulse" />
                            </div>
                        ) : (
                             <FileVideo className="h-16 w-16 text-white/5" />
                        )}
                        
                        <AnimatePresence>
                            {(status === 'uploading' || status === 'processing') && (
                                <motion.div 
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center text-white p-6 backdrop-blur-md"
                                >
                                    <div className="relative mb-6">
                                        <div className="h-16 w-16 rounded-full border-4 border-white/5 flex items-center justify-center">
                                            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                                        </div>
                                        <div className="absolute inset-0 flex items-center justify-center text-[10px] font-black">
                                            {Math.round(progress)}%
                                        </div>
                                    </div>
                                    <span className="text-[10px] font-black uppercase tracking-[0.2em] mb-4">{status}</span>
                                    <div className="w-full max-w-[140px] ">
                                        <Progress value={progress} className="h-1 bg-white/10 rounded-full" />
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Watch link overlay (if ready) */}
                        {status === 'completed' && (
                             <a 
                                href={videoUrl} 
                                target="_blank"
                                className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all duration-300 backdrop-blur-sm"
                             >
                                <div className="p-4 bg-white/10 rounded-2xl border border-white/20 text-white flex items-center gap-2 font-bold shadow-xl">
                                    <Zap className="h-5 w-5 fill-white" />
                                    View Live
                                </div>
                             </a>
                        )}
                    </div>

                    <CardContent className="p-8 space-y-8">
                        <div className="space-y-6">
                            <div>
                                <h4 className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-3">Video Link</h4>
                                <div className="flex items-center gap-3 p-4 rounded-xl bg-neutral-50 dark:bg-black/40 border border-neutral-100 dark:border-neutral-900">
                                    <span className="text-sm text-blue-500 truncate flex-1 font-mono">{videoUrl || 'Generating...'}</span>
                                    <Button type="button" variant="ghost" size="icon" className="h-9 w-9 text-neutral-400" onClick={copyLink}>
                                        <Copy className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                            
                            <Separator className="bg-neutral-100 dark:bg-neutral-900" />

                            <FormField
                                control={form.control}
                                name="visibility"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Visibility</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl>
                                                <SelectTrigger className="h-14 bg-neutral-50 dark:bg-black/40 border-neutral-100 dark:border-neutral-900 rounded-xl">
                                                    <SelectValue />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent className="rounded-xl border-neutral-200 dark:border-neutral-800">
                                                <SelectItem value="PUBLIC" className="rounded-lg p-3">
                                                    <div className="flex items-center gap-3">
                                                        <Globe className="h-4 w-4 text-green-500" />
                                                        <div className="flex flex-col gap-0.5">
                                                            <span className="font-bold text-sm">Public</span>
                                                            <span className="text-[10px] text-muted-foreground">Everyone can watch</span>
                                                        </div>
                                                    </div>
                                                </SelectItem>
                                                <SelectItem value="UNLISTED" className="rounded-lg p-3">
                                                    <div className="flex items-center gap-3">
                                                        <EyeOff className="h-4 w-4 text-orange-400" />
                                                        <div className="flex flex-col gap-0.5">
                                                            <span className="font-bold text-sm">Unlisted</span>
                                                            <span className="text-[10px] text-muted-foreground">Only those with link</span>
                                                        </div>
                                                    </div>
                                                </SelectItem>
                                                <SelectItem value="PRIVATE" className="rounded-lg p-3">
                                                    <div className="flex items-center gap-3">
                                                        <Lock className="h-4 w-4 text-neutral-400" />
                                                        <div className="flex flex-col gap-0.5">
                                                            <span className="font-bold text-sm">Private</span>
                                                            <span className="text-[10px] text-muted-foreground">Only you and selected</span>
                                                        </div>
                                                    </div>
                                                </SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </FormItem>
                                )}
                            />
                        </div>

                        <Button 
                            type="submit" 
                            className="w-full py-9 font-black text-lg bg-blue-600 hover:bg-blue-700 text-white shadow-2xl shadow-blue-500/30 rounded-2xl transition-all hover:scale-[1.02] active:scale-[0.98] relative overflow-hidden group" 
                            disabled={isSaving}
                        >
                            <div className="relative z-10 flex items-center justify-center gap-3">
                                {isSaving ? (
                                    <>
                                        <Loader2 className="h-6 w-6 animate-spin" />
                                        <span>Saving Details...</span>
                                    </>
                                ) : (
                                    <>
                                        <Zap className="h-6 w-6 fill-white" />
                                        <span>Save & Publish</span>
                                    </>
                                )}
                            </div>
                            <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                        </Button>
                        
                        <div className="flex items-center justify-center gap-2 text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                            <ShieldCheck className="h-3 w-3" />
                            All changes are encrypted
                        </div>
                    </CardContent>
                </Card>

                {/* Status Card (Footer mini) */}
                <div className="flex items-center gap-4 p-5 rounded-2xl bg-neutral-100/50 dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800">
                    <div className="p-3 bg-neutral-200 dark:bg-black/40 rounded-xl">
                        <Clapperboard className="h-5 w-5 opacity-40" />
                    </div>
                    <div className="flex-1">
                        <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Processing</p>
                        <p className="font-bold text-sm">4K Resolution Ready</p>
                    </div>
                    {status === 'completed' && <Zap className="h-5 w-5 text-yellow-500 fill-yellow-500 animate-pulse" />}
                </div>
            </div>
          </div>
        </div>
      </form>
    </Form>
  );
}

function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return "0:00";
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
