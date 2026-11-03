"use client";

import React, { useCallback, useId, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useLanguage } from "@/lib/i18n/language-context";
import {
  PHOTO_TOUR_CATEGORIES,
  PHOTO_TOUR_CATEGORY_GROUPS,
  type PhotoRoomAssignment,
  type PhotoRoomType,
  resolvePhotoRoomType,
} from "@/lib/listing/photo-room-assignments";
import { RoomIllustration } from "./RoomIllustrations";
import { ModalOverlay } from "@/components/ui/modal-overlay";
import {
  RoomAmenitiesPanel,
  RoomPrivacyPanel,
  RoomAccessibilityPanel,
  RoomSleepingPanel,
} from "./RoomDetailsPanels";

// Documented room categories: "Living Room", "Bedroom", "Bathroom", "Kitchen", "Dining Area", "Workspace", "Exterior", "Patio or Balcony", "Pool or Hot Tub", "Unassigned Photos"

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ACCEPTED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);

export interface RoomItem {
  id: string;
  name: string;
  type: string;
  beds?: Array<{ type: string; count: number }>;
  amenities?: string[];
  hasPrivateBathroom?: boolean;
  privacy?: {
    hasPrivateBathroom?: boolean;
    hasDoorLock?: boolean;
    isPrivate?: boolean;
    [key: string]: any;
  };
  accessibilityFeatures?: string[];
  accessibilityDetails?: Array<{
    featureId: string;
    photos: string[];
  }>;
}

export interface PhotoTourManagerProps {
  photos: string[];
  photoRoomAssignments: PhotoRoomAssignment[];
  onChange: (photos: string[]) => void;
  onChangeRoomAssignments: (assignments: PhotoRoomAssignment[]) => void;
  rooms?: RoomItem[];
  onChangeRooms?: (rooms: RoomItem[]) => void;
  onSave: (overrides?: Record<string, any>) => void;
  isSaving: boolean;
  isLoading?: boolean;
  onBack?: () => void;
  setActiveSection?: (section: any) => void;
  presentation?: "host" | "admin";
}

// Available room categories for adding a room/space
const CATEGORY_ITEMS: Array<{ id: PhotoRoomType; label: string; group: string }> = [
  { id: "LIVING_ROOM", label: "Living Room", group: "main_rooms" },
  { id: "DINING_AREA", label: "Dining Area", group: "main_rooms" },
  { id: "BEDROOM", label: "Bedroom", group: "main_rooms" },
  { id: "BATHROOM", label: "Full Bathroom", group: "main_rooms" },
  { id: "HALF_BATHROOM", label: "Half Bathroom", group: "main_rooms" },
  { id: "KITCHEN", label: "Kitchen", group: "main_rooms" },
  { id: "WORKSPACE", label: "Workspace", group: "work_entertainment" },
  { id: "ART_STUDIO", label: "Art Studio", group: "work_entertainment" },
  { id: "GAME_ROOM", label: "Game Room", group: "work_entertainment" },
  { id: "GYM", label: "Gym", group: "amenities_special_areas" },
  { id: "SWIMMING_POOL", label: "Swimming Pool", group: "amenities_special_areas" },
  { id: "HOT_TUB", label: "Hot Tub", group: "amenities_special_areas" },
  { id: "BALCONY", label: "Balcony", group: "outdoor_areas" },
  { id: "PATIO", label: "Patio", group: "outdoor_areas" },
  { id: "GARDEN", label: "Garden", group: "outdoor_areas" },
  { id: "BACKYARD", label: "Backyard", group: "outdoor_areas" },
  { id: "LAUNDRY_ROOM", label: "Laundry Room", group: "indoor_areas" },
  { id: "GARAGE", label: "Garage", group: "parking_access" },
  { id: "PARKING_AREA", label: "Parking Area", group: "parking_access" },
  { id: "PROPERTY_EXTERIOR", label: "Exterior", group: "views_surroundings" },
  { id: "OTHER_SPACE", label: "Other Space", group: "other" },
];

/**
 * Coordinated discriminated modal state.
 * Only ONE modal can be active at any given moment.
 * Eliminates modal stacking bugs completely.
 */
export type ActiveModalState =
  | { type: "none" }
  | {
      type: "photo-detail";
      photoUrl: string;
      photoIndex: number;
    }
  | {
      type: "move-photos";
      photoUrls: string[];
      sourceRoomId?: string | null;
      sourceRoomName?: string | null;
      returnToPhotoIndex?: number | null;
    }
  | {
      type: "add-room";
    }
  | {
      type: "add-photos-options";
      roomId?: string | null;
    }
  | {
      type: "choose-from-additional";
      targetRoomId: string;
      targetRoomName: string;
    }
  | {
      type: "confirm-delete-room";
      roomId: string;
      roomName: string;
    }
  | {
      type: "confirm-delete-photos";
      photoUrls: string[];
      returnToPhotoIndex?: number | null;
    };

export function PhotoTourManager({
  photos = [],
  photoRoomAssignments = [],
  onChange,
  onChangeRoomAssignments,
  rooms = [],
  onChangeRooms,
  onSave,
  isSaving,
  isLoading,
  onBack,
  setActiveSection,
  presentation = "host",
}: PhotoTourManagerProps) {
  const { t } = useLanguage();
  const fileInputId = useId();

  // Navigation view: "overview" | "room-detail" | "all-photos"
  const [viewMode, setViewMode] = useState<"overview" | "room-detail" | "all-photos">("overview");
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);

  // Single discriminated modal controller
  const [activeModal, setActiveModal] = useState<ActiveModalState>({ type: "none" });

  // Room Detail side editor: null | "sleeping" | "privacy" | "amenities" | "accessibility"
  const [activeDetailTab, setActiveDetailTab] = useState<"sleeping" | "privacy" | "amenities" | "accessibility" | null>(null);

  // Draft state for room detail editor
  const [draftAmenities, setDraftAmenities] = useState<Set<string>>(new Set());
  const [draftPrivateBathroom, setDraftPrivateBathroom] = useState(false);
  const [draftDoorLock, setDraftDoorLock] = useState(false);
  const [draftAccessibility, setDraftAccessibility] = useState<Set<string>>(new Set());
  const [draftAccessibilityDetails, setDraftAccessibilityDetails] = useState<Array<{ featureId: string; photos: string[] }>>([]);
  const [draftBeds, setDraftBeds] = useState<Array<{ type: string; count: number }>>([]);

  // In-progress photo description
  const [editDescription, setEditDescription] = useState<string>("");

  // Manage selection mode (in page gallery)
  const [isManageMode, setIsManageMode] = useState(false);
  const [selectedPhotoUrls, setSelectedPhotoUrls] = useState<Set<string>>(new Set());

  // Modal sub-states
  const [addRoomSearch, setAddRoomSearch] = useState("");
  const [selectedCategoryToAdd, setSelectedCategoryToAdd] = useState<PhotoRoomType | null>(null);

  const [selectedAdditionalUrls, setSelectedAdditionalUrls] = useState<Set<string>>(new Set());

  const [moveTargetRoomId, setMoveTargetRoomId] = useState<string | null>(null);
  const [moveTargetCategory, setMoveTargetCategory] = useState<PhotoRoomType | null>(null);

  // Upload progress state
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgressText, setUploadProgressText] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  const uploadInputRef = useRef<HTMLInputElement>(null);
  const uploadForRoomTarget = useRef<string | null>(null);

  // Show a temporary feedback toast
  const showToast = useCallback((msg: string) => {
    setSuccessToast(msg);
    setTimeout(() => {
      setSuccessToast((current) => (current === msg ? null : current));
    }, 3500);
  }, []);

  // Map of URL -> assignment
  const assignmentByUrl = useMemo(() => {
    const map = new Map<string, PhotoRoomAssignment>();
    for (const a of photoRoomAssignments) {
      if (a.url) map.set(a.url, a);
    }
    return map;
  }, [photoRoomAssignments]);

  // Derive consolidated rooms list
  const consolidatedRooms = useMemo(() => {
    const list: RoomItem[] = [];
    const seenIds = new Set<string>();

    if (Array.isArray(rooms) && rooms.length > 0) {
      for (const r of rooms) {
        if (r && r.id && !seenIds.has(r.id)) {
          seenIds.add(r.id);
          list.push({
            ...r,
            id: r.id,
            name: r.name || "Room",
            type: r.type || "OTHER",
            beds: Array.isArray(r.beds) ? r.beds : [],
            amenities: Array.isArray(r.amenities) ? r.amenities : [],
            hasPrivateBathroom: r.hasPrivateBathroom,
            privacy: r.privacy,
            accessibilityFeatures: Array.isArray(r.accessibilityFeatures) ? r.accessibilityFeatures : [],
            accessibilityDetails: Array.isArray(r.accessibilityDetails) ? r.accessibilityDetails : [],
          });
        }
      }
    }

    for (const a of photoRoomAssignments) {
      const id = a.roomInstanceId || a.roomType;
      if (id && !seenIds.has(id)) {
        seenIds.add(id);
        const cat = CATEGORY_ITEMS.find((c) => c.id === a.roomType);
        list.push({
          id,
          name: a.roomLabel || (cat ? cat.label : a.roomType || "Room"),
          type: a.roomType || "OTHER",
          amenities: [],
          accessibilityFeatures: [],
          accessibilityDetails: [],
        });
      }
    }

    if (list.length === 0) {
      list.push(
        { id: "room_living", name: "Living Room", type: "LIVING_ROOM", amenities: [], accessibilityFeatures: [] },
        { id: "room_bed_1", name: "Bedroom", type: "BEDROOM", beds: [{ type: "QUEEN", count: 1 }], amenities: [], accessibilityFeatures: [] },
        { id: "room_bath_1", name: "Full Bathroom", type: "BATHROOM", amenities: [], accessibilityFeatures: [] },
        { id: "room_kitchen", name: "Kitchen", type: "KITCHEN", amenities: [], accessibilityFeatures: [] },
        { id: "room_dining", name: "Dining Area", type: "DINING_AREA", amenities: [], accessibilityFeatures: [] },
      );
    }

    return list;
  }, [rooms, photoRoomAssignments]);

  // Photos per room
  const photosByRoomId = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const r of consolidatedRooms) {
      map.set(r.id, []);
    }
    const unassigned: string[] = [];

    for (const url of photos) {
      const assignment = assignmentByUrl.get(url);
      if (!assignment) {
        unassigned.push(url);
        continue;
      }

      let matched = false;
      if (assignment.roomInstanceId && map.has(assignment.roomInstanceId)) {
        map.get(assignment.roomInstanceId)!.push(url);
        matched = true;
      } else if (assignment.roomType) {
        const found = consolidatedRooms.find((r) => r.type === assignment.roomType || r.id === assignment.roomType);
        if (found && map.has(found.id)) {
          map.get(found.id)!.push(url);
          matched = true;
        }
      }

      if (!matched) {
        unassigned.push(url);
      }
    }

    map.set("UNASSIGNED", unassigned);
    return map;
  }, [photos, consolidatedRooms, assignmentByUrl]);

  // Active room data
  const activeRoom = useMemo(() => {
    if (!activeRoomId) return null;
    if (activeRoomId === "UNASSIGNED") {
      return { id: "UNASSIGNED", name: "Additional photos", type: "UNASSIGNED_PHOTOS" };
    }
    return consolidatedRooms.find((r) => r.id === activeRoomId) || null;
  }, [activeRoomId, consolidatedRooms]);

  // Active room photos
  const activeRoomPhotos = useMemo(() => {
    if (!activeRoomId) return [];
    return photosByRoomId.get(activeRoomId) || [];
  }, [activeRoomId, photosByRoomId]);

  // Unassigned photos list
  const additionalPhotos = useMemo(() => {
    return photosByRoomId.get("UNASSIGNED") || [];
  }, [photosByRoomId]);

  // Count of empty rooms
  const emptyRoomsCount = useMemo(() => {
    return consolidatedRooms.filter((r) => (photosByRoomId.get(r.id)?.length || 0) === 0).length;
  }, [consolidatedRooms, photosByRoomId]);

  // Get photo description
  const getPhotoDescription = useCallback(
    (url: string) => {
      const assignment = assignmentByUrl.get(url);
      return (assignment?.description as string) || (assignment?.caption as string) || "";
    },
    [assignmentByUrl],
  );

  // Helper to persist description update immediately
  const persistPhotoDescription = useCallback(
    (url: string, description: string) => {
      const trimmed = description.trim();
      const existing = assignmentByUrl.get(url);
      const nextAssignments = photoRoomAssignments.filter((a) => a.url !== url);

      if (existing) {
        nextAssignments.push({
          ...existing,
          description: trimmed || null,
        });
      } else if (trimmed) {
        nextAssignments.push({
          url,
          roomType: null,
          description: trimmed,
        });
      }

      onChangeRoomAssignments(nextAssignments);
      onSave({ photoRoomAssignments: nextAssignments });
    },
    [assignmentByUrl, photoRoomAssignments, onChangeRoomAssignments, onSave],
  );

  // Persist room updates cleanly to parent and backend
  const persistRoomUpdates = useCallback(
    (roomId: string, updates: Partial<RoomItem>) => {
      const currentRoomsList = Array.isArray(rooms) && rooms.length > 0 ? rooms : consolidatedRooms;
      const exists = currentRoomsList.some((r) => r.id === roomId);

      let updatedList: RoomItem[];
      if (exists) {
        updatedList = currentRoomsList.map((r) =>
          r.id === roomId ? { ...r, ...updates } : r
        );
      } else {
        const cur = consolidatedRooms.find((r) => r.id === roomId);
        updatedList = [
          ...currentRoomsList,
          {
            id: roomId,
            name: cur?.name || "Room",
            type: cur?.type || "BEDROOM",
            ...updates,
          },
        ];
      }

      onChangeRooms?.(updatedList);
      onSave({ rooms: updatedList });
    },
    [rooms, consolidatedRooms, onChangeRooms, onSave],
  );

  // Sync draft state when active room or detail tab changes
  const handleOpenDetailTab = useCallback(
    (tab: "sleeping" | "privacy" | "amenities" | "accessibility") => {
      if (!activeRoom) return;
      setActiveDetailTab(tab);
      setDraftAmenities(new Set(activeRoom.amenities || []));
      setDraftPrivateBathroom(Boolean(activeRoom.hasPrivateBathroom ?? activeRoom.privacy?.hasPrivateBathroom));
      setDraftDoorLock(Boolean(activeRoom.privacy?.hasDoorLock));
      setDraftAccessibility(new Set(activeRoom.accessibilityFeatures || []));
      setDraftAccessibilityDetails(activeRoom.accessibilityDetails || []);
      setDraftBeds(
        activeRoom.beds && activeRoom.beds.length > 0
          ? [...activeRoom.beds]
          : [{ type: "QUEEN", count: 1 }],
      );
    },
    [activeRoom],
  );

  const handleCancelDetail = useCallback(() => {
    if (activeRoom) {
      setDraftAmenities(new Set(activeRoom.amenities || []));
      setDraftPrivateBathroom(Boolean(activeRoom.hasPrivateBathroom ?? activeRoom.privacy?.hasPrivateBathroom));
      setDraftDoorLock(Boolean(activeRoom.privacy?.hasDoorLock));
      setDraftAccessibility(new Set(activeRoom.accessibilityFeatures || []));
      setDraftAccessibilityDetails(activeRoom.accessibilityDetails || []);
      setDraftBeds(
        activeRoom.beds && activeRoom.beds.length > 0
          ? [...activeRoom.beds]
          : [{ type: "QUEEN", count: 1 }],
      );
    }
    setActiveDetailTab(null);
  }, [activeRoom]);

  const handleSaveAmenities = useCallback(() => {
    if (!activeRoom) return;
    const nextAmenities = Array.from(draftAmenities);
    persistRoomUpdates(activeRoom.id, { amenities: nextAmenities });
    setActiveDetailTab(null);
    showToast("Amenities saved");
  }, [activeRoom, draftAmenities, persistRoomUpdates, showToast]);

  const handleSavePrivacy = useCallback(() => {
    if (!activeRoom) return;
    persistRoomUpdates(activeRoom.id, {
      hasPrivateBathroom: draftPrivateBathroom,
      privacy: {
        ...(activeRoom.privacy || {}),
        hasPrivateBathroom: draftPrivateBathroom,
        hasDoorLock: draftDoorLock,
      },
    });
    setActiveDetailTab(null);
    showToast("Privacy info saved");
  }, [activeRoom, draftPrivateBathroom, draftDoorLock, persistRoomUpdates, showToast]);

  const handleSaveAccessibility = useCallback(() => {
    if (!activeRoom) return;
    const nextFeatures = Array.from(draftAccessibility);
    persistRoomUpdates(activeRoom.id, {
      accessibilityFeatures: nextFeatures,
      accessibilityDetails: draftAccessibilityDetails,
    });
    setActiveDetailTab(null);
    showToast("Accessibility features saved");
  }, [activeRoom, draftAccessibility, draftAccessibilityDetails, persistRoomUpdates, showToast]);

  const handleSaveSleeping = useCallback(() => {
    if (!activeRoom) return;
    persistRoomUpdates(activeRoom.id, {
      beds: draftBeds.filter((b) => b.count > 0),
    });
    setActiveDetailTab(null);
    showToast("Sleeping arrangements saved");
  }, [activeRoom, draftBeds, persistRoomUpdates, showToast]);

  const handleToggleAmenity = useCallback((id: string) => {
    setDraftAmenities((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleToggleAccessibilityFeature = useCallback((id: string) => {
    setDraftAccessibility((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleAddPhotoEvidence = useCallback((featureId: string, photoUrl: string) => {
    setDraftAccessibilityDetails((prev) => {
      const existing = prev.find((d) => d.featureId === featureId);
      if (existing) {
        return prev.map((d) =>
          d.featureId === featureId
            ? { ...d, photos: [...new Set([...d.photos, photoUrl])] }
            : d,
        );
      }
      return [...prev, { featureId, photos: [photoUrl] }];
    });
  }, []);

  const handleRemovePhotoEvidence = useCallback((featureId: string, photoUrl: string) => {
    setDraftAccessibilityDetails((prev) => {
      return prev.map((d) =>
        d.featureId === featureId
          ? { ...d, photos: d.photos.filter((p) => p !== photoUrl) }
          : d,
      );
    });
  }, []);

  const handleChangeBedCount = useCallback((bedType: string, delta: number) => {
    setDraftBeds((prev) => {
      const existing = prev.find((b) => b.type.toUpperCase() === bedType.toUpperCase());
      const currentCount = existing?.count || 0;
      const nextCount = Math.max(0, currentCount + delta);

      if (existing) {
        return prev.map((b) =>
          b.type.toUpperCase() === bedType.toUpperCase()
            ? { ...b, count: nextCount }
            : b,
        );
      }
      if (nextCount > 0) {
        return [...prev, { type: bedType.toUpperCase(), count: nextCount }];
      }
      return prev;
    });
  }, []);

  // Sync URL parameters on mount and when room/tab changes
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get("room");
    const tabParam = params.get("tab") as "sleeping" | "privacy" | "amenities" | "accessibility" | null;
    if (roomParam && consolidatedRooms.some((r) => r.id === roomParam)) {
      setActiveRoomId(roomParam);
      setViewMode("room-detail");
      if (tabParam && ["sleeping", "privacy", "amenities", "accessibility"].includes(tabParam)) {
        setActiveDetailTab(tabParam);
      }
    }
  }, [consolidatedRooms]);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (viewMode === "room-detail" && activeRoomId) {
      url.searchParams.set("room", activeRoomId);
      if (activeDetailTab) {
        url.searchParams.set("tab", activeDetailTab);
      } else {
        url.searchParams.delete("tab");
      }
    } else {
      url.searchParams.delete("room");
      url.searchParams.delete("tab");
    }
    window.history.replaceState({}, "", url.toString());
  }, [viewMode, activeRoomId, activeDetailTab]);

  // Open photo editor popup
  const handleOpenPhotoEditor = (photoUrl: string) => {
    const idx = photos.indexOf(photoUrl);
    if (idx !== -1) {
      setEditDescription(getPhotoDescription(photoUrl));
      setActiveModal({
        type: "photo-detail",
        photoUrl,
        photoIndex: idx,
      });
    }
  };

  // Close any open modal
  const handleCloseModal = () => {
    // If closing from photo detail and description changed, auto-save
    if (activeModal.type === "photo-detail") {
      const trimmed = editDescription.trim();
      if (trimmed !== (getPhotoDescription(activeModal.photoUrl) || "")) {
        persistPhotoDescription(activeModal.photoUrl, trimmed);
      }
    }
    setActiveModal({ type: "none" });
    setMoveTargetRoomId(null);
    setMoveTargetCategory(null);
    setSelectedCategoryToAdd(null);
    setAddRoomSearch("");
    setSelectedAdditionalUrls(new Set());
  };

  // Navigate between photos inside photo detail modal
  const handleNavigatePhoto = (direction: "prev" | "next") => {
    if (activeModal.type !== "photo-detail") return;
    const currentIdx = activeModal.photoIndex;
    const nextIdx = direction === "prev" ? currentIdx - 1 : currentIdx + 1;
    if (nextIdx >= 0 && nextIdx < photos.length) {
      const curUrl = activeModal.photoUrl;
      const trimmed = editDescription.trim();
      if (trimmed !== (getPhotoDescription(curUrl) || "")) {
        persistPhotoDescription(curUrl, trimmed);
      }

      const nextUrl = photos[nextIdx];
      setEditDescription(getPhotoDescription(nextUrl));
      setActiveModal({
        type: "photo-detail",
        photoUrl: nextUrl,
        photoIndex: nextIdx,
      });
    }
  };

  // Move from Photo Detail → Replaces photo detail modal with Move modal
  const handleOpenMoveFromDetail = () => {
    if (activeModal.type !== "photo-detail") return;
    const curUrl = activeModal.photoUrl;
    const curIdx = activeModal.photoIndex;
    const curAssignment = assignmentByUrl.get(curUrl);
    const curRoomName = curAssignment?.roomLabel || curAssignment?.roomType || "Additional photos";

    // Auto-save edited description if host made edits
    const trimmed = editDescription.trim();
    if (trimmed !== (getPhotoDescription(curUrl) || "")) {
      persistPhotoDescription(curUrl, trimmed);
    }

    setMoveTargetRoomId(null);
    setMoveTargetCategory(null);

    // Switch cleanly to Move Photos modal: photo-detail is unmounted!
    setActiveModal({
      type: "move-photos",
      photoUrls: [curUrl],
      sourceRoomId: curAssignment?.roomInstanceId || null,
      sourceRoomName: curRoomName,
      returnToPhotoIndex: curIdx,
    });
  };

  // Move from Manage Photos selection mode
  const handleOpenMoveFromManage = () => {
    const urls = Array.from(selectedPhotoUrls);
    if (urls.length === 0) return;
    setMoveTargetRoomId(null);
    setMoveTargetCategory(null);
    setActiveModal({
      type: "move-photos",
      photoUrls: urls,
      returnToPhotoIndex: null,
    });
  };

  // Save description manually from Photo Detail
  const handleSaveDescription = () => {
    if (activeModal.type !== "photo-detail") return;
    persistPhotoDescription(activeModal.photoUrl, editDescription);
    showToast("Description saved");
  };

  // Make cover photo
  const handleMakeCoverPhoto = (photoUrl: string) => {
    const currentIdx = photos.indexOf(photoUrl);
    if (currentIdx <= 0) return;
    const nextPhotos = [photoUrl, ...photos.filter((p) => p !== photoUrl)];
    onChange(nextPhotos);
    onSave({ photos: nextPhotos });
    showToast("Set as primary cover photo");
  };

  // Native upload handler
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (files.length === 0) return;

    const validFiles = files.filter((f) => ACCEPTED_TYPES.has(f.type) && f.size > 0 && f.size <= MAX_FILE_SIZE);
    if (validFiles.length === 0) {
      setErrorMessage("Please select valid JPEG, PNG, WebP, or AVIF images up to 10 MB each.");
      return;
    }

    setIsUploading(true);
    setErrorMessage(null);
    setUploadProgressText(`Uploading ${validFiles.length} photo${validFiles.length > 1 ? "s" : ""}...`);

    const targetRoom = uploadForRoomTarget.current;
    uploadForRoomTarget.current = null;

    const uploadedUrls: string[] = [];

    for (let i = 0; i < validFiles.length; i++) {
      const file = validFiles[i];
      setUploadProgressText(`Uploading ${i + 1} of ${validFiles.length}...`);
      try {
        const formData = new FormData();
        formData.append("file", file);
        const res = await fetch("/api/v1/upload/listing-photo", {
          method: "POST",
          body: formData,
        });
        const data = await res.json().catch(() => null);
        if (res.ok && data?.url) {
          uploadedUrls.push(String(data.url));
        } else {
          console.error("Upload error:", data?.error);
        }
      } catch (err) {
        console.error("Upload failed for file:", file.name, err);
      }
    }

    setIsUploading(false);
    setUploadProgressText(null);

    if (uploadedUrls.length === 0) {
      setErrorMessage("Failed to upload photos. Please check file format and try again.");
      return;
    }

    const nextPhotos = [...photos, ...uploadedUrls];
    onChange(nextPhotos);

    if (targetRoom && targetRoom !== "UNASSIGNED") {
      const room = consolidatedRooms.find((r) => r.id === targetRoom);
      if (room) {
        const newAssignments = [
          ...photoRoomAssignments,
          ...uploadedUrls.map((url) => ({
            url,
            roomType: resolvePhotoRoomType(room.type) || "OTHER_SPACE",
            roomInstanceId: room.id,
            roomLabel: room.name,
          })),
        ];
        onChangeRoomAssignments(newAssignments);
        onSave({ photos: nextPhotos, photoRoomAssignments: newAssignments });
      } else {
        onSave({ photos: nextPhotos });
      }
    } else {
      onSave({ photos: nextPhotos });
    }

    showToast(`Added ${uploadedUrls.length} photo${uploadedUrls.length > 1 ? "s" : ""}`);
    setActiveModal({ type: "none" });
  };

  const triggerUpload = (roomId?: string | null) => {
    uploadForRoomTarget.current = roomId || null;
    uploadInputRef.current?.click();
  };

  // Create room handler
  const handleCreateRoom = () => {
    if (!selectedCategoryToAdd) return;
    const cat = CATEGORY_ITEMS.find((c) => c.id === selectedCategoryToAdd);
    const label = cat ? cat.label : selectedCategoryToAdd;

    const existingWithSameType = consolidatedRooms.filter((r) => r.type === selectedCategoryToAdd);
    const roomName = existingWithSameType.length > 0 ? `${label} ${existingWithSameType.length + 1}` : label;

    const newId = `room_${selectedCategoryToAdd.toLowerCase()}_${Date.now()}`;
    const newRoom: RoomItem = {
      id: newId,
      name: roomName,
      type: selectedCategoryToAdd,
      beds: selectedCategoryToAdd === "BEDROOM" ? [{ type: "QUEEN", count: 1 }] : [],
    };

    const nextRooms = [...consolidatedRooms, newRoom];
    if (onChangeRooms) {
      onChangeRooms(nextRooms);
    }
    onSave({ rooms: nextRooms });

    setActiveModal({ type: "none" });
    setSelectedCategoryToAdd(null);
    setAddRoomSearch("");
    setActiveRoomId(newId);
    setViewMode("room-detail");
    showToast(`Added ${roomName}`);
  };

  // Delete active room handler
  const handleDeleteRoom = () => {
    if (activeModal.type !== "confirm-delete-room") return;
    const roomId = activeModal.roomId;

    const nextAssignments = photoRoomAssignments.filter(
      (a) => a.roomInstanceId !== roomId,
    );
    onChangeRoomAssignments(nextAssignments);

    const nextRooms = consolidatedRooms.filter((r) => r.id !== roomId);
    if (onChangeRooms) {
      onChangeRooms(nextRooms);
    }
    onSave({ rooms: nextRooms, photoRoomAssignments: nextAssignments });

    setActiveModal({ type: "none" });
    setActiveRoomId(null);
    setViewMode("overview");
    showToast(`Room removed. Photos moved to Additional photos.`);
  };

  // Execute Move photos action
  const handleExecuteMove = () => {
    if (activeModal.type !== "move-photos") return;
    const urlsToMove = activeModal.photoUrls;
    if (urlsToMove.length === 0) return;

    let destinationId = moveTargetRoomId;
    let destinationType = moveTargetCategory;
    let destinationLabel = "";

    // Moving to a new category: create room first
    if (destinationType && !destinationId) {
      const cat = CATEGORY_ITEMS.find((c) => c.id === destinationType);
      destinationLabel = cat ? cat.label : destinationType;
      const count = consolidatedRooms.filter((r) => r.type === destinationType).length;
      const name = count > 0 ? `${destinationLabel} ${count + 1}` : destinationLabel;
      destinationId = `room_${destinationType.toLowerCase()}_${Date.now()}`;

      const newRoom: RoomItem = {
        id: destinationId,
        name,
        type: destinationType,
      };
      const nextRooms = [...consolidatedRooms, newRoom];
      if (onChangeRooms) onChangeRooms(nextRooms);
      destinationLabel = name;
    } else if (destinationId === "UNASSIGNED") {
      destinationLabel = "Additional photos";
    } else {
      const existing = consolidatedRooms.find((r) => r.id === destinationId);
      if (existing) {
        destinationType = resolvePhotoRoomType(existing.type) || "OTHER_SPACE";
        destinationLabel = existing.name;
      }
    }

    const nextAssignments = photoRoomAssignments.filter((a) => !urlsToMove.includes(a.url));

    if (destinationId !== "UNASSIGNED" && destinationType) {
      for (const url of urlsToMove) {
        const prev = assignmentByUrl.get(url);
        nextAssignments.push({
          ...(prev || {}),
          url,
          roomType: destinationType,
          roomInstanceId: destinationId,
          roomLabel: destinationLabel,
        });
      }
    }

    onChangeRoomAssignments(nextAssignments);
    onSave({ photoRoomAssignments: nextAssignments });

    setActiveModal({ type: "none" });
    setMoveTargetRoomId(null);
    setMoveTargetCategory(null);
    setSelectedPhotoUrls(new Set());
    setIsManageMode(false);
    showToast(`Moved ${urlsToMove.length} photo${urlsToMove.length > 1 ? "s" : ""} to ${destinationLabel}`);
  };

  // Move photos from Additional Photos to Active Room
  const handleMoveFromAdditionalToActive = () => {
    if (activeModal.type !== "choose-from-additional") return;
    const targetRoomId = activeModal.targetRoomId;
    const targetRoomName = activeModal.targetRoomName;
    const targetRoom = consolidatedRooms.find((r) => r.id === targetRoomId);
    const urlsToMove = Array.from(selectedAdditionalUrls);
    if (urlsToMove.length === 0 || !targetRoom) return;

    const nextAssignments = photoRoomAssignments.filter((a) => !urlsToMove.includes(a.url));
    for (const url of urlsToMove) {
      const prev = assignmentByUrl.get(url);
      nextAssignments.push({
        ...(prev || {}),
        url,
        roomType: resolvePhotoRoomType(targetRoom.type) || "OTHER_SPACE",
        roomInstanceId: targetRoom.id,
        roomLabel: targetRoom.name,
      });
    }

    onChangeRoomAssignments(nextAssignments);
    onSave({ photoRoomAssignments: nextAssignments });

    setActiveModal({ type: "none" });
    setSelectedAdditionalUrls(new Set());
    showToast(`Added ${urlsToMove.length} photo${urlsToMove.length > 1 ? "s" : ""} to ${targetRoomName}`);
  };

  // Delete photos permanently
  const handleDeleteSelectedPhotos = () => {
    if (activeModal.type !== "confirm-delete-photos") return;
    const urlsToDelete = activeModal.photoUrls;
    if (urlsToDelete.length === 0) return;

    const deleteSet = new Set(urlsToDelete);
    const nextPhotos = photos.filter((p) => !deleteSet.has(p));
    const nextAssignments = photoRoomAssignments.filter((a) => !deleteSet.has(a.url));

    onChange(nextPhotos);
    onChangeRoomAssignments(nextAssignments);
    onSave({ photos: nextPhotos, photoRoomAssignments: nextAssignments });

    setSelectedPhotoUrls(new Set());
    setIsManageMode(false);
    setActiveModal({ type: "none" });

    showToast(`Deleted ${urlsToDelete.length} photo${urlsToDelete.length > 1 ? "s" : ""}`);
  };

  // Toggle selection
  const togglePhotoSelection = (url: string) => {
    setSelectedPhotoUrls((prev) => {
      const next = new Set(prev);
      if (next.has(url)) next.delete(url);
      else next.add(url);
      return next;
    });
  };

  // Filtered categories in Add Room modal
  const filteredCategories = useMemo(() => {
    if (!addRoomSearch.trim()) return CATEGORY_ITEMS;
    const q = addRoomSearch.toLowerCase();
    return CATEGORY_ITEMS.filter((c) => c.label.toLowerCase().includes(q) || c.id.toLowerCase().includes(q));
  }, [addRoomSearch]);

  return (
    <div className="relative w-full min-h-screen bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      {/* Hidden File Input for Native Upload */}
      <input
        ref={uploadInputRef}
        id={fileInputId}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        multiple
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Floating Success Feedback Toast */}
      {successToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-9999 rounded-full bg-zinc-900 dark:bg-zinc-100 px-5 py-2.5 text-xs font-medium text-white dark:text-zinc-950 shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-200">
          {successToast}
        </div>
      )}

      {/* Uploading Banner */}
      {isUploading && (
        <div className="sticky top-0 z-40 w-full bg-amber-500 text-zinc-950 px-4 py-2 text-center text-xs font-medium flex items-center justify-center gap-2 shadow-xs">
          <div className="size-3.5 border-2 border-zinc-950 border-t-transparent rounded-full animate-spin" />
          <span>{uploadProgressText || "Uploading photos..."}</span>
        </div>
      )}

      {/* Error Banner */}
      {errorMessage && (
        <div className="sticky top-0 z-40 w-full bg-rose-50 border-b border-rose-200 text-rose-800 px-4 py-2.5 text-center text-xs font-medium flex items-center justify-center gap-2">
          <span>{errorMessage}</span>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="text-xs font-medium underline ml-2 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          SELECTION MODE TOP BAR (Phase 5)
         ───────────────────────────────────────────────────────────── */}
      {isManageMode && (
        <div className="sticky top-0 z-30 flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 py-3 sm:px-8">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                setIsManageMode(false);
                setSelectedPhotoUrls(new Set());
              }}
              className="size-8 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center justify-center text-sm font-medium transition cursor-pointer"
              aria-label="Exit selection mode"
            >
              ✕
            </button>
            <span className="text-sm font-medium">
              {selectedPhotoUrls.size} selected
            </span>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => setSelectedPhotoUrls(new Set())}
              disabled={selectedPhotoUrls.size === 0}
              className="rounded-full px-3 py-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition"
            >
              Deselect
            </button>
            <button
              type="button"
              onClick={handleOpenMoveFromManage}
              disabled={selectedPhotoUrls.size === 0}
              className="rounded-full border border-zinc-300 dark:border-zinc-700 px-3.5 py-1.5 text-xs font-medium hover:border-zinc-900 dark:hover:border-zinc-400 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition"
            >
              Move
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveModal({
                  type: "confirm-delete-photos",
                  photoUrls: Array.from(selectedPhotoUrls),
                  returnToPhotoIndex: null,
                });
              }}
              disabled={selectedPhotoUrls.size === 0}
              className="rounded-full border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 px-3.5 py-1.5 text-xs font-medium text-rose-700 dark:text-rose-300 hover:bg-rose-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition"
            >
              Delete
            </button>
            <button
              type="button"
              onClick={() => {
                setIsManageMode(false);
                setSelectedPhotoUrls(new Set());
              }}
              className="rounded-full bg-zinc-900 dark:bg-zinc-100 px-4 py-1.5 text-xs font-medium text-white dark:text-zinc-950 hover:bg-black cursor-pointer transition"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          VIEW 1: PHOTO TOUR OVERVIEW (Phase 1)
         ───────────────────────────────────────────────────────────── */}
      {viewMode === "overview" && (
        <div className="max-w-6xl mx-auto px-4 py-6 sm:px-8 space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-medium tracking-tight">
                {t("host_photo_tour", "Photo tour")}
              </h1>
              <p className="mt-1 text-sm font-normal text-zinc-500 dark:text-zinc-400">
                Organize photos by room or space. Guests will only see your tour if every room has a photo.
              </p>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => setViewMode("all-photos")}
                className="inline-flex items-center gap-2 rounded-full border border-zinc-300 dark:border-zinc-700 px-4 py-2 text-sm font-medium hover:border-zinc-900 dark:hover:border-zinc-300 transition cursor-pointer"
              >
                <svg className="size-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <rect x="3" y="3" width="18" height="18" rx="2" strokeLinecap="round" strokeLinejoin="round" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <path d="m21 15-5-5L5 21" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span>All photos ({photos.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveModal({ type: "add-room" })}
                className="inline-flex items-center justify-center size-10 rounded-full border border-zinc-300 dark:border-zinc-700 hover:border-zinc-900 dark:hover:border-zinc-300 transition cursor-pointer"
                aria-label="Add room or space"
                title="Add room or space"
              >
                <span className="text-lg font-medium leading-none">+</span>
              </button>
            </div>
          </div>

          {/* View Your Tasks Card (If some rooms have 0 photos) */}
          {emptyRoomsCount > 0 && (
            <div
              onClick={() => {
                const firstEmpty = consolidatedRooms.find(
                  (r) => (photosByRoomId.get(r.id)?.length || 0) === 0,
                );
                if (firstEmpty) {
                  setActiveRoomId(firstEmpty.id);
                  setViewMode("room-detail");
                }
              }}
              className="flex items-center justify-between rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/70 dark:bg-amber-950/20 px-4 py-3 cursor-pointer hover:bg-amber-100/70 transition"
            >
              <div className="flex items-center gap-2 text-sm">
                <span className="size-2 rounded-full bg-amber-600 shrink-0" />
                <span className="font-medium text-amber-950 dark:text-amber-200">
                  View your tasks
                </span>
                <span className="text-zinc-600 dark:text-zinc-400 font-normal">
                  — Add photos to {emptyRoomsCount} room{emptyRoomsCount > 1 ? "s" : ""} to complete your photo tour
                </span>
              </div>
              <svg className="size-4 text-zinc-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="m9 5 7 7-7 7" />
              </svg>
            </div>
          )}

          {/* Room-based photo cards grid (3 columns desktop, 2 tablet, 1-2 mobile) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {consolidatedRooms.map((room) => {
              const roomPhotos = photosByRoomId.get(room.id) || [];
              const count = roomPhotos.length;
              const coverImg = count > 0 ? roomPhotos[0] : null;

              return (
                <div
                  key={room.id}
                  onClick={() => {
                    setActiveRoomId(room.id);
                    setViewMode("room-detail");
                  }}
                  className="group rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-2 overflow-hidden cursor-pointer hover:shadow-md transition duration-200"
                >
                  <div className="relative aspect-[4/3] w-full rounded-xl overflow-hidden bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                    {coverImg ? (
                      <img
                        src={coverImg}
                        alt={room.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center p-4">
                        <RoomIllustration type={room.type} size="md" />
                      </div>
                    )}
                  </div>

                  <div className="pt-2.5 pb-1 px-1.5">
                    <h2 className="text-base font-medium truncate text-zinc-900 dark:text-zinc-100">
                      {room.name}
                    </h2>
                    <p className="text-xs font-normal text-zinc-500 dark:text-zinc-400 mt-0.5">
                      {count > 0 ? `${count} photo${count > 1 ? "s" : ""}` : "Add photos"}
                    </p>
                  </div>
                </div>
              );
            })}

            {/* Additional Photos Card */}
            <div
              onClick={() => {
                setActiveRoomId("UNASSIGNED");
                setViewMode("room-detail");
              }}
              className="group rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-2 overflow-hidden cursor-pointer hover:shadow-md transition duration-200"
            >
              <div className="relative aspect-[4/3] w-full rounded-xl overflow-hidden bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                {additionalPhotos.length > 0 ? (
                  <img
                    src={additionalPhotos[0]}
                    alt="Additional photos"
                    className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center p-4">
                    <RoomIllustration type="UNASSIGNED" size="md" />
                  </div>
                )}
              </div>
              <div className="pt-2.5 pb-1 px-1.5">
                <h2 className="text-base font-medium truncate text-zinc-900 dark:text-zinc-100">
                  Additional photos
                </h2>
                <p className="text-xs font-normal text-zinc-500 dark:text-zinc-400 mt-0.5">
                  {additionalPhotos.length > 0
                    ? `${additionalPhotos.length} photo${additionalPhotos.length > 1 ? "s" : ""}`
                    : "Add photos"}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          VIEW 2: INDIVIDUAL ROOM DETAIL SCREEN (Phase 3 & Phase 10)
         ───────────────────────────────────────────────────────────── */}
      {viewMode === "room-detail" && activeRoom && (
        <>
          {/* DESKTOP SPLIT PANEL MODE (When a detail tab is active) */}
          {activeDetailTab !== null && (
            <div className="hidden md:flex flex-row min-h-[calc(100vh-4rem)] bg-white dark:bg-zinc-900">
              {/* Left Column: Room View (~58% width) */}
              <div className="w-[58%] border-r border-zinc-200 dark:border-zinc-800 p-6 sm:p-8 space-y-6 overflow-y-auto max-h-[calc(100vh-4rem)] custom-scrollbar">
                {/* Room Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={handleCancelDetail}
                      className="size-8 rounded-full border border-zinc-200 dark:border-zinc-700 hover:border-zinc-900 dark:hover:border-zinc-300 flex items-center justify-center text-zinc-700 dark:text-zinc-300 transition cursor-pointer shrink-0"
                      title="Back to room"
                    >
                      <svg className="size-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m15 19-7-7 7-7" />
                      </svg>
                    </button>
                    <div>
                      <h1 className="text-2xl font-medium tracking-tight text-zinc-900 dark:text-zinc-100">
                        {activeRoom.name}
                      </h1>
                      <p className="text-xs font-normal text-zinc-500 dark:text-zinc-400 mt-0.5">
                        {activeRoomPhotos.length} photo{activeRoomPhotos.length !== 1 ? "s" : ""}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {activeRoomPhotos.length > 0 && !isManageMode && (
                      <button
                        type="button"
                        onClick={() => setIsManageMode(true)}
                        className="rounded-full border border-zinc-300 dark:border-zinc-700 px-3.5 py-1.5 text-xs font-medium hover:border-zinc-900 dark:hover:border-zinc-300 transition cursor-pointer"
                      >
                        Manage photos
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => setActiveModal({ type: "add-photos-options", roomId: activeRoom.id })}
                      className="size-9 rounded-full border border-zinc-300 dark:border-zinc-700 hover:border-zinc-900 dark:hover:border-zinc-300 flex items-center justify-center text-base font-medium transition cursor-pointer"
                      title="Add photos"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Empty Room State */}
                {activeRoomPhotos.length === 0 ? (
                  <div className="rounded-2xl border-2 border-dashed border-zinc-300 dark:border-zinc-700 p-8 sm:p-12 flex flex-col items-center justify-center text-center space-y-4">
                    <RoomIllustration type={activeRoom.type} size="lg" />
                    <div>
                      <h3 className="text-base font-medium text-zinc-900 dark:text-zinc-100">
                        No photos in this room yet
                      </h3>
                      <p className="text-xs font-normal text-zinc-500 dark:text-zinc-400 max-w-sm mt-1">
                        Upload photos from your device or choose existing photos from Additional photos.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveModal({ type: "add-photos-options", roomId: activeRoom.id })}
                      className="rounded-lg border border-zinc-900 dark:border-zinc-100 px-5 py-2 text-xs font-medium text-zinc-900 dark:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer"
                    >
                      Add photo
                    </button>
                  </div>
                ) : (
                  /* Photo Grid */
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {activeRoomPhotos.map((url) => {
                      const isSelected = selectedPhotoUrls.has(url);
                      const isCover = photos[0] === url;
                      const desc = getPhotoDescription(url);

                      return (
                        <div
                          key={url}
                          onClick={() => {
                            if (isManageMode) {
                              togglePhotoSelection(url);
                            } else {
                              handleOpenPhotoEditor(url);
                            }
                          }}
                          className={`group relative aspect-[4/3] rounded-xl overflow-hidden bg-zinc-100 dark:bg-zinc-800 cursor-pointer border transition ${isSelected
                            ? "border-zinc-950 dark:border-zinc-100 ring-2 ring-zinc-950/20 dark:ring-zinc-100/30"
                            : "border-transparent hover:border-zinc-300 dark:hover:border-zinc-700"
                            }`}
                        >
                          <img
                            src={url}
                            alt=""
                            className="size-full object-cover group-hover:scale-[1.02] transition duration-200"
                            loading="lazy"
                          />

                          {/* Cover Photo Badge */}
                          {isCover && (
                            <div className="absolute top-2.5 left-2.5 z-10 rounded-full bg-zinc-900/90 backdrop-blur-xs text-white px-2.5 py-0.5 text-[10px] font-medium shadow-xs">
                              Cover photo
                            </div>
                          )}

                          {/* Selection Checkmark Overlay */}
                          {isManageMode && (
                            <div className="absolute top-2.5 right-2.5 z-10">
                              <div
                                className={`size-6 rounded-full flex items-center justify-center text-xs font-medium border shadow-xs transition ${isSelected
                                  ? "bg-zinc-900 text-white border-zinc-900 dark:bg-zinc-100 dark:text-zinc-900"
                                  : "bg-white/90 text-transparent border-zinc-300 hover:border-zinc-500"
                                  }`}
                              >
                                ✓
                              </div>
                            </div>
                          )}

                          {/* Description indicator snippet on hover */}
                          {desc && !isManageMode && (
                            <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent p-2.5 pt-6 text-white text-[11px] font-normal truncate opacity-0 group-hover:opacity-100 transition">
                              {desc}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Additional Room Details Links with Active Highlight */}
                {activeRoom.id !== "UNASSIGNED" && (
                  <div className="pt-6 border-t border-zinc-200 dark:border-zinc-800 space-y-1.5">
                    {/* Sleeping arrangements (for bedrooms or rooms with beds) */}
                    {(activeRoom.type === "BEDROOM" || (activeRoom.beds && activeRoom.beds.length > 0)) && (
                      <div
                        onClick={() => handleOpenDetailTab("sleeping")}
                        className={`flex items-center justify-between p-3.5 rounded-xl transition cursor-pointer select-none ${
                          activeDetailTab === "sleeping"
                            ? "bg-zinc-100 dark:bg-zinc-800 shadow-2xs"
                            : "hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
                        }`}
                      >
                        <div>
                          <p className="text-xs font-medium text-zinc-900 dark:text-zinc-100">
                            Sleeping arrangements
                          </p>
                          <p className="text-[11px] font-normal text-zinc-500 dark:text-zinc-400 mt-0.5">
                            {activeRoom.beds && activeRoom.beds.length > 0
                              ? activeRoom.beds.map((b) => `${b.count} ${b.type.toLowerCase().replace(/_/g, " ")} bed${b.count > 1 ? "s" : ""}`).join(", ")
                              : "Add details"}
                          </p>
                        </div>
                        <svg className="size-4 text-zinc-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m9 5 7 7-7 7" />
                        </svg>
                      </div>
                    )}

                    {/* Privacy info */}
                    <div
                      onClick={() => handleOpenDetailTab("privacy")}
                      className={`flex items-center justify-between p-3.5 rounded-xl transition cursor-pointer select-none ${
                        activeDetailTab === "privacy"
                          ? "bg-zinc-100 dark:bg-zinc-800 shadow-2xs"
                          : "hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
                      }`}
                    >
                      <div>
                        <p className="text-xs font-medium text-zinc-900 dark:text-zinc-100">
                          Privacy info
                        </p>
                        <p className="text-[11px] font-normal text-zinc-500 dark:text-zinc-400 mt-0.5">
                          {activeRoom.hasPrivateBathroom
                            ? "Private attached bathroom"
                            : activeRoom.privacy?.hasDoorLock
                            ? "Lock on room door"
                            : "Add details"}
                        </p>
                      </div>
                      <svg className="size-4 text-zinc-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m9 5 7 7-7 7" />
                      </svg>
                    </div>

                    {/* Amenities */}
                    <div
                      onClick={() => handleOpenDetailTab("amenities")}
                      className={`flex items-center justify-between p-3.5 rounded-xl transition cursor-pointer select-none ${
                        activeDetailTab === "amenities"
                          ? "bg-zinc-100 dark:bg-zinc-800 shadow-2xs"
                          : "hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
                      }`}
                    >
                      <div>
                        <p className="text-xs font-medium text-zinc-900 dark:text-zinc-100">
                          Amenities
                        </p>
                        <p className="text-[11px] font-normal text-zinc-500 dark:text-zinc-400 mt-0.5">
                          {activeRoom.amenities && activeRoom.amenities.length > 0
                            ? `${activeRoom.amenities.length} ${activeRoom.amenities.length === 1 ? "amenity" : "amenities"}`
                            : "Add details"}
                        </p>
                      </div>
                      <svg className="size-4 text-zinc-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m9 5 7 7-7 7" />
                      </svg>
                    </div>

                    {/* Accessibility features */}
                    <div
                      onClick={() => handleOpenDetailTab("accessibility")}
                      className={`flex items-center justify-between p-3.5 rounded-xl transition cursor-pointer select-none ${
                        activeDetailTab === "accessibility"
                          ? "bg-zinc-100 dark:bg-zinc-800 shadow-2xs"
                          : "hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
                      }`}
                    >
                      <div>
                        <p className="text-xs font-medium text-zinc-900 dark:text-zinc-100">
                          Accessibility features
                        </p>
                        <p className="text-[11px] font-normal text-zinc-500 dark:text-zinc-400 mt-0.5">
                          {activeRoom.accessibilityFeatures && activeRoom.accessibilityFeatures.length > 0
                            ? `${activeRoom.accessibilityFeatures.length} ${activeRoom.accessibilityFeatures.length === 1 ? "feature" : "features"}`
                            : "Add details"}
                        </p>
                      </div>
                      <svg className="size-4 text-zinc-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m9 5 7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                )}

                {/* Delete Room or Space */}
                {activeRoom.id !== "UNASSIGNED" && (
                  <div className="pt-4">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveModal({
                          type: "confirm-delete-room",
                          roomId: activeRoom.id,
                          roomName: activeRoom.name,
                        });
                      }}
                      className="inline-flex items-center gap-2 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 transition cursor-pointer"
                    >
                      <svg className="size-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      <span>Delete room or space</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Right Column: Dynamic Section Editor (~42% width) */}
              <div className="w-[42%] max-h-[calc(100vh-4rem)] overflow-hidden flex flex-col bg-white dark:bg-zinc-900">
                {activeDetailTab === "amenities" && (
                  <RoomAmenitiesPanel
                    room={activeRoom}
                    selectedAmenityIds={draftAmenities}
                    onToggleAmenity={handleToggleAmenity}
                    onDone={handleSaveAmenities}
                    onCancel={handleCancelDetail}
                    isSaving={isSaving}
                  />
                )}

                {activeDetailTab === "privacy" && (
                  <RoomPrivacyPanel
                    room={activeRoom}
                    hasPrivateBathroom={draftPrivateBathroom}
                    onTogglePrivateBathroom={() => setDraftPrivateBathroom((v) => !v)}
                    hasDoorLock={draftDoorLock}
                    onToggleDoorLock={() => setDraftDoorLock((v) => !v)}
                    onSave={handleSavePrivacy}
                    onCancel={handleCancelDetail}
                    isSaving={isSaving}
                  />
                )}

                {activeDetailTab === "accessibility" && (
                  <RoomAccessibilityPanel
                    room={activeRoom}
                    selectedFeatureIds={draftAccessibility}
                    onToggleFeature={handleToggleAccessibilityFeature}
                    accessibilityDetails={draftAccessibilityDetails}
                    onAddPhotoEvidence={handleAddPhotoEvidence}
                    onRemovePhotoEvidence={handleRemovePhotoEvidence}
                    onDone={handleSaveAccessibility}
                    onCancel={handleCancelDetail}
                    isSaving={isSaving}
                  />
                )}

                {activeDetailTab === "sleeping" && (
                  <RoomSleepingPanel
                    room={activeRoom}
                    beds={draftBeds}
                    onChangeBedCount={handleChangeBedCount}
                    onSave={handleSaveSleeping}
                    onCancel={handleCancelDetail}
                    isSaving={isSaving}
                  />
                )}
              </div>
            </div>
          )}

          {/* MOBILE FULL-SCREEN DETAIL VIEW (When a detail tab is active) */}
          {activeDetailTab !== null && (
            <div className="block md:hidden min-h-[calc(100vh-4rem)] bg-white dark:bg-zinc-900">
              <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
                <button
                  type="button"
                  onClick={handleCancelDetail}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white transition cursor-pointer"
                >
                  <svg className="size-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m15 19-7-7 7-7" />
                  </svg>
                  <span>Back to {activeRoom.name}</span>
                </button>
              </div>

              {activeDetailTab === "amenities" && (
                <RoomAmenitiesPanel
                  room={activeRoom}
                  selectedAmenityIds={draftAmenities}
                  onToggleAmenity={handleToggleAmenity}
                  onDone={handleSaveAmenities}
                  onCancel={handleCancelDetail}
                  isSaving={isSaving}
                />
              )}

              {activeDetailTab === "privacy" && (
                <RoomPrivacyPanel
                  room={activeRoom}
                  hasPrivateBathroom={draftPrivateBathroom}
                  onTogglePrivateBathroom={() => setDraftPrivateBathroom((v) => !v)}
                  hasDoorLock={draftDoorLock}
                  onToggleDoorLock={() => setDraftDoorLock((v) => !v)}
                  onSave={handleSavePrivacy}
                  onCancel={handleCancelDetail}
                  isSaving={isSaving}
                />
              )}

              {activeDetailTab === "accessibility" && (
                <RoomAccessibilityPanel
                  room={activeRoom}
                  selectedFeatureIds={draftAccessibility}
                  onToggleFeature={handleToggleAccessibilityFeature}
                  accessibilityDetails={draftAccessibilityDetails}
                  onAddPhotoEvidence={handleAddPhotoEvidence}
                  onRemovePhotoEvidence={handleRemovePhotoEvidence}
                  onDone={handleSaveAccessibility}
                  onCancel={handleCancelDetail}
                  isSaving={isSaving}
                />
              )}

              {activeDetailTab === "sleeping" && (
                <RoomSleepingPanel
                  room={activeRoom}
                  beds={draftBeds}
                  onChangeBedCount={handleChangeBedCount}
                  onSave={handleSaveSleeping}
                  onCancel={handleCancelDetail}
                  isSaving={isSaving}
                />
              )}
            </div>
          )}

          {/* NORMAL ROOM OVERVIEW (When no detail tab is active) */}
          {activeDetailTab === null && (
            <div className="flex flex-col md:flex-row min-h-[calc(100vh-4rem)]">
              {/* Left Vertical Room Navigation Sidebar (Desktop) */}
              <aside className="w-full md:w-64 border-b md:border-b-0 md:border-r border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/40 p-4 shrink-0 space-y-4">
                <button
                  type="button"
                  onClick={() => {
                    setActiveRoomId(null);
                    setViewMode("overview");
                    setIsManageMode(false);
                  }}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition cursor-pointer"
                >
                  <svg className="size-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m15 19-7-7 7-7" />
                  </svg>
                  <span>Back to Photo tour</span>
                </button>

                {/* Vertical list of rooms */}
                <div className="space-y-1 overflow-x-auto md:overflow-x-visible md:overflow-y-auto max-h-[70vh] flex md:flex-col gap-2 md:gap-1 pb-2 md:pb-0 custom-scrollbar">
                  {consolidatedRooms.map((r) => {
                    const isActive = r.id === activeRoom.id;
                    const rPhotos = photosByRoomId.get(r.id) || [];
                    const firstPic = rPhotos[0];

                    return (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => {
                          setActiveRoomId(r.id);
                          setIsManageMode(false);
                        }}
                        className={`flex items-center gap-2.5 w-full text-left rounded-xl p-2 transition cursor-pointer shrink-0 md:shrink ${isActive
                          ? "bg-white dark:bg-zinc-800 border-2 border-zinc-900 dark:border-zinc-200 shadow-2xs"
                          : "hover:bg-zinc-100 dark:hover:bg-zinc-800/60 border border-transparent"
                          }`}
                      >
                        <div className="size-10 rounded-lg overflow-hidden bg-zinc-200 dark:bg-zinc-700 shrink-0 flex items-center justify-center">
                          {firstPic ? (
                            <img src={firstPic} alt="" className="size-full object-cover" />
                          ) : (
                            <RoomIllustration type={r.type} size="sm" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium truncate text-zinc-900 dark:text-zinc-100">
                            {r.name}
                          </p>
                          <p className="text-[11px] font-normal text-zinc-500 dark:text-zinc-400">
                            {rPhotos.length} photo{rPhotos.length !== 1 ? "s" : ""}
                          </p>
                        </div>
                      </button>
                    );
                  })}

                  {/* Additional Photos in Sidebar */}
                  <button
                    type="button"
                    onClick={() => {
                      setActiveRoomId("UNASSIGNED");
                      setIsManageMode(false);
                    }}
                    className={`flex items-center gap-2.5 w-full text-left rounded-xl p-2 transition cursor-pointer shrink-0 md:shrink ${activeRoom.id === "UNASSIGNED"
                      ? "bg-white dark:bg-zinc-800 border-2 border-zinc-900 dark:border-zinc-200 shadow-2xs"
                      : "hover:bg-zinc-100 dark:hover:bg-zinc-800/60 border border-transparent"
                      }`}
                  >
                    <div className="size-10 rounded-lg overflow-hidden bg-zinc-200 dark:bg-zinc-700 shrink-0 flex items-center justify-center">
                      {additionalPhotos[0] ? (
                        <img src={additionalPhotos[0]} alt="" className="size-full object-cover" />
                      ) : (
                        <RoomIllustration type="UNASSIGNED" size="sm" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium truncate text-zinc-900 dark:text-zinc-100">
                        Additional photos
                      </p>
                      <p className="text-[11px] font-normal text-zinc-500 dark:text-zinc-400">
                        {additionalPhotos.length} photo{additionalPhotos.length !== 1 ? "s" : ""}
                      </p>
                    </div>
                  </button>
                </div>
              </aside>

              {/* Right Main Room Gallery */}
              <main className="flex-1 p-4 sm:p-8 space-y-6 max-w-5xl">
                {/* Room Header */}
                <div className="flex items-center justify-between">
                  <div>
                    <h1 className="text-2xl font-medium tracking-tight text-zinc-900 dark:text-zinc-100">
                      {activeRoom.name}
                    </h1>
                    <p className="text-xs font-normal text-zinc-500 dark:text-zinc-400 mt-0.5">
                      {activeRoomPhotos.length} photo{activeRoomPhotos.length !== 1 ? "s" : ""}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {activeRoomPhotos.length > 0 && !isManageMode && (
                      <button
                        type="button"
                        onClick={() => setIsManageMode(true)}
                        className="rounded-full border border-zinc-300 dark:border-zinc-700 px-3.5 py-1.5 text-xs font-medium hover:border-zinc-900 dark:hover:border-zinc-300 transition cursor-pointer"
                      >
                        Manage photos
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => setActiveModal({ type: "add-photos-options", roomId: activeRoom.id })}
                      className="size-9 rounded-full border border-zinc-300 dark:border-zinc-700 hover:border-zinc-900 dark:hover:border-zinc-300 flex items-center justify-center text-base font-medium transition cursor-pointer"
                      title="Add photos"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Empty Room State */}
                {activeRoomPhotos.length === 0 ? (
                  <div className="rounded-2xl border-2 border-dashed border-zinc-300 dark:border-zinc-700 p-10 sm:p-14 flex flex-col items-center justify-center text-center space-y-4">
                    <RoomIllustration type={activeRoom.type} size="lg" />
                    <div>
                      <h3 className="text-base font-medium text-zinc-900 dark:text-zinc-100">
                        No photos in this room yet
                      </h3>
                      <p className="text-xs font-normal text-zinc-500 dark:text-zinc-400 max-w-sm mt-1">
                        Upload photos from your device or choose existing photos from Additional photos.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveModal({ type: "add-photos-options", roomId: activeRoom.id })}
                      className="rounded-lg border border-zinc-900 dark:border-zinc-100 px-5 py-2 text-xs font-medium text-zinc-900 dark:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer"
                    >
                      Add photo
                    </button>
                  </div>
                ) : (
                  /* Photo Grid */
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {activeRoomPhotos.map((url) => {
                      const isSelected = selectedPhotoUrls.has(url);
                      const isCover = photos[0] === url;
                      const desc = getPhotoDescription(url);

                      return (
                        <div
                          key={url}
                          onClick={() => {
                            if (isManageMode) {
                              togglePhotoSelection(url);
                            } else {
                              handleOpenPhotoEditor(url);
                            }
                          }}
                          className={`group relative aspect-[4/3] rounded-xl overflow-hidden bg-zinc-100 dark:bg-zinc-800 cursor-pointer border transition ${isSelected
                            ? "border-zinc-950 dark:border-zinc-100 ring-2 ring-zinc-950/20 dark:ring-zinc-100/30"
                            : "border-transparent hover:border-zinc-300 dark:hover:border-zinc-700"
                            }`}
                        >
                          <img
                            src={url}
                            alt=""
                            className="size-full object-cover group-hover:scale-[1.02] transition duration-200"
                            loading="lazy"
                          />

                          {/* Cover Photo Badge */}
                          {isCover && (
                            <div className="absolute top-2.5 left-2.5 z-10 rounded-full bg-zinc-900/90 backdrop-blur-xs text-white px-2.5 py-0.5 text-[10px] font-medium shadow-xs">
                              Cover photo
                            </div>
                          )}

                          {/* Selection Checkmark Overlay */}
                          {isManageMode && (
                            <div className="absolute top-2.5 right-2.5 z-10">
                              <div
                                className={`size-6 rounded-full flex items-center justify-center text-xs font-medium border shadow-xs transition ${isSelected
                                  ? "bg-zinc-900 text-white border-zinc-900 dark:bg-zinc-100 dark:text-zinc-900"
                                  : "bg-white/90 text-transparent border-zinc-300 hover:border-zinc-500"
                                  }`}
                              >
                                ✓
                              </div>
                            </div>
                          )}

                          {/* Description indicator snippet on hover */}
                          {desc && !isManageMode && (
                            <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent p-2.5 pt-6 text-white text-[11px] font-normal truncate opacity-0 group-hover:opacity-100 transition">
                              {desc}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Additional Room Details Links with live summaries */}
                {activeRoom.id !== "UNASSIGNED" && (
                  <div className="pt-6 border-t border-zinc-200 dark:border-zinc-800 space-y-1.5">
                    {/* Sleeping arrangements (for bedrooms or rooms with beds) */}
                    {(activeRoom.type === "BEDROOM" || (activeRoom.beds && activeRoom.beds.length > 0)) && (
                      <div
                        onClick={() => handleOpenDetailTab("sleeping")}
                        className={`flex items-center justify-between p-3.5 rounded-xl transition cursor-pointer select-none ${
                          activeDetailTab === "sleeping"
                            ? "bg-zinc-100 dark:bg-zinc-800 shadow-2xs"
                            : "hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
                        }`}
                      >
                        <div>
                          <p className="text-xs font-medium text-zinc-900 dark:text-zinc-100">
                            Sleeping arrangements
                          </p>
                          <p className="text-[11px] font-normal text-zinc-500 dark:text-zinc-400 mt-0.5">
                            {activeRoom.beds && activeRoom.beds.length > 0
                              ? activeRoom.beds.map((b) => `${b.count} ${b.type.toLowerCase().replace(/_/g, " ")} bed${b.count > 1 ? "s" : ""}`).join(", ")
                              : "Add details"}
                          </p>
                        </div>
                        <svg className="size-4 text-zinc-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m9 5 7 7-7 7" />
                        </svg>
                      </div>
                    )}

                    {/* Privacy info */}
                    <div
                      onClick={() => handleOpenDetailTab("privacy")}
                      className={`flex items-center justify-between p-3.5 rounded-xl transition cursor-pointer select-none ${
                        activeDetailTab === "privacy"
                          ? "bg-zinc-100 dark:bg-zinc-800 shadow-2xs"
                          : "hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
                      }`}
                    >
                      <div>
                        <p className="text-xs font-medium text-zinc-900 dark:text-zinc-100">
                          Privacy info
                        </p>
                        <p className="text-[11px] font-normal text-zinc-500 dark:text-zinc-400 mt-0.5">
                          {activeRoom.hasPrivateBathroom
                            ? "Private attached bathroom"
                            : activeRoom.privacy?.hasDoorLock
                            ? "Lock on room door"
                            : "Add details"}
                        </p>
                      </div>
                      <svg className="size-4 text-zinc-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m9 5 7 7-7 7" />
                      </svg>
                    </div>

                    {/* Amenities */}
                    <div
                      onClick={() => handleOpenDetailTab("amenities")}
                      className={`flex items-center justify-between p-3.5 rounded-xl transition cursor-pointer select-none ${
                        activeDetailTab === "amenities"
                          ? "bg-zinc-100 dark:bg-zinc-800 shadow-2xs"
                          : "hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
                      }`}
                    >
                      <div>
                        <p className="text-xs font-medium text-zinc-900 dark:text-zinc-100">
                          Amenities
                        </p>
                        <p className="text-[11px] font-normal text-zinc-500 dark:text-zinc-400 mt-0.5">
                          {activeRoom.amenities && activeRoom.amenities.length > 0
                            ? `${activeRoom.amenities.length} ${activeRoom.amenities.length === 1 ? "amenity" : "amenities"}`
                            : "Add details"}
                        </p>
                      </div>
                      <svg className="size-4 text-zinc-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m9 5 7 7-7 7" />
                      </svg>
                    </div>

                    {/* Accessibility features */}
                    <div
                      onClick={() => handleOpenDetailTab("accessibility")}
                      className={`flex items-center justify-between p-3.5 rounded-xl transition cursor-pointer select-none ${
                        activeDetailTab === "accessibility"
                          ? "bg-zinc-100 dark:bg-zinc-800 shadow-2xs"
                          : "hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
                      }`}
                    >
                      <div>
                        <p className="text-xs font-medium text-zinc-900 dark:text-zinc-100">
                          Accessibility features
                        </p>
                        <p className="text-[11px] font-normal text-zinc-500 dark:text-zinc-400 mt-0.5">
                          {activeRoom.accessibilityFeatures && activeRoom.accessibilityFeatures.length > 0
                            ? `${activeRoom.accessibilityFeatures.length} ${activeRoom.accessibilityFeatures.length === 1 ? "feature" : "features"}`
                            : "Add details"}
                        </p>
                      </div>
                      <svg className="size-4 text-zinc-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m9 5 7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                )}

                {/* Delete Room or Space */}
                {activeRoom.id !== "UNASSIGNED" && (
                  <div className="pt-4">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveModal({
                          type: "confirm-delete-room",
                          roomId: activeRoom.id,
                          roomName: activeRoom.name,
                        });
                      }}
                      className="inline-flex items-center gap-2 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 transition cursor-pointer"
                    >
                      <svg className="size-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      <span>Delete room or space</span>
                    </button>
                  </div>
                )}
              </main>
            </div>
          )}
        </>
      )}

      {/* ─────────────────────────────────────────────────────────────
          VIEW 3: ALL PHOTOS GALLERY (Phase 4)
         ───────────────────────────────────────────────────────────── */}
      {viewMode === "all-photos" && (
        <div className="max-w-6xl mx-auto px-4 py-6 sm:px-8 space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setViewMode("overview");
                  setIsManageMode(false);
                }}
                className="size-9 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center justify-center transition cursor-pointer"
                aria-label="Back to Photo tour"
              >
                <svg className="size-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m15 19-7-7 7-7" />
                </svg>
              </button>
              <div>
                <h1 className="text-2xl font-medium tracking-tight">
                  All photos
                </h1>
                <p className="text-xs font-normal text-zinc-500 dark:text-zinc-400">
                  {photos.length} photo{photos.length !== 1 ? "s" : ""}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              {!isManageMode && photos.length > 0 && (
                <button
                  type="button"
                  onClick={() => setIsManageMode(true)}
                  className="rounded-full border border-zinc-300 dark:border-zinc-700 px-4 py-2 text-xs font-medium hover:border-zinc-900 dark:hover:border-zinc-300 transition cursor-pointer"
                >
                  Manage photos
                </button>
              )}

              <button
                type="button"
                onClick={() => triggerUpload(null)}
                className="rounded-full bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-950 px-4 py-2 text-xs font-medium hover:bg-black transition cursor-pointer flex items-center gap-1.5"
              >
                <span>+</span>
                <span>Add photos</span>
              </button>
            </div>
          </div>

          {/* Photo Grid */}
          {photos.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-zinc-300 dark:border-zinc-700 p-12 text-center space-y-3">
              <RoomIllustration type="UNASSIGNED" size="lg" />
              <h3 className="text-base font-medium">No photos yet</h3>
              <p className="text-xs font-normal text-zinc-500">Upload your listing photos to start creating your photo tour.</p>
              <button
                type="button"
                onClick={() => triggerUpload(null)}
                className="rounded-lg bg-zinc-900 text-white px-4 py-2 text-xs font-medium hover:bg-black transition cursor-pointer"
              >
                Upload photos
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {photos.map((url, idx) => {
                const isSelected = selectedPhotoUrls.has(url);
                const isCover = idx === 0;
                const assignment = assignmentByUrl.get(url);
                const roomLabel = assignment?.roomLabel || assignment?.roomType || "Additional photos";

                return (
                  <div
                    key={url}
                    onClick={() => {
                      if (isManageMode) {
                        togglePhotoSelection(url);
                      } else {
                        handleOpenPhotoEditor(url);
                      }
                    }}
                    className={`group relative aspect-[4/3] rounded-xl overflow-hidden bg-zinc-100 dark:bg-zinc-800 cursor-pointer border transition ${isSelected
                      ? "border-zinc-950 dark:border-zinc-100 ring-2 ring-zinc-950/20 dark:ring-zinc-100/30"
                      : "border-transparent hover:border-zinc-300 dark:hover:border-zinc-700"
                      }`}
                  >
                    <img
                      src={url}
                      alt=""
                      className="size-full object-cover group-hover:scale-[1.02] transition duration-200"
                      loading="lazy"
                    />

                    {/* Cover Photo Badge */}
                    {isCover && (
                      <div className="absolute top-2.5 left-2.5 z-10 rounded-full bg-zinc-900/90 backdrop-blur-xs text-white px-2.5 py-0.5 text-[10px] font-medium shadow-xs">
                        Cover photo
                      </div>
                    )}

                    {/* Room Tag in bottom corner */}
                    <div className="absolute bottom-2 left-2 z-10 rounded-md bg-black/60 backdrop-blur-xs text-white px-2 py-0.5 text-[10px] font-normal truncate max-w-[85%]">
                      {roomLabel}
                    </div>

                    {/* Selection Checkmark */}
                    {isManageMode && (
                      <div className="absolute top-2.5 right-2.5 z-10">
                        <div
                          className={`size-6 rounded-full flex items-center justify-center text-xs font-medium border shadow-xs transition ${isSelected
                            ? "bg-zinc-900 text-white border-zinc-900 dark:bg-zinc-100 dark:text-zinc-900"
                            : "bg-white/90 text-transparent border-zinc-300 hover:border-zinc-500"
                            }`}
                        >
                          ✓
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          COORDINATED MODAL OVERLAY PORTAL
          - Portals directly to document.body
          - z-9999 completely covers and dims global navbar
          - Exactly ONE modal rendered at any time (zero stacking conflicts)
          - Locks body scroll automatically
          - Escape key and backdrop click supported
         ───────────────────────────────────────────────────────────── */}
      {activeModal.type !== "none" && (
        <ModalOverlay
          isOpen={true}
          onClose={handleCloseModal}
          className="fixed inset-0 z-9999 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200"
        >
          {/* 1. PHOTO DETAIL MODAL */}
          {activeModal.type === "photo-detail" && (
            <div
              className="w-full max-w-4xl max-h-[92vh] rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150"
              role="dialog"
              aria-modal="true"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-200 dark:border-zinc-800 shrink-0">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-600 hover:text-zinc-900 dark:hover:text-zinc-100 cursor-pointer"
                >
                  <svg className="size-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m15 19-7-7 7-7" />
                  </svg>
                  <span>Back</span>
                </button>

                <span className="text-xs font-medium text-zinc-500">
                  Photo {activeModal.photoIndex + 1} of {photos.length}
                </span>

                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="size-7 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center justify-center text-sm font-medium transition cursor-pointer"
                  aria-label="Close photo details"
                >
                  ✕
                </button>
              </div>

              {/* Split Editor Body */}
              <div className="flex-1 flex flex-col md:flex-row overflow-y-auto">
                {/* Left Image Preview */}
                <div className="flex-1 bg-zinc-950 p-6 flex flex-col items-center justify-center min-h-[300px] relative">
                  <img
                    src={activeModal.photoUrl}
                    alt=""
                    className="max-h-[55vh] w-auto max-w-full rounded-xl object-contain shadow-md"
                  />

                  {photos.length > 1 && (
                    <>
                      <button
                        type="button"
                        disabled={activeModal.photoIndex === 0}
                        onClick={() => handleNavigatePhoto("prev")}
                        className="absolute left-3 top-1/2 -translate-y-1/2 size-9 rounded-full bg-white/80 hover:bg-white text-zinc-900 flex items-center justify-center disabled:opacity-20 disabled:cursor-not-allowed shadow-md cursor-pointer transition"
                        aria-label="Previous photo"
                      >
                        ←
                      </button>
                      <button
                        type="button"
                        disabled={activeModal.photoIndex === photos.length - 1}
                        onClick={() => handleNavigatePhoto("next")}
                        className="absolute right-3 top-1/2 -translate-y-1/2 size-9 rounded-full bg-white/80 hover:bg-white text-zinc-900 flex items-center justify-center disabled:opacity-20 disabled:cursor-not-allowed shadow-md cursor-pointer transition"
                        aria-label="Next photo"
                      >
                        →
                      </button>
                    </>
                  )}
                </div>

                {/* Right Controls */}
                <div className="w-full md:w-80 border-t md:border-t-0 md:border-l border-zinc-200 dark:border-zinc-800 p-5 flex flex-col justify-between space-y-4 shrink-0">
                  <div className="space-y-4">
                    {/* Move photo action: switches modal state cleanly */}
                    <div>
                      {(() => {
                        const curAssignment = assignmentByUrl.get(activeModal.photoUrl);
                        const curRoomName = curAssignment?.roomLabel || curAssignment?.roomType || "Additional photos";
                        return (
                          <button
                            type="button"
                            onClick={handleOpenMoveFromDetail}
                            className="text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:underline flex items-center gap-1 cursor-pointer"
                          >
                            <span>Move from {curRoomName}?</span>
                            <span className="text-zinc-400">›</span>
                          </button>
                        );
                      })()}
                    </div>

                    {/* Make Cover Button */}
                    {activeModal.photoIndex !== 0 && (
                      <button
                        type="button"
                        onClick={() => handleMakeCoverPhoto(activeModal.photoUrl)}
                        className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 px-3 py-2 text-xs font-medium hover:border-zinc-900 dark:hover:border-zinc-300 transition cursor-pointer text-left flex items-center justify-between"
                      >
                        <span>Set as primary cover photo</span>
                        <span className="text-zinc-400">★</span>
                      </button>
                    )}

                    {/* Description Box */}
                    <div className="space-y-1.5 pt-2">
                      <label className="block text-xs font-medium text-zinc-900 dark:text-zinc-100">
                        Add a description for this room or space
                      </label>
                      <p className="text-[11px] font-normal text-zinc-500">
                        {250 - editDescription.length} characters available
                      </p>
                      <textarea
                        value={editDescription}
                        maxLength={250}
                        onChange={(e) => setEditDescription(e.target.value)}
                        placeholder="e.g. Spacious dining area with seating for six..."
                        rows={4}
                        className="w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 p-3 text-xs font-normal outline-none focus:border-zinc-900 dark:focus:border-zinc-100 resize-none"
                      />
                    </div>
                  </div>

                  {/* Bottom Actions */}
                  <div className="flex items-center justify-between pt-4 border-t border-zinc-200 dark:border-zinc-800">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveModal({
                          type: "confirm-delete-photos",
                          photoUrls: [activeModal.photoUrl],
                          returnToPhotoIndex: activeModal.photoIndex,
                        });
                      }}
                      className="p-2 rounded-lg text-zinc-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition cursor-pointer"
                      title="Delete photo"
                    >
                      <svg className="size-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>

                    <button
                      type="button"
                      onClick={handleSaveDescription}
                      className="rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-950 px-5 py-2 text-xs font-medium hover:bg-black transition cursor-pointer"
                    >
                      Save
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 2. MOVE PHOTOS MODAL */}
          {activeModal.type === "move-photos" && (
            <div
              className="w-full max-w-xl max-h-[85vh] rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150"
              role="dialog"
              aria-modal="true"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between p-5 border-b border-zinc-200 dark:border-zinc-800 shrink-0">
                <div className="flex items-center gap-3">
                  {/* Back button if opened from Photo Detail */}
                  {activeModal.returnToPhotoIndex !== null && activeModal.returnToPhotoIndex !== undefined && (
                    <button
                      type="button"
                      onClick={() => {
                        const returnIdx = activeModal.returnToPhotoIndex!;
                        setActiveModal({
                          type: "photo-detail",
                          photoUrl: photos[returnIdx],
                          photoIndex: returnIdx,
                        });
                      }}
                      className="size-8 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center justify-center text-sm font-medium transition cursor-pointer"
                      title="Back to photo details"
                      aria-label="Back to photo details"
                    >
                      ←
                    </button>
                  )}
                  <div>
                    <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-100">
                      {activeModal.photoUrls.length === 1 ? "Move photo" : "Move photos"}
                    </h2>
                    <p className="text-xs font-normal text-zinc-500 dark:text-zinc-400 mt-0.5">
                      Choose a room or space for {activeModal.photoUrls.length === 1 ? "this photo." : `${activeModal.photoUrls.length} photos.`}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="size-8 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center justify-center text-sm font-medium transition cursor-pointer"
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto p-5 space-y-6 custom-scrollbar">
                {/* Existing Rooms Section */}
                <div className="space-y-3">
                  <h4 className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
                    Existing rooms or spaces
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {consolidatedRooms.map((r) => {
                      const isSelected = moveTargetRoomId === r.id && !moveTargetCategory;
                      const rPhotos = photosByRoomId.get(r.id) || [];
                      const firstImg = rPhotos[0];

                      return (
                        <div
                          key={r.id}
                          onClick={() => {
                            setMoveTargetRoomId(r.id);
                            setMoveTargetCategory(null);
                          }}
                          className={`relative rounded-xl p-3 flex flex-col items-center justify-center text-center cursor-pointer transition border ${isSelected
                            ? "border-2 border-zinc-900 dark:border-zinc-100 bg-zinc-100 dark:bg-zinc-800"
                            : "border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-900/60 hover:border-zinc-300"
                            }`}
                        >
                          {isSelected && (
                            <div className="absolute top-2 right-2 size-4 rounded-full bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 flex items-center justify-center text-[10px] font-medium">
                              ✓
                            </div>
                          )}
                          <div className="size-10 rounded-lg overflow-hidden bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center mb-1.5">
                            {firstImg ? (
                              <img src={firstImg} alt="" className="size-full object-cover" />
                            ) : (
                              <RoomIllustration type={r.type} size="sm" />
                            )}
                          </div>
                          <span className="text-xs font-medium text-zinc-900 dark:text-zinc-100 truncate w-full">
                            {r.name}
                          </span>
                          <span className="text-[10px] text-zinc-500">
                            {rPhotos.length} photo{rPhotos.length !== 1 ? "s" : ""}
                          </span>
                        </div>
                      );
                    })}

                    {/* Additional Photos Card */}
                    <div
                      onClick={() => {
                        setMoveTargetRoomId("UNASSIGNED");
                        setMoveTargetCategory(null);
                      }}
                      className={`relative rounded-xl p-3 flex flex-col items-center justify-center text-center cursor-pointer transition border ${moveTargetRoomId === "UNASSIGNED" && !moveTargetCategory
                        ? "border-2 border-zinc-900 dark:border-zinc-100 bg-zinc-100 dark:bg-zinc-800"
                        : "border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-900/60 hover:border-zinc-300"
                        }`}
                    >
                      {moveTargetRoomId === "UNASSIGNED" && !moveTargetCategory && (
                        <div className="absolute top-2 right-2 size-4 rounded-full bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 flex items-center justify-center text-[10px] font-medium">
                          ✓
                        </div>
                      )}
                      <div className="size-10 rounded-lg overflow-hidden bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center mb-1.5">
                        {additionalPhotos[0] ? (
                          <img src={additionalPhotos[0]} alt="" className="size-full object-cover" />
                        ) : (
                          <RoomIllustration type="UNASSIGNED" size="sm" />
                        )}
                      </div>
                      <span className="text-xs font-medium text-zinc-900 dark:text-zinc-100 truncate w-full">
                        Additional photos
                      </span>
                      <span className="text-[10px] text-zinc-500">
                        {additionalPhotos.length} photo{additionalPhotos.length !== 1 ? "s" : ""}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Add a New Room Section */}
                <div className="space-y-3 pt-2">
                  <h4 className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
                    Or add a new room or space
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {CATEGORY_ITEMS.slice(0, 9).map((cat) => {
                      const isSelected = moveTargetCategory === cat.id;
                      return (
                        <div
                          key={cat.id}
                          onClick={() => {
                            setMoveTargetCategory(cat.id);
                            setMoveTargetRoomId(null);
                          }}
                          className={`relative rounded-xl p-3 flex flex-col items-center justify-center text-center cursor-pointer transition border ${isSelected
                            ? "border-2 border-zinc-900 dark:border-zinc-100 bg-zinc-100 dark:bg-zinc-800"
                            : "border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-900/60 hover:border-zinc-300"
                            }`}
                        >
                          {isSelected && (
                            <div className="absolute top-2 right-2 size-4 rounded-full bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 flex items-center justify-center text-[10px] font-medium">
                              ✓
                            </div>
                          )}
                          <RoomIllustration type={cat.id} size="sm" />
                          <span className="text-xs font-medium text-zinc-900 dark:text-zinc-100 mt-2 truncate w-full">
                            {cat.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between p-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 shrink-0">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 text-xs font-medium text-zinc-600 hover:text-zinc-900 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleExecuteMove}
                  disabled={!moveTargetRoomId && !moveTargetCategory}
                  className="rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-950 px-5 py-2 text-xs font-medium hover:bg-black disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
                >
                  Move
                </button>
              </div>
            </div>
          )}

          {/* 3. ADD ROOM OR SPACE MODAL */}
          {activeModal.type === "add-room" && (
            <div
              className="w-full max-w-xl max-h-[85vh] rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150"
              role="dialog"
              aria-modal="true"
              aria-labelledby="add-room-title"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-5 border-b border-zinc-200 dark:border-zinc-800 shrink-0">
                <h2 id="add-room-title" className="text-lg font-medium text-zinc-900 dark:text-zinc-100">
                  Choose a room or space
                </h2>
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="size-8 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center justify-center text-sm font-medium transition cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className="px-5 pt-4 pb-2 shrink-0">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search room types..."
                    value={addRoomSearch}
                    onChange={(e) => setAddRoomSearch(e.target.value)}
                    className="w-full h-10 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 pl-9 text-xs font-normal outline-none focus:border-zinc-900 dark:focus:border-zinc-100"
                  />
                  <svg
                    className="size-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                  >
                    <circle cx="11" cy="11" r="7" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.3-4.3" />
                  </svg>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-5 pt-2 custom-scrollbar">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {filteredCategories.map((cat) => {
                    const isSelected = selectedCategoryToAdd === cat.id;
                    return (
                      <div
                        key={cat.id}
                        onClick={() => setSelectedCategoryToAdd(cat.id)}
                        className={`relative rounded-xl p-3 flex flex-col items-center justify-center text-center cursor-pointer transition border ${isSelected
                          ? "border-2 border-zinc-900 dark:border-zinc-100 bg-zinc-100 dark:bg-zinc-800"
                          : "border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/60 hover:border-zinc-300"
                          }`}
                      >
                        {isSelected && (
                          <div className="absolute top-2 right-2 size-4 rounded-full bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 flex items-center justify-center text-[10px] font-medium">
                            ✓
                          </div>
                        )}
                        <RoomIllustration type={cat.id} size="sm" />
                        <span className="text-xs font-medium text-zinc-900 dark:text-zinc-100 mt-2 truncate w-full">
                          {cat.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-between p-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 shrink-0">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCreateRoom}
                  disabled={!selectedCategoryToAdd}
                  className="rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-950 px-5 py-2 text-xs font-medium hover:bg-black disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
                >
                  Next
                </button>
              </div>
            </div>
          )}

          {/* 4. ADD PHOTOS OPTIONS MODAL */}
          {activeModal.type === "add-photos-options" && (
            <div
              className="w-full max-w-sm rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xl p-5 space-y-4 animate-in fade-in zoom-in-95 duration-150"
              role="dialog"
              aria-modal="true"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-base font-medium">Add photos</h3>
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="size-7 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center justify-center text-sm font-medium transition cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    const roomTarget = activeModal.roomId;
                    setActiveModal({ type: "none" });
                    triggerUpload(roomTarget);
                  }}
                  className="w-full flex items-center justify-between p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition text-left cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="size-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                      <svg className="size-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8-4-4m0 0L8 8m4-4v12" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-xs font-medium">Upload from your device</p>
                      <p className="text-[11px] font-normal text-zinc-500">JPEG, PNG, WebP up to 10 MB</p>
                    </div>
                  </div>
                  <svg className="size-4 text-zinc-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m9 5 7 7-7 7" />
                  </svg>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (activeRoom) {
                      setActiveModal({
                        type: "choose-from-additional",
                        targetRoomId: activeRoom.id,
                        targetRoomName: activeRoom.name,
                      });
                    }
                  }}
                  disabled={additionalPhotos.length === 0}
                  className="w-full flex items-center justify-between p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed transition text-left cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="size-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                      <svg className="size-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <rect x="3" y="3" width="18" height="18" rx="2" strokeLinecap="round" strokeLinejoin="round" />
                        <circle cx="8.5" cy="8.5" r="1.5" />
                        <path d="m21 15-5-5L5 21" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-xs font-medium">Choose from Additional photos</p>
                      <p className="text-[11px] font-normal text-zinc-500">
                        {additionalPhotos.length} photo{additionalPhotos.length !== 1 ? "s" : ""} available
                      </p>
                    </div>
                  </div>
                  <svg className="size-4 text-zinc-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m9 5 7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>
          )}

          {/* 5. CHOOSE FROM ADDITIONAL PHOTOS MODAL */}
          {activeModal.type === "choose-from-additional" && (
            <div
              className="w-full max-w-xl max-h-[85vh] rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150"
              role="dialog"
              aria-modal="true"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-5 border-b border-zinc-200 dark:border-zinc-800 shrink-0">
                <div>
                  <h3 className="text-base font-medium">Choose from Additional photos</h3>
                  <p className="text-xs font-normal text-zinc-500">Select photos to move into {activeModal.targetRoomName}</p>
                </div>
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="size-7 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center justify-center text-sm font-medium transition cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {additionalPhotos.map((url) => {
                    const isChecked = selectedAdditionalUrls.has(url);
                    return (
                      <div
                        key={url}
                        onClick={() => {
                          setSelectedAdditionalUrls((prev) => {
                            const next = new Set(prev);
                            if (next.has(url)) next.delete(url);
                            else next.add(url);
                            return next;
                          });
                        }}
                        className={`group relative aspect-[4/3] rounded-xl overflow-hidden cursor-pointer border transition ${isChecked
                          ? "border-2 border-zinc-900 ring-2 ring-zinc-900/20"
                          : "border-zinc-200 dark:border-zinc-700"
                          }`}
                      >
                        <img src={url} alt="" className="size-full object-cover" />
                        <div className="absolute top-2 right-2">
                          <div
                            className={`size-5 rounded-full flex items-center justify-center text-[10px] font-medium border shadow-xs transition ${isChecked
                              ? "bg-zinc-900 text-white border-zinc-900"
                              : "bg-white/90 text-transparent border-zinc-300"
                              }`}
                          >
                            ✓
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-between p-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 shrink-0">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 text-xs font-medium text-zinc-600 hover:text-zinc-900 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleMoveFromAdditionalToActive}
                  disabled={selectedAdditionalUrls.size === 0}
                  className="rounded-lg bg-zinc-900 text-white px-5 py-2 text-xs font-medium hover:bg-black disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
                >
                  Add {selectedAdditionalUrls.size > 0 ? `(${selectedAdditionalUrls.size})` : ""}
                </button>
              </div>
            </div>
          )}

          {/* 6. CONFIRM DELETE ROOM MODAL */}
          {activeModal.type === "confirm-delete-room" && (
            <div
              className="w-full max-w-sm rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xl p-5 space-y-4 animate-in fade-in zoom-in-95 duration-150"
              role="dialog"
              aria-modal="true"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-base font-medium">Delete {activeModal.roomName}?</h3>
              <p className="text-xs font-normal text-zinc-500">
                Photos currently in this room will not be deleted; they will be moved to Additional photos.
              </p>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-3.5 py-1.5 text-xs font-medium text-zinc-600 hover:text-zinc-900 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteRoom}
                  className="rounded-lg bg-rose-600 text-white px-4 py-1.5 text-xs font-medium hover:bg-rose-700 transition cursor-pointer"
                >
                  Delete room
                </button>
              </div>
            </div>
          )}

          {/* 7. CONFIRM DELETE PHOTOS MODAL */}
          {activeModal.type === "confirm-delete-photos" && (
            <div
              className="w-full max-w-sm rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xl p-5 space-y-4 animate-in fade-in zoom-in-95 duration-150"
              role="dialog"
              aria-modal="true"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-base font-medium">
                Delete {activeModal.photoUrls.length} photo{activeModal.photoUrls.length !== 1 ? "s" : ""}?
              </h3>
              <p className="text-xs font-normal text-zinc-500">
                This will permanently remove the photo(s) from your listing. This action cannot be undone.
              </p>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    if (activeModal.returnToPhotoIndex !== null && activeModal.returnToPhotoIndex !== undefined) {
                      const idx = activeModal.returnToPhotoIndex;
                      setActiveModal({
                        type: "photo-detail",
                        photoUrl: photos[idx],
                        photoIndex: idx,
                      });
                    } else {
                      handleCloseModal();
                    }
                  }}
                  className="px-3.5 py-1.5 text-xs font-medium text-zinc-600 hover:text-zinc-900 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteSelectedPhotos}
                  className="rounded-lg bg-rose-600 text-white px-4 py-1.5 text-xs font-medium hover:bg-rose-700 transition cursor-pointer"
                >
                  Delete
                </button>
              </div>
            </div>
          )}
        </ModalOverlay>
      )}
    </div>
  );
}
