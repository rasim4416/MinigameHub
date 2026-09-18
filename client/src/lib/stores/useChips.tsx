import { create } from "zustand";
import { persist } from "zustand/middleware";

export const HOURLY_BONUS_AMOUNT = 1000;
export const HOURLY_BONUS_INTERVAL_MS = 60 * 60 * 1000;

/** Epoch ms when the hourly bonus becomes claimable (0 once it is ready). */
export function hourlyBonusReadyAt(lastClaimedAt: number | null): number {
  return lastClaimedAt === null ? 0 : lastClaimedAt + HOURLY_BONUS_INTERVAL_MS;
}

interface ChipsState {
  chips: number;
  lastHourlyBonusAt: number | null;
  addChips: (amount: number) => void;
  spendChips: (amount: number) => boolean;
  /** Grants the bonus and returns the amount, or null while still on cooldown. */
  claimHourlyBonus: () => number | null;
}

export const useChips = create<ChipsState>()(
  persist(
    (set, get) => ({
      chips: 500,
      lastHourlyBonusAt: null,
      addChips: (amount) => set((state) => ({ chips: state.chips + amount })),
      spendChips: (amount) => {
        const { chips } = get();
        if (chips < amount) return false;
        set({ chips: chips - amount });
        return true;
      },
      claimHourlyBonus: () => {
        const now = Date.now();
        const { chips, lastHourlyBonusAt } = get();
        if (now < hourlyBonusReadyAt(lastHourlyBonusAt)) return null;
        set({ chips: chips + HOURLY_BONUS_AMOUNT, lastHourlyBonusAt: now });
        return HOURLY_BONUS_AMOUNT;
      },
    }),
    { name: "chips-storage" }
  )
);

export const CHIP_DENOMINATIONS = [
  { value: 5,     color: "bg-gray-400",   text: "text-gray-900",  border: "border-gray-300",  label: "5"     },
  { value: 10,    color: "bg-blue-500",   text: "text-white",     border: "border-blue-300",  label: "10"    },
  { value: 20,    color: "bg-green-500",  text: "text-white",     border: "border-green-300", label: "20"    },
  { value: 50,    color: "bg-red-500",    text: "text-white",     border: "border-red-300",   label: "50"    },
  { value: 100,   color: "bg-gray-800",   text: "text-white",     border: "border-gray-600",  label: "100"   },
  { value: 200,   color: "bg-purple-500", text: "text-white",     border: "border-purple-300",label: "200"   },
  { value: 500,   color: "bg-orange-500", text: "text-white",     border: "border-orange-300",label: "500"   },
  { value: 1000,  color: "bg-cyan-500",   text: "text-gray-900",  border: "border-cyan-300",  label: "1K"    },
  { value: 5000,  color: "bg-pink-500",   text: "text-white",     border: "border-pink-300",  label: "5K"    },
  { value: 10000, color: "bg-yellow-400", text: "text-gray-900",  border: "border-yellow-200",label: "10K"   },
] as const;
