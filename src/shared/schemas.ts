import { z } from "zod";

export const storyImageSchema = z.object({
  assetId: z.string().min(1).max(128),
  objectKey: z.string().min(1).max(512),
  contentType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  width: z.number().int().positive().max(12_000),
  height: z.number().int().positive().max(12_000),
  size: z.number().int().positive().max(10 * 1024 * 1024),
  caption: z.string().max(240).default(""),
  order: z.number().int().min(0).max(7),
});

export const draftInputSchema = z.object({
  title: z.string().trim().min(1).max(120),
  body: z.string().trim().min(1).max(20_000),
  anonymous: z.boolean().default(false),
  images: z.array(storyImageSchema).max(8).default([]),
});

export const reviewDecisionSchema = z.discriminatedUnion("decision", [
  z.object({
    decision: z.literal("approve"),
    reason: z.string().max(1_000).optional(),
  }),
  z.object({
    decision: z.literal("reject"),
    reason: z.string().trim().min(1).max(1_000),
  }),
]);

export const roleChangeSchema = z.object({
  role: z.enum(["USER", "STAFF", "ADMIN"]),
});

