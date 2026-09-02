"use client";

import { HomyzAuthForm, type HomyzAuthFormProps } from "@/components/forms/homyz-auth-form";

export function RegisterFormClient(props: HomyzAuthFormProps) {
  return <HomyzAuthForm {...props} />;
}
