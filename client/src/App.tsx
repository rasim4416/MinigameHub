import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import MinigameMenu from "@/pages/MinigameMenu";
import MinigamePage from "@/pages/MinigamePage";
import NotFound from "@/pages/not-found";
import { Suspense } from "react";
import { Toaster } from "@/components/ui/sonner";

function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<div className="flex items-center justify-center h-screen">Loading...</div>}>
        <Routes>
          <Route path="/" element={<Navigate to="/minigames" replace />} />
          <Route path="/minigames" element={<MinigameMenu />} />
          <Route path="/minigames/:id" element={<MinigamePage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
      <Toaster position="top-right" />
    </BrowserRouter>
  );
}

export default App;
