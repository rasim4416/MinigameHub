import React from 'react';
import { FallingWord } from '@/lib/stores/useSpeedTyper';
import { cn } from '@/lib/utils';

interface FallingWordsProps {
  words: FallingWord[];
  isPaused: boolean;
}

const FallingWords: React.FC<FallingWordsProps> = ({ words, isPaused }) => {
  return (
    <div className="falling-words-container absolute inset-0">
      {words.map((word) => (
        <div
          key={word.id}
          className={cn(
            "absolute transform -translate-x-1/2 transition-opacity duration-300",
            word.color,
            isPaused ? "animate-none" : ""
          )}
          style={{
            left: `${word.x}%`,
            top: `${word.y}%`,
            // Apply font size based on word length - shorter words are bigger
            fontSize: `${Math.max(6, 24 - word.word.length)}px`,
            // Optional: Add a subtle glow effect based on color
            textShadow: '0 0 5px currentColor',
            opacity: isPaused ? 0.7 : 1
          }}
        >
          <span className="font-medium">{word.word}</span>
        </div>
      ))}
    </div>
  );
};

export default FallingWords;