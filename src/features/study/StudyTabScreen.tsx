import { useMemo } from "react";
import { useAppState } from "../app/AppStateContext";
import { calculateReviewStreak } from "../progress/progress.utils";
import { StudyTab } from "./StudyTab";

export default function StudyTabScreen() {
  const { studySession, progressStore } = useAppState();
  const streakDays = calculateReviewStreak(progressStore.progressMap);
  const scopedStats = useMemo(() => {
    const scopedWords = studySession.scopedWords;

    return {
      knownCount: scopedWords.filter((word) => progressStore.progressMap[word.id]?.known).length,
      needsPracticeCount: scopedWords.filter((word) => progressStore.progressMap[word.id]?.needsPractice).length,
      totalWords: scopedWords.length
    };
  }, [progressStore.progressMap, studySession.scopedWords]);

  return (
    <StudyTab
      studyFilter={studySession.studyFilter}
      studyScope={studySession.studyScope}
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
      needsPracticeCount={scopedStats.needsPracticeCount}
      knownCount={scopedStats.knownCount}
      totalWords={scopedStats.totalWords}
      streakDays={streakDays}
      dailyGoal={progressStore.dailyGoal}
      goalPct={progressStore.stats.goalPct}
      hasStudyActivity={studySession.hasStudyActivity}
      onStudyFilterChange={studySession.setStudyFilter}
      onStudyScopeChange={studySession.setStudyScope}
      onRevealStudyWord={studySession.revealStudyWord}
      onRevealStudyHint={studySession.revealStudyHint}
      onNextStudyWord={studySession.nextStudyWord}
      onMarkStudyKnown={studySession.markStudyKnown}
      onMarkStudyPractice={studySession.markStudyPractice}
      onDailyGoalChange={progressStore.updateDailyGoal}
    />
  );
}