import { useEffect, useMemo, useState } from "react";
import { words } from "./data/words";
import type { ProgressMap, VocabularyWord, WordPos, WordTopic } from "./types";

type Tab = "study" | "quiz" | "list" | "progress";
type StudyFilter = "all" | "unknown" | "known";
type QuizMode = "mcq" | "typing";

const PROGRESS_KEY = "suomisanat-progress-v1";
const DAILY_GOAL_KEY = "suomisanat-daily-goal-v1";
const DEFAULT_DAILY_GOAL = 20;

const TOPICS: WordTopic[] = ["core", "time", "home", "food", "city", "health", "work", "verbs", "describing"];
const POS_OPTIONS: WordPos[] = ["noun", "verb", "adjective", "adverb", "pronoun", "other"];

const todayIso = (): string => new Date().toISOString().slice(0, 10);

const normalizeFinnish = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/\u00E4/g, "a")
    .replace(/\u00F6/g, "o")
    .replace(/\u00E5/g, "a")
    .replace(/\s+/g, " ");

const randomFrom = <T,>(list: T[]): T => list[Math.floor(Math.random() * list.length)];

const safeReadProgress = (): ProgressMap => {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    if (!raw) return {};
    return (JSON.parse(raw) as ProgressMap) ?? {};
  } catch {
    return {};
  }
};

const safeReadDailyGoal = (): number => {
  try {
    const parsed = Number(localStorage.getItem(DAILY_GOAL_KEY));
    return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_DAILY_GOAL;
  } catch {
    return DEFAULT_DAILY_GOAL;
  }
};

const pickQuizOptions = (correctWord: VocabularyWord): string[] => {
  const distractors = Array.from(
    new Set(words.filter((word) => word.id !== correctWord.id).map((word) => word.en))
  )
    .sort(() => Math.random() - 0.5)
    .slice(0, 3);

  return [...distractors, correctWord.en].sort(() => Math.random() - 0.5);
};

export default function App() {
  const [tab, setTab] = useState<Tab>("study");
  const [progressMap, setProgressMap] = useState<ProgressMap>(() => safeReadProgress());
  const [dailyGoal, setDailyGoal] = useState<number>(() => safeReadDailyGoal());
  const [studyFilter, setStudyFilter] = useState<StudyFilter>("all");
  const [studyWord, setStudyWord] = useState<VocabularyWord>(() => words[0]);
  const [reveal, setReveal] = useState(false);
  const [quizMode, setQuizMode] = useState<QuizMode>("mcq");
  const [quizWord, setQuizWord] = useState<VocabularyWord>(() => words[1]);
  const [quizOptions, setQuizOptions] = useState<string[]>(() => pickQuizOptions(words[1]));
  const [typingValue, setTypingValue] = useState("");
  const [quizFeedback, setQuizFeedback] = useState("");
  const [quizCorrect, setQuizCorrect] = useState(0);
  const [quizWrong, setQuizWrong] = useState(0);
  const [searchValue, setSearchValue] = useState("");
  const [topicFilter, setTopicFilter] = useState<WordTopic | "all">("all");
  const [posFilter, setPosFilter] = useState<WordPos | "all">("all");

  useEffect(() => {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(progressMap));
  }, [progressMap]);

  useEffect(() => {
    localStorage.setItem(DAILY_GOAL_KEY, String(dailyGoal));
  }, [dailyGoal]);

  const markWord = (word: VocabularyWord, isCorrect: boolean, known?: boolean): void => {
    setProgressMap((current) => {
      const prev = current[word.id] ?? {
        seen: 0,
        correct: 0,
        wrong: 0,
        known: false,
        lastReviewed: null
      };

      return {
        ...current,
        [word.id]: {
          seen: prev.seen + 1,
          correct: prev.correct + (isCorrect ? 1 : 0),
          wrong: prev.wrong + (isCorrect ? 0 : 1),
          known: typeof known === "boolean" ? known : prev.known,
          lastReviewed: todayIso()
        }
      };
    });
  };

  const studyPool = useMemo(() => {
    if (studyFilter === "all") return words;
    return words.filter((word) => {
      const known = progressMap[word.id]?.known ?? false;
      return studyFilter === "known" ? known : !known;
    });
  }, [progressMap, studyFilter]);

  const filteredWords = useMemo(() => {
    return words.filter((word) => {
      if (topicFilter !== "all" && word.topic !== topicFilter) return false;
      if (posFilter !== "all" && word.pos !== posFilter) return false;
      if (!searchValue.trim()) return true;
      const needle = searchValue.toLowerCase();
      return (
        word.fi.toLowerCase().includes(needle) ||
        word.en.toLowerCase().includes(needle) ||
        word.fiSimple.toLowerCase().includes(needle)
      );
    });
  }, [posFilter, searchValue, topicFilter]);

  const knownCount = words.filter((word) => progressMap[word.id]?.known).length;
  const reviewedToday = words.filter((word) => progressMap[word.id]?.lastReviewed === todayIso()).length;
  const totalCorrect = words.reduce((sum, word) => sum + (progressMap[word.id]?.correct ?? 0), 0);
  const totalWrong = words.reduce((sum, word) => sum + (progressMap[word.id]?.wrong ?? 0), 0);
  const accuracy = totalCorrect + totalWrong > 0 ? Math.round((totalCorrect / (totalCorrect + totalWrong)) * 100) : 0;
  const goalPct = Math.min(100, Math.round((reviewedToday / dailyGoal) * 100));

  const nextStudyWord = (): void => {
    const pool = studyPool.length > 0 ? studyPool : words;
    setStudyWord(randomFrom(pool));
    setReveal(false);
  };

  const nextQuiz = (): void => {
    const next = randomFrom(words);
    setQuizWord(next);
    setQuizOptions(pickQuizOptions(next));
    setTypingValue("");
    setQuizFeedback("");
  };

  const answerMcq = (option: string): void => {
    const ok = option === quizWord.en;
    markWord(quizWord, ok);
    if (ok) {
      setQuizCorrect((prev) => prev + 1);
      setQuizFeedback("Correct.");
    } else {
      setQuizWrong((prev) => prev + 1);
      setQuizFeedback(`Incorrect. Correct answer: ${quizWord.en}`);
    }
  };

  const answerTyping = (): void => {
    if (!typingValue.trim()) return;
    const ok = normalizeFinnish(typingValue) === normalizeFinnish(quizWord.fi);
    markWord(quizWord, ok);
    if (ok) {
      setQuizCorrect((prev) => prev + 1);
      setQuizFeedback("Correct.");
    } else {
      setQuizWrong((prev) => prev + 1);
      setQuizFeedback(`Incorrect. Correct answer: ${quizWord.fi}`);
    }
  };

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="mx-auto max-w-6xl">
        <header className="glass card-shadow mb-6 rounded-3xl p-5 md:p-8">
          <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight text-ink md:text-4xl">SuomiSanat</h1>
              <p className="mt-2 max-w-xl text-sm text-slate-700 md:text-base">
                500 Finnish must-have words for YKI intermediate (grade 3), with English meaning and simple Finnish explanation.
              </p>
            </div>
            <div className="sun-gradient inline-flex rounded-2xl px-4 py-3 text-sm font-semibold text-ink">
              Known: {knownCount}/500
            </div>
          </div>

          <nav className="mt-6 grid gap-2 sm:grid-cols-2 md:grid-cols-4">
            <button className={`rounded-xl px-3 py-2 text-sm font-semibold ${tab === "study" ? "accent-gradient text-white" : "bg-white text-ink"}`} onClick={() => setTab("study")}>
              Study
            </button>
            <button className={`rounded-xl px-3 py-2 text-sm font-semibold ${tab === "quiz" ? "accent-gradient text-white" : "bg-white text-ink"}`} onClick={() => setTab("quiz")}>
              Quiz
            </button>
            <button className={`rounded-xl px-3 py-2 text-sm font-semibold ${tab === "list" ? "accent-gradient text-white" : "bg-white text-ink"}`} onClick={() => setTab("list")}>
              Word List
            </button>
            <button className={`rounded-xl px-3 py-2 text-sm font-semibold ${tab === "progress" ? "accent-gradient text-white" : "bg-white text-ink"}`} onClick={() => setTab("progress")}>
              Progress
            </button>
          </nav>
        </header>

        {tab === "study" && (
          <section className="glass card-shadow rounded-3xl p-5 md:p-8">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-slate-700">Study mode:</span>
              {(["all", "unknown", "known"] as StudyFilter[]).map((mode) => (
                <button
                  key={mode}
                  className={`rounded-lg px-3 py-1 text-sm ${studyFilter === mode ? "accent-gradient text-white" : "bg-slate-200 text-ink"}`}
                  onClick={() => setStudyFilter(mode)}
                >
                  {mode}
                </button>
              ))}
              <span className="ml-auto text-xs text-slate-600">Pool: {studyPool.length}</span>
            </div>

            <div className="rounded-3xl bg-white p-6 text-center">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{studyWord.topic}</p>
              <h2 className="mt-3 text-4xl font-extrabold text-ink md:text-5xl">{studyWord.fi}</h2>
              {!reveal && <p className="mt-4 text-sm text-slate-600">Try to recall the meaning, then reveal.</p>}
              {reveal && (
                <div className="mt-4 space-y-2">
                  <p className="text-xl font-semibold text-accent">{studyWord.en}</p>
                  <p className="text-sm text-slate-700">{studyWord.fiSimple}</p>
                </div>
              )}
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <button className="rounded-xl bg-slate-800 px-4 py-2 text-sm font-semibold text-white" onClick={() => setReveal(true)}>
                Reveal
              </button>
              <button className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-ink" onClick={nextStudyWord}>
                Next Card
              </button>
              <button
                className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white"
                onClick={() => {
                  markWord(studyWord, true, true);
                  nextStudyWord();
                }}
              >
                Mark Known
              </button>
              <button
                className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-white"
                onClick={() => {
                  markWord(studyWord, false, false);
                  nextStudyWord();
                }}
              >
                Needs Practice
              </button>
            </div>
          </section>
        )}

        {tab === "quiz" && (
          <section className="glass card-shadow rounded-3xl p-5 md:p-8">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-slate-700">Quiz mode:</span>
              <button className={`rounded-lg px-3 py-1 text-sm ${quizMode === "mcq" ? "accent-gradient text-white" : "bg-slate-200 text-ink"}`} onClick={() => setQuizMode("mcq")}>
                Multiple Choice
              </button>
              <button className={`rounded-lg px-3 py-1 text-sm ${quizMode === "typing" ? "accent-gradient text-white" : "bg-slate-200 text-ink"}`} onClick={() => setQuizMode("typing")}>
                Type Finnish
              </button>
              <span className="ml-auto text-xs text-slate-600">
                Score: {quizCorrect} correct / {quizWrong} wrong
              </span>
            </div>

            <div className="rounded-3xl bg-white p-6">
              {quizMode === "mcq" && (
                <>
                  <p className="text-sm text-slate-500">Pick the English meaning:</p>
                  <h2 className="mt-2 text-3xl font-bold text-ink">{quizWord.fi}</h2>
                  <div className="mt-5 grid gap-2 sm:grid-cols-2">
                    {quizOptions.map((option) => (
                      <button
                        key={`${quizWord.id}-${option}`}
                        className="rounded-xl border border-slate-200 px-3 py-3 text-left text-sm font-semibold text-ink hover:bg-slate-50"
                        onClick={() => answerMcq(option)}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                </>
              )}

              {quizMode === "typing" && (
                <>
                  <p className="text-sm text-slate-500">Type the Finnish word:</p>
                  <h2 className="mt-2 text-2xl font-bold text-ink">{quizWord.en}</h2>
                  <input
                    className="mt-4 w-full rounded-xl border border-slate-300 px-3 py-2 text-base focus:border-accent focus:outline-none"
                    placeholder="Write Finnish word"
                    value={typingValue}
                    onChange={(event) => setTypingValue(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        answerTyping();
                      }
                    }}
                  />
                  <button className="mt-3 rounded-xl bg-slate-800 px-4 py-2 text-sm font-semibold text-white" onClick={answerTyping}>
                    Check
                  </button>
                </>
              )}

              {quizFeedback && <p className="mt-4 text-sm font-semibold text-slate-700">{quizFeedback}</p>}
            </div>

            <button className="mt-4 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-ink" onClick={nextQuiz}>
              Next Question
            </button>
          </section>
        )}

        {tab === "list" && (
          <section className="glass card-shadow rounded-3xl p-5 md:p-8">
            <div className="grid gap-3 md:grid-cols-4">
              <input
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-accent focus:outline-none md:col-span-2"
                placeholder="Search Finnish, English, or explanation"
                value={searchValue}
                onChange={(event) => setSearchValue(event.target.value)}
              />
              <select
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-accent focus:outline-none"
                value={topicFilter}
                onChange={(event) => setTopicFilter(event.target.value as WordTopic | "all")}
              >
                <option value="all">All Topics</option>
                {TOPICS.map((topic) => (
                  <option key={topic} value={topic}>
                    {topic}
                  </option>
                ))}
              </select>
              <select
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-accent focus:outline-none"
                value={posFilter}
                onChange={(event) => setPosFilter(event.target.value as WordPos | "all")}
              >
                <option value="all">All POS</option>
                {POS_OPTIONS.map((pos) => (
                  <option key={pos} value={pos}>
                    {pos}
                  </option>
                ))}
              </select>
            </div>

            <p className="mt-3 text-xs text-slate-600">Showing {filteredWords.length} of 500 words</p>

            <div className="mt-4 max-h-[60vh] overflow-auto rounded-2xl border border-slate-200 bg-white">
              <table className="w-full min-w-[700px] text-left text-sm">
                <thead className="sticky top-0 bg-slate-100 text-xs uppercase tracking-wide text-slate-600">
                  <tr>
                    <th className="px-3 py-2">Finnish</th>
                    <th className="px-3 py-2">English</th>
                    <th className="px-3 py-2">Simple Finnish</th>
                    <th className="px-3 py-2">Topic</th>
                    <th className="px-3 py-2">Known</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredWords.map((word) => (
                    <tr key={word.id} className="border-t border-slate-100">
                      <td className="px-3 py-2 font-semibold text-ink">{word.fi}</td>
                      <td className="px-3 py-2">{word.en}</td>
                      <td className="px-3 py-2 text-slate-700">{word.fiSimple}</td>
                      <td className="px-3 py-2 text-xs uppercase tracking-wide text-slate-500">{word.topic}</td>
                      <td className="px-3 py-2">{progressMap[word.id]?.known ? "yes" : "no"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {tab === "progress" && (
          <section className="glass card-shadow rounded-3xl p-5 md:p-8">
            <div className="grid gap-4 md:grid-cols-3">
              <article className="rounded-2xl bg-white p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">Known Words</p>
                <p className="mt-2 text-3xl font-bold text-ink">{knownCount}</p>
              </article>
              <article className="rounded-2xl bg-white p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">Accuracy</p>
                <p className="mt-2 text-3xl font-bold text-ink">{accuracy}%</p>
              </article>
              <article className="rounded-2xl bg-white p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">Reviewed Today</p>
                <p className="mt-2 text-3xl font-bold text-ink">{reviewedToday}</p>
              </article>
            </div>

            <div className="mt-5 rounded-2xl bg-white p-4">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-semibold text-ink">Daily goal progress</p>
                <span className="text-xs text-slate-600">
                  {reviewedToday}/{dailyGoal}
                </span>
              </div>
              <div className="h-3 rounded-full bg-slate-200">
                <div className="h-3 rounded-full bg-accent" style={{ width: `${goalPct}%` }} />
              </div>
              <div className="mt-4 flex items-center gap-2">
                <label htmlFor="daily-goal" className="text-sm text-slate-700">
                  Daily goal
                </label>
                <input
                  id="daily-goal"
                  type="number"
                  min={5}
                  max={200}
                  className="w-24 rounded-lg border border-slate-300 px-2 py-1 text-sm"
                  value={dailyGoal}
                  onChange={(event) => {
                    const parsed = Number(event.target.value);
                    if (Number.isFinite(parsed) && parsed > 0) {
                      setDailyGoal(Math.round(parsed));
                    }
                  }}
                />
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}




