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
    <div className="hub-backdrop flex h-screen flex-col overflow-hidden text-white">
      <main className="flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden">
        <GameHeader
          title={game?.title || "Game"}
          icon={game?.icon}
          showHomeButton={true}
        />
        <div className="flex flex-1 flex-col items-center justify-start p-2 sm:p-3">
          {game && game.isAvailable ? (
            <GameArea game={game} />
          ) : (
            <PlaceholderGame />
          )}
        </div>
      </main>
    </div>
  );
};

export default MinigamePage;
