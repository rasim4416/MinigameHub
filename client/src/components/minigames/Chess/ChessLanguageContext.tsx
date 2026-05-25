import { createContext, useContext, type ReactNode } from "react";
import type { Language } from "../../../lib/language";

const ChessLanguageContext = createContext<Language>("english");

export function ChessLanguageProvider({
  language,
  children,
}: {
  language: Language;
  children: ReactNode;
}) {
  return (
    <ChessLanguageContext.Provider value={language}>
      {children}
    </ChessLanguageContext.Provider>
  );
}

export function useChessLanguage(): Language {
  return useContext(ChessLanguageContext);
}
