import { useAppState } from "../app/AppStateContext";
import { QuizTab } from "./QuizTab";

export default function QuizTabScreen() {
  const { quizSession } = useAppState();

  return (
    <QuizTab
      quizMode={quizSession.quizMode}
      isAnswered={quizSession.isAnswered}
      quizWord={quizSession.quizWord}
      quizOptions={quizSession.quizOptions}
      typingValue={quizSession.typingValue}
      quizFeedback={quizSession.quizFeedback}
      lastAnswerCorrect={quizSession.lastAnswerCorrect}
      selectedOption={quizSession.selectedOption}
      quizCorrect={quizSession.quizCorrect}
      quizWrong={quizSession.quizWrong}
      miniDrillActive={quizSession.miniDrillActive}
      miniDrillProgress={quizSession.miniDrillProgress}
      miniDrillLastQuestion={quizSession.miniDrillLastQuestion}
      onQuizModeChange={quizSession.setQuizMode}
      onTypingValueChange={quizSession.setTypingValue}
      onAnswerMcq={quizSession.answerMcq}
      onAnswerTyping={quizSession.answerTyping}
      onNextQuiz={quizSession.nextQuiz}
      onStopMiniDrill={quizSession.stopMiniDrill}
    />
  );
}
