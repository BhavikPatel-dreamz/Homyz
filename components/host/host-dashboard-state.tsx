"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type HostDashboardState = {
  selectedPropertyId: string | null;
  setSelectedPropertyId: (propertyId: string | null) => void;
};

const HostDashboardStateContext = createContext<HostDashboardState | null>(null);

export function HostDashboardStateProvider({ children }: { children: ReactNode }) {
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);
  const value = useMemo(
    () => ({ selectedPropertyId, setSelectedPropertyId }),
    [selectedPropertyId],
  );

  return (
    <HostDashboardStateContext.Provider value={value}>
      {children}
    </HostDashboardStateContext.Provider>
  );
}

export function useHostDashboardState(): HostDashboardState {
  const state = useContext(HostDashboardStateContext);
  if (!state) {
    throw new Error("useHostDashboardState must be used within HostDashboardStateProvider");
  }
  return state;
}
