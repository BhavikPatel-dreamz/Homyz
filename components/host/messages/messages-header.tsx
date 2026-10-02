"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";

const links = [
  { href: "/host/today", label: "Today" },
  { href: "/host/calendar", label: "Calendar" },
  { href: "/host/listings", label: "Listing" },
  { href: "/host/messages", label: "Messages" },
];

export function MessagesHeader() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const user = session?.user;
  return (
    <header className="sticky top-0 z-40 bg-white/95 text-[#1F1F1F] backdrop-blur">
      <div className="mx-auto flex h-[76px] w-full max-w-[1520px] items-center justify-between px-5 sm:px-6 lg:h-[88px]">
        <Link href="/" aria-label="Homyz home" className="shrink-0">
          <Image
            src="/images/brand/homyz-logo-dark-v1.svg"
            alt="Homyz"
            width={198}
            height={72}
            className="hidden h-[72px] w-[198px] sm:block"
            priority
          />
          <Image
            src="/images/brand/homyz-logo-dark-v2.svg"
            alt="Stay like a homie."
            width={200}
            height={53}
            className="h-auto w-[200px] sm:hidden"
            priority
          />
        </Link>
        <nav
          aria-label="Host navigation"
          className="hidden items-center gap-5 text-base text-[#727272] font-medium md:flex xl:gap-8"
        >
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={
                pathname === link.href
                  ? "font-medium text-rose-500 underline underline-offset-4"
                  : "transition-colors hover:text-zinc-950"
              }
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="hidden rounded-full bg-[#FCDF9C] px-4 py-2 text-sm font-medium transition-colors hover:bg-[#F7D37D] xl:block"
          >
            Switch to traveling
          </Link>
          {user?.image ? (
            <Link
              href="/profile"
              className="hidden overflow-hidden rounded-full md:block"
            >
              <Image
                src={user.image}
                alt={user.name || "Profile"}
                width={32}
                height={32}
                className="size-8 object-cover"
              />
            </Link>
          ) : null}
          <Link
            href="/profile"
            aria-label="Open menu"
            className="flex size-10 items-center justify-center rounded-full bg-zinc-100 transition-colors hover:bg-zinc-200"
          >
            <Image
              src="/images/icons/menu-icon.svg"
              alt=""
              width={18}
              height={16}
            />
          </Link>
        </div>
      </div>
    </header>
  );
}
