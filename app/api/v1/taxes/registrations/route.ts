import { apiHandler } from "@/lib/api/handler";
import { created, ok } from "@/lib/api/response";
import { requireApiAuth } from "@/lib/permissions/guards";
import { saveTaxRegistrationSchema } from "@/lib/validation/tax";
import { taxService } from "@/services/tax.service";

// POST /api/v1/taxes/registrations — save or update a tax registration
export const POST = apiHandler(async (req) => {
  const actor = await requireApiAuth(req);
  const json = await req.json();
  const input = saveTaxRegistrationSchema.parse(json);
  const registration = await taxService.saveTaxRegistration(actor, input);
  return created(registration);
});

