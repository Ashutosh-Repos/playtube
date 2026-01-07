"use client";

import { useState, useTransition, useEffect } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { createChannelAction, checkHandleAvailability } from "@/app/actions/channel";
import { useModal } from "@/components/ui/animated-modal";
import { useChannel } from "@/context/channel-context";
import { FileUploadInput } from "@/components/studio/file-upload-input";
import { useRouter } from "next/navigation";
import { Loader2, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";


const createChannelSchema = z.object({
  name: z.string().min(1, "Name is required").max(50),
  handle: z
    .string()
    .min(3, "Handle must be at least 3 characters")
    .max(30, "Handle must be less than 30 characters")
    .regex(/^[a-zA-Z0-9._]+$/, "Handle can only contain letters, numbers, underscores, and periods."),
  description: z.string().max(5000).optional(),
  image: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  bannerUrl: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  contactEmail: z.string().email("Must be a valid email").optional().or(z.literal("")),
  links: z
    .array(
      z.object({
        title: z.string().min(1, "Title is required").max(100),
        url: z.string().url("Must be a valid URL").max(2000),
      })
    )
    .max(20)
    .optional(),
});

type CreateChannelInput = z.infer<typeof createChannelSchema>;

const steps = [
  { title: "Basic Info", fields: ["name", "handle", "description"] },
  { title: "Branding", fields: ["image", "bannerUrl"] },
  { title: "Contact & Links", fields: ["contactEmail", "links"] },
] as const;

export function CreateChannelForm() {
  const [step, setStep] = useState(0);
  const [isPending, setIsPending] = useState(false);
  const { setOpen } = useModal();
  const { addChannel } = useChannel();
  const router = useRouter();

  // Handle availability state
  const [handleStatus, setHandleStatus] = useState<"idle" | "checking" | "available" | "taken" | "error">("idle");
  const [handleMessage, setHandleMessage] = useState("");

  const form = useForm<CreateChannelInput>({
    resolver: zodResolver(createChannelSchema),
    defaultValues: {
      name: "",
      handle: "",
      description: "",
      image: "",
      bannerUrl: "",
      contactEmail: "",
      links: [],
    },
    mode: "onChange",
  });

  const { control, trigger, handleSubmit, watch, setError, clearErrors } = form;
  const handleValue = watch("handle");

  const { fields, append, remove } = useFieldArray({
    control,
    name: "links",
  });

  // Debounced handle check
  useEffect(() => {
    const checkHandle = async () => {
      if (!handleValue || handleValue.length < 3) {
        setHandleStatus("idle");
        setHandleMessage("");
        return;
      }

      setHandleStatus("checking");
      
      try {
        const result = await checkHandleAvailability(handleValue);
        if (result.success) {
            // Need to cast or check refined type, usually 'available' or 'isAvailable' depending on service 
            // The lint error says type has 'available: boolean', so we use that.
            if ((result as any).available) {
                setHandleStatus("available");
                setHandleMessage("Handle is available");
                clearErrors("handle");
            } else {
                setHandleStatus("taken");
                setHandleMessage("This handle is already taken");
                setError("handle", { type: "manual", message: "This handle is already taken" });
            }
        } else {
             setHandleStatus("error");
             setHandleMessage("Could not check handle");
        }
      } catch (err) {
        setHandleStatus("error");
      }
    };

    const timer = setTimeout(checkHandle, 500);
    return () => clearTimeout(timer);
  }, [handleValue, setError, clearErrors]);


  async function next() {
    const fieldsToCheck = steps[step].fields as any;
    const valid = await trigger(fieldsToCheck);
    
    // Prevent moving forward if handle is taken in step 0
    if (step === 0 && handleStatus === "taken") {
        return;
    }

    if (!valid) return;
    setStep((s) => s + 1);
  }

  function back() {
    setStep((s) => s - 1);
  }

  async function onSubmit(values: CreateChannelInput) {
    // Prevent early submission if not on the last step (e.g. user pressed Enter)
    if (step < steps.length - 1) {
        next();
        return;
    }

    if (handleStatus === "taken" || handleStatus === "checking") return;

    setIsPending(true);
    try {
      const result = await createChannelAction(values);
      if (result.success) {
        // Success - Close modal and update switcher optimistically
        // No full page refresh needed as server revalidatePath handles next visit
        addChannel((result as any).data);
        setOpen(false);
      } else {
         const errorMsg = "error" in result ? result.error : "Failed to create channel";
         form.setError("root", { message: errorMsg });
      }
    } catch (err) {
      console.error(err);
      form.setError("root", { message: "Something went wrong" });
    } finally {
      setIsPending(false);
    }
  }

  return (
    <Form {...form}>
      <form 
        onSubmit={handleSubmit(onSubmit)} 
        className="space-y-6 max-w-xl mx-auto w-full"
        onKeyDown={(e) => {
          if (e.key === "Enter" && e.target instanceof HTMLElement && e.target.tagName !== "TEXTAREA") {
            e.preventDefault();
          }
        }}
      >
         <div className="mb-6">
            <h2 className="text-2xl font-bold tracking-tight text-neutral-800 dark:text-neutral-100">
            {steps[step].title}
            </h2>
            <p className="text-sm text-muted-foreground">
                Step {step + 1} of {steps.length}
            </p>
         </div>

        {/* STEP 1 */}
        {step === 0 && (
          <div className="space-y-4">
            <FormField
              control={control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Channel Name</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="My Awesome Channel" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={control}
              name="handle"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Handle</FormLabel>
                  <FormControl>
                    <div className="relative">
                        <Input 
                            {...field} 
                            placeholder="my_handle" 
                            className={cn(
                                handleStatus === "taken" && "border-red-500 focus-visible:ring-red-500",
                                handleStatus === "available" && "border-green-500 focus-visible:ring-green-500"
                            )}
                        />
                        <div className="absolute right-3 top-2.5">
                            {handleStatus === "checking" && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                            {handleStatus === "available" && <Check className="h-4 w-4 text-green-500" />}
                            {handleStatus === "taken" && <X className="h-4 w-4 text-red-500" />}
                        </div>
                    </div>
                  </FormControl>
                  <FormDescription>
                    {handleMessage && (
                        <span className={cn(
                            "text-xs",
                            handleStatus === "available" ? "text-green-500" : 
                            handleStatus === "taken" ? "text-red-500" : "text-muted-foreground"
                        )}>
                            {handleMessage}
                        </span>
                    )}
                    {!handleMessage && "Unique identifier for your channel"}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea 
                        {...field} 
                        placeholder="Tell viewers about your channel..." 
                        className="resize-none min-h-[100px]"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        )}

        {/* STEP 2 */}
        {step === 1 && (
          <div className="space-y-6">
            <FormField
              control={control}
              name="image"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <FileUploadInput 
                        value={field.value} 
                        onChange={field.onChange} 
                        type="channel-logo" 
                        label="Channel Logo"
                        aspectRatio={1} 
                    />
                  </FormControl>
                  <FormDescription>Recommended circular or square image (1:1).</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={control}
              name="bannerUrl"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                     <FileUploadInput 
                        value={field.value} 
                        onChange={field.onChange} 
                        type="channel-banner" 
                        label="Channel Banner"
                        exactDimensions={{ width: 2560, height: 1440 }}
                    />
                  </FormControl>
                  <FormDescription>Must be exactly 2560 x 1440 pixels.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        )}

        {/* STEP 3 */}
        {step === 2 && (
          <div className="space-y-4">
            <FormField
              control={control}
              name="contactEmail"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Contact Email</FormLabel>
                  <FormControl>
                    <Input {...field} type="email" placeholder="contact@example.com" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <FormLabel>Links</FormLabel>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => append({ title: "", url: "" })}
                >
                  Add Link
                </Button>
              </div>

              {fields.map((field, i) => (
                <div key={field.id} className="flex gap-2 items-start">
                  <FormField
                    control={control}
                    name={`links.${i}.title`}
                    render={({ field }) => (
                      <FormItem className="flex-1">
                        <FormControl>
                          <Input {...field} placeholder="Title (e.g. Website)" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={control}
                    name={`links.${i}.url`}
                    render={({ field }) => (
                      <FormItem className="grow-2 w-full"> 
                        <FormControl>
                          <Input {...field} placeholder="https://..." />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="button" variant="ghost" size="icon" onClick={() => remove(i)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              {fields.length === 0 && (
                  <p className="text-sm text-muted-foreground italic">No links added yet.</p>
              )}
            </div>
          </div>
        )}
        
        {form.formState.errors.root && (
            <div className="bg-red-50 text-red-500 p-3 rounded-md text-sm">
                {form.formState.errors.root.message}
            </div>
        )}

        {/* FOOTER */}
        <div className="flex justify-between pt-6 border-t mt-6">
          {step > 0 ? (
            <Button type="button" variant="outline" onClick={back}>
              Back
            </Button>
          ) : (
            <div /> // Spacer
          )}

          {step < steps.length - 1 ? (
            <Button type="button" onClick={next} disabled={handleStatus === "checking" || handleStatus === "taken"}>
              Next
            </Button>
          ) : (
            <Button type="submit" disabled={isPending || handleStatus === "taken" || handleStatus === "checking"}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Channel
            </Button>
          )}
        </div>
      </form>
    </Form>
  );
}
