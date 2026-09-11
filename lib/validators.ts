import { z } from "zod";

export const pinSchema = z.object({
  pin: z.string().regex(/^\d{4,8}$/, "PIN harus 4-8 digit angka"),
});

export const mapsLinkSchema = z.object({
  link: z.string().min(5).max(2000),
});

export const activateSchema = z.object({
  businessId: z.string().min(1),
  businessName: z.string().min(1).max(200),
  googleMapsUrl: z.string().url(),
  writeReviewUrl: z.string().url(),
});

export const generateCardsSchema = z.object({
  count: z.number().int().min(1).max(500),
});

export const cardActionSchema = z.object({
  action: z.enum(["disable", "enable", "reset", "reset-pin"]),
});
