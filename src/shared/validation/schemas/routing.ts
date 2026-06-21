import { z } from "zod";

import { modelIdSchema, jsonObjectSchema, resetStatsActionSchema } from "./misc.ts";

export const updateModelAliasSchema = z.object({
  model: modelIdSchema,
  alias: z.string().trim().min(1, "Alias is required").max(200),
});

export const intelligenceSyncRequestSchema = z
  .object({
    dryRun: z.boolean().optional(),
  })
  .strict();

export const taskRoutingModelMapSchema = z
  .object({
    coding: z.string().max(200).optional(),
    creative: z.string().max(200).optional(),
    analysis: z.string().max(200).optional(),
    vision: z.string().max(200).optional(),
    summarization: z.string().max(200).optional(),
    background: z.string().max(200).optional(),
    chat: z.string().max(200).optional(),
  })
  .strict();

export const updateTaskRoutingSchema = z
  .object({
    enabled: z.boolean().optional(),
    taskModelMap: taskRoutingModelMapSchema.optional(),
    detectionEnabled: z.boolean().optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (
      value.enabled === undefined &&
      value.taskModelMap === undefined &&
      value.detectionEnabled === undefined
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "No valid fields to update",
        path: [],
      });
    }
  });

export const taskRoutingActionSchema = z.discriminatedUnion("action", [
  resetStatsActionSchema,
  z
    .object({
      action: z.literal("detect"),
      body: jsonObjectSchema.optional(),
    })
    .strict(),
]);
