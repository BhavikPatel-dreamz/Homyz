import { useLanguage } from "@/lib/i18n/language-context";

interface AuthHeadingProps {
  onBack: () => void;
  title?: string;
  backAriaLabel?: string;
}

export function AuthHeading({ onBack, title, backAriaLabel }: AuthHeadingProps) {
  const { t } = useLanguage();
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-6 mb-2">
      <button
        type="button"
        onClick={onBack}
        className="w-8 h-8 rounded-full border border-[#727272] bg-[#F3F4F5] flex items-center justify-center text-[#1F1F1F] hover:bg-zinc-200 transition-colors cursor-pointer shrink-0 self-start sm:self-auto"
        aria-label={backAriaLabel || t("common_go_back", "Go back")}
      >
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="#1F1F1F" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polyline points="15 18 9 12 15 6" />
        </svg>
      </button>
      <h1 className="wrap-break-words">{title || t("auth_login_or_signup", "Log in or sign up")}</h1>
    </div>
  );
}
