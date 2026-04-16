import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAudio } from '@/lib/stores/useAudio';
import { GameType } from '@/lib/stores/useMinigames';

interface GameIconProps {
  game: GameType;
  index: number;
}

const GameIcon = ({ game, index }: GameIconProps) => {
  const [isHovered, setIsHovered] = useState(false);
  const navigate = useNavigate();
  const { playHit } = useAudio();

  const handleClick = () => {
    if (!game.isAvailable) return;
    playHit();
    navigate(`/minigames/${game.id}`);
  };

  return (
    <div
      className={`
        relative aspect-square flex flex-col items-center justify-center rounded-lg border transition-all duration-200 select-none
        ${game.isAvailable ? 'cursor-pointer' : 'cursor-default opacity-50'}
        ${isHovered && game.isAvailable
          ? 'bg-gray-800 border-indigo-500 shadow-lg shadow-indigo-900/30 scale-105'
          : 'bg-gray-900 border-gray-800'}
      `}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleClick}
      data-testid={`game-icon-${index}`}
    >
      <div className={`text-4xl mb-3 transition-transform duration-200 ${isHovered && game.isAvailable ? 'scale-110' : ''}`}>
        {game.icon}
      </div>

      <div className={`text-sm font-semibold transition-colors duration-200 ${isHovered && game.isAvailable ? 'text-indigo-300' : 'text-gray-200'}`}>
        {game.title}
      </div>

      {!game.isAvailable && (
        <div className="mt-2 text-[10px] font-bold text-gray-500 tracking-widest uppercase">
          Coming Soon
        </div>
      )}

      {isHovered && game.isAvailable && (
        <div className="mt-2 px-3 py-0.5 bg-indigo-600 rounded-full text-[11px] font-semibold text-white">
          Play Now
        </div>
      )}
    </div>
  );
};

export default GameIcon;
