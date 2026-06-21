import { z } from "zod";

export const pricingFieldsSchema = z
  .object({
    input: z.number().min(0).optional(),
    output: z.number().min(0).optional(),
    cached: z.number().min(0).optional(),
    reasoning: z.number().min(0).optional(),
    cache_creation: z.number().min(0).optional(),
  })
  .strict();

export const updatePricingSchema = z.record(
  z.string().trim().min(1),
  z.record(z.string().trim().min(1), pricingFieldsSchema)
);

export const pricingSyncSourceSchema = z.enum(["litellm"]);

export const pricingSyncRequestSchema = z
  .object({
    sources: z.array(pricingSyncSourceSchema).min(1).optional(),
    dryRun: z.boolean().optional(),
  })
  .strict();
