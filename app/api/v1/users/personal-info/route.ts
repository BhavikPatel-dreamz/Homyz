import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { AppError } from "@/lib/api/errors";
import { requireApiAuth } from "@/lib/permissions/guards";
import { personalInfoService } from "@/services/personal-info.service";
import {
  addressSchema,
  emergencyContactSchema,
  legalNameSchema,
  postalAddressSchema,
  preferredNameSchema,
  updateEmailSchema,
  updatePhoneSchema,
} from "@/lib/validation/personal-info";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const GET = apiHandler(async (req) => {
  const actor = await requireApiAuth(req);
  const data = await personalInfoService.getPersonalInfo(actor.id);
  const response = ok(data);
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  return response;
});

export const PATCH = apiHandler(async (req) => {
  const actor = await requireApiAuth(req);
  const body = await req.json();

  if (!body || typeof body !== "object") {
    throw AppError.badRequest("Invalid request body");
  }

  const { type, payload } = body;
  let result;

  switch (type) {
    case "legalName": {
      const parsed = legalNameSchema.parse(payload);
      result = await personalInfoService.updateLegalName(actor.id, parsed);
      break;
    }
    case "preferredName": {
      const parsed = preferredNameSchema.parse(payload);
      result = await personalInfoService.updatePreferredFirstName(actor.id, parsed);
      break;
    }
    case "email": {
      const parsed = updateEmailSchema.parse(payload);
      result = await personalInfoService.updateEmail(actor.id, parsed);
      break;
    }
    case "phone": {
      const parsed = updatePhoneSchema.parse(payload);
      result = await personalInfoService.updatePhone(actor.id, parsed);
      break;
    }
    case "residentialAddress": {
      const parsed = addressSchema.parse(payload);
      result = await personalInfoService.updateResidentialAddress(actor.id, parsed);
      break;
    }
    case "postalAddress": {
      const parsed = postalAddressSchema.parse(payload);
      result = await personalInfoService.updatePostalAddress(actor.id, parsed);
      break;
    }
    case "emergencyContact": {
      const parsed = emergencyContactSchema.parse(payload);
      result = await personalInfoService.updateEmergencyContact(actor.id, parsed);
      break;
    }
    default:
      throw AppError.badRequest(`Unknown update type: ${type}`);
  }

  return ok(result);
});
