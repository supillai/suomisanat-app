import { useState } from "react";
import { words } from "./data/words";
import { AppHeader } from "./features/app/AppHeader";
import type { Tab } from "./features/app/app.types";
import { useProgressStore } from "./features/progress/useProgressStore";
import { useCloudSync } from "./features/sync/useCloudSync";
import { useStudySession } from "./features/study/useStudySession";
import { StudyTab } from "./features/study/StudyTab";
import { useQuizSession } from "./features/quiz/useQuizSession";
import { QuizTab } from "./features/quiz/QuizTab";
import { useWordFilters } from "./features/words/useWordFilters";
import { WordListTab } from "./features/words/WordListTab";
import { ProgressTab } from "./features/progress/ProgressTab";

export default function App() {
  const [tab, setTab] = useState<Tab>("study");

  const progressStore = useProgressStore(words);
  const studySession = useStudySession({
    words,
    progressMap: progressStore.progressMap,
    markWord: progressStore.markWord
  });
  const quizSession = useQuizSession({
    words,
    progressMap: progressStore.progressMap,
    markWord: progressStore.markWord
  });
  const wordFilters = useWordFilters(words);
  const cloudSync = useCloudSync({
    progressMap: progressStore.progressMap,
    progressMapRef: progressStore.progressMapRef,
    dailyGoal: progressStore.dailyGoal,
    dailyGoalRef: progressStore.dailyGoalRef,
    replaceSnapshot: progressStore.replaceSnapshot,
    localSyncSummary: progressStore.localSyncSummary
  });

  const openCloudSyncSettings = (): void => {
    cloudSync.openCloudSync();
    setTab("progress");
  };

  const startMiniDrill = (): void => {
    quizSession.startMiniDrill();
    setTab("quiz");
  };

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="mx-auto max-w-6xl">
        <AppHeader
          tab={tab}
          totalWords={progressStore.stats.totalWords}
          knownCount={progressStore.stats.knownCount}
          syncBadgeLabel={cloudSync.syncBadgeLabel}
          syncBadgeClass={cloudSync.syncBadgeClass}
          onTabChange={setTab}
          onOpenCloudSync={openCloudSyncSettings}
        />

        {tab === "study" && (
          <StudyTab
            studyFilter={studySession.studyFilter}
            studyPool={studySession.studyPool}
            studyWord={studySession.studyWord}
            reveal={studySession.reveal}
            studyHintLevel={studySession.studyHintLevel}
            studyHints={studySession.studyHints}
            studyDecision={studySession.studyDecision}
            studyKnownSession={studySession.studyKnownSession}
            studyPracticeSession={studySession.studyPracticeSession}
            reviewedToday={progressStore.stats.reviewedToday}
            accuracy={progressStore.stats.accuracy}
            needsPracticeCount={progressStore.stats.needsPracticeCount}
            dailyGoal={progressStore.dailyGoal}
            goalPct={progressStore.stats.goalPct}
            hasStudyActivity={studySession.hasStudyActivity}
            onStudyFilterChange={studySession.setStudyFilter}
            onRevealStudyWord={studySession.revealStudyWord}
            onRevealStudyHint={studySession.revealStudyHint}
            onNextStudyWord={studySession.nextStudyWord}
            onMarkStudyKnown={studySession.markStudyKnown}
            onMarkStudyPractice={studySession.markStudyPractice}
            onDailyGoalChange={progressStore.updateDailyGoal}
          />
        )}

        {tab === "quiz" && (
          <QuizTab
            quizMode={quizSession.quizMode}
            isAnswered={quizSession.isAnswered}
            quizWord={quizSession.quizWord}
            quizOptions={quizSession.quizOptions}
            typingValue={quizSession.typingValue}
            quizFeedback={quizSession.quizFeedback}
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
        )}

        {tab === "list" && (
          <WordListTab
            filteredWords={wordFilters.filteredWords}
            totalWords={progressStore.stats.totalWords}
            searchValue={wordFilters.searchValue}
            topicFilter={wordFilters.topicFilter}
            posFilter={wordFilters.posFilter}
            progressMap={progressStore.progressMap}
            onSearchChange={wordFilters.setSearchValue}
            onTopicFilterChange={wordFilters.setTopicFilter}
            onPosFilterChange={wordFilters.setPosFilter}
            onSetWordStatus={progressStore.setWordStatus}
          />
        )}

        {tab === "progress" && (
          <ProgressTab
            knownCount={progressStore.stats.knownCount}
            needsPracticeCount={progressStore.stats.needsPracticeCount}
            accuracy={progressStore.stats.accuracy}
            reviewedToday={progressStore.stats.reviewedToday}
            dailyGoal={progressStore.dailyGoal}
            goalPct={progressStore.stats.goalPct}
            miniDrillRecommendations={quizSession.miniDrillRecommendations}
            cloudSync={cloudSync}
            onDailyGoalChange={progressStore.updateDailyGoal}
            onStartMiniDrill={startMiniDrill}
          />
        )}
      </div>
    </div>
  );
}















