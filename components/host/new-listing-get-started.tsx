"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { toast } from "@/components/ui/toast";
import { AppHeader } from "@/components/dashboard/app-header";
import { Footer } from "@/components/dashboard/footer";
import { ModalOverlay } from "@/components/ui/modal-overlay";

import { PropertyCategory, PlaceTypeOption, LocationCoords, LocationDetails } from "./onboarding/types";
import { StepOverview } from "./onboarding/step-overview";
import { StepIntro } from "./onboarding/step-intro";
import { StepCategory } from "./onboarding/step-category";
import { StepPlaceType } from "./onboarding/step-place-type";
import { StepLocationSearch } from "./onboarding/step-location-search";
import { StepAddressConfirm } from "./onboarding/step-address-confirm";
import { StepBasicsCounters } from "./onboarding/step-basics-counters";
import { StepStandoutIntro } from "./onboarding/step-standout-intro";
import { StepAmenities } from "./onboarding/step-amenities";
import { StepPhotos } from "./onboarding/step-photos";
import { StepPhotoManagement } from "./onboarding/step-photo-management";
import { StepTitle } from "./onboarding/step-title";
import { StepHighlights } from "./onboarding/step-highlights";
import { StepDescription } from "./onboarding/step-description";
import { StepFinishIntro } from "./onboarding/step-finish-intro";
import { StepPrice } from "./onboarding/step-price";
import { StepWeekendPrice } from "./onboarding/step-weekend-price";
import { StepDiscounts } from "./onboarding/step-discounts";
import { StepSafety } from "./onboarding/step-safety";
import { WIZARD_STEPS } from "./onboarding/wizard-steps";
import type { ListingDTO } from "@/services/mappers";

type HostingType = "HOME" | "EXPERIENCE" | "SERVICE";

type NominatimSuggestion = {
  lat: string;
  lon: string;
  display_name?: string;
  address?: Record<string, string | undefined>;
};

type WizardError = {
  title: string;
  messages: string[];
  fixStep?: number;
};

const COMPLETION_REQUIREMENTS: Record<string, { message: string; step: number }> = {
  propertyType: { message: "Choose the type of place you are hosting.", step: 2 },
  listingType: { message: "Choose what guests will have.", step: 3 },
  coordinates: { message: "Confirm your property location on the map.", step: 4 },
  address: { message: "Add your street address, city, and country.", step: 5 },
  capacity: { message: "Add valid guest and bed capacity details.", step: 6 },
  photos: { message: "Upload at least five property photos.", step: 9 },
  title: { message: "Use a listing title between 3 and 50 characters.", step: 11 },
  highlights: { message: "Choose no more than three highlights.", step: 12 },
  description: { message: "Write a description of at least 10 characters.", step: 13 },
  weekdayPrice: { message: "Set a weekday price greater than zero.", step: 15 },
  weekendPrice: { message: "Set a weekend price greater than zero.", step: 16 },
  safetyDisclosures: { message: "Answer all three safety questions.", step: 18 },
};

const RESTORED_PROPERTY_TYPE_LABELS: Record<string, string> = {
  HOUSE: "House",
  APARTMENT: "Apartment",
  BARN: "Barn",
  BED_AND_BREAKFAST: "Bed & breakfast",
  BOAT: "Boat",
  CABIN: "Cabin",
  CAMPER_RV: "Camper / RV",
  CASTLE: "Castle",
  CONTAINER: "Container",
  CYCLADIC_HOME: "Cycladic home",
  DOME: "Dome",
  EARTH_HOME: "Earth home",
  FARM: "Farm",
  GUEST_HOUSE: "Guest house",
  HOTEL: "Hotel",
  HOUSEBOAT: "Houseboat",
};

// Step Slugs for URL query parameter mapping derived from centralized config
const STEP_SLUGS = WIZARD_STEPS.map((s) => s.slug);

async function readSaveError(response: Response) {
  const body: unknown = await response.json().catch(() => null);
  if (body && typeof body === "object" && "error" in body) {
    const error = (body as { error?: { message?: string } }).error;
    if (error?.message) return error.message;
  }
  return "We couldn't save your listing. Please try again.";
}

export function NewListingGetStarted({ initialHostingType }: { initialHostingType: HostingType }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, update: updateSession } = useSession();
  const hostingType = initialHostingType;
  const urlStepParam = searchParams.get("step");
  const urlDraftId = searchParams.get("draftId");

  // Determine initial step based on URL query parameter (?step=category or ?step=2)
  const getInitialStep = (): number => {
    if (!urlStepParam) return 0;
    const slugIdx = STEP_SLUGS.indexOf(urlStepParam.toLowerCase());
    if (slugIdx !== -1) return slugIdx;
    const num = parseInt(urlStepParam, 10);
    if (!isNaN(num) && num >= 0 && num < STEP_SLUGS.length) return num;
    return 0;
  };

  const [step, setStep] = useState<number>(getInitialStep);
  const [draftId, setDraftId] = useState<string | null>(urlDraftId || null);
  const draftIdRef = useRef<string | null>(draftId);
  draftIdRef.current = draftId;
  const [isSavingStep, setIsSavingStep] = useState<boolean>(false);
  const [wizardError, setWizardError] = useState<WizardError | null>(null);
  const hydratedDraftRef = useRef(false);
  // PATCH operations are serialized so an older debounced save can never
  // overwrite a newer explicit Next/Finish save.
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());

  // Selections & States
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [selectedPlaceType, setSelectedPlaceType] = useState<string>("");
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>([]);
  const [photos, setPhotos] = useState<string[]>([]);
  const [title, setTitle] = useState<string>("");
  const [selectedHighlights, setSelectedHighlights] = useState<string[]>(["Peaceful", "Unique"]);
  const [description, setDescription] = useState<string>("");
  const [price, setPrice] = useState<number>(0);
  const [weekendPrice, setWeekendPrice] = useState<number>(0);
  const [selectedDiscounts, setSelectedDiscounts] = useState<string[]>(["new_listing"]);
  const [selectedSafety, setSelectedSafety] = useState<string[]>([]);

  // Location & Address States
  const [country, setCountry] = useState<string>("");
  const [shortAddress, setShortAddress] = useState<string>("");
  const [aptFloorBldg, setAptFloorBldg] = useState<string>("");
  const [streetAddress, setStreetAddress] = useState<string>("");
  const [district, setDistrict] = useState<string>("");
  const [postalCode, setPostalCode] = useState<string>("");
  const [city, setCity] = useState<string>("");
  const [showSpecificLocation, setShowSpecificLocation] = useState<boolean>(false);
  const [coords, setCoords] = useState<LocationCoords>({ lat: 24.7136, lng: 46.6753 });
  const [hasConfirmedLocation, setHasConfirmedLocation] = useState(false);
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Property Basics Counters (Step 6)
  const [guests, setGuests] = useState<number>(4);
  const [bedrooms, setBedrooms] = useState<number>(1);
  const [beds, setBeds] = useState<number>(1);
  const [bathrooms, setBathrooms] = useState<number>(1);

  const currencySymbol = country.includes("Saudi")
    ? "SAR"
    : country.includes("Emirates")
      ? "AED"
      : country.includes("Kuwait")
        ? "KWD"
        : country.includes("Qatar")
          ? "QAR"
          : country.includes("Bahrain")
            ? "BHD"
            : country.includes("Oman")
              ? "OMR"
              : country.includes("United Kingdom")
                ? "GBP"
                : "USD";

  // Sync state step with URL search parameters
  const updateUrlForStep = useCallback((stepIdx: number, activeDraftId?: string | null) => {
    const currentDraft = activeDraftId !== undefined ? activeDraftId : draftId;
    const slug = STEP_SLUGS[stepIdx] || "overview";
    const params = new URLSearchParams();
    params.set("type", hostingType);
    params.set("step", slug);
    if (currentDraft) {
      params.set("draftId", currentDraft);
    }
    const newUrl = `/host/listings/new?${params.toString()}`;
    window.history.pushState(null, "", newUrl);
  }, [draftId, hostingType]);

  // Handle URL changes when browser back/forward buttons are clicked
  useEffect(() => {
    const handlePopState = () => {
      const sp = new URLSearchParams(window.location.search);
      const st = sp.get("step");
      if (st) {
        const idx = STEP_SLUGS.indexOf(st.toLowerCase());
        if (idx !== -1) setStep(idx);
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  // Direct step navigation without saving
  const goToStep = (targetStep: number) => {
    setStep(targetStep);
    updateUrlForStep(targetStep);
  };

  const buildDraftPayload = useCallback((currentStep: number) => ({
    title: title.trim() || "Draft Listing",
    description: description.trim(),
    // The wizard displays whole currency units; the API persists minor units.
    price: Math.round(price * 100),
    weekendPrice: weekendPrice > 0 ? Math.round(weekendPrice * 100) : null,
    hostingType,
    propertyType: selectedCategory || null,
    listingType: selectedPlaceType || null,
    locationSearch: searchQuery.trim() || null,
    shortAddress: shortAddress.trim() || null,
    address: streetAddress.trim() || null,
    apartment: aptFloorBldg.trim() || null,
    city: city || null,
    district: district || null,
    postalCode: postalCode || null,
    country: country || null,
    latitude: hasConfirmedLocation && Number.isFinite(coords.lat) ? coords.lat : null,
    longitude: hasConfirmedLocation && Number.isFinite(coords.lng) ? coords.lng : null,
    showExactLocation: showSpecificLocation,
    guests,
    bedrooms,
    beds,
    bathrooms,
    amenities: selectedAmenities,
    photos,
    highlights: selectedHighlights,
    discounts: Object.fromEntries(
      ["new_listing", "last_minute", "weekly", "monthly"].map((discount) => [
        discount,
        selectedDiscounts.includes(discount),
      ]),
    ),
    safetyDisclosures: selectedSafety,
    published: false,
    currentStep: currentStep + 1,
  }), [
    aptFloorBldg,
    bathrooms,
    bedrooms,
    beds,
    city,
    coords.lat,
    coords.lng,
    country,
    description,
    district,
    guests,
    hasConfirmedLocation,
    hostingType,
    photos,
    postalCode,
    price,
    selectedAmenities,
    selectedCategory,
    selectedDiscounts,
    selectedHighlights,
    selectedPlaceType,
    selectedSafety,
    searchQuery,
    showSpecificLocation,
    shortAddress,
    streetAddress,
    title,
    weekendPrice,
  ]);

  const validateCurrentStep = (): string[] | null => {
    switch (step) {
      case 2:
        return selectedCategory ? null : ["Choose the type of place you want to host."];
      case 3:
        return selectedPlaceType ? null : ["Choose what guests will have."];
      case 4:
        return null;
      case 5: {
        const missing: string[] = [];
        if (!streetAddress.trim()) missing.push("Enter a street address.");
        if (!city.trim()) missing.push("Enter a city or town.");
        if (!country.trim()) missing.push("Choose a country or region.");
        return missing.length > 0 ? missing : null;
      }
      case 6:
        return guests >= 1 && bedrooms >= 0 && beds >= 1 && bathrooms >= 0
          ? null
          : ["Enter valid capacity values for your place."];
      case 7:
      case 8:
        return null;
      case 9:
      case 10:
        return photos.length >= 5 ? null : ["Upload at least 5 successful property photos."];
      case 11:
        return title.trim().length >= 3 && title.trim().length <= 50
          ? null
          : ["Use a listing title between 3 and 50 characters."];
      case 12:
        return selectedHighlights.length <= 3 ? null : ["Choose no more than 3 highlights."];
      case 13:
        return description.trim().length >= 10 && description.trim().length <= 5000
          ? null
          : ["Write a description between 10 and 5,000 characters."];
      case 14:
        return null;
      case 15:
        return price > 0 ? null : ["Set a weekday price greater than zero."];
      case 16:
        return weekendPrice > 0 ? null : ["Set a weekend price greater than zero."];
      case 17:
        return null;
      case 18: {
        const answers = new Set(selectedSafety);
        return ["SECURITY_CAMERA", "NOISE_MONITOR", "WEAPONS"].every(
          (item) => answers.has(`${item}:YES`) || answers.has(`${item}:NO`),
        )
          ? null
          : ["Answer every safety question before continuing."];
      }
      default:
        return null;
    }
  };

  const queueDraftPatch = useCallback((id: string, payload: object) => {
    const next = saveQueueRef.current
      .catch(() => undefined)
      .then(async () => {
        await fetch(`/api/v1/listings/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }).catch(() => undefined);
      });
    saveQueueRef.current = next;
    return next;
  }, []);

  // Persists a draft before navigation; the wizard advances cleanly upon success.
  const saveDraftAndGoToStep = async (nextStepIndex: number): Promise<string | null> => {
    const validationErrors = validateCurrentStep();
    if (validationErrors) {
      setWizardError({ title: "Complete this step", messages: validationErrors });
      return null;
    }

    setIsSavingStep(true);
    try {
      const payload = buildDraftPayload(nextStepIndex);
      let activeDraftId = draftIdRef.current || draftId;

      if (activeDraftId) {
        const res = await fetch(`/api/v1/listings/${activeDraftId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error(await readSaveError(res));
      } else {
        const res = await fetch("/api/v1/listings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error(await readSaveError(res));
        const data: unknown = await res.json().catch(() => null);
        const createdId =
          data && typeof data === "object" && "data" in data
            ? ((data as { data?: { id?: string } }).data?.id ?? null)
            : null;
        if (!createdId) {
          throw new Error("The draft was saved, but no listing ID was returned.");
        }
        activeDraftId = createdId;
        draftIdRef.current = createdId;
        setDraftId(createdId);
        hydratedDraftRef.current = true;
      }

      // Non-blocking session refresh for host role
      if (session?.user?.role !== "HOST" && session?.user?.role !== "ADMIN") {
        void updateSession?.({ role: "HOST" }).catch(() => undefined);
      }

      setStep(nextStepIndex);
      updateUrlForStep(nextStepIndex, activeDraftId);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return activeDraftId;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "We couldn't save your listing.";
      setWizardError({ title: "Your changes weren't saved", messages: [message] });
      return null;
    } finally {
      setIsSavingStep(false);
    }
  };

  // Create draft record in DB when user selects a category (e.g., House, Apartment)
  const handleSelectCategory = async (catId: string) => {
    setSelectedCategory(catId);

    const activeId = draftIdRef.current || draftId;
    if (!activeId) {
      try {
        const payload = {
          ...buildDraftPayload(2),
          propertyType: catId,
        };
        const res = await fetch(`/api/v1/listings`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error(await readSaveError(res));
        const data: unknown = await res.json().catch(() => null);
        const createdId =
          data && typeof data === "object" && "data" in data
            ? ((data as { data?: { id?: string } }).data?.id ?? null)
            : null;
        if (!createdId) throw new Error("The draft was saved, but no listing ID was returned.");
        draftIdRef.current = createdId;
        setDraftId(createdId);
        hydratedDraftRef.current = true;
        updateUrlForStep(2, createdId);
      } catch (err) {
        setWizardError({
          title: "Your changes weren't saved",
          messages: [err instanceof Error ? err.message : "Please check your connection and try again."],
        });
      }
    }
  };

  // Final Draft Completion & Redirect to Host Listings
  const handleFinalSaveAndFinish = async () => {
    const savedDraftId = await saveDraftAndGoToStep(18);
    if (!savedDraftId) return;

    try {
      const response = await fetch(`/api/v1/listings/${savedDraftId}/readiness`);
      if (!response.ok) throw new Error(await readSaveError(response));
      const body: unknown = await response.json();
      const readiness = body && typeof body === "object" && "data" in body
        ? (body as { data?: { publishable?: boolean; missing?: string[] } }).data
        : undefined;
      if (!readiness?.publishable) {
        const requirements = (readiness?.missing ?? [])
          .map((field) => COMPLETION_REQUIREMENTS[field])
          .filter((requirement): requirement is { message: string; step: number } => Boolean(requirement));
        setWizardError({
          title: "Complete your listing",
          messages: requirements.length > 0
            ? requirements.map((requirement) => requirement.message)
            : ["We couldn't confirm that all listing details are complete. Please review the form."],
          fixStep: requirements[0]?.step,
        });
        return;
      }
      toast.success("Draft listing saved successfully!");
      router.push("/host/listings");
    } catch (error: unknown) {
      setWizardError({
        title: "We couldn't verify your listing",
        messages: [error instanceof Error ? error.message : "Please try again."],
      });
    }
  };

  useEffect(() => {
    if (!urlDraftId) {
      hydratedDraftRef.current = true;
      return;
    }

    const controller = new AbortController();
    const loadDraft = async () => {
      try {
        const response = await fetch(`/api/v1/listings/${urlDraftId}`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(await readSaveError(response));
        const body: unknown = await response.json();
        const listing =
          body && typeof body === "object" && "data" in body
            ? (body as { data?: ListingDTO }).data
            : undefined;
        if (!listing) throw new Error("Listing draft was not found.");
        if (listing.hostingType !== hostingType) {
          throw new Error("This draft belongs to a different hosting flow.");
        }

        const listingTypeLabels: Record<string, string> = {
          ENTIRE_PLACE: "Entire place",
          ROOM: "Private room",
          SHARED_ROOM: "Shared room",
        };
        const discountValues = listing.discounts;
        const restoredDiscounts =
          discountValues && typeof discountValues === "object" && !Array.isArray(discountValues)
            ? Object.entries(discountValues)
                .filter(([, enabled]) => enabled === true)
                .map(([discount]) => discount)
            : ["new_listing"];

        setDraftId(listing.id);
        setSelectedCategory(listing.propertyType ? RESTORED_PROPERTY_TYPE_LABELS[listing.propertyType] ?? "" : "");
        setSelectedPlaceType(listing.listingType ? listingTypeLabels[listing.listingType] ?? "" : "");
        setSelectedAmenities(listing.amenities ?? []);
        setPhotos(listing.photos ?? []);
        setTitle(listing.title === "Draft Listing" ? "" : listing.title);
        setSelectedHighlights(listing.highlights ?? []);
        setDescription(listing.description ?? "");
        setPrice((listing.price ?? 0) / 100);
        setWeekendPrice((listing.weekendPrice ?? 0) / 100);
        setSelectedDiscounts(restoredDiscounts);
        setSelectedSafety((listing.safetyDisclosures ?? []).filter((value) => value.includes(":")));
        setCountry(listing.country ?? "");
        setShortAddress(listing.shortAddress ?? "");
        setStreetAddress(listing.address ?? "");
        setAptFloorBldg(listing.apartment ?? "");
        setDistrict(listing.district ?? "");
        setPostalCode(listing.postalCode ?? "");
        setCity(listing.city ?? "");
        setShowSpecificLocation(listing.showExactLocation ?? false);
        setCoords({ lat: listing.latitude ?? 24.7136, lng: listing.longitude ?? 46.6753 });
        setHasConfirmedLocation(listing.latitude !== null && listing.longitude !== null);
        setSearchQuery(listing.locationSearch ?? listing.address ?? "");
        setGuests(listing.guests ?? 1);
        setBedrooms(listing.bedrooms ?? 0);
        setBeds(listing.beds ?? 1);
        setBathrooms(listing.bathrooms ?? 0);

        const resumeStep = Math.max(0, Math.min(STEP_SLUGS.length - 1, (listing.currentStep || 1) - 1));
        setStep(resumeStep);
        draftIdRef.current = listing.id;
        setDraftId(listing.id);
        window.history.replaceState(
          null,
          "",
          `/host/listings/new?type=${hostingType}&step=${STEP_SLUGS[resumeStep]}&draftId=${listing.id}`,
        );
        hydratedDraftRef.current = true;
      } catch (error: unknown) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setWizardError({
          title: "We couldn't load your draft",
          messages: [error instanceof Error ? error.message : "Please try again."],
        });
      }
    };

    void loadDraft();
    return () => controller.abort();
  }, [hostingType, urlDraftId]);

  // Every editable draft value is write-through autosaved. The queue preserves
  // ordering and explicit navigation waits for the latest database write.
  // Behavior:
  // - If a `draftId` exists, debounce and PATCH the draft.
  // - If no `draftId` exists but the form has been hydrated and the user has
  //   interacted, create an initial draft (POST) so subsequent autosaves can
  //   PATCH it. This ensures first/second-step interactions persist.
  useEffect(() => {
    if (!hydratedDraftRef.current || isSavingStep) return;

    // Do not auto-create draft on steps before category selection (step < 2 or no category chosen yet)
    if (!draftIdRef.current && (step < 2 || !selectedCategory)) return;

    const timer = window.setTimeout(async () => {
      try {
        const payload = buildDraftPayload(step);
        const activeId = draftIdRef.current || draftId;
        if (activeId) {
          await queueDraftPatch(activeId, payload);
          return;
        }

        // No draft yet: create one on first interaction with property category.
        const createRequest = async () => {
          if (draftIdRef.current) {
            await queueDraftPatch(draftIdRef.current, payload);
            return;
          }
          const res = await fetch(`/api/v1/listings`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          if (!res.ok) throw new Error(await readSaveError(res));
          const data: unknown = await res.json().catch(() => null);
          const createdId = data && typeof data === "object" && "data" in data
            ? ((data as { data?: { id?: string } }).data?.id ?? null)
            : null;
          if (!createdId) throw new Error("The draft was saved, but no listing ID was returned.");
          draftIdRef.current = createdId;
          setDraftId(createdId);
          hydratedDraftRef.current = true;
          updateUrlForStep(step, createdId);
        };

        // Serialize the create request through the save queue.
        const queued = saveQueueRef.current.catch(() => undefined).then(createRequest);
        saveQueueRef.current = queued;
        await queued;
      } catch (err) {
        setWizardError({
          title: "Your changes weren't saved",
          messages: [err instanceof Error ? err.message : "Please check your connection and try again."],
        });
      }
    }, 800);

    return () => window.clearTimeout(timer);
  }, [buildDraftPayload, draftId, isSavingStep, queueDraftPatch, selectedCategory, step, updateUrlForStep]);

  const categories: PropertyCategory[] = [
    {
      id: "House",
      label: "House",
      icon: <Image src="/images/icons/house.svg" alt="" width={20} height={20} />,
    },
    {
      id: "Apartment",
      label: "Apartment",
      icon: <Image src="/images/icons/apartment.svg" alt="" width={20} height={20} />,
    },
    {
      id: "Barn",
      label: "Barn",
      icon: <Image src="/images/icons/barn.svg" alt="" width={20} height={20} />,
    },
    {
      id: "Bed & breakfast",
      label: "Bed & breakfast",
      icon: <Image src="/images/icons/bed-breakfast.svg" alt="" width={20} height={20} />,
    },
    {
      id: "Boat",
      label: "Boat",
      icon: <Image src="/images/icons/boat.svg" alt="" width={20} height={20} />,
    },
    {
      id: "Cabin",
      label: "Cabin",
      icon: <Image src="/images/icons/cabin.svg" alt="" width={20} height={20} />,
    },
    {
      id: "Camper / RV",
      label: "Camper / RV",
      icon: <Image src="/images/icons/camper-rv.svg" alt="" width={20} height={20} />,
    },
    {
      id: "Castle",
      label: "Castle",
      icon: <Image src="/images/icons/castle.svg" alt="" width={20} height={20} />,
    },
    {
      id: "Container",
      label: "Container",
      icon: <Image src="/images/icons/container.svg" alt="" width={20} height={20} />,
    },
    {
      id: "Cycladic home",
      label: "Cycladic home",
      icon: <Image src="/images/icons/cycladic-home.svg" alt="" width={20} height={20} />,
    },
    {
      id: "Dome",
      label: "Dome",
      icon: <Image src="/images/icons/dome.svg" alt="" width={20} height={20} />,
    },
    {
      id: "Earth home",
      label: "Earth home",
      icon: <Image src="/images/icons/earth-home.svg" alt="" width={20} height={20} />,
    },
    {
      id: "Farm",
      label: "Farm",
      icon: <Image src="/images/icons/farm.svg" alt="" width={20} height={20} />,
    },
    {
      id: "Guest house",
      label: "Guest house",
      icon: <Image src="/images/icons/guest-house.svg" alt="" width={20} height={20} />,
    },
    {
      id: "Hotel",
      label: "Hotel",
      icon: <Image src="/images/icons/hotel.svg" alt="" width={20} height={20} />,
    },
    {
      id: "Houseboat",
      label: "Houseboat",
      icon: <Image src="/images/icons/houseboat.svg" alt="" width={20} height={20} />,
    },
  ];

  const placeTypes: PlaceTypeOption[] = [
    {
      id: "Entire place",
      title: "An entire place",
      description: "Guests have the whole place to themselves. This usually includes a bedroom, a bathroom, and a kitchen.",
      icon: <Image src="/images/icons/house.svg" alt="" width={20} height={20} />,
    },
    {
      id: "Private room",
      title: "A room",
      description: "Guests have their own private room for sleeping. Other areas could be shared.",
      icon: <Image src="/images/icons/room.svg" alt="" width={24} height={24} />,
    },
    {
      id: "Shared room",
      title: "A shared room",
      description: "Guests sleep in a bedroom or common area that may be shared with others.",
      icon: <Image src="/images/icons/shared-room.svg" alt="" width={24} height={24} />,
    },
  ];

  // Map position change handler
  const handleLocationChange = (lat: number, lng: number, details?: LocationDetails) => {
    setCoords({ lat, lng });
    setHasConfirmedLocation(true);
    if (details) {
      const fullDisplay = details.formattedAddress || details.address || "";
      if (fullDisplay) {
        setStreetAddress(fullDisplay);
        setSearchQuery(fullDisplay);
      }
      if (details.city) setCity(details.city);
      if (details.district) setDistrict(details.district);
      if (details.postalCode) setPostalCode(details.postalCode);
      if (details.country) {
        const c = details.country.toLowerCase();
        if (c.includes("saudi")) setCountry("Saudi Arabia - SA");
        else if (c.includes("emirates") || c.includes("uae")) setCountry("United Arab Emirates - AE");
        else if (c.includes("kuwait")) setCountry("Kuwait - KW");
        else if (c.includes("qatar")) setCountry("Qatar - QA");
        else if (c.includes("bahrain")) setCountry("Bahrain - BH");
        else if (c.includes("oman")) setCountry("Oman - OM");
        else if (c.includes("united states") || c.includes("usa")) setCountry("United States - US");
        else if (c.includes("kingdom") || c.includes("uk")) setCountry("United Kingdom - GB");
        else setCountry(details.country);
      }
    }
  };

  // Location Autocomplete Selection
  const handleSelectSuggestion = (item: NominatimSuggestion) => {
    const a = item.address || {};
    const newLat = parseFloat(item.lat);
    const newLng = parseFloat(item.lon);

    const fullAddrStr = item.display_name || "";
    const street = a.road || a.pedestrian || a.suburb || a.neighbourhood || a.amenity || fullAddrStr;
    const cityName = a.city || a.town || a.municipality || a.county || a.state || "";
    const districtName = a.suburb || a.neighbourhood || a.city_district || "";
    const postalCodeStr = a.postcode || "";
    const countryName = a.country || "";

    setStreetAddress(fullAddrStr || street);
    setCity(cityName);
    setDistrict(districtName);
    setPostalCode(postalCodeStr);
    setCoords({ lat: newLat, lng: newLng });
    setHasConfirmedLocation(Number.isFinite(newLat) && Number.isFinite(newLng));
    setSearchQuery(fullAddrStr || street);

    if (countryName) {
      const c = countryName.toLowerCase();
      if (c.includes("saudi")) setCountry("Saudi Arabia - SA");
      else if (c.includes("emirates") || c.includes("uae")) setCountry("United Arab Emirates - AE");
      else if (c.includes("kuwait")) setCountry("Kuwait - KW");
      else if (c.includes("qatar")) setCountry("Qatar - QA");
      else if (c.includes("bahrain")) setCountry("Bahrain - BH");
      else if (c.includes("oman")) setCountry("Oman - OM");
      else if (c.includes("united states") || c.includes("usa")) setCountry("United States - US");
      else if (c.includes("kingdom") || c.includes("uk")) setCountry("United Kingdom - GB");
      else setCountry(countryName);
    }
  };

  const handleToggleAmenity = (id: string) => {
    setSelectedAmenities((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleToggleHighlight = (id: string) => {
    if (!selectedHighlights.includes(id) && selectedHighlights.length >= 3) {
      setWizardError({
        title: "Maximum highlights selected",
        messages: ["Choose up to three highlights. Remove one before adding another."],
      });
      return;
    }
    setSelectedHighlights((prev) => {
      if (prev.includes(id)) {
        return prev.filter((item) => item !== id);
      }
      return [...prev, id];
    });
  };

  const handleToggleDiscount = (id: string) => {
    setSelectedDiscounts((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleAnswerSafety = (id: string, answer: "YES" | "NO") => {
    setSelectedSafety((prev) => [
      ...prev.filter((value) => !value.startsWith(`${id}:`)),
      `${id}:${answer}`,
    ]);
  };

  const errorFixStep = wizardError?.fixStep;

  return (
    <div className="flex min-h-screen flex-col bg-white">
      {/* Shared Application Header */}
      <AppHeader />

      {/* Step 0: Overview */}
      {step === 0 && (
        <StepOverview onGetStarted={() => goToStep(1)} isLoading={isSavingStep} />
      )}

      {/* Step 1: Intro */}
      {step === 1 && (
        <StepIntro onBack={() => goToStep(0)} onNext={() => goToStep(2)} isLoading={isSavingStep} />
      )}

      {/* Step 2: Category Selector */}
      {step === 2 && (
        <StepCategory
          categories={categories}
          selectedCategory={selectedCategory}
          onSelectCategory={handleSelectCategory}
          onBack={() => goToStep(1)}
          onNext={() => saveDraftAndGoToStep(3)}
          isLoading={isSavingStep}
        />
      )}

      {/* Step 3: Space Type Selector */}
      {step === 3 && (
        <StepPlaceType
          placeTypes={placeTypes}
          selectedPlaceType={selectedPlaceType}
          onSelectPlaceType={setSelectedPlaceType}
          onBack={() => goToStep(2)}
          onNext={() => saveDraftAndGoToStep(4)}
          isLoading={isSavingStep}
        />
      )}

      {/* Step 4: Map Location Search */}
      {step === 4 && (
        <StepLocationSearch
          streetAddress={streetAddress}
          city={city}
          country={country}
          coords={coords}
          searchQuery={searchQuery}
          onSearchInputChange={(val) => {
            setSearchQuery(val);
            setStreetAddress(val);
          }}
          onSelectSuggestion={handleSelectSuggestion}
          onLocationChange={handleLocationChange}
          onBack={() => goToStep(3)}
          onNext={() => saveDraftAndGoToStep(5)}
          isLoading={isSavingStep}
        />
      )}

      {/* Step 5: Address Form & Interactive Map */}
      {step === 5 && (
        <StepAddressConfirm
          country={country}
          setCountry={setCountry}
          shortAddress={shortAddress}
          setShortAddress={setShortAddress}
          aptFloorBldg={aptFloorBldg}
          setAptFloorBldg={setAptFloorBldg}
          streetAddress={streetAddress}
          setStreetAddress={setStreetAddress}
          district={district}
          setDistrict={setDistrict}
          postalCode={postalCode}
          setPostalCode={setPostalCode}
          city={city}
          setCity={setCity}
          showSpecificLocation={showSpecificLocation}
          setShowSpecificLocation={setShowSpecificLocation}
          coords={coords}
          onLocationChange={handleLocationChange}
          onBack={() => goToStep(4)}
          onNext={() => saveDraftAndGoToStep(6)}
          isLoading={isSavingStep}
        />
      )}

      {/* Step 6: Property Basics Counters */}
      {step === 6 && (
        <StepBasicsCounters
          guests={guests}
          setGuests={setGuests}
          bedrooms={bedrooms}
          setBedrooms={setBedrooms}
          beds={beds}
          setBeds={setBeds}
          bathrooms={bathrooms}
          setBathrooms={setBathrooms}
          onBack={() => goToStep(5)}
          onNext={() => saveDraftAndGoToStep(7)}
          isLoading={isSavingStep}
        />
      )}

      {/* Step 7: "Make your place to stand out" Intro Screen (Step 2 section badge) */}
      {step === 7 && (
        <StepStandoutIntro
          onBack={() => goToStep(6)}
          onNext={() => saveDraftAndGoToStep(8)}
          isLoading={isSavingStep}
        />
      )}

      {/* Step 8: Amenities */}
      {step === 8 && (
        <StepAmenities
          selectedAmenities={selectedAmenities}
          onToggleAmenity={handleToggleAmenity}
          onBack={() => goToStep(7)}
          onNext={() => saveDraftAndGoToStep(9)}
          isLoading={isSavingStep}
        />
      )}

      {/* Step 9: Photos Upload */}
      {step === 9 && (
        <StepPhotos
          photos={photos}
          onUpdatePhotos={setPhotos}
          onBack={() => goToStep(8)}
          onNext={() => saveDraftAndGoToStep(10)}
          isLoading={isSavingStep}
        />
      )}

      {/* Step 10: Photos Review & Management */}
      {step === 10 && (
        <StepPhotoManagement
          photos={photos}
          onUpdatePhotos={setPhotos}
          onBack={() => goToStep(9)}
          onNext={() => saveDraftAndGoToStep(11)}
          isLoading={isSavingStep}
        />
      )}

      {/* Step 11: Listing Title */}
      {step === 11 && (
        <StepTitle
          title={title}
          onChangeTitle={setTitle}
          onBack={() => goToStep(10)}
          onNext={() => saveDraftAndGoToStep(12)}
          isLoading={isSavingStep}
        />
      )}

      {/* Step 12: House Highlights */}
      {step === 12 && (
        <StepHighlights
          selectedHighlights={selectedHighlights}
          onToggleHighlight={handleToggleHighlight}
          onBack={() => goToStep(11)}
          onNext={() => saveDraftAndGoToStep(13)}
          isLoading={isSavingStep}
        />
      )}

      {/* Step 13: Description */}
      {step === 13 && (
        <StepDescription
          description={description}
          onChangeDescription={setDescription}
          onBack={() => goToStep(12)}
          onNext={() => saveDraftAndGoToStep(14)}
          isLoading={isSavingStep}
        />
      )}

      {/* Step 14: Finish and publish introduction (Part 3) */}
      {step === 14 && (
        <StepFinishIntro
          onBack={() => goToStep(13)}
          onNext={() => saveDraftAndGoToStep(15)}
          isLoading={isSavingStep}
        />
      )}

      {/* Step 15: Weekday base price */}
      {step === 15 && (
        <StepPrice
          price={price}
          onChangePrice={setPrice}
          currencySymbol={currencySymbol}
          onBack={() => goToStep(14)}
          onNext={() => saveDraftAndGoToStep(16)}
          isLoading={isSavingStep}
        />
      )}

      {/* Step 16: Weekend price & premium */}
      {step === 16 && (
        <StepWeekendPrice
          weekdayPrice={price}
          weekendPrice={weekendPrice}
          onChangeWeekendPrice={setWeekendPrice}
          currencySymbol={currencySymbol}
          onBack={() => goToStep(15)}
          onNext={() => saveDraftAndGoToStep(17)}
          isLoading={isSavingStep}
        />
      )}

      {/* Step 17: Discounts */}
      {step === 17 && (
        <StepDiscounts
          selectedDiscounts={selectedDiscounts}
          onToggleDiscount={handleToggleDiscount}
          onBack={() => goToStep(16)}
          onNext={() => saveDraftAndGoToStep(18)}
          isLoading={isSavingStep}
        />
      )}

      {/* Step 18: Safety disclosures & Final submission */}
      {step === 18 && (
        <StepSafety
          selectedSafety={selectedSafety}
          onAnswerSafety={handleAnswerSafety}
          onBack={() => goToStep(17)}
          onNext={handleFinalSaveAndFinish}
          isLoading={isSavingStep}
        />
      )}

      {wizardError && (
        <ModalOverlay className="fixed inset-0 z-[70] flex items-center justify-center bg-black/45 p-4 backdrop-blur-xs">
          <section
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="wizard-error-title"
            className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl sm:p-8"
          >
            <div className="mb-5 flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-100 text-lg text-rose-700">!</div>
              <div className="min-w-0 flex-1">
                <h2 id="wizard-error-title" className="text-lg font-semibold text-zinc-900">
                  {wizardError.title}
                </h2>
                <div className="mt-2 space-y-1.5 text-sm leading-6 text-zinc-600">
                  {wizardError.messages.length === 1 ? (
                    <p>{wizardError.messages[0]}</p>
                  ) : (
                    <ul className="list-disc space-y-1 pl-5">
                      {wizardError.messages.map((message) => <li key={message}>{message}</li>)}
                    </ul>
                  )}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setWizardError(null)}
                className="rounded-full border border-zinc-300 px-5 py-2.5 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
              >
                Close
              </button>
              {errorFixStep !== undefined && (
                <button
                  type="button"
                  onClick={() => {
                    setWizardError(null);
                    goToStep(errorFixStep);
                  }}
                  className="rounded-full bg-[#FCDF9C] px-5 py-2.5 text-sm font-semibold text-zinc-900 hover:bg-[#ebd08d]"
                >
                  Fix now
                </button>
              )}
            </div>
          </section>
        </ModalOverlay>
      )}

      {/* Shared Application Footer */}
      <Footer />
    </div>
  );
}
