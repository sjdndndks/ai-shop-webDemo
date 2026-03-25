import { create } from "zustand";
import { persist } from "zustand/middleware";

export const MIN_RECOMMENDATION_COUNT = 1;
export const MAX_RECOMMENDATION_COUNT = 6;

function clampProductCount(value: number) {
  return Math.min(
    MAX_RECOMMENDATION_COUNT,
    Math.max(MIN_RECOMMENDATION_COUNT, Math.floor(value)),
  );
}

interface SettingsStore {
  productCount: number;
  setProductCount: (value: number) => void;
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      productCount: 3,
      setProductCount: (value) => {
        set({ productCount: clampProductCount(value) });
      },
    }),
    {
      name: "ai-shop-settings",
    },
  ),
);
