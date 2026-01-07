"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

const updateVideoSchema = z.object({
  title: z.string().min(1).max(100).optional(),
  description: z.string().max(5000).optional().nullable(),
  visibility: z.enum(["PUBLIC", "PRIVATE", "UNLISTED", "SCHEDULED"]).optional(),
  categoryId: z.string().optional().nullable(),
  language: z.string().max(10).optional().nullable(),
  tags: z.array(z.string()).optional(),
  thumbnailUrl: z.string().optional().nullable(), // Removed .url() validation as it might be a key
  allowComments: z.boolean().optional(),
  allowEmbedding: z.boolean().optional(),
  isAgeRestricted: z.boolean().optional(),
  isPremiere: z.boolean().optional(),
  scheduledAt: z.string().datetime().optional().nullable(),
  premiereStartsAt: z.string().datetime().optional().nullable(),
});

type FormValues = z.infer<typeof updateVideoSchema>;

export default function VideoUpdateForm({ video }: { video: any }) {
  console.log(video);
  const form = useForm<FormValues>({
    resolver: zodResolver(updateVideoSchema),
    defaultValues: {
      title: video.title,
      description: video.description,
      visibility: video.visibility,
      thumbnailUrl: video.thumbnailUrl,
      tags: video.tags ?? [],
      categoryId: video.categoryId,
      language: video.language,
      allowComments: video.allowComments,
      allowEmbedding: video.allowEmbedding,
      isAgeRestricted: video.isAgeRestricted,
      isPremiere: video.isPremiere,
      scheduledAt: video.scheduledAt,
      premiereStartsAt: video.premiereStartsAt,
    },
  });

  const visibility = form.watch("visibility");
  const isPremiere = form.watch("isPremiere");

  const onSubmit = async (values: FormValues) => {
    // PATCH-safe cleanup
    if (values.tags?.length === 0) delete values.tags;

    console.log("PATCH payload:", values);
    // await updateVideoAction(video.id, values);
  };

  return (  
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="grid grid-cols-1 lg:grid-cols-3 gap-6"
      >
        {/* LEFT – FORM */}
        <div className="lg:col-span-2 space-y-6">
          {/* TITLE */}
          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Title</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* DESCRIPTION */}
          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Description</FormLabel>
                <FormControl>
                  <Textarea
                    rows={6}
                    value={field.value ?? ""}
                    onChange={(e) =>
                      field.onChange(e.target.value || null)
                    }
                  />
                </FormControl>
              </FormItem>
            )}
          />

          {/* VISIBILITY */}
          <FormField
            control={form.control}
            name="visibility"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Visibility</FormLabel>
                <FormControl>
                  <select
                    {...field}
                    className="w-full border rounded-md px-3 py-2"
                  >
                    <option value="PUBLIC">Public</option>
                    <option value="UNLISTED">Unlisted</option>
                    <option value="PRIVATE">Private</option>
                    <option value="SCHEDULED">Scheduled</option>
                  </select>
                </FormControl>
              </FormItem>
            )}
          />

          {/* SCHEDULED PUBLISH */}
          {visibility === "SCHEDULED" && (
            <FormField
              control={form.control}
              name="scheduledAt"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Publish date</FormLabel>
                  <FormControl>
                    <Input
                      type="datetime-local"
                      value={field.value?.slice(0, 16) ?? ""}
                      onChange={(e) =>
                        field.onChange(e.target.value || null)
                      }
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          )}

          <Separator />

          {/* PREMIERE */}
          <FormField
            control={form.control}
            name="isPremiere"
            render={({ field }) => (
              <FormItem className="flex items-center justify-between">
                <FormLabel>Set as Premiere</FormLabel>
                <FormControl>
                  <Switch
                    checked={field.value ?? false}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
              </FormItem>
            )}
          />

          {isPremiere && (
            <FormField
              control={form.control}
              name="premiereStartsAt"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Premiere start time</FormLabel>
                  <FormControl>
                    <Input
                      type="datetime-local"
                      value={field.value?.slice(0, 16) ?? ""}
                      onChange={(e) =>
                        field.onChange(e.target.value || null)
                      }
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          )}

          <Separator />

          {/* TAGS */}
          <FormField
            control={form.control}
            name="tags"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tags</FormLabel>
                <FormControl>
                  <Input
                    placeholder="comma,separated,tags"
                    value={field.value?.join(",") ?? ""}
                    onChange={(e) =>
                      field.onChange(
                        e.target.value
                          .split(",")
                          .map((t) => t.trim())
                          .filter(Boolean)
                      )
                    }
                  />
                </FormControl>
              </FormItem>
            )}
          />

          <Separator />

          {/* TOGGLES */}
          {[
            ["allowComments", "Allow comments"],
            ["allowEmbedding", "Allow embedding"],
            ["isAgeRestricted", "Age restricted"],
          ].map(([name, label]) => (
            <FormField
              key={name}
              control={form.control}
              name={name as any}
              render={({ field }) => (
                <FormItem className="flex items-center justify-between">
                  <FormLabel>{label}</FormLabel>
                  <FormControl>
                    <Switch
                      checked={field.value ?? false}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          ))}

          <Button type="submit" className="w-fit">
            Save changes
          </Button>
        </div>

        {/* RIGHT – PREVIEW / META */}
        <div className="space-y-4 text-sm">
          <img
            src={video.thumbnailUrl}
            className="rounded-lg aspect-video object-cover"
          />

          <Separator />

          <div className="space-y-1">
            <div>Duration: {video.duration}s</div>
            <div>Resolution: {video.width}×{video.height}</div>
            <div>FPS: {video.fps}</div>
            <div>Status: {video.processingStatus}</div>
          </div>
        </div>
      </form>
    </Form>
  );
}
