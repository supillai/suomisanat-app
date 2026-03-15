import { useAppState } from "../app/AppStateContext";
import { ProgressTab } from "./ProgressTab";

export default function ProgressTabScreen() {
  const { progressStore, quizSession, cloudSync, startMiniDrill } = useAppState();

  return (
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
  );
}
