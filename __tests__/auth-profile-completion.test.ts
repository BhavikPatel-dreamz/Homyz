import assert from "node:assert/strict";

import {
  getMissingProfileFields,
  isRegistrationProfileComplete,
} from "../lib/auth/profile-completion";
import { completeRegistrationProfileSchema } from "../lib/validation/user";

function run() {
  assert.deepEqual(
    getMissingProfileFields({
      name: null,
      birthDate: null,
      email: null,
      phone: "+919876543210",
    }),
    ["name", "birthDate", "email"],
    "new mobile registration asks for name, birth date, and email",
  );

  assert.deepEqual(
    getMissingProfileFields({
      name: "Asha Kumar",
      birthDate: null,
      email: "asha@example.com",
      phone: null,
    }),
    ["birthDate", "phone"],
    "new email registration asks for birth date and mobile number",
  );

  assert.deepEqual(
    getMissingProfileFields({
      name: "Guest (3210)",
      birthDate: null,
      email: "user_919876543210@homyz.app",
      phone: "+919876543210",
    }),
    ["name", "birthDate", "email"],
    "legacy phone-signup placeholders remain incomplete",
  );

  assert.equal(
    isRegistrationProfileComplete({
      name: "Asha Kumar",
      birthDate: new Date("1994-06-15T00:00:00.000Z"),
      email: "asha@example.com",
      phone: "+919876543210",
    }),
    true,
    "a fully populated valid profile does not reopen the modal",
  );

  assert.equal(
    completeRegistrationProfileSchema.safeParse({
      name: "Asha Kumar",
      birthDate: "1994-06-15",
      email: "asha@example.com",
      phone: "+919876543210",
    }).success,
    true,
    "valid completion payload passes validation",
  );

  assert.equal(
    completeRegistrationProfileSchema.safeParse({
      name: "A",
      birthDate: "2099-02-31",
      email: "invalid",
      phone: "123",
    }).success,
    false,
    "invalid required fields are rejected",
  );

  console.log("Authentication profile-completion checks passed.");
}

run();
