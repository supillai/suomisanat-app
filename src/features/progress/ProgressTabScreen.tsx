import { useAppState } from "../app/AppStateContext";
import { calculateReviewStreak } from "./progress.utils";
import { ProgressTab } from "./ProgressTab";

export default function ProgressTabScreen() {
  const { progressStore, quizSession, cloudSync, startMiniDrill } = useAppState();
  const streakDays = calculateReviewStreak(progressStore.progressMap);

  return (
    <ProgressTab
      knownCount={progressStore.stats.knownCount}
      needsPracticeCount={progressStore.stats.needsPracticeCount}
      accuracy={progressStore.stats.accuracy}
      reviewedToday={progressStore.stats.reviewedToday}
      dailyGoal={progressStore.dailyGoal}
      goalPct={progressStore.stats.goalPct}
      streakDays={streakDays}
      miniDrillRecommendations={quizSession.miniDrillRecommendations}
      cloudSync={cloudSync}
      onDailyGoalChange={progressStore.updateDailyGoal}
      onStartMiniDrill={startMiniDrill}
    />
  );
}
