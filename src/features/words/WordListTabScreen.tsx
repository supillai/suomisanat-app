import { useAppState } from "../app/AppStateContext";
import { WordListTab } from "./WordListTab";

export default function WordListTabScreen() {
  const { wordFilters, progressStore } = useAppState();

  return (
    <WordListTab
      filteredWords={wordFilters.filteredWords}
      totalWords={progressStore.stats.totalWords}
      searchValue={wordFilters.searchValue}
      topicFilter={wordFilters.topicFilter}
      posFilter={wordFilters.posFilter}
      sortBy={wordFilters.sortBy}
      viewMode={wordFilters.viewMode}
      dueNextCount={wordFilters.dueNextCount}
      progressMap={progressStore.progressMap}
      onSearchChange={wordFilters.setSearchValue}
      onTopicFilterChange={wordFilters.setTopicFilter}
      onPosFilterChange={wordFilters.setPosFilter}
      onSortByChange={wordFilters.setSortBy}
      onViewModeChange={wordFilters.setViewMode}
      onSetWordStatus={progressStore.setWordStatus}
    />
  );
}
