"use client";

import { HomyzAuthForm, type HomyzAuthFormProps } from "@/components/forms/homyz-auth-form";

export function LoginFormClient(props: HomyzAuthFormProps) {
  return <HomyzAuthForm {...props} />;
}
