"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "@/components/ui/toast";
import { AppHeader } from "@/components/dashboard/app-header";
import { Footer } from "@/components/dashboard/footer";

import { PropertyCategory, PlaceTypeOption, LocationCoords } from "./onboarding/types";
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

// Step Slugs for URL query parameter mapping
const STEP_SLUGS = [
  "overview",        // Step 0
  "intro",           // Step 1
  "category",        // Step 2
  "place-type",      // Step 3
  "location",        // Step 4
  "address",         // Step 5
  "basics",          // Step 6
  "standout",        // Step 7
  "amenities",       // Step 8
  "photos",          // Step 9
  "photos-review",   // Step 10
  "title",           // Step 11
  "highlights",      // Step 12
  "description",     // Step 13
  "finish-intro",    // Step 14
  "price",           // Step 15
  "weekend-price",   // Step 16
  "discounts",       // Step 17
  "safety",          // Step 18
];

export function NewListingGetStarted() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const hostingType = searchParams.get("type") || "HOME";
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
  const [isSavingStep, setIsSavingStep] = useState<boolean>(false);

  // Selections & States
  const [selectedCategory, setSelectedCategory] = useState<string>("House");
  const [selectedPlaceType, setSelectedPlaceType] = useState<string>("Entire place");
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>(["Wifi"]);
  const [photos, setPhotos] = useState<string[]>([]);
  const [title, setTitle] = useState<string>("");
  const [selectedHighlights, setSelectedHighlights] = useState<string[]>(["Peaceful", "Unique"]);
  const [description, setDescription] = useState<string>("");
  const [price, setPrice] = useState<number>(241);
  const [weekendPrice, setWeekendPrice] = useState<number>(291);
  const [selectedDiscounts, setSelectedDiscounts] = useState<string[]>(["new_listing"]);
  const [selectedSafety, setSelectedSafety] = useState<string[]>([]);

  // Location & Address States
  const [country, setCountry] = useState<string>("Saudi Arabia - SA");
  const [shortAddress, setShortAddress] = useState<string>("");
  const [aptFloorBldg, setAptFloorBldg] = useState<string>("");
  const [streetAddress, setStreetAddress] = useState<string>("");
  const [district, setDistrict] = useState<string>("");
  const [postalCode, setPostalCode] = useState<string>("");
  const [city, setCity] = useState<string>("Riyadh");
  const [showSpecificLocation, setShowSpecificLocation] = useState<boolean>(true);
  const [coords, setCoords] = useState<LocationCoords>({ lat: 24.7136, lng: 46.6753 });
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Property Basics Counters (Step 6)
  const [guests, setGuests] = useState<number>(4);
  const [bedrooms, setBedrooms] = useState<number>(1);
  const [beds, setBeds] = useState<number>(1);
  const [bathrooms, setBathrooms] = useState<number>(1);

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

  // Auto-Save current wizard progress to DB and transition to next step
  const saveDraftAndGoToStep = async (nextStepIndex: number) => {
    setIsSavingStep(true);
    try {
      const fullAddressStr = [streetAddress, aptFloorBldg, district, city, country]
        .filter(Boolean)
        .join(", ");

      const finalDescription = description.trim()
        ? description.trim()
        : selectedHighlights.length > 0
        ? `You'll have a great time at this ${selectedHighlights.join(" and ").toLowerCase()} place.`
        : "";

      const payload = {
        title: title.trim() || `Draft ${selectedCategory}`,
        description: finalDescription,
        price: price || 241,
        weekendPrice: weekendPrice || 291,
        hostingType: hostingType.toUpperCase(),
        propertyType: selectedCategory,
        listingType: selectedPlaceType,
        address: fullAddressStr || streetAddress || "Main Street",
        city: city || "Riyadh",
        district: district || "",
        postalCode: postalCode || "",
        country: country || "Saudi Arabia",
        latitude: coords.lat,
        longitude: coords.lng,
        guests,
        bedrooms,
        beds,
        bathrooms,
        amenities: selectedAmenities,
        photos: photos,
        highlights: selectedHighlights,
        discounts: selectedDiscounts,
        safetyDisclosures: selectedSafety,
        published: false,
      };

      let activeDraftId = draftId;

      if (activeDraftId) {
        // Update existing listing draft in database
        const res = await fetch(`/api/v1/listings/${activeDraftId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          console.warn("Failed to patch listing draft:", await res.text());
        }
      } else {
        // Create new listing draft in database
        const res = await fetch("/api/v1/listings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (res.ok && (data.data?.id || data.id)) {
          activeDraftId = data.data?.id || data.id;
          setDraftId(activeDraftId);
        }
      }

      setStep(nextStepIndex);
      updateUrlForStep(nextStepIndex, activeDraftId);
    } catch (err: any) {
      console.error("Auto-save listing error:", err);
      // Proceed to next step even if network glitch occurs
      setStep(nextStepIndex);
      updateUrlForStep(nextStepIndex);
    } finally {
      setIsSavingStep(false);
    }
  };

  // Final Draft Completion & Redirect to Host Listings
  const handleFinalSaveAndFinish = async () => {
    setIsSavingStep(true);
    try {
      await saveDraftAndGoToStep(18);
      toast.success("Draft listing saved successfully!");
      router.push("/host/listings");
    } catch (err: any) {
      toast.error(err.message || "Failed to save listing.");
      setIsSavingStep(false);
    }
  };

  const categories: PropertyCategory[] = [
    {
      id: "House",
      label: "House",
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
        </svg>
      ),
    },
    {
      id: "Apartment",
      label: "Apartment",
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6.75h1.5m-1.5 3h1.5m-1.5 3h1.5M9 16.5h1.5m3 0h1.5" />
        </svg>
      ),
    },
    {
      id: "Barn",
      label: "Barn",
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3L2.25 9v12h19.5V9L12 3zm0 0v6m-4 12v-6h8v6" />
        </svg>
      ),
    },
    {
      id: "Bed & breakfast",
      label: "Bed & breakfast",
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9 9 0 100-18 9 9 0 000 18zM8.25 10.5h7.5m-7.5 3h4.5" />
        </svg>
      ),
    },
    {
      id: "Boat",
      label: "Boat",
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 16.5l2.25 4.5h12l2.25-4.5M12 3v13.5m0-13.5L7.5 9h9.5L12 3z" />
        </svg>
      ),
    },
    {
      id: "Cabin",
      label: "Cabin",
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3L3 10.5V21h18V10.5L12 3zm0 4.5l6 5V19H6v-6.5l6-5z" />
        </svg>
      ),
    },
    {
      id: "Camper / RV",
      label: "Camper / RV",
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm7.5 0a1.5 1.5 0 100-3 1.5 1.5 0 000 3zM3 9h15l3 4.5V17.25H3V9z" />
        </svg>
      ),
    },
    {
      id: "Castle",
      label: "Castle",
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 21h18V9l-3-3v3h-3V6l-3 3h-3V6L6 9v3H3v9z" />
        </svg>
      ),
    },
    {
      id: "Container",
      label: "Container",
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6h16.5v12H3.75V6zm4.5 0v12m4.5-12v12m4.5-12v12" />
        </svg>
      ),
    },
    {
      id: "Cycladic home",
      label: "Cycladic home",
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3a9 9 0 00-9 9v9h18v-9a9 9 0 00-9-9z" />
        </svg>
      ),
    },
    {
      id: "Dome",
      label: "Dome",
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5a9.75 9.75 0 00-9.75 9.75V21h19.5v-6.75A9.75 9.75 0 0012 4.5z" />
        </svg>
      ),
    },
    {
      id: "Earth home",
      label: "Earth home",
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9 9 0 100-18 9 9 0 000 18zm-4.5-9a4.5 4.5 0 019 0" />
        </svg>
      ),
    },
    {
      id: "Farm",
      label: "Farm",
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v18m-6-6l12-6m0 6L6 9" />
        </svg>
      ),
    },
    {
      id: "Guest house",
      label: "Guest house",
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.5 20.118a7.5 7.5 0 0115 0" />
        </svg>
      ),
    },
    {
      id: "Hotel",
      label: "Hotel",
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M6 3h12v18H6V3zm3 3.75h1.5m3 0h1.5m-6 3.75h1.5m3 0h1.5m-6 3.75h1.5m3 0h1.5" />
        </svg>
      ),
    },
    {
      id: "Houseboat",
      label: "Houseboat",
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3l7.5 6v6h-15v-6L12 3zm-9 15c3 0 4.5 1.5 6 1.5s3-1.5 6-1.5 3 1.5 6 1.5" />
        </svg>
      ),
    },
  ];

  const placeTypes: PlaceTypeOption[] = [
    {
      id: "Entire place",
      title: "An entire place",
      description: "Lorem ipsum non diam posuere malesuada nisl urna pharetra feugiat nisi a amet at pretium nam ac magna fermentum in.",
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
        </svg>
      ),
    },
    {
      id: "Private room",
      title: "A room",
      description: "Lorem ipsum non diam posuere malesuada nisl urna pharetra feugiat nisi a amet at pretium nam ac magna fermentum in.",
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
        </svg>
      ),
    },
    {
      id: "Shared room",
      title: "A shared room",
      description: "Lorem ipsum non diam posuere malesuada nisl urna pharetra feugiat nisi a amet at pretium nam ac magna fermentum in.",
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a5.97 5.97 0 00-.942 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
        </svg>
      ),
    },
  ];

  // Map position change handler
  const handleLocationChange = (lat: number, lng: number, details?: any) => {
    setCoords({ lat, lng });
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
  const handleSelectSuggestion = (item: any) => {
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
    setSelectedHighlights((prev) => {
      if (prev.includes(id)) {
        return prev.filter((item) => item !== id);
      }
      if (prev.length >= 2) {
        return [prev[1], id];
      }
      return [...prev, id];
    });
  };

  const handleToggleDiscount = (id: string) => {
    setSelectedDiscounts((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleToggleSafety = (id: string) => {
    setSelectedSafety((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  return (
    <div className="flex min-h-screen flex-col bg-white">
      {/* Shared Application Header */}
      <AppHeader />

      {/* Step 0: Overview */}
      {step === 0 && (
        <StepOverview onGetStarted={() => saveDraftAndGoToStep(1)} isLoading={isSavingStep} />
      )}

      {/* Step 1: Intro */}
      {step === 1 && (
        <StepIntro onBack={() => goToStep(0)} onNext={() => saveDraftAndGoToStep(2)} isLoading={isSavingStep} />
      )}

      {/* Step 2: Category Selector */}
      {step === 2 && (
        <StepCategory
          categories={categories}
          selectedCategory={selectedCategory}
          onSelectCategory={setSelectedCategory}
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

      {/* Step 8: Amenities Selection ("Tell guests what your place has to offer") */}
      {step === 8 && (
        <StepAmenities
          selectedAmenities={selectedAmenities}
          onToggleAmenity={handleToggleAmenity}
          onBack={() => goToStep(7)}
          onNext={() => saveDraftAndGoToStep(9)}
          isLoading={isSavingStep}
        />
      )}

      {/* Step 9: Photos Upload ("Add some photos of your house") */}
      {step === 9 && (
        <StepPhotos
          photos={photos}
          onUpdatePhotos={setPhotos}
          onBack={() => goToStep(8)}
          onNext={() => saveDraftAndGoToStep(10)}
          isLoading={isSavingStep}
        />
      )}

      {/* Step 10: Photos Management ("Cool ! How does this look?") */}
      {step === 10 && (
        <StepPhotoManagement
          photos={photos}
          onUpdatePhotos={setPhotos}
          onBack={() => goToStep(9)}
          onNext={() => saveDraftAndGoToStep(11)}
          isLoading={isSavingStep}
        />
      )}

      {/* Step 11: Listing Title ("Now, it’s time to give your house a title") */}
      {step === 11 && (
        <StepTitle
          title={title}
          onChangeTitle={setTitle}
          onBack={() => goToStep(10)}
          onNext={() => saveDraftAndGoToStep(12)}
          isLoading={isSavingStep}
        />
      )}

      {/* Step 12: House Highlights ("Let’s describe your house") */}
      {step === 12 && (
        <StepHighlights
          selectedHighlights={selectedHighlights}
          onToggleHighlight={handleToggleHighlight}
          onBack={() => goToStep(11)}
          onNext={() => {
            if (!description && selectedHighlights.length > 0) {
              setDescription(`You'll have a great time at this ${selectedHighlights.join(" and ").toLowerCase()} place.`);
            }
            saveDraftAndGoToStep(13);
          }}
          isLoading={isSavingStep}
        />
      )}

      {/* Step 13: Description Text ("Create your description") */}
      {step === 13 && (
        <StepDescription
          description={description}
          onChangeDescription={setDescription}
          onBack={() => goToStep(12)}
          onNext={() => saveDraftAndGoToStep(14)}
          isLoading={isSavingStep}
        />
      )}

      {/* Step 14: Finish Intro ("Finish up and publish") */}
      {step === 14 && (
        <StepFinishIntro
          onBack={() => goToStep(13)}
          onNext={() => saveDraftAndGoToStep(15)}
          isLoading={isSavingStep}
        />
      )}

      {/* Step 15: Base Pricing ("Now, set a weekday base price") */}
      {step === 15 && (
        <StepPrice
          price={price}
          onChangePrice={(val) => {
            setPrice(val);
            setWeekendPrice(Math.round(val * 1.2074));
          }}
          onBack={() => goToStep(14)}
          onNext={() => saveDraftAndGoToStep(16)}
          isLoading={isSavingStep}
        />
      )}

      {/* Step 16: Weekend Base Pricing ("Set a weekend price") */}
      {step === 16 && (
        <StepWeekendPrice
          weekdayPrice={price}
          weekendPrice={weekendPrice}
          onChangeWeekendPrice={setWeekendPrice}
          onBack={() => goToStep(15)}
          onNext={() => saveDraftAndGoToStep(17)}
          isLoading={isSavingStep}
        />
      )}

      {/* Step 17: Discounts ("Add discounts") */}
      {step === 17 && (
        <StepDiscounts
          selectedDiscounts={selectedDiscounts}
          onToggleDiscount={handleToggleDiscount}
          onBack={() => goToStep(16)}
          onNext={() => saveDraftAndGoToStep(18)}
          isLoading={isSavingStep}
        />
      )}

      {/* Step 18: Safety ("Share safety details") */}
      {step === 18 && (
        <StepSafety
          selectedSafety={selectedSafety}
          onToggleSafety={handleToggleSafety}
          onBack={() => goToStep(17)}
          onNext={handleFinalSaveAndFinish}
          isLoading={isSavingStep}
        />
      )}

      {/* Shared Application Footer */}
      <Footer />
    </div>
  );
}
