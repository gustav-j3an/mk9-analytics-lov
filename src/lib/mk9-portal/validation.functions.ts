import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { listVisitEvidencesLogic, processVisitEvidenceLogic } from "./validation.server";

export const listVisitEvidences = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => 
    z.object({
      status: z.enum(["PENDING", "APPROVED", "REJECTED"]).optional(),
      promoterId: z.string().uuid().optional(),
      industryId: z.string().uuid().optional(),
      storeId: z.string().uuid().optional(),
      page: z.number().default(0),
      limit: z.number().default(20),
    }).parse(data)
  )
  .handler(async ({ data }) => {
    return listVisitEvidencesLogic(data);
  });

export const processVisitEvidence = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z.object({
      evidenceId: z.string().uuid(),
      action: z.enum(["APPROVE", "REJECT"]),
      rejectionReason: z.string().optional(),
    }).parse(data)
  )
  .handler(async ({ data }) => {
    return processVisitEvidenceLogic(data);
  });
