import { apiHandler } from "@/lib/api/handler";
import { created } from "@/lib/api/response";
import { AppError } from "@/lib/api/errors";
import { requireApiAuth } from "@/lib/permissions/guards";
import { messagingService } from "@/services/messaging.service";

export const dynamic = "force-dynamic";

export const POST = apiHandler(async (req, { params }) => {
  const actor = await requireApiAuth(req);
  const resolvedParams = await Promise.resolve(params);
  const id = resolvedParams.id;

  const formData = await req.formData();
  const file = formData.get("file") as File | null;

  if (!file || typeof file === "string") {
    throw AppError.badRequest("Please select a valid attachment file to upload.");
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const attachment = await messagingService.uploadAttachment(actor, id, {
    fileName: file.name,
    mimeType: file.type,
    buffer,
  });

  return created(attachment);
});

