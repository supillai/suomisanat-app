import { useAppState } from "../app/AppStateContext";
import { StudyTab } from "./StudyTab";

export default function StudyTabScreen() {
  const { studySession, progressStore } = useAppState();

  return (
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
  );
}
