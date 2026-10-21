import { z } from "zod";

const identifier = z.string().trim().min(1).max(200);
const shortText = z.string().trim().max(160);
const identity = { name: shortText.optional(), email: shortText.optional() };
const owner = { site: identifier, visitor: identifier, conversation: identifier.optional() };

export const widgetMessageRequest = z.object({
  ...owner,
  id: identifier,
  body: z.string().trim().max(20_000).default(""),
  presetQuestion: z.string().trim().min(1).max(120).optional(),
  context: z.object({
    browser: shortText.optional(),
    os: shortText.optional(),
    device: shortText.optional(),
    timezone: shortText.optional(),
    page: z.string().max(2048).optional(),
  }).optional(),
  identity: z.object(identity).optional(),
  attachment: z.object({
    url: z.url({ protocol: /^https?$/ }).max(4096),
    name: shortText.optional(),
    size: shortText.optional(),
    type: z.enum(["image", "file"]).optional(),
  }).optional(),
}).refine((message) => Boolean(message.body || message.attachment), {
  message: "A message or attachment is required",
});

export const widgetStateRequest = z.discriminatedUnion("action", [
  z.object({ ...owner, action: z.literal("read") }),
  z.object({ ...owner, action: z.literal("new") }),
  z.object({ ...owner, action: z.literal("typing"), value: z.enum(["true", "false"]) }),
  z.object({ ...owner, action: z.literal("tag"), value: z.string().trim().min(1).max(40) }),
  z.object({ ...owner, action: z.literal("csat"), value: z.enum(["good", "bad"]), comment: shortText.optional() }),
  z.object({ ...owner, action: z.literal("identify"), ...identity })
    .refine((request) => Boolean(request.name || request.email), { message: "A name or email is required" }),
]);
