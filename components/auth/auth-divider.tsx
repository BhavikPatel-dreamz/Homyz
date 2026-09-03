import Image from "next/image";

export function AuthDivider() {
  return (
    <div className="my-1 flex w-full items-center gap-3 sm:gap-4" role="separator" aria-label="or">
      <Image src="/auth-divider.svg" alt="" width={237} height={1} className="h-px min-w-0 flex-1" aria-hidden="true" />
      <span className="font-['Poppins'] text-[15px] font-normal leading-6 text-[#1F1F1F] sm:text-[16px]">or</span>
      <Image src="/auth-divider.svg" alt="" width={237} height={1} className="h-px min-w-0 flex-1" aria-hidden="true" />
    </div>
  );
}
