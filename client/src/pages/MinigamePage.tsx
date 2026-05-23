import GameHeader from "@/components/minigames/GameHeader";
import PlaceholderGame from "@/components/minigames/PlaceholderGame";
import { useMinigames } from "@/lib/stores/useMinigames";
import { useParams } from "react-router-dom";
import { useEffect } from "react";
import { useAudio } from "@/lib/stores/useAudio";
import GameArea from "@/components/minigames/GameArea";

const MinigamePage = () => {
  const { id } = useParams<{ id: string }>();
  const { games } = useMinigames();
  const { backgroundMusic } = useAudio();

  const game = games.find(g => g.id === id);

  useEffect(() => {
    if (backgroundMusic) backgroundMusic.pause();
    return () => {
      if (backgroundMusic) backgroundMusic.pause();
    };
  }, [backgroundMusic]);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-gray-950 text-white">
      <GameHeader
        title={game?.title || "Game"}
        showHomeButton={true}
      />

      <main className="flex min-h-0 flex-1 flex-col items-center justify-start overflow-y-auto overflow-x-hidden p-4 md:p-8">
        {game && game.isAvailable ? (
          <GameArea game={game} />
        ) : (
          <PlaceholderGame />
        )}
      </main>

      <footer className="py-3 text-center border-t border-gray-800">
        <p className="text-xs text-gray-600">© {new Date().getFullYear()} Minigame Collection</p>
      </footer>
    </div>
  );
};

export default MinigamePage;
