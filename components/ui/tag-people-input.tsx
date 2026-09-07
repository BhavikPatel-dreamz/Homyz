"use client";

import React, { useState, useEffect, useRef, useId } from "react";
import Image from "next/image";

export type TaggedUser = {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
};

type TagPeopleInputProps = {
  selectedUsers: TaggedUser[];
  onChange: (users: TaggedUser[]) => void;
  maxTags?: number;
  disabled?: boolean;
};

export function TagPeopleInput({
  selectedUsers = [],
  onChange,
  maxTags = 10,
  disabled = false,
}: TagPeopleInputProps) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<TaggedUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Debounced user search
  useEffect(() => {
    if (!isOpen) return;

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/v1/users/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        if (res.ok && Array.isArray(data.users)) {
          setSuggestions(data.users);
        } else {
          setSuggestions([]);
        }
      } catch {
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [query, isOpen]);

  const handleSelectUser = (user: TaggedUser) => {
    if (selectedUsers.some((u) => u.id === user.id)) return;
    if (selectedUsers.length >= maxTags) return;

    onChange([...selectedUsers, user]);
    setQuery("");
    setActiveIndex(-1);
    setIsOpen(false);
    inputRef.current?.focus();
  };

  const handleRemoveUser = (userId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    onChange(selectedUsers.filter((u) => u.id !== userId));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!isOpen) setIsOpen(true);
      setActiveIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeIndex >= 0 && suggestions[activeIndex]) {
        handleSelectUser(suggestions[activeIndex]);
      }
    } else if (e.key === "Backspace" && query === "" && selectedUsers.length > 0) {
      handleRemoveUser(selectedUsers[selectedUsers.length - 1].id);
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  };

  const isMaxReached = selectedUsers.length >= maxTags;

  return (
    <div ref={containerRef} className="relative w-full">
      <label htmlFor={inputId} className="block text-xs font-semibold text-[#1F1F1F] mb-1.5">
        Tag People
      </label>

      {/* Combobox Chip Container */}
      <div
        onClick={() => {
          if (!disabled && !isMaxReached) {
            setIsOpen(true);
            inputRef.current?.focus();
          }
        }}
        className={`w-full min-h-[46px] p-2 rounded-2xl border bg-white flex flex-wrap items-center gap-1.5 transition-all shadow-2xs ${
          isOpen ? "border-amber-400 ring-2 ring-amber-400/20" : "border-zinc-200 hover:border-zinc-300"
        } ${disabled ? "opacity-60 cursor-not-allowed" : "cursor-text"}`}
      >
        {/* Selected Chips */}
        {selectedUsers.map((user) => (
          <span
            key={user.id}
            className="inline-flex items-center gap-1.5 pl-1.5 pr-2 py-1 rounded-full bg-zinc-100 border border-zinc-200 text-xs font-semibold text-zinc-800 shadow-2xs group animate-in fade-in"
          >
            {user.image ? (
              <span className="relative w-4 h-4 rounded-full overflow-hidden shrink-0">
                <Image src={user.image} alt={user.name || "User"} fill className="object-cover" sizes="16px" />
              </span>
            ) : (
              <span className="w-4 h-4 rounded-full bg-amber-200 text-amber-900 text-[9px] font-semibold flex items-center justify-center shrink-0">
                {(user.name || user.email || "U")[0].toUpperCase()}
              </span>
            )}
            <span className="truncate max-w-[110px]">{user.name || user.email || "User"}</span>
            <button
              type="button"
              onClick={(e) => handleRemoveUser(user.id, e)}
              className="w-3.5 h-3.5 rounded-full hover:bg-zinc-300 text-zinc-500 hover:text-[#1F1F1F] flex items-center justify-center text-[11px] leading-none transition-colors cursor-pointer"
              title="Remove tag"
            >
              ✕
            </button>
          </span>
        ))}

        {/* Input Field */}
        {!isMaxReached && (
          <input
            id={inputId}
            ref={inputRef}
            type="text"
            disabled={disabled}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              if (!isOpen) setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder={selectedUsers.length === 0 ? "Search people to tag..." : "Add more..."}
            className="flex-1 min-w-[120px] bg-transparent text-xs text-[#1F1F1F] placeholder-zinc-400 focus:outline-none py-1"
          />
        )}
      </div>

      {/* Limit Notice */}
      {isMaxReached && (
        <p className="text-[11px] text-amber-700 font-semibold mt-1">
          Maximum {maxTags} people reached.
        </p>
      )}

      {/* Suggestion Dropdown */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1 z-50 max-h-60 overflow-y-auto rounded-2xl bg-white border border-zinc-200 shadow-xl py-1.5 animate-in fade-in">
          {loading ? (
            <div className="px-4 py-3 text-xs text-zinc-500 flex items-center gap-2">
              <svg className="w-3.5 h-3.5 animate-spin text-zinc-400" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
                <path fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" className="opacity-75" />
              </svg>
              <span>Searching people...</span>
            </div>
          ) : suggestions.length === 0 ? (
            <div className="px-4 py-3 text-xs text-zinc-400 italic text-center">
              No people found
            </div>
          ) : (
            suggestions.map((user, index) => {
              const isSelected = selectedUsers.some((u) => u.id === user.id);
              const isActive = index === activeIndex;

              return (
                <div
                  key={user.id}
                  onClick={() => !isSelected && handleSelectUser(user)}
                  className={`px-3.5 py-2.5 flex items-center justify-between gap-3 text-xs transition-colors cursor-pointer ${
                    isSelected
                      ? "opacity-50 bg-zinc-50 cursor-default"
                      : isActive
                      ? "bg-amber-50 text-[#1F1F1F] font-medium"
                      : "hover:bg-zinc-50 text-zinc-800"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {user.image ? (
                      <div className="relative w-7 h-7 rounded-full overflow-hidden shrink-0 border border-zinc-200">
                        <Image src={user.image} alt={user.name || "User"} fill className="object-cover" sizes="28px" />
                      </div>
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-amber-100 text-amber-800 font-semibold text-xs flex items-center justify-center shrink-0">
                        {(user.name || user.email || "U")[0].toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="font-semibold text-[#1F1F1F] truncate">{user.name || "Guest Member"}</p>
                      {user.email && (
                        <p className="text-[11px] text-zinc-400 truncate">
                          @{user.email.split("@")[0]}
                        </p>
                      )}
                    </div>
                  </div>

                  {isSelected && (
                    <span className="text-[11px] font-semibold text-zinc-400 bg-zinc-100 px-2 py-0.5 rounded-full">
                      Tagged
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
