"use client";

import React, { useState, useEffect, useRef } from "react";
import { toast } from "@/components/ui/toast";
import { ModalOverlay } from "@/components/ui/modal-overlay";
import { GuidebookMap, MapPlacePin } from "@/components/guidebook/guidebook-map";
import {
  GUIDEBOOK_CATEGORIES,
  TIP_CATEGORIES,
  getCategoryLabel,
  getCategoryIcon,
  GuidebookCategoryId,
} from "@/lib/validation/guidebook";
import { searchPlaces, PlaceSearchResult } from "@/lib/location/places-search";
import { searchLocations, StructuredLocation } from "@/lib/location/geocoding";
import {
  getGuidebooksAction,
  getGuidebookByIdAction,
  createGuidebookAction,
  updateGuidebookAction,
  deleteGuidebookAction,
  addGuidebookItemAction,
  updateGuidebookItemAction,
  deleteGuidebookItemAction,
  reorderGuidebookItemsAction,
} from "@/actions/host/guidebooks";

interface GuidebookItemData {
  id: string;
  type: "PLACE" | "NEIGHBORHOOD" | "TIP";
  title: string;
  category: string;
  description?: string | null;
  hostTip?: string | null;
  photo?: string | null;
  placeProviderId?: string | null;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  isFavorite?: boolean;
  sortOrder?: number;
}

interface GuidebookDetailData {
  id: string;
  hostId: string;
  title: string;
  coverImage?: string | null;
  description?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  countryCode?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  formattedAddress?: string | null;
  published: boolean;
  createdAt: string;
  updatedAt: string;
  items: GuidebookItemData[];
  listings: Array<{ id: string; title: string; city?: string | null; coverPhoto?: string | null }>;
  host?: { id: string; name: string | null; image: string | null };
}

interface GuidebooksManagerProps {
  listingId: string;
  listingCity?: string;
  listingCountry?: string;
  listingLatitude?: number | null;
  listingLongitude?: number | null;
  setActiveSection: (s: any) => void;
  initialGuidebooks?: any[];
}

export function GuidebooksManager({
  listingId,
  listingCity,
  listingCountry,
  listingLatitude,
  listingLongitude,
  setActiveSection,
  initialGuidebooks,
}: GuidebooksManagerProps) {
  // Navigation & View Mode
  const [viewMode, setViewMode] = useState<"list" | "create" | "editor" | "preview">("list");
  const [guidebooks, setGuidebooks] = useState<any[]>(initialGuidebooks ?? []);
  const [selectedGuidebook, setSelectedGuidebook] = useState<GuidebookDetailData | null>(null);
  const [isLoading, setIsLoading] = useState(initialGuidebooks === undefined);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [activePinId, setActivePinId] = useState<string | null>(null);
  const [mobileTab, setMobileTab] = useState<"content" | "map">("content");

  // Modals
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
  const [modalType, setModalType] = useState<"place" | "neighborhood" | "tip" | "delete_item" | "delete_gb" | null>(null);
  const [editingItem, setEditingItem] = useState<GuidebookItemData | null>(null);
  const [itemToDelete, setItemToDelete] = useState<GuidebookItemData | null>(null);
  const [gbToDelete, setGbToDelete] = useState<string | null>(null);

  // Create Form State
  const [createTitle, setCreateTitle] = useState("");
  const [createCover, setCreateCover] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [createLocation, setCreateLocation] = useState(listingCity || "");
  const [createLocationDetails, setCreateLocationDetails] = useState<StructuredLocation | null>(null);
  const [locationSuggestions, setLocationSuggestions] = useState<StructuredLocation[]>([]);
  const [isLocationSearching, setIsLocationSearching] = useState(false);
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const [detailsDraft, setDetailsDraft] = useState("");

  // Place Modal State
  const [placeSearchInput, setPlaceSearchInput] = useState("");
  const [placeResults, setPlaceResults] = useState<PlaceSearchResult[]>([]);
  const [isSearchingPlaces, setIsSearchingPlaces] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState<PlaceSearchResult | null>(null);
  const [recommendationText, setRecommendationText] = useState("");
  const [hostTipText, setHostTipText] = useState("");
  const [itemCategory, setItemCategory] = useState<string>("FOOD_AND_DRINK");
  const [isFavoriteItem, setIsFavoriteItem] = useState(false);
  const [itemPhotoUrl, setItemPhotoUrl] = useState("");
  const [isUploadingItemPhoto, setIsUploadingItemPhoto] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);

  // Neighborhood / Tip Modal State
  const [simpleTitle, setSimpleTitle] = useState("");
  const [simpleDesc, setSimpleDesc] = useState("");
  const [simpleTip, setSimpleTip] = useState("");
  const [simpleCategory, setSimpleCategory] = useState("GETTING_AROUND");
  const [simplePhoto, setSimplePhoto] = useState("");

  const addMenuRef = useRef<HTMLDivElement>(null);

  const showToast = (msg: string, type?: "success" | "error") => {
    if (type === "error" || msg.toLowerCase().includes("failed") || msg.toLowerCase().includes("error")) {
      toast.error(msg);
    } else {
      toast.success(msg);
    }
  };

  // Close add dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (addMenuRef.current && !addMenuRef.current.contains(e.target as Node)) {
        setIsAddMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fetch Guidebooks List on mount unless server provided initialGuidebooks
  useEffect(() => {
    if (initialGuidebooks === undefined) {
      loadGuidebooks();
    } else {
      setIsLoading(false);
    }
  }, [initialGuidebooks]);

  const loadGuidebooks = async () => {
    setIsLoading(true);
    const res = await getGuidebooksAction();
    if (res.ok && Array.isArray(res.data)) {
      setGuidebooks(res.data);
    }
    setIsLoading(false);
  };

  const openGuidebookEditor = async (id: string) => {
    setIsLoading(true);
    const res = await getGuidebookByIdAction(id);
    if (res.ok && res.data) {
      setSelectedGuidebook(res.data as GuidebookDetailData);
      setDetailsDraft((res.data as GuidebookDetailData).description || "");
      setViewMode("editor");
      setActiveCategoryFilter("ALL");
      setSearchQuery("");
      setActivePinId(null);
    } else {
      showToast("Failed to load guidebook.");
    }
    setIsLoading(false);
  };

  // Debounced Location Search for Create Form
  useEffect(() => {
    if (viewMode !== "create" || !createLocation || createLocation.length < 2) {
      setLocationSuggestions([]);
      return;
    }
    const timer = setTimeout(async () => {
      setIsLocationSearching(true);
      try {
        const results = await searchLocations(createLocation);
        setLocationSuggestions(results);
      } catch {
        setLocationSuggestions([]);
      } finally {
        setIsLocationSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [createLocation, viewMode]);

  // Debounced Place Search for Place Modal
  useEffect(() => {
    if (modalType !== "place" || !placeSearchInput || placeSearchInput.length < 2) {
      setPlaceResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setIsSearchingPlaces(true);
      try {
        const centerLat = selectedGuidebook?.latitude || listingLatitude;
        const centerLng = selectedGuidebook?.longitude || listingLongitude;
        const results = await searchPlaces(placeSearchInput, centerLat, centerLng);
        setPlaceResults(results);
      } catch {
        setPlaceResults([]);
      } finally {
        setIsSearchingPlaces(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [placeSearchInput, modalType, selectedGuidebook, listingLatitude, listingLongitude]);

  // Handle Photo Upload via API
  const handlePhotoUpload = async (file: File, target: "cover" | "item" | "simple") => {
    const formData = new FormData();
    formData.append("file", file);

    if (target === "cover") setIsUploadingCover(true);
    if (target === "item") setIsUploadingItemPhoto(true);

    try {
      const res = await fetch("/api/v1/upload/guidebook-photo", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (res.ok && data.url) {
        if (target === "cover") {
          setCreateCover(data.url);
          if (selectedGuidebook) {
            handleSaveGuidebookMeta({ coverImage: data.url });
          }
        } else if (target === "item") {
          setItemPhotoUrl(data.url);
        } else if (target === "simple") {
          setSimplePhoto(data.url);
        }
      } else {
        showToast(data.error || "Failed to upload photo.");
      }
    } catch {
      showToast("Network error uploading photo.");
    } finally {
      if (target === "cover") setIsUploadingCover(false);
      if (target === "item") setIsUploadingItemPhoto(false);
    }
  };

  // Create Guidebook Submit
  const handleCreateGuidebook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createTitle.trim()) return;

    setIsLoading(true);
    const res = await createGuidebookAction({
      title: createTitle.trim(),
      coverImage: createCover || null,
      description: createDescription.trim() || null,
      city: createLocationDetails?.city || createLocation || listingCity,
      country: createLocationDetails?.country || listingCountry,
      latitude: createLocationDetails?.latitude ?? listingLatitude,
      longitude: createLocationDetails?.longitude ?? listingLongitude,
      formattedAddress: createLocationDetails?.formattedAddress || createLocation,
      listingIds: [listingId],
      published: true,
    });

    if (res.ok) {
      showToast("Guidebook created successfully!");
      setCreateTitle("");
      setCreateCover("");
      setCreateDescription("");
      setCreateLocation("");
      setCreateLocationDetails(null);
      await loadGuidebooks();
      await openGuidebookEditor(res.data.id);
    } else {
      showToast(res.error || "Failed to create guidebook.");
      setIsLoading(false);
    }
  };

  // Update Guidebook Meta (Title, Published, Cover, etc.)
  const handleSaveGuidebookMeta = async (updates: Partial<GuidebookDetailData>) => {
    if (!selectedGuidebook) return;
    setSaveStatus("saving");

    const res = await updateGuidebookAction(selectedGuidebook.id, updates);
    if (res.ok) {
      setSelectedGuidebook((prev) => (prev ? { ...prev, ...updates } : null));
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2000);
      loadGuidebooks();
    } else {
      setSaveStatus("error");
      showToast("Failed to save changes.");
    }
  };

  // Place Selection in Modal
  const handleSelectPlaceResult = (place: PlaceSearchResult) => {
    setSelectedPlace(place);
    setItemCategory(place.category);

    // Duplicate detection
    const isDup = selectedGuidebook?.items.some(
      (item) =>
        item.placeProviderId === place.placeProviderId ||
        (item.title.toLowerCase() === place.name.toLowerCase() &&
          item.address?.toLowerCase() === place.address.toLowerCase())
    );

    if (isDup) {
      setDuplicateWarning(
        `"${place.name}" is already in this guidebook. You can edit the existing recommendation.`
      );
    } else {
      setDuplicateWarning(null);
    }
  };

  // Open Place Modal for Add or Edit
  const openPlaceModal = (item?: GuidebookItemData) => {
    setModalType("place");
    setDuplicateWarning(null);
    if (item) {
      setEditingItem(item);
      setSelectedPlace({
        id: item.placeProviderId || item.id,
        name: item.title,
        category: item.category as GuidebookCategoryId,
        address: item.address || "",
        latitude: item.latitude || 0,
        longitude: item.longitude || 0,
        placeProviderId: item.placeProviderId || "",
      });
      setPlaceSearchInput(item.title);
      setRecommendationText(item.description || "");
      setHostTipText(item.hostTip || "");
      setItemCategory(item.category);
      setIsFavoriteItem(Boolean(item.isFavorite));
      setItemPhotoUrl(item.photo || "");
    } else {
      setEditingItem(null);
      setSelectedPlace(null);
      setPlaceSearchInput("");
      setRecommendationText("");
      setHostTipText("");
      setItemCategory("FOOD_AND_DRINK");
      setIsFavoriteItem(false);
      setItemPhotoUrl("");
    }
  };

  // Save Place Item
  const handleSavePlaceItem = async () => {
    if (!selectedGuidebook || !selectedPlace) return;

    setSaveStatus("saving");
    if (editingItem) {
      // Update
      const res = await updateGuidebookItemAction(selectedGuidebook.id, editingItem.id, {
        title: selectedPlace.name,
        category: itemCategory,
        description: recommendationText.trim() || null,
        hostTip: hostTipText.trim() || null,
        photo: itemPhotoUrl || null,
        address: selectedPlace.address || null,
        latitude: selectedPlace.latitude,
        longitude: selectedPlace.longitude,
        placeProviderId: selectedPlace.placeProviderId,
        isFavorite: isFavoriteItem,
      });

      if (res.ok) {
        setSelectedGuidebook((prev) =>
          prev
            ? {
                ...prev,
                items: prev.items.map((it) =>
                  it.id === editingItem.id ? (res.data as GuidebookItemData) : it
                ),
              }
            : null
        );
        setModalType(null);
        setSaveStatus("saved");
        showToast("Recommendation updated!");
      } else {
        setSaveStatus("error");
        showToast(res.error || "Failed to update recommendation.");
      }
    } else {
      // Add
      const res = await addGuidebookItemAction(selectedGuidebook.id, {
        type: "PLACE",
        title: selectedPlace.name,
        category: itemCategory,
        description: recommendationText.trim() || null,
        hostTip: hostTipText.trim() || null,
        photo: itemPhotoUrl || null,
        address: selectedPlace.address || null,
        latitude: selectedPlace.latitude,
        longitude: selectedPlace.longitude,
        placeProviderId: selectedPlace.placeProviderId,
        isFavorite: isFavoriteItem,
      });

      if (res.ok) {
        setSelectedGuidebook((prev) =>
          prev ? { ...prev, items: [...prev.items, res.data as GuidebookItemData] } : null
        );
        setModalType(null);
        setSaveStatus("saved");
        showToast("Place added to guidebook!");
      } else {
        setSaveStatus("error");
        showToast(res.error || "Failed to add place.");
      }
    }
  };

  // Save Neighborhood or Tip
  const handleSaveSimpleItem = async () => {
    if (!selectedGuidebook || !simpleTitle.trim()) return;

    setSaveStatus("saving");
    const isNeighborhood = modalType === "neighborhood";
    const type = isNeighborhood ? "NEIGHBORHOOD" : "TIP";
    const category = isNeighborhood ? "OUTDOORS" : simpleCategory;

    if (editingItem) {
      const res = await updateGuidebookItemAction(selectedGuidebook.id, editingItem.id, {
        title: simpleTitle.trim(),
        description: simpleDesc.trim() || null,
        hostTip: isNeighborhood ? simpleTip.trim() || null : null,
        photo: simplePhoto || null,
        category,
      });
      if (res.ok) {
        setSelectedGuidebook((prev) =>
          prev
            ? {
                ...prev,
                items: prev.items.map((it) =>
                  it.id === editingItem.id ? (res.data as GuidebookItemData) : it
                ),
              }
            : null
        );
        setModalType(null);
        setSaveStatus("saved");
        showToast(`${isNeighborhood ? "Neighborhood" : "Tip"} updated!`);
      } else {
        showToast(res.error || "Failed to update.");
      }
    } else {
      const res = await addGuidebookItemAction(selectedGuidebook.id, {
        type,
        title: simpleTitle.trim(),
        category,
        description: simpleDesc.trim() || null,
        hostTip: isNeighborhood ? simpleTip.trim() || null : null,
        photo: simplePhoto || null,
      });
      if (res.ok) {
        setSelectedGuidebook((prev) =>
          prev ? { ...prev, items: [...prev.items, res.data as GuidebookItemData] } : null
        );
        setModalType(null);
        setSaveStatus("saved");
        showToast(`${isNeighborhood ? "Neighborhood" : "Tip"} added!`);
      } else {
        showToast(res.error || "Failed to add.");
      }
    }
  };

  // Delete Item
  const handleConfirmDeleteItem = async () => {
    if (!selectedGuidebook || !itemToDelete) return;
    setSaveStatus("saving");

    const res = await deleteGuidebookItemAction(selectedGuidebook.id, itemToDelete.id);
    if (res.ok) {
      setSelectedGuidebook((prev) =>
        prev ? { ...prev, items: prev.items.filter((it) => it.id !== itemToDelete.id) } : null
      );
      setItemToDelete(null);
      setModalType(null);
      setSaveStatus("saved");
      showToast("Recommendation removed.");
    } else {
      setSaveStatus("error");
      showToast("Failed to remove item.");
    }
  };

  // Delete Guidebook
  const handleConfirmDeleteGuidebook = async () => {
    if (!gbToDelete) return;
    const res = await deleteGuidebookAction(gbToDelete);
    if (res.ok) {
      setGbToDelete(null);
      setModalType(null);
      showToast("Guidebook deleted.");
      await loadGuidebooks();
      setViewMode("list");
    } else {
      showToast("Failed to delete guidebook.");
    }
  };

  // Reorder Item Up/Down
  const handleMoveItem = async (index: number, direction: "up" | "down") => {
    if (!selectedGuidebook) return;
    const items = [...selectedGuidebook.items];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= items.length) return;

    // Swap
    const temp = items[index];
    items[index] = items[targetIndex];
    items[targetIndex] = temp;

    setSelectedGuidebook({ ...selectedGuidebook, items });
    setSaveStatus("saving");

    const itemIds = items.map((it) => it.id);
    const res = await reorderGuidebookItemsAction(selectedGuidebook.id, { itemIds });
    if (res.ok) {
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 1500);
    } else {
      setSaveStatus("error");
      showToast("Failed to save reordered items.");
    }
  };

  // Filter and Search Items
  const filteredItems = (selectedGuidebook?.items || []).filter((item) => {
    if (activeCategoryFilter !== "ALL") {
      if (activeCategoryFilter === "FAVORITES" && !item.isFavorite) return false;
      if (activeCategoryFilter === "TIPS" && item.type !== "TIP") return false;
      if (
        activeCategoryFilter !== "FAVORITES" &&
        activeCategoryFilter !== "TIPS" &&
        item.category !== activeCategoryFilter
      ) {
        return false;
      }
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = item.title.toLowerCase().includes(q);
      const matchDesc = item.description?.toLowerCase().includes(q);
      const matchTip = item.hostTip?.toLowerCase().includes(q);
      const matchAddr = item.address?.toLowerCase().includes(q);
      if (!matchTitle && !matchDesc && !matchTip && !matchAddr) return false;
    }
    return true;
  });

  // Map Pins for Map View
  const mapPins: MapPlacePin[] = (selectedGuidebook?.items || [])
    .filter((item) => item.latitude != null && item.longitude != null)
    .map((item) => ({
      id: item.id,
      title: item.title,
      category: item.category,
      latitude: item.latitude,
      longitude: item.longitude,
      address: item.address,
      isFavorite: item.isFavorite,
    }));

  // Checklist Calculations
  const hasCover = Boolean(selectedGuidebook?.coverImage);
  const placesCount = selectedGuidebook?.items.filter((it) => it.type === "PLACE").length || 0;
  const tipsCount = selectedGuidebook?.items.filter((it) => it.type === "TIP").length || 0;

  return (
    <div className="space-y-6 animate-in fade-in pb-16 font-sans">

      {/* ========================================================= */}
      {/* 1. LIST VIEW MODE (MAIN GUIDEBOOKS LIST)                  */}
      {/* ========================================================= */}
      {viewMode === "list" && (
        <div className="max-w-4xl space-y-6">
          {/* Header & Subtitle & Create Action */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-zinc-200/80">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setActiveSection("arrival-guide")}
                className="w-8 h-8 rounded-full border border-zinc-200 bg-white flex items-center justify-center text-zinc-600 hover:bg-zinc-100 text-sm transition-all cursor-pointer shadow-2xs shrink-0"
                title="Back to Arrival guide"
              >
                ‹
              </button>
              <div>
                <h1 className="text-xl font-bold tracking-tight text-[#1F1F1F]">Guidebooks</h1>
                <p className="text-xs text-zinc-500 font-normal mt-0.5">
                  Share your favorite places and local tips with guests.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setViewMode("create")}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-[#FEE08B] hover:bg-[#FDE047] text-zinc-950 px-5 py-2.5 text-xs font-semibold shadow-2xs transition-all cursor-pointer"
            >
              <span>+</span>
              <span>Create guidebook</span>
            </button>
          </div>

          {/* Loading Skeleton */}
          {isLoading && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-4">
              {[1, 2].map((i) => (
                <div key={i} className="h-56 rounded-3xl bg-zinc-100 animate-pulse border border-zinc-200" />
              ))}
            </div>
          )}

          {/* Empty State */}
          {!isLoading && guidebooks.length === 0 && (
            <div className="rounded-3xl border border-zinc-200 bg-white p-10 text-center flex flex-col items-center justify-center shadow-2xs space-y-4 max-w-lg mx-auto my-8">
              <div className="w-16 h-16 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center text-2xl">
                📖
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-zinc-900">Create a guidebook</h3>
                <p className="text-xs text-zinc-500 font-normal max-w-sm leading-relaxed">
                  Help guests discover your favorite restaurants, cafés, attractions, shops, and authentic local experiences.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setViewMode("create")}
                className="rounded-full bg-[#FEE08B] hover:bg-[#FDE047] text-zinc-950 px-6 py-2.5 text-xs font-semibold shadow-2xs transition-all cursor-pointer"
              >
                Create guidebook
              </button>
            </div>
          )}

          {/* Guidebook Cards Grid */}
          {!isLoading && guidebooks.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
              {guidebooks.map((gb) => {
                const cover = gb.coverImage || "https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&w=600&q=80";
                return (
                  <div
                    key={gb.id}
                    className="rounded-3xl border border-zinc-200 bg-white overflow-hidden shadow-2xs hover:shadow-md transition-all flex flex-col justify-between group"
                  >
                    {/* Card Cover & Badges */}
                    <div className="relative h-40 w-full overflow-hidden bg-zinc-100">
                      <img
                        src={cover}
                        alt={gb.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />

                      <div className="absolute top-3 right-3 flex items-center gap-1.5">
                        <span
                          className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-full backdrop-blur-md shadow-2xs ${
                            gb.published
                              ? "bg-emerald-500/90 text-white"
                              : "bg-amber-400/90 text-zinc-950"
                          }`}
                        >
                          {gb.published ? "Published" : "Draft"}
                        </span>
                      </div>

                      <div className="absolute bottom-3 left-4 right-4 text-white">
                        <h3 className="text-base font-bold leading-tight truncate">{gb.title}</h3>
                        <p className="text-[11px] text-zinc-200 font-medium truncate mt-0.5">
                          {gb.city ? `${gb.city}${gb.country ? `, ${gb.country}` : ""}` : "Local Guide"}
                        </p>
                      </div>
                    </div>

                    {/* Card Body & Metadata */}
                    <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                      <div className="flex items-center justify-between text-xs text-zinc-600 font-medium">
                        <div className="flex items-center gap-1.5">
                          <span>📍</span>
                          <span>{gb.itemsCount} {gb.itemsCount === 1 ? "recommendation" : "recommendations"}</span>
                        </div>
                        <div className="flex items-center gap-1 text-[11px] text-zinc-400">
                          {(() => {
                            const count = Array.isArray(gb.listings) ? gb.listings.length : 0;
                            return <span>{count} {count === 1 ? "listing" : "listings"}</span>;
                          })()}
                        </div>
                      </div>

                      {/* Card Actions */}
                      <div className="pt-2 border-t border-zinc-100 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => openGuidebookEditor(gb.id)}
                            className="rounded-full bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-semibold px-4 py-1.5 shadow-2xs transition-all cursor-pointer"
                          >
                            Edit
                          </button>
                          <a
                            href={`/guidebooks/${gb.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-full border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700 text-xs font-semibold px-3.5 py-1.5 shadow-2xs transition-all cursor-pointer"
                          >
                            Preview
                          </a>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(`${window.location.origin}/guidebooks/${gb.id}`);
                              showToast("Share link copied to clipboard!");
                            }}
                            className="w-8 h-8 rounded-full border border-zinc-200 hover:bg-zinc-100 flex items-center justify-center text-xs text-zinc-600 transition-all cursor-pointer"
                            title="Copy share link"
                          >
                            🔗
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setGbToDelete(gb.id);
                              setModalType("delete_gb");
                            }}
                            className="w-8 h-8 rounded-full border border-zinc-200 hover:bg-rose-50 hover:border-rose-200 hover:text-rose-600 flex items-center justify-center text-xs text-zinc-400 transition-all cursor-pointer"
                            title="Delete guidebook"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* 2. CREATE GUIDEBOOK FLOW                                  */}
      {/* ========================================================= */}
      {viewMode === "create" && (
        <div className="max-w-xl space-y-6">
          <div className="flex items-center gap-3 pb-2 border-b border-zinc-200/80">
            <button
              type="button"
              onClick={() => setViewMode("list")}
              className="w-8 h-8 rounded-full border border-zinc-200 bg-white flex items-center justify-center text-zinc-600 hover:bg-zinc-100 text-sm transition-all cursor-pointer shadow-2xs shrink-0"
            >
              ‹
            </button>
            <div>
              <h2 className="text-xl font-bold tracking-tight text-[#1F1F1F]">Create a Guidebook</h2>
              <p className="text-xs text-zinc-500 font-normal">
                Share your favorite places and authentic recommendations with your guests.
              </p>
            </div>
          </div>

          <form onSubmit={handleCreateGuidebook} className="rounded-3xl border border-zinc-200 bg-white p-6 space-y-5 shadow-2xs">
            {/* Guidebook Title */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-zinc-900">Guidebook title</label>
                <span className="text-[10px] text-zinc-400">{createTitle.length}/100</span>
              </div>
              <input
                type="text"
                required
                maxLength={100}
                value={createTitle}
                onChange={(e) => setCreateTitle(e.target.value)}
                placeholder="e.g. Bhavik's Favorite Places in Riyadh"
                className="w-full rounded-2xl border border-zinc-200 bg-white p-3.5 text-xs font-medium text-zinc-900 outline-none focus:border-zinc-400 shadow-2xs"
              />
            </div>

            {/* Destination / Area Autocomplete */}
            <div className="space-y-1.5 relative">
              <label className="block text-xs font-bold text-zinc-900">Primary location or area</label>
              <input
                type="text"
                value={createLocation}
                onChange={(e) => setCreateLocation(e.target.value)}
                placeholder="Search city or neighborhood (e.g. Al Olaya, Riyadh)"
                className="w-full rounded-2xl border border-zinc-200 bg-white p-3.5 text-xs font-medium text-zinc-900 outline-none focus:border-zinc-400 shadow-2xs"
              />
              {isLocationSearching && (
                <span className="absolute right-3.5 top-9 text-[10px] text-zinc-400">Searching...</span>
              )}

              {locationSuggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 z-30 mt-1 rounded-2xl border border-zinc-200 bg-white shadow-xl max-h-48 overflow-y-auto divide-y divide-zinc-100">
                  {locationSuggestions.map((dest, idx) => (
                    <div
                      key={idx}
                      onClick={() => {
                        setCreateLocation(dest.formattedAddress);
                        setCreateLocationDetails(dest);
                        setLocationSuggestions([]);
                      }}
                      className="p-3 text-xs font-medium text-zinc-800 hover:bg-amber-50/70 cursor-pointer transition-colors"
                    >
                      <span className="font-semibold">{dest.locationName}</span>
                      <span className="text-[10px] text-zinc-400 block truncate">{dest.formattedAddress}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Cover Photo */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-zinc-900">Cover photo</label>
              {createCover ? (
                <div className="relative h-44 rounded-2xl overflow-hidden border border-zinc-200 group">
                  <img src={createCover} alt="Cover preview" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                    <label className="rounded-full bg-white text-zinc-900 text-xs font-semibold px-4 py-2 cursor-pointer shadow-md hover:bg-zinc-100">
                      Replace
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="hidden"
                        onChange={(e) => e.target.files?.[0] && handlePhotoUpload(e.target.files[0], "cover")}
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => setCreateCover("")}
                      className="rounded-full bg-rose-600 text-white text-xs font-semibold px-4 py-2 cursor-pointer shadow-md hover:bg-rose-700"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ) : (
                <label className="border-2 border-dashed border-zinc-200 hover:border-zinc-400 rounded-2xl p-6 flex flex-col items-center justify-center cursor-pointer bg-zinc-50/50 hover:bg-zinc-50 transition-all text-center">
                  <span className="text-2xl mb-1">📷</span>
                  <span className="text-xs font-semibold text-zinc-700">
                    {isUploadingCover ? "Uploading cover image..." : "Upload cover photo"}
                  </span>
                  <span className="text-[10px] text-zinc-400 mt-0.5">JPEG, PNG, or WebP up to 10MB</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    disabled={isUploadingCover}
                    onChange={(e) => e.target.files?.[0] && handlePhotoUpload(e.target.files[0], "cover")}
                  />
                </label>
              )}
            </div>

            {/* Guidebook Details */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-zinc-900" htmlFor="guidebook-details">
                  Guidebook details <span className="text-zinc-400 font-normal">(optional)</span>
                </label>
                <span className="text-[10px] text-zinc-400">{createDescription.length}/1200</span>
              </div>
              <textarea
                id="guidebook-details"
                rows={3}
                maxLength={1200}
                value={createDescription}
                onChange={(e) => setCreateDescription(e.target.value)}
                placeholder="Tell guests what makes this guidebook useful, such as your favorite neighborhood or the kind of recommendations inside."
                className="w-full resize-y rounded-2xl border border-zinc-200 bg-white p-3.5 text-xs font-medium leading-relaxed text-zinc-900 outline-none focus:border-zinc-400 shadow-2xs"
              />
            </div>

            {/* Associate Listing Note */}
            <div className="rounded-2xl bg-zinc-50 border border-zinc-200/80 p-4 text-xs text-zinc-600 space-y-1">
              <span className="font-semibold text-zinc-900 block">Listing Association</span>
              <p className="text-[11px] text-zinc-500">
                This guidebook will automatically be linked to this listing. You can link additional listings anytime.
              </p>
            </div>

            {/* Submit & Cancel */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setViewMode("list")}
                className="rounded-full border border-zinc-200 px-5 py-2.5 text-xs font-semibold text-zinc-600 hover:bg-zinc-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading || !createTitle.trim()}
                className="rounded-full bg-[#FEE08B] hover:bg-[#FDE047] text-zinc-950 font-semibold text-xs px-6 py-2.5 shadow-2xs disabled:opacity-50 cursor-pointer"
              >
                {isLoading ? "Creating..." : "Save & Open Editor"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ========================================================= */}
      {/* 3. GUIDEBOOK EDITOR VIEW (TWO-COLUMN DESKTOP SPLIT)        */}
      {/* ========================================================= */}
      {viewMode === "editor" && selectedGuidebook && (
        <div className="space-y-5">
          {/* Top Bar Navigation & Actions */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-200/80">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setViewMode("list");
                  loadGuidebooks();
                }}
                className="w-8 h-8 rounded-full border border-zinc-200 bg-white flex items-center justify-center text-zinc-600 hover:bg-zinc-100 text-sm transition-all cursor-pointer shadow-2xs shrink-0"
                title="Back to Guidebooks list"
              >
                ‹
              </button>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold tracking-tight text-zinc-900 truncate max-w-sm sm:max-w-md">
                    {selectedGuidebook.title}
                  </h2>
                  <button
                    type="button"
                    onClick={() => handleSaveGuidebookMeta({ published: !selectedGuidebook.published })}
                    className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-full cursor-pointer transition-all ${
                      selectedGuidebook.published
                        ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                        : "bg-amber-100 text-amber-900 hover:bg-amber-200"
                    }`}
                    title="Toggle public visibility"
                  >
                    {selectedGuidebook.published ? "● Published" : "○ Draft"}
                  </button>
                </div>
                <span className="text-[11px] text-zinc-500 font-medium">
                  {selectedGuidebook.city ? `${selectedGuidebook.city} · ` : ""}
                  {selectedGuidebook.items.length} recommendations
                  {saveStatus === "saving" && <span className="ml-2 text-zinc-400">Saving...</span>}
                  {saveStatus === "saved" && <span className="ml-2 text-emerald-600">Saved ✓</span>}
                </span>
              </div>
            </div>

            {/* Top Bar Action Buttons */}
            <div className="flex items-center gap-2">
              <a
                href={`/guidebooks/${selectedGuidebook.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700 text-xs font-semibold px-4 py-2 shadow-2xs transition-all flex items-center gap-1.5"
              >
                <span>👁️</span>
                <span>Preview as guest</span>
              </a>

              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}/guidebooks/${selectedGuidebook.id}`);
                  showToast("Shareable guidebook link copied!");
                }}
                className="rounded-full border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700 text-xs font-semibold px-3.5 py-2 shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer"
                title="Copy share link"
              >
                <span>🔗</span>
                <span>Share</span>
              </button>

              {/* Mobile List / Map Toggle */}
              <div className="lg:hidden flex items-center border border-zinc-200 rounded-full p-0.5 bg-zinc-100">
                <button
                  type="button"
                  onClick={() => setMobileTab("content")}
                  className={`px-3 py-1 text-xs font-semibold rounded-full transition-all ${
                    mobileTab === "content" ? "bg-white text-zinc-900 shadow-2xs" : "text-zinc-500"
                  }`}
                >
                  List
                </button>
                <button
                  type="button"
                  onClick={() => setMobileTab("map")}
                  className={`px-3 py-1 text-xs font-semibold rounded-full transition-all ${
                    mobileTab === "map" ? "bg-white text-zinc-900 shadow-2xs" : "text-zinc-500"
                  }`}
                >
                  Map ({mapPins.length})
                </button>
              </div>
            </div>
          </div>

          {/* TWO-COLUMN LAYOUT (Left Content, Right Desktop Map) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* LEFT COLUMN: Content & Items */}
            <div className={`lg:col-span-7 space-y-5 ${mobileTab === "map" ? "hidden lg:block" : "block"}`}>
              {/* Overview & Progress Checklist */}
              <div className="rounded-3xl border border-zinc-200 bg-white p-5 space-y-4 shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-zinc-900 uppercase tracking-wider">Guidebook Overview</span>
                  <span className="text-[11px] text-zinc-500">
                    {(() => {
                      const count = Array.isArray(selectedGuidebook.listings) ? selectedGuidebook.listings.length : 0;
                      return <>Shown on {count} {count === 1 ? "listing" : "listings"}</>;
                    })()}
                  </span>
                </div>

                <div className="space-y-1.5 border-t border-zinc-100 pt-4">
                  <div className="flex items-center justify-between gap-3">
                    <label className="text-xs font-bold text-zinc-900" htmlFor="edit-guidebook-details">
                      Guidebook details
                    </label>
                    <span className="text-[10px] text-zinc-400">{detailsDraft.length}/1200</span>
                  </div>
                  <textarea
                    id="edit-guidebook-details"
                    rows={3}
                    maxLength={1200}
                    value={detailsDraft}
                    onChange={(e) => setDetailsDraft(e.target.value)}
                    placeholder="Add a short introduction for guests."
                    className="w-full resize-y rounded-2xl border border-zinc-200 bg-white p-3 text-xs font-medium leading-relaxed text-zinc-900 outline-none focus:border-zinc-400 shadow-2xs"
                  />
                  <div className="flex justify-end">
                    <button
                      type="button"
                      disabled={saveStatus === "saving" || detailsDraft === (selectedGuidebook.description || "")}
                      onClick={() => handleSaveGuidebookMeta({ description: detailsDraft.trim() || null })}
                      className="rounded-full border border-zinc-200 bg-white px-3.5 py-1.5 text-[11px] font-semibold text-zinc-700 shadow-2xs transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Save details
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="p-2.5 rounded-2xl bg-zinc-50 border border-zinc-100">
                    <span className="text-[10px] text-zinc-400 block font-semibold">Title</span>
                    <span className="font-semibold text-emerald-600 flex items-center gap-1 mt-0.5">
                      ✓ Ready
                    </span>
                  </div>
                  <div className="p-2.5 rounded-2xl bg-zinc-50 border border-zinc-100">
                    <span className="text-[10px] text-zinc-400 block font-semibold">Cover</span>
                    <span className={`font-semibold flex items-center gap-1 mt-0.5 ${hasCover ? "text-emerald-600" : "text-amber-600"}`}>
                      {hasCover ? "✓ Added" : "○ Optional"}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-2xl bg-zinc-50 border border-zinc-100">
                    <span className="text-[10px] text-zinc-400 block font-semibold">Places</span>
                    <span className={`font-semibold flex items-center gap-1 mt-0.5 ${placesCount > 0 ? "text-emerald-600" : "text-zinc-500"}`}>
                      {placesCount} places
                    </span>
                  </div>
                  <div className="p-2.5 rounded-2xl bg-zinc-50 border border-zinc-100">
                    <span className="text-[10px] text-zinc-400 block font-semibold">Tips</span>
                    <span className={`font-semibold flex items-center gap-1 mt-0.5 ${tipsCount > 0 ? "text-emerald-600" : "text-zinc-500"}`}>
                      {tipsCount} tips
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Bar: + Add to Guidebook & Search */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                {/* + Add Dropdown */}
                <div className="relative" ref={addMenuRef}>
                  <button
                    type="button"
                    onClick={() => setIsAddMenuOpen(!isAddMenuOpen)}
                    className="inline-flex items-center gap-2 rounded-full bg-[#FEE08B] hover:bg-[#FDE047] text-zinc-950 px-5 py-2 text-xs font-bold shadow-2xs transition-all cursor-pointer"
                  >
                    <span>+</span>
                    <span>Add to guidebook</span>
                    <span className="text-[10px]">▼</span>
                  </button>

                  {isAddMenuOpen && (
                    <div className="absolute left-0 top-full mt-2 w-56 rounded-2xl border border-zinc-200 bg-white shadow-xl p-1.5 z-30 divide-y divide-zinc-100 animate-in fade-in slide-in-from-top-1">
                      <button
                        type="button"
                        onClick={() => {
                          setIsAddMenuOpen(false);
                          openPlaceModal();
                        }}
                        className="w-full text-left p-2.5 rounded-xl hover:bg-amber-50/70 text-xs font-semibold text-zinc-800 flex items-center gap-2.5 transition-colors cursor-pointer"
                      >
                        <span className="text-base">📍</span>
                        <div>
                          <span>Add a place</span>
                          <span className="text-[10px] text-zinc-400 block font-normal">Café, restaurant, museum, park</span>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setIsAddMenuOpen(false);
                          setModalType("neighborhood");
                          setEditingItem(null);
                          setSimpleTitle("");
                          setSimpleDesc("");
                          setSimpleTip("");
                          setSimplePhoto("");
                        }}
                        className="w-full text-left p-2.5 rounded-xl hover:bg-amber-50/70 text-xs font-semibold text-zinc-800 flex items-center gap-2.5 transition-colors cursor-pointer"
                      >
                        <span className="text-base">🏘️</span>
                        <div>
                          <span>Add a neighborhood</span>
                          <span className="text-[10px] text-zinc-400 block font-normal">Overview of an area</span>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setIsAddMenuOpen(false);
                          setModalType("tip");
                          setEditingItem(null);
                          setSimpleTitle("");
                          setSimpleDesc("");
                          setSimpleCategory("GETTING_AROUND");
                          setSimplePhoto("");
                        }}
                        className="w-full text-left p-2.5 rounded-xl hover:bg-amber-50/70 text-xs font-semibold text-zinc-800 flex items-center gap-2.5 transition-colors cursor-pointer"
                      >
                        <span className="text-base">💡</span>
                        <div>
                          <span>Add a local tip</span>
                          <span className="text-[10px] text-zinc-400 block font-normal">Transport, etiquette, weather</span>
                        </div>
                      </button>
                    </div>
                  )}
                </div>

                {/* Instant Client-Side Search */}
                <div className="relative sm:w-64">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search this guidebook..."
                    className="w-full rounded-full border border-zinc-200 bg-white py-2 pl-8 pr-3 text-xs font-medium text-zinc-800 outline-none focus:border-zinc-400 shadow-2xs"
                  />
                  <span className="absolute left-2.5 top-2.5 text-xs text-zinc-400">🔍</span>
                </div>
              </div>

              {/* Category Filter Chips */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
                <button
                  type="button"
                  onClick={() => setActiveCategoryFilter("ALL")}
                  className={`rounded-full px-3 py-1.5 font-semibold text-xs transition-all shrink-0 cursor-pointer ${
                    activeCategoryFilter === "ALL"
                      ? "bg-zinc-900 text-white shadow-2xs"
                      : "bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-50"
                  }`}
                >
                  All ({selectedGuidebook.items.length})
                </button>

                <button
                  type="button"
                  onClick={() => setActiveCategoryFilter("FAVORITES")}
                  className={`rounded-full px-3 py-1.5 font-semibold text-xs transition-all shrink-0 cursor-pointer ${
                    activeCategoryFilter === "FAVORITES"
                      ? "bg-amber-400 text-zinc-950 shadow-2xs"
                      : "bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-50"
                  }`}
                >
                  ⭐ Favorites ({selectedGuidebook.items.filter((it) => it.isFavorite).length})
                </button>

                {GUIDEBOOK_CATEGORIES.map((cat) => {
                  const count = selectedGuidebook.items.filter((it) => it.category === cat.id).length;
                  if (count === 0) return null;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setActiveCategoryFilter(cat.id)}
                      className={`rounded-full px-3 py-1.5 font-semibold text-xs transition-all shrink-0 cursor-pointer ${
                        activeCategoryFilter === cat.id
                          ? "bg-zinc-900 text-white shadow-2xs"
                          : "bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-50"
                      }`}
                    >
                      {cat.icon} {cat.label} ({count})
                    </button>
                  );
                })}
              </div>

              {/* Recommendations Cards List */}
              {filteredItems.length === 0 ? (
                <div className="rounded-3xl border border-zinc-200 bg-white p-8 text-center space-y-2">
                  <span className="text-2xl">🔍</span>
                  <p className="text-xs font-semibold text-zinc-700">No recommendations found</p>
                  <p className="text-[11px] text-zinc-400">
                    {searchQuery
                      ? "Try another search keyword."
                      : "Click \"+ Add to guidebook\" above to add your first place or tip."}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredItems.map((item, idx) => {
                    const isSelectedPin = activePinId === item.id;
                    const icon = getCategoryIcon(item.category);
                    const label = getCategoryLabel(item.category);

                    return (
                      <div
                        key={item.id}
                        onMouseEnter={() => {
                          if (item.latitude && item.longitude) setActivePinId(item.id);
                        }}
                        className={`rounded-2xl border bg-white p-4 transition-all shadow-2xs flex flex-col sm:flex-row items-start gap-4 ${
                          isSelectedPin
                            ? "border-amber-400 ring-2 ring-amber-200"
                            : "border-zinc-200 hover:border-zinc-300"
                        }`}
                      >
                        {/* Photo / Thumbnail */}
                        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden bg-zinc-100 shrink-0 border border-zinc-200/80 flex items-center justify-center">
                          {item.photo ? (
                            <img src={item.photo} alt={item.title} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-2xl">{icon}</span>
                          )}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0 space-y-1.5">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-1.5">
                                <h4 className="text-xs font-bold text-zinc-900 leading-tight truncate">
                                  {item.title}
                                </h4>
                                {item.isFavorite && (
                                  <span className="text-[9px] bg-amber-100 text-amber-900 font-bold px-2 py-0.5 rounded-full shrink-0">
                                    ⭐ Host favorite
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] text-zinc-400 font-medium">
                                {icon} {label}
                                {item.address ? ` · ${item.address}` : ""}
                              </span>
                            </div>

                            {/* Reorder Buttons */}
                            <div className="flex items-center gap-0.5 shrink-0">
                              <button
                                type="button"
                                disabled={idx === 0}
                                onClick={() => handleMoveItem(idx, "up")}
                                className="w-6 h-6 rounded-md border border-zinc-200 hover:bg-zinc-100 text-[10px] disabled:opacity-30 cursor-pointer flex items-center justify-center"
                                title="Move up"
                              >
                                ▲
                              </button>
                              <button
                                type="button"
                                disabled={idx === filteredItems.length - 1}
                                onClick={() => handleMoveItem(idx, "down")}
                                className="w-6 h-6 rounded-md border border-zinc-200 hover:bg-zinc-100 text-[10px] disabled:opacity-30 cursor-pointer flex items-center justify-center"
                                title="Move down"
                              >
                                ▼
                              </button>
                            </div>
                          </div>

                          {/* Host Recommendation Quote */}
                          {item.description && (
                            <p className="text-xs text-zinc-700 font-normal leading-relaxed italic">
                              "{item.description}"
                            </p>
                          )}

                          {/* Host Insider Tip */}
                          {item.hostTip && (
                            <div className="p-2 rounded-xl bg-amber-50/70 border border-amber-200/50 text-[11px] text-amber-900 font-medium flex items-start gap-1.5">
                              <span className="shrink-0">💡</span>
                              <span>{item.hostTip}</span>
                            </div>
                          )}

                          {/* Card Footer Actions */}
                          <div className="pt-2 flex items-center justify-end gap-3 text-xs font-semibold">
                            <button
                              type="button"
                              onClick={() => {
                                if (item.type === "PLACE") openPlaceModal(item);
                                else {
                                  setEditingItem(item);
                                  setSimpleTitle(item.title);
                                  setSimpleDesc(item.description || "");
                                  setSimpleTip(item.hostTip || "");
                                  setSimpleCategory(item.category);
                                  setSimplePhoto(item.photo || "");
                                  setModalType(item.type === "NEIGHBORHOOD" ? "neighborhood" : "tip");
                                }
                              }}
                              className="text-zinc-700 hover:text-zinc-950 cursor-pointer"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setItemToDelete(item);
                                setModalType("delete_item");
                              }}
                              className="text-rose-600 hover:text-rose-700 cursor-pointer"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* RIGHT COLUMN: Interactive Leaflet Map (Desktop) */}
            <div className={`lg:col-span-5 sticky top-24 ${mobileTab === "content" ? "hidden lg:block" : "block"}`}>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-zinc-900 uppercase tracking-wider">
                    Interactive Map ({mapPins.length} pins)
                  </span>
                  <span className="text-[11px] text-zinc-400">Click a pin to view details</span>
                </div>
                <div className="h-[480px]">
                  <GuidebookMap
                    places={mapPins}
                    activePlaceId={activePinId}
                    onSelectPlace={(id) => setActivePinId(id)}
                    centerLat={selectedGuidebook.latitude || listingLatitude || 24.7136}
                    centerLng={selectedGuidebook.longitude || listingLongitude || 46.6753}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 1: ADD / EDIT PLACE                                 */}
      {/* ========================================================= */}
      {modalType === "place" && (
        <ModalOverlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 space-y-5 max-h-[90vh] overflow-y-auto shadow-2xl border border-zinc-200 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-zinc-200/80 pb-3">
              <h3 className="text-base font-bold text-zinc-900">
                {editingItem ? "Edit recommendation" : "Add a place to guidebook"}
              </h3>
              <button
                type="button"
                onClick={() => setModalType(null)}
                className="w-8 h-8 rounded-full border border-zinc-200 text-zinc-500 hover:bg-zinc-100 flex items-center justify-center text-sm"
              >
                ✕
              </button>
            </div>

            {/* Step A: Search for Place */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-zinc-900">Search for a place</label>
              <div className="relative">
                <input
                  type="text"
                  value={placeSearchInput}
                  onChange={(e) => setPlaceSearchInput(e.target.value)}
                  placeholder="e.g. Brew92, Kingdom Tower, Danube Supermarket..."
                  className="w-full rounded-2xl border border-zinc-200 bg-white p-3.5 pl-9 text-xs font-medium text-zinc-900 outline-none focus:border-zinc-400 shadow-2xs"
                />
                <span className="absolute left-3 top-3.5 text-xs text-zinc-400">🔍</span>
                {isSearchingPlaces && (
                  <span className="absolute right-3.5 top-3.5 text-[10px] text-zinc-400">Searching...</span>
                )}
              </div>

              {/* Duplicate Warning */}
              {duplicateWarning && (
                <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-center gap-2">
                  <span>⚠️</span>
                  <span>{duplicateWarning}</span>
                </div>
              )}

              {/* Search Suggestions */}
              {placeResults.length > 0 && !selectedPlace && (
                <div className="rounded-2xl border border-zinc-200 bg-white shadow-lg max-h-48 overflow-y-auto divide-y divide-zinc-100">
                  {placeResults.map((p) => (
                    <div
                      key={p.id}
                      onClick={() => handleSelectPlaceResult(p)}
                      className="p-3 hover:bg-amber-50/70 cursor-pointer transition-colors text-xs space-y-0.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-zinc-900">{p.name}</span>
                        {p.relativeDistance && (
                          <span className="text-[10px] text-zinc-500 font-semibold">{p.relativeDistance}</span>
                        )}
                      </div>
                      <span className="text-[10px] text-zinc-400 block truncate">{p.address}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Step B: Selected Place Details & Recommendation Form */}
            {selectedPlace && (
              <div className="space-y-4 pt-2 border-t border-zinc-100">
                <div className="p-3.5 rounded-2xl bg-zinc-50 border border-zinc-200/80 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-zinc-900 block">{selectedPlace.name}</span>
                    <span className="text-[10px] text-zinc-500 block truncate max-w-sm">{selectedPlace.address}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedPlace(null)}
                    className="text-xs text-zinc-500 hover:text-zinc-800 underline font-semibold"
                  >
                    Change
                  </button>
                </div>

                {/* Category Selector */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-zinc-900">Category</label>
                  <select
                    value={itemCategory}
                    onChange={(e) => setItemCategory(e.target.value)}
                    className="w-full rounded-2xl border border-zinc-200 bg-white p-3.5 text-xs font-semibold text-zinc-900 outline-none focus:border-zinc-400 shadow-2xs"
                  >
                    {GUIDEBOOK_CATEGORIES.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.icon} {cat.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Why do you recommend this place? */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-zinc-900">Why do you recommend this place?</label>
                    <span className="text-[10px] text-zinc-400">{recommendationText.length}/1200</span>
                  </div>
                  <textarea
                    rows={3}
                    value={recommendationText}
                    onChange={(e) => setRecommendationText(e.target.value)}
                    placeholder="e.g. My favorite place for breakfast. Try the outdoor terrace in the morning!"
                    className="w-full rounded-2xl border border-zinc-200 bg-white p-3.5 text-xs font-medium text-zinc-900 outline-none focus:border-zinc-400 shadow-2xs leading-relaxed"
                  />
                </div>

                {/* Personal Host Tip */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-zinc-900">
                    Host tip <span className="text-zinc-400 font-normal">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={hostTipText}
                    onChange={(e) => setHostTipText(e.target.value)}
                    placeholder="e.g. Ask for the terrace, or go before 9 AM to avoid queues."
                    className="w-full rounded-2xl border border-zinc-200 bg-white p-3.5 text-xs font-medium text-zinc-900 outline-none focus:border-zinc-400 shadow-2xs"
                  />
                </div>

                {/* Photo Upload */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-zinc-900">
                    Photo <span className="text-zinc-400 font-normal">(optional)</span>
                  </label>
                  {itemPhotoUrl ? (
                    <div className="relative h-28 rounded-2xl overflow-hidden border border-zinc-200">
                      <img src={itemPhotoUrl} alt="Recommendation preview" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setItemPhotoUrl("")}
                        className="absolute top-2 right-2 bg-black/60 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <label className="border border-dashed border-zinc-300 hover:border-zinc-400 rounded-2xl p-4 flex items-center justify-center gap-2 cursor-pointer bg-zinc-50 hover:bg-zinc-100 text-xs font-semibold text-zinc-700 transition-all">
                      <span>📷</span>
                      <span>{isUploadingItemPhoto ? "Uploading..." : "Upload photo"}</span>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="hidden"
                        disabled={isUploadingItemPhoto}
                        onChange={(e) => e.target.files?.[0] && handlePhotoUpload(e.target.files[0], "item")}
                      />
                    </label>
                  )}
                </div>

                {/* Favorite Checkbox */}
                <label className="flex items-center gap-2.5 p-3 rounded-2xl bg-amber-50/60 border border-amber-200/60 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isFavoriteItem}
                    onChange={(e) => setIsFavoriteItem(e.target.checked)}
                    className="w-4 h-4 rounded text-amber-500 focus:ring-amber-400"
                  />
                  <div>
                    <span className="text-xs font-bold text-zinc-900 block">⭐ Highlight as Host Favorite</span>
                    <span className="text-[10px] text-zinc-500 block">Standout recommendation shown prominently to guests</span>
                  </div>
                </label>

                {/* Modal Actions */}
                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setModalType(null)}
                    className="rounded-full border border-zinc-200 px-5 py-2.5 text-xs font-semibold text-zinc-600 hover:bg-zinc-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSavePlaceItem}
                    className="rounded-full bg-[#FEE08B] hover:bg-[#FDE047] text-zinc-950 font-semibold text-xs px-6 py-2.5 shadow-2xs cursor-pointer"
                  >
                    {editingItem ? "Save changes" : "Add to guidebook"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </ModalOverlay>
      )}

      {/* ========================================================= */}
      {/* MODAL 2: ADD / EDIT NEIGHBORHOOD OR TIP                   */}
      {/* ========================================================= */}
      {(modalType === "neighborhood" || modalType === "tip") && (
        <ModalOverlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto shadow-2xl border border-zinc-200 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-zinc-200/80 pb-3">
              <h3 className="text-base font-bold text-zinc-900">
                {modalType === "neighborhood" ? "Add neighborhood advice" : "Add a local tip"}
              </h3>
              <button
                type="button"
                onClick={() => setModalType(null)}
                className="w-8 h-8 rounded-full border border-zinc-200 text-zinc-500 hover:bg-zinc-100 flex items-center justify-center text-sm"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3.5">
              {modalType === "tip" && (
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-zinc-900">Tip category</label>
                  <select
                    value={simpleCategory}
                    onChange={(e) => setSimpleCategory(e.target.value)}
                    className="w-full rounded-2xl border border-zinc-200 bg-white p-3 text-xs font-semibold text-zinc-900 outline-none shadow-2xs"
                  >
                    {TIP_CATEGORIES.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.icon} {cat.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-zinc-900">
                  {modalType === "neighborhood" ? "Neighborhood name" : "Tip title"}
                </label>
                <input
                  type="text"
                  value={simpleTitle}
                  onChange={(e) => setSimpleTitle(e.target.value)}
                  placeholder={modalType === "neighborhood" ? "e.g. Al Olaya" : "e.g. Best time to explore the old town"}
                  className="w-full rounded-2xl border border-zinc-200 bg-white p-3.5 text-xs font-medium text-zinc-900 outline-none focus:border-zinc-400 shadow-2xs"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-zinc-900">
                  {modalType === "neighborhood" ? "Description & why you recommend it" : "Advice / details"}
                </label>
                <textarea
                  rows={3}
                  value={simpleDesc}
                  onChange={(e) => setSimpleDesc(e.target.value)}
                  placeholder={
                    modalType === "neighborhood"
                      ? "A vibrant central area with fantastic cafés and walkable boutiques..."
                      : "Ride-hailing apps are the easiest and most reliable way to get around after 10 PM."
                  }
                  className="w-full rounded-2xl border border-zinc-200 bg-white p-3.5 text-xs font-medium text-zinc-900 outline-none focus:border-zinc-400 shadow-2xs"
                />
              </div>

              {modalType === "neighborhood" && (
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-zinc-900">Insider tip (optional)</label>
                  <input
                    type="text"
                    value={simpleTip}
                    onChange={(e) => setSimpleTip(e.target.value)}
                    placeholder="e.g. Walk around Tahlia Street in the evening for the best atmosphere."
                    className="w-full rounded-2xl border border-zinc-200 bg-white p-3.5 text-xs font-medium text-zinc-900 outline-none focus:border-zinc-400 shadow-2xs"
                  />
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setModalType(null)}
                  className="rounded-full border border-zinc-200 px-5 py-2 text-xs font-semibold text-zinc-600 hover:bg-zinc-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!simpleTitle.trim()}
                  onClick={handleSaveSimpleItem}
                  className="rounded-full bg-[#FEE08B] hover:bg-[#FDE047] text-zinc-950 font-semibold text-xs px-6 py-2 shadow-2xs disabled:opacity-50 cursor-pointer"
                >
                  {editingItem ? "Save changes" : "Add to guidebook"}
                </button>
              </div>
            </div>
          </div>
        </ModalOverlay>
      )}

      {/* ========================================================= */}
      {/* MODAL 3: DELETE CONFIRMATION                              */}
      {/* ========================================================= */}
      {(modalType === "delete_item" || modalType === "delete_gb") && (
        <ModalOverlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 space-y-4 shadow-2xl border border-zinc-200 text-center animate-in zoom-in-95">
            <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto text-xl">
              🗑️
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-zinc-900">
                {modalType === "delete_item" ? "Remove this recommendation?" : "Delete this guidebook?"}
              </h3>
              <p className="text-xs text-zinc-500 font-normal">
                {modalType === "delete_item"
                  ? "This place will be removed from your guidebook."
                  : "This action cannot be undone. Guests will no longer see this guidebook."}
              </p>
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setModalType(null);
                  setItemToDelete(null);
                  setGbToDelete(null);
                }}
                className="rounded-full border border-zinc-200 px-5 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={modalType === "delete_item" ? handleConfirmDeleteItem : handleConfirmDeleteGuidebook}
                className="rounded-full bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs px-5 py-2 shadow-2xs cursor-pointer"
              >
                Remove
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}
    </div>
  );
}
