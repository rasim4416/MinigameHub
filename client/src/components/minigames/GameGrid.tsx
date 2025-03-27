import { useMinigames } from '@/lib/stores/useMinigames';
import GameIcon from './GameIcon';

const GameGrid = () => {
  const { games } = useMinigames();

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:gap-6 w-full max-w-5xl mx-auto px-4">
      {games.map((game, index) => (
        <GameIcon 
          key={game.id} 
          game={game} 
          index={index}
        />
      ))}
    </div>
  );
};

export default GameGrid;
