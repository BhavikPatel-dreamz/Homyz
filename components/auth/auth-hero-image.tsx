import Image from "next/image";

interface AuthHeroImageProps {
  mobile?: boolean;
}

export function AuthHeroImage({ mobile = false }: AuthHeroImageProps) {
  return (
    <div className={mobile ? "w-full aspect-[4/4.5] max-h-[460px] relative overflow-hidden my-4 lg:hidden" : "hidden lg:block lg:w-1/2 xl:w-[619px] max-w-[619px] h-[520px] lg:h-[580px] xl:h-[714px] shrink-0 relative overflow-hidden"}>
      <Image src="/images/auth-traveler-water.jpg" alt="Homyz Traveler" fill priority sizes={mobile ? "(max-width: 1024px) 100vw, 500px" : "(min-width: 1280px) 619px, 50vw"} className="object-cover" />
    </div>
  );
}
