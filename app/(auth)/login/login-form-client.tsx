"use client";

import dynamic from "next/dynamic";
import type { HomyzAuthFormProps } from "@/components/forms/homyz-auth-form";

const HomyzAuthForm = dynamic(
  () =>
    import("@/components/forms/homyz-auth-form").then((m) => ({
      default: m.HomyzAuthForm,
    })),
  {
    ssr: false,
    loading: () => <div className="min-h-screen bg-white" />,
  }
);

export function LoginFormClient(props: HomyzAuthFormProps) {
  return <HomyzAuthForm {...props} />;
}
