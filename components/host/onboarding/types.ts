import React from "react";

export interface PropertyCategory {
  id: string;
  label: string;
  icon: React.ReactNode;
}

export interface PlaceTypeOption {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
}

export interface LocationDetails {
  address?: string;
  city?: string;
  district?: string;
  postalCode?: string;
  country?: string;
  formattedAddress?: string;
}

export interface LocationCoords {
  lat: number;
  lng: number;
}
