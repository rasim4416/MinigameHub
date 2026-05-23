export type BoardThemePalette = {
  light: string;
  dark: string;
  selLight: string;
  selDark: string;
  lastLight: string;
  lastDark: string;
};

export type BoardThemeId =
  | "classic"
  | "forest"
  | "ocean"
  | "slate"
  | "highContrast";

export const BOARD_THEMES: Record<
  BoardThemeId,
  { label: string; palette: BoardThemePalette }
> = {
  classic: {
    label: "Classic",
    palette: {
      light: "#f0d9b5",
      dark: "#b58863",
      selLight: "#f6f669",
      selDark: "#baca2b",
      lastLight: "#cdd16f",
      lastDark: "#aaa23a",
    },
  },
  forest: {
    label: "Forest",
    palette: {
      light: "#dce8c6",
      dark: "#6b8f4e",
      selLight: "#e8f5a0",
      selDark: "#8faa3c",
      lastLight: "#c5e89a",
      lastDark: "#5a7d38",
    },
  },
  ocean: {
    label: "Ocean",
    palette: {
      light: "#d4e4f7",
      dark: "#5b7c99",
      selLight: "#a8d4ff",
      selDark: "#4a90c4",
      lastLight: "#9ec5eb",
      lastDark: "#3d6d8f",
    },
  },
  slate: {
    label: "Slate",
    palette: {
      light: "#c8cdd3",
      dark: "#5a6068",
      selLight: "#e2e8f0",
      selDark: "#94a3b8",
      lastLight: "#b8c0c8",
      lastDark: "#4b5563",
    },
  },
  highContrast: {
    label: "High contrast",
    palette: {
      light: "#ffffff",
      dark: "#2d2d2d",
      selLight: "#ffff00",
      selDark: "#cccc00",
      lastLight: "#e0e0e0",
      lastDark: "#404040",
    },
  },
};
