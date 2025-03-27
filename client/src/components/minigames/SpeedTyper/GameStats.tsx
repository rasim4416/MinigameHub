import React from 'react';
import { Clock, Trophy } from 'lucide-react';

interface GameStatsProps {
  score: number;
  timeLeft: number;
}

const GameStats: React.FC<GameStatsProps> = ({ score, timeLeft }) => {
  // Format time as MM:SS
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };
  
  // Determine time color based on remaining time
  const getTimeColor = (seconds: number): string => {
    if (seconds <= 10) return 'text-red-500';
    if (seconds <= 30) return 'text-yellow-500';
    return 'text-green-500';
  };

  return (
    <div className="game-stats-container p-4 flex justify-between items-center bg-card rounded-t-lg border-b border-border">
      <div className="stat-item flex items-center gap-2">
        <Trophy className="h-5 w-5 text-yellow-500" />
        <span className="font-semibold">Score:</span>
        <span className="text-lg font-bold text-primary">{score}</span>
      </div>
      
      <div className="stat-item flex items-center gap-2">
        <Clock className="h-5 w-5 text-blue-500" />
        <span className="font-semibold">Time:</span>
        <span className={`text-lg font-bold ${getTimeColor(timeLeft)}`}>
          {formatTime(timeLeft)}
        </span>
      </div>
    </div>
  );
};

export default GameStats;