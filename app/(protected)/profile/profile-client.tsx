"use client";

import React, { useState, useTransition, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { updateProfileAction } from "@/actions/user/updateProfile";
import { changePasswordAction } from "@/actions/user/changePassword";
import { Alert } from "@/components/ui";
import { LogoutButton } from "@/components/admin/logout-button";

export type PublicProfileData = {
  whereIWantToGo?: string;
  myWork?: string;
  spendTooMuchTime?: string;
  pets?: string;
  decadeBorn?: string;
  school?: string;
  uselessSkill?: string;
  funFact?: string;
  favoriteSong?: string;
  languages?: string;
  obsessedWith?: string;
  bioTitle?: string;
  whereILive?: string;
  bio?: string;
  stampsVisible?: boolean;
};

type ProfileData = {
  id: string;
  name: string | null;
  phone: string | null;
  image: string | null;
  email: string | null;
  publicProfile?: PublicProfileData | null;
};

type ProfileClientProps = {
  initial: ProfileData;
};

// Precise circular sprig icon matching reference design
const IconSprig = () => (
  <div className="w-8 h-8 rounded-full border border-zinc-200 flex items-center justify-center shrink-0 bg-white shadow-2xs">
    <svg className="w-4 h-4 text-zinc-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 21V9" />
      <path d="M12 13C9 13 7 10.5 7 7.5C9.5 7.5 12 9.5 12 13Z" />
      <path d="M12 11C15 11 17 8.5 17 5.5C14.5 5.5 12 7.5 12 11Z" />
      <circle cx="12" cy="4.5" r="1" fill="currentColor" />
    </svg>
  </div>
);

// Hand-drawn Paris Eiffel Tower Stamp
function StampParis() {
  return (
    <div className="flex flex-col items-center shrink-0">
      <div className="relative w-40 h-40 flex items-center justify-center">
        <svg className="w-full h-full" viewBox="0 0 160 160">
          <circle cx="80" cy="88" r="54" fill="#FDE8EB" stroke="#A1A1AA" strokeWidth="1" strokeDasharray="3 3" />
          <path id="parisArc" d="M 28,68 A 62,62 0 0,1 132,68" fill="none" />
          <text className="text-[13px] fill-zinc-800" style={{ fontFamily: 'Georgia, serif', italic: 'true' }}>
            <textPath href="#parisArc" startOffset="50%" textAnchor="middle">
              stay like a homie.
            </textPath>
          </text>
          <g stroke="#27272A" strokeWidth="1.75" fill="none" strokeLinecap="round" strokeLinejoin="round">
            <line x1="80" y1="34" x2="80" y2="48" />
            <circle cx="80" cy="33" r="1.5" fill="#27272A" />
            <polygon points="76,48 84,48 82,72 78,72" />
            <line x1="74" y1="72" x2="86" y2="72" />
            <polygon points="76,72 84,72 87,105 73,105" />
            <line x1="70" y1="105" x2="90" y2="105" />
            <line x1="75" y1="88" x2="85" y2="88" />
            <path d="M 73,105 L 63,142" />
            <path d="M 87,105 L 97,142" />
            <path d="M 69,142 C 72,120 88,120 91,142" />
            <line x1="58" y1="142" x2="102" y2="142" />
          </g>
        </svg>
      </div>
      <span className="text-base font-serif italic text-zinc-800 mt-1">Paris</span>
    </div>
  );
}

// Hand-drawn Coffee Moka Pot Stamp
function StampCoffee() {
  return (
    <div className="flex flex-col items-center shrink-0">
      <div className="relative w-40 h-40 flex items-center justify-center">
        <svg className="w-full h-full" viewBox="0 0 160 160">
          <circle cx="80" cy="88" r="54" fill="#EEF2FF" stroke="#A1A1AA" strokeWidth="1" strokeDasharray="3 3" />
          <path id="coffeeArc" d="M 28,68 A 62,62 0 0,1 132,68" fill="none" />
          <text className="text-[13px] fill-zinc-800" style={{ fontFamily: 'Georgia, serif', italic: 'true' }}>
            <textPath href="#coffeeArc" startOffset="50%" textAnchor="middle">
              stay like a homie.
            </textPath>
          </text>
          <g stroke="#27272A" strokeWidth="1.75" fill="none" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="80" cy="48" r="3" fill="#27272A" />
            <path d="M 68,62 L 80,51 L 92,62 Z" />
            <polygon points="68,62 92,62 88,92 72,92" />
            <line x1="66" y1="92" x2="94" y2="92" />
            <line x1="66" y1="96" x2="94" y2="96" />
            <polygon points="72,96 88,96 92,134 68,134" />
            <path d="M 92,68 C 108,70 108,110 90,115" />
            <path d="M 68,66 L 58,76 L 68,84" />
            <line x1="65" y1="134" x2="95" y2="134" />
          </g>
        </svg>
      </div>
      <span className="text-base font-serif italic text-zinc-800 mt-1">Coffee</span>
    </div>
  );
}

// Sidebar Navigation Icons
const IconUpcomingTrips = () => <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 19V5C4 3.89543 4.89543 3 6 3H14L20 9V19C20 20.1046 19.1046 21 18 21H6C4.89543 21 4 20.1046 4 19Z"/><path d="M14 3V9H20"/></svg>;
const IconPastBookings = () => <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z"/><path d="M12 6V12L16 14"/></svg>;
const IconWallet = () => <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M22 12V18C22 19.1046 21.1046 20 20 20H4C2.89543 20 2 19.1046 2 18V6C2 4.89543 2.89543 4 4 4H18"/><path d="M18 4V12H22V4H18Z"/><circle cx="20" cy="8" r="1"/></svg>;
const IconInvite = () => <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M18 8C19.6569 8 21 6.65685 21 5C21 3.34315 19.6569 2 18 2C16.3431 2 15 3.34315 15 5C15 6.65685 16.3431 8 18 8Z"/><path d="M6 15C7.65685 15 9 13.6569 9 12C9 10.3431 7.65685 9 6 9C4.34315 9 3 10.3431 3 12C3 13.6569 4.34315 15 6 15Z"/><path d="M15 6.5L9 10.5"/><path d="M15 17.5L9 13.5"/><path d="M18 22C19.6569 22 21 20.6569 21 19C21 17.3431 19.6569 16 18 16C16.3431 16 15 17.3431 15 19C15 20.6569 16.3431 22 18 22Z"/></svg>;
const IconSaved = () => <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 21.35L10.55 20.03C5.4 15.36 2 12.27 2 8.5C2 5.41 4.42 3 7.5 3C9.24 3 10.91 3.81 12 5.08C13.09 3.81 14.76 3 16.5 3C19.58 3 22 5.41 22 8.5C22 12.27 18.6 15.36 13.45 20.03L12 21.35Z"/></svg>;
const IconProfile = () => <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 12C14.7614 12 17 9.76142 17 7C17 4.23858 14.7614 2 12 2C9.23858 2 7 4.23858 7 7C7 9.76142 9.23858 12 12 12Z"/><path d="M2.92993 20.0001C3.39993 16.5201 6.37993 13.8001 9.99993 13.8001H13.9999C17.6199 13.8001 20.5999 16.5201 21.0699 20.0001"/></svg>;
const IconSupport = () => <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 11.5C21 16.75 16.5 21 12 21C10.5 21 9.1 20.6 7.9 19.9L3 21L4.1 16.1C3.4 14.9 3 13.5 3 12C3 6.75 7.5 2.5 12 2.5C16.5 2.5 21 6.75 21 11.5Z"/><circle cx="12" cy="12" r="1"/><circle cx="16" cy="12" r="1"/><circle cx="8" cy="12" r="1"/></svg>;
const IconNotification = () => <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M15 17H20L18.5951 15.5951C18.2141 15.2141 18 14.6973 18 14.1585V11C18 8.38757 16.3304 6.16509 14 5.34142V5C14 3.89543 13.1046 3 12 3C10.8954 3 10 3.89543 10 5V5.34142C7.66962 6.16509 6 8.38757 6 11V14.1585C6 14.6973 5.78595 15.2141 5.40493 15.5951L4 17H9M15 17V18C15 19.6569 13.6569 21 12 21C10.3431 21 9 19.6569 9 18V17M15 17H9"/></svg>;

const TABS = [
  { id: "about", label: "About me", icon: IconProfile },
  { id: "upcoming_trips", label: "Upcoming Trips", icon: IconUpcomingTrips },
  { id: "past_bookings", label: "Past Bookings", icon: IconPastBookings },
  { id: "loyalty", label: "Loyalty Points Wallet", icon: IconWallet },
  { id: "invite", label: "Invite & Earn", icon: IconInvite },
  { id: "saved", label: "Saved Listings", icon: IconSaved },
  { id: "management", label: "Profile Management", icon: IconProfile },
  { id: "support", label: "Support / Chat with Agent", icon: IconSupport },
  { id: "notifications", label: "Notifications", icon: IconNotification },
];

export function ProfileClient({ initial }: ProfileClientProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("about");
  const [isEditing, setIsEditing] = useState(true);
  const [mobileHub, setMobileHub] = useState(false);

  const [profileData, setProfileData] = useState<ProfileData>(initial);

  const openTab = (tabId: string) => {
    setActiveTab(tabId);
    setIsEditing(true);
    setMobileHub(false);
  };
  
  const goBackToHub = () => {
    setMobileHub(true);
    setIsEditing(false);
  };

  const handleProfileUpdated = (updated: ProfileData) => {
    setProfileData(updated);
    router.refresh();
  };

  return (
    <div className="w-full bg-white min-h-[85vh] flex flex-col font-sans" suppressHydrationWarning>
      <div className="mx-auto w-full max-w-[1280px] flex-1 flex flex-col md:flex-row md:py-10 md:px-8">
        
        {/* DESKTOP SIDEBAR */}
        <aside className="hidden md:flex flex-col w-72 pr-8 shrink-0 border-r border-zinc-100">
          <h1 className="text-3xl font-bold text-zinc-900 mb-8 tracking-tight">My profile</h1>
          <nav className="flex flex-col space-y-1">
            {TABS.map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => openTab(tab.id)}
                  className={`flex items-center gap-4 px-4 py-3 rounded-xl transition-all text-left font-medium text-sm ${
                    active ? "bg-[#FDE29B] text-zinc-900 font-semibold shadow-sm" : "text-zinc-700 hover:bg-zinc-50"
                  }`}
                >
                  {tab.id === 'about' ? (
                     <div className="w-7 h-7 rounded-full overflow-hidden relative shrink-0">
                       <Image src={profileData.image || "/images/header-user-avatar.jpg"} alt="avatar" fill className="object-cover" sizes="28px"/>
                     </div>
                  ) : (
                    <div className="w-7 h-7 flex items-center justify-center shrink-0 opacity-70">
                      <tab.icon />
                    </div>
                  )}
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        {/* MOBILE HUB */}
        {mobileHub ? (
          <div className="md:hidden flex flex-col w-full px-5 py-6">
            <div className="flex items-center justify-between mb-6">
              <button onClick={() => router.back()} className="w-10 h-10 rounded-full border border-zinc-200 flex items-center justify-center text-zinc-500 hover:bg-zinc-50 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
              </button>
            </div>
            <h1 className="text-3xl font-bold text-zinc-900 mb-6 tracking-tight">My profile</h1>
            <div className="grid grid-cols-2 gap-3 mb-8">
              {TABS.slice(1).map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => openTab(tab.id)}
                  className="bg-white border border-zinc-200/80 shadow-xs rounded-2xl p-4 flex flex-col items-center justify-center gap-2 hover:border-zinc-300 transition-colors"
                >
                  <div className="text-zinc-700"><tab.icon /></div>
                  <span className="text-xs font-semibold text-zinc-800 text-center leading-tight px-1">{tab.label}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* MAIN CONTENT PANE */
          <div className="flex-1 flex flex-col max-w-4xl px-5 md:px-12 py-6 md:py-0 w-full min-h-[60vh]">
            {activeTab === "about" ? (
              <ProfileEditForm 
                initial={profileData} 
                onSuccess={handleProfileUpdated} 
                onCancel={() => setIsEditing(false)} 
              />
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-center border border-dashed border-zinc-200 rounded-3xl my-8">
                <h2 className="text-xl font-bold text-zinc-800 mb-2">{TABS.find(t => t.id === activeTab)?.label}</h2>
                <button onClick={() => openTab("about")} className="bg-[#FDE29B] text-zinc-900 font-semibold px-6 py-2 rounded-full hover:bg-[#FCD885] transition-colors text-sm mt-4">
                  Return to Profile
                </button>
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* FOOTER */}
      <footer className="bg-zinc-50 border-t border-zinc-200/60 mt-16 pb-8 pt-12 px-6">
        <div className="max-w-7xl mx-auto flex flex-col">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10 mb-12">
            <div>
              <h3 className="font-bold text-zinc-900 mb-4 text-sm">Support</h3>
              <ul className="space-y-3 text-sm text-zinc-600">
                <li><Link href="#" className="hover:underline">Help Center</Link></li>
                <li><Link href="#" className="hover:underline">Get help with a safety issue</Link></li>
                <li><Link href="#" className="hover:underline">Disability support</Link></li>
                <li><Link href="#" className="hover:underline">Cancellation options</Link></li>
                <li><Link href="#" className="hover:underline">Report neighborhood concern</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="font-bold text-zinc-900 mb-4 text-sm">Hosting</h3>
              <ul className="space-y-3 text-sm text-zinc-600">
                <li><Link href="#" className="hover:underline">Homyz your home</Link></li>
                <li><Link href="#" className="hover:underline">Homyz your experience</Link></li>
                <li><Link href="#" className="hover:underline">Homyz your service</Link></li>
                <li><Link href="#" className="hover:underline">Homyz for Hosts</Link></li>
                <li><Link href="#" className="hover:underline">Hosting resources</Link></li>
                <li><Link href="#" className="hover:underline">Community forum</Link></li>
                <li><Link href="#" className="hover:underline">Hosting responsibly</Link></li>
                <li><Link href="#" className="hover:underline">Find a co-host</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="font-bold text-zinc-900 mb-4 text-sm">Homyz</h3>
              <ul className="space-y-3 text-sm text-zinc-600">
                <li><Link href="#" className="hover:underline">2026 Summer Release</Link></li>
                <li><Link href="#" className="hover:underline">Newsroom</Link></li>
                <li><Link href="#" className="hover:underline">Careers</Link></li>
                <li><Link href="#" className="hover:underline">Investors</Link></li>
                <li><Link href="#" className="hover:underline">Gift cards</Link></li>
                <li><Link href="#" className="hover:underline">Homyz.com emergency stays</Link></li>
              </ul>
            </div>
          </div>
          <div className="flex flex-col md:flex-row items-center justify-between border-t border-zinc-200 pt-6">
            <p className="text-xs text-zinc-500">© 2026 Homyz, Inc.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

// ----------------------------------------------------
// PROFILE EDIT FORM (CLEAN AVATAR CLEARANCE & ROW PARITY)
// ----------------------------------------------------
function ProfileEditForm({ 
  initial, 
  onSuccess, 
  onCancel 
}: { 
  initial: ProfileData; 
  onSuccess: (updated: ProfileData) => void; 
  onCancel: () => void; 
}) {
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  
  const [imageUrl, setImageUrl] = useState(initial.image || "");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const pub = initial.publicProfile || {};

  const [formDataState, setFormDataState] = useState<PublicProfileData>({
    whereIWantToGo: pub.whereIWantToGo || "",
    myWork: pub.myWork || "",
    spendTooMuchTime: pub.spendTooMuchTime || "",
    pets: pub.pets || "",
    decadeBorn: pub.decadeBorn || "",
    school: pub.school || "",
    uselessSkill: pub.uselessSkill || "",
    funFact: pub.funFact || "",
    favoriteSong: pub.favoriteSong || "",
    languages: pub.languages || "English and Russian",
    obsessedWith: pub.obsessedWith || "",
    bioTitle: pub.bioTitle || "",
    whereILive: pub.whereILive || "Bucharest, Romania",
    bio: pub.bio || "Your profile's got star power—hosts and guests can check it out, helping Airbnb stay awesome and trustworthy!",
    stampsVisible: pub.stampsVisible !== false,
  });

  const handleInputChange = (field: keyof PublicProfileData, value: any) => {
    setFormDataState(prev => ({ ...prev, [field]: value }));
  };

  const onSubmit = (e?: React.FormEvent<HTMLFormElement>) => {
    if (e) e.preventDefault();
    setMsg(null);

    const payload = {
      image: imageUrl || initial.image || null,
      name: initial.name || null,
      phone: initial.phone || null,
      publicProfile: formDataState,
    };

    startTransition(async () => {
      const res = await updateProfileAction(payload);
      if (!res.ok) {
        setMsg({ tone: "error", text: res.error || "Failed to update profile." });
        return;
      }
      setMsg({ tone: "success", text: "Profile successfully saved!" });
      onSuccess(res.data as ProfileData);
    });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setMsg(null);
    
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/v1/upload/listing-photo", {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      setImageUrl(data.url);
      setMsg({ tone: "success", text: "Avatar uploaded." });
    } catch (err: any) {
      setMsg({ tone: "error", text: err.message || "Upload error" });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="w-full flex flex-col fade-in animate-in">
      
      {/* Header Row: Title on Left, Disclaimer on Right */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
        <h2 className="text-3xl font-bold text-zinc-900 tracking-tight">My profile</h2>
        <div className="text-[11px] leading-relaxed text-zinc-400 max-w-xs">
          Your profile is visible to both hosts and guests, and may be shown throughout Homyz to support a trustworthy community. <Link href="#" className="underline font-medium text-zinc-600">Learn more</Link>
        </div>
      </div>

      {msg && (
        <div className="mb-6 max-w-lg">
          <Alert tone={msg.tone}>{msg.text}</Alert>
        </div>
      )}

      {/* Avatar Card Container with Strict Clearance (mb-12) */}
      <div className="mb-12 block">
        <div className="relative w-36 h-36 md:w-44 md:h-44 rounded-full overflow-hidden shadow-xs border border-zinc-200">
          <Image src={imageUrl || "/images/header-user-avatar.jpg"} alt="avatar" fill className="object-cover" sizes="176px"/>
          <button 
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="absolute bottom-2 right-2 bg-[#FDE29B] hover:bg-[#FCD885] text-zinc-900 rounded-full px-4 py-1.5 text-xs font-bold shadow-md hover:scale-105 transition-transform flex items-center gap-1.5 cursor-pointer z-10"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
            {uploading ? "..." : "Edit"}
          </button>
          <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleImageUpload} />
        </div>
      </div>

      <form onSubmit={(e) => onSubmit(e)} className="w-full flex flex-col gap-10">
        
        {/* ROW-BY-ROW 2-COLUMN GRID (PARITY WITH FIGMA DESIGN) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-7">
          
          {/* ROW 1 */}
          <div className="flex items-center gap-3.5 pb-2.5 border-b border-zinc-200/80">
            <IconSprig />
            <div className="flex-1 min-w-0">
              <span className="block text-xs font-semibold text-zinc-800">Where I've always wanted to go</span>
              <input 
                value={formDataState.whereIWantToGo} 
                onChange={(e) => handleInputChange("whereIWantToGo", e.target.value)}
                onBlur={() => onSubmit()}
                className={`w-full text-xs bg-transparent focus:outline-none ${formDataState.whereIWantToGo ? 'text-zinc-900 font-medium' : 'text-zinc-400 font-normal'}`} 
                placeholder="edit: Where have you always wanted to travel?" 
              />
            </div>
          </div>

          <div className="flex items-center gap-3.5 pb-2.5 border-b border-zinc-200/80">
            <IconSprig />
            <div className="flex-1 min-w-0">
              <span className="block text-xs font-semibold text-zinc-800">My work</span>
              <input 
                value={formDataState.myWork} 
                onChange={(e) => handleInputChange("myWork", e.target.value)}
                onBlur={() => onSubmit()}
                className={`w-full text-xs bg-transparent focus:outline-none ${formDataState.myWork ? 'text-zinc-900 font-medium' : 'text-zinc-400 font-normal'}`} 
                placeholder="Add your work" 
              />
            </div>
          </div>

          {/* ROW 2 */}
          <div className="flex items-center gap-3.5 pb-2.5 border-b border-zinc-200/80">
            <IconSprig />
            <div className="flex-1 min-w-0">
              <span className="block text-xs font-semibold text-zinc-800">I spend too much time</span>
              <input 
                value={formDataState.spendTooMuchTime} 
                onChange={(e) => handleInputChange("spendTooMuchTime", e.target.value)}
                onBlur={() => onSubmit()}
                className={`w-full text-xs bg-transparent focus:outline-none ${formDataState.spendTooMuchTime ? 'text-zinc-900 font-medium' : 'text-zinc-400 font-normal'}`} 
                placeholder="Add an answer" 
              />
            </div>
          </div>

          <div className="flex items-center gap-3.5 pb-2.5 border-b border-zinc-200/80">
            <IconSprig />
            <div className="flex-1 min-w-0">
              <span className="block text-xs font-semibold text-zinc-800">Pets</span>
              <input 
                value={formDataState.pets} 
                onChange={(e) => handleInputChange("pets", e.target.value)}
                onBlur={() => onSubmit()}
                className={`w-full text-xs bg-transparent focus:outline-none ${formDataState.pets ? 'text-zinc-900 font-medium' : 'text-zinc-400 font-normal'}`} 
                placeholder="Add pets" 
              />
            </div>
          </div>

          {/* ROW 3 */}
          <div className="flex items-center gap-3.5 pb-2.5 border-b border-zinc-200/80">
            <IconSprig />
            <div className="flex-1 min-w-0">
              <span className="block text-xs font-semibold text-zinc-800">Decade I was born</span>
              <input 
                value={formDataState.decadeBorn} 
                onChange={(e) => handleInputChange("decadeBorn", e.target.value)}
                onBlur={() => onSubmit()}
                className={`w-full text-xs bg-transparent focus:outline-none ${formDataState.decadeBorn ? 'text-zinc-900 font-medium' : 'text-zinc-400 font-normal'}`} 
                placeholder="Add decade" 
              />
            </div>
          </div>

          <div className="flex items-center gap-3.5 pb-2.5 border-b border-zinc-200/80">
            <IconSprig />
            <div className="flex-1 min-w-0">
              <span className="block text-xs font-semibold text-zinc-800">Where I went to school</span>
              <input 
                value={formDataState.school} 
                onChange={(e) => handleInputChange("school", e.target.value)}
                onBlur={() => onSubmit()}
                className={`w-full text-xs bg-transparent focus:outline-none ${formDataState.school ? 'text-zinc-900 font-medium' : 'text-zinc-400 font-normal'}`} 
                placeholder="Add school" 
              />
            </div>
          </div>

          {/* ROW 4 */}
          <div className="flex items-center gap-3.5 pb-2.5 border-b border-zinc-200/80">
            <IconSprig />
            <div className="flex-1 min-w-0">
              <span className="block text-xs font-semibold text-zinc-800">My most useless skill</span>
              <input 
                value={formDataState.uselessSkill} 
                onChange={(e) => handleInputChange("uselessSkill", e.target.value)}
                onBlur={() => onSubmit()}
                className={`w-full text-xs bg-transparent focus:outline-none ${formDataState.uselessSkill ? 'text-zinc-900 font-medium' : 'text-zinc-400 font-normal'}`} 
                placeholder="edit: What's your most useless skill?" 
              />
            </div>
          </div>

          <div className="flex items-center gap-3.5 pb-2.5 border-b border-zinc-200/80">
            <IconSprig />
            <div className="flex-1 min-w-0">
              <span className="block text-xs font-semibold text-zinc-800">My fun fact</span>
              <input 
                value={formDataState.funFact} 
                onChange={(e) => handleInputChange("funFact", e.target.value)}
                onBlur={() => onSubmit()}
                className={`w-full text-xs bg-transparent focus:outline-none ${formDataState.funFact ? 'text-zinc-900 font-medium' : 'text-zinc-400 font-normal'}`} 
                placeholder="Add a fun fact" 
              />
            </div>
          </div>

          {/* ROW 5 */}
          <div className="flex items-center gap-3.5 pb-2.5 border-b border-zinc-200/80">
            <IconSprig />
            <div className="flex-1 min-w-0">
              <span className="block text-xs font-semibold text-zinc-800">My favorite song in high school</span>
              <input 
                value={formDataState.favoriteSong} 
                onChange={(e) => handleInputChange("favoriteSong", e.target.value)}
                onBlur={() => onSubmit()}
                className={`w-full text-xs bg-transparent focus:outline-none ${formDataState.favoriteSong ? 'text-zinc-900 font-medium' : 'text-zinc-400 font-normal'}`} 
                placeholder="edit: What was your favorite song in high school?" 
              />
            </div>
          </div>

          <div className="flex items-center gap-3.5 pb-2.5 border-b border-zinc-200/80">
            <IconSprig />
            <div className="flex-1 min-w-0 flex items-center gap-1.5">
              <span className="text-xs font-semibold text-zinc-800 whitespace-nowrap">Languages I speak:</span>
              <input 
                value={formDataState.languages} 
                onChange={(e) => handleInputChange("languages", e.target.value)}
                onBlur={() => onSubmit()}
                className={`w-full text-xs bg-transparent focus:outline-none ${formDataState.languages ? 'text-zinc-900 font-medium' : 'text-zinc-400 font-normal'}`} 
                placeholder="English and Russian" 
              />
            </div>
          </div>

          {/* ROW 6 */}
          <div className="flex items-center gap-3.5 pb-2.5 border-b border-zinc-200/80">
            <IconSprig />
            <div className="flex-1 min-w-0">
              <span className="block text-xs font-semibold text-zinc-800">I'm obsessed with</span>
              <input 
                value={formDataState.obsessedWith} 
                onChange={(e) => handleInputChange("obsessedWith", e.target.value)}
                onBlur={() => onSubmit()}
                className={`w-full text-xs bg-transparent focus:outline-none ${formDataState.obsessedWith ? 'text-zinc-900 font-medium' : 'text-zinc-400 font-normal'}`} 
                placeholder="Add an obsession" 
              />
            </div>
          </div>

          <div className="flex items-center gap-3.5 pb-2.5 border-b border-zinc-200/80">
            <IconSprig />
            <div className="flex-1 min-w-0">
              <span className="block text-xs font-semibold text-zinc-800">My biography title would be</span>
              <input 
                value={formDataState.bioTitle} 
                onChange={(e) => handleInputChange("bioTitle", e.target.value)}
                onBlur={() => onSubmit()}
                className={`w-full text-xs bg-transparent focus:outline-none ${formDataState.bioTitle ? 'text-zinc-900 font-medium' : 'text-zinc-400 font-normal'}`} 
                placeholder="Add title" 
              />
            </div>
          </div>

          {/* ROW 7 */}
          <div className="hidden md:block" />

          <div className="flex items-center gap-3.5 pb-2.5 border-b border-zinc-200/80">
            <IconSprig />
            <div className="flex-1 min-w-0 flex items-center gap-1.5">
              <span className="text-xs font-semibold text-zinc-800 whitespace-nowrap">Where I live:</span>
              <input 
                value={formDataState.whereILive} 
                onChange={(e) => handleInputChange("whereILive", e.target.value)}
                onBlur={() => onSubmit()}
                className={`w-full text-xs bg-transparent focus:outline-none ${formDataState.whereILive ? 'text-zinc-900 font-medium' : 'text-zinc-400 font-normal'}`} 
                placeholder="Bucharest, Romania" 
              />
            </div>
          </div>

        </div>

        {/* About me Textarea Box */}
        <div className="mt-4">
          <h3 className="text-sm font-bold text-zinc-900 mb-3">About me</h3>
          <div className="rounded-xl border border-zinc-200/90 p-4 min-h-[90px] focus-within:border-zinc-400 transition-colors bg-white">
            <textarea 
              value={formDataState.bio}
              onChange={(e) => handleInputChange("bio", e.target.value)}
              onBlur={() => onSubmit()}
              className="w-full h-full bg-transparent resize-none text-xs text-zinc-800 placeholder-zinc-400 focus:outline-none leading-relaxed"
              placeholder="Your profile's got star power—hosts and guests can check it out, helping Airbnb stay awesome and trustworthy!"
            ></textarea>
          </div>
        </div>

        {/* Where I've been (Stamps Section) */}
        <div className="mt-4 pt-4">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-sm font-bold text-zinc-900">Where I've been</h3>
            <div 
              onClick={() => {
                const val = !formDataState.stampsVisible;
                handleInputChange("stampsVisible", val);
                setTimeout(() => onSubmit(), 100);
              }}
              className={`w-11 h-6 rounded-full relative cursor-pointer transition-colors ${
                formDataState.stampsVisible ? "bg-[#FA595D]" : "bg-zinc-300"
              }`}
            >
               <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform shadow-xs ${
                 formDataState.stampsVisible ? "right-0.5" : "left-0.5"
               }`}></div>
            </div>
          </div>
          <p className="text-zinc-400 text-xs mb-6">Pick the stamps you want other people to see on your profile.</p>
          
          {formDataState.stampsVisible && (
            <div className="flex items-center gap-12 py-2">
              <StampParis />
              <StampCoffee />
            </div>
          )}
        </div>

        {/* Save button */}
        <div className="flex justify-end pt-4">
          <button 
            type="submit" 
            disabled={pending} 
            className="bg-[#FDE29B] hover:bg-[#FCD885] text-zinc-900 text-xs font-semibold px-8 py-2.5 rounded-full transition-all shadow-xs disabled:opacity-50 cursor-pointer"
          >
            {pending ? "Saving..." : "Save profile"}
          </button>
        </div>
      </form>
    </div>
  );
}
