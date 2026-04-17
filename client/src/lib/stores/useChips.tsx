import { create } from "zustand";
import { persist } from "zustand/middleware";

interface ChipsState {
  chips: number;
  addChips: (amount: number) => void;
  spendChips: (amount: number) => boolean;
}

export const useChips = create<ChipsState>()(
  persist(
    (set, get) => ({
      chips: 500,
      addChips: (amount) => set((state) => ({ chips: state.chips + amount })),
      spendChips: (amount) => {
        const { chips } = get();
        if (chips < amount) return false;
        set({ chips: chips - amount });
        return true;
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
