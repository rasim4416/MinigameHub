import ChessGame from "./ChessGame";
import { TutorialManager } from "./tutorial/TutorialManager";

export default function TutorialChess({ onBack }: { onBack: () => void }) {
  return (
    <TutorialManager onExit={onBack}>
      <ChessGame tutorialMode />
    </TutorialManager>
  );
}
