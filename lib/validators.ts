import { z } from "zod";

export const pinSchema = z.object({
  pin: z.string().regex(/^\d{4,8}$/, "PIN harus 4-8 digit angka"),
});

export const searchSchema = z.object({
  query: z.string().min(2).max(120),
});

export const activateSchema = z.object({
  placeId: z.string().min(1),
  businessName: z.string().min(1).max(200),
  businessAddress: z.string().max(300).optional().default(""),
  googleMapsUrl: z.string().url(),
  writeReviewUrl: z.string().url(),
});

export const generateCardsSchema = z.object({
  count: z.number().int().min(1).max(500),
});

export const cardActionSchema = z.object({
  action: z.enum(["disable", "enable", "reset", "reset-pin"]),
});
