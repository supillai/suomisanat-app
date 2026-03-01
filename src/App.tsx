import { useEffect, useMemo, useState } from "react";
import { words } from "./data/words";
import type { ProgressMap, VocabularyWord, WordPos, WordTopic } from "./types";

type Tab = "study" | "quiz" | "list" | "progress";
type StudyFilter = "all" | "unknown" | "known";
type QuizMode = "mcq" | "typing";
type StudyDecision = "none" | "known" | "practice";

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

const studyExample = (word: VocabularyWord): string => {
  if (word.pos === "verb") {
    if (word.fi === "olla") {
      return "Esimerkki: Minä haluan olla ajoissa.";
    }
    return `Esimerkki: Minä yritän ${word.fi} tänään.`;
  }
  if (word.pos === "noun") {
    return `Esimerkki: Tämä on ${word.fi}.`;
  }
  if (word.pos === "adjective") {
    return `Esimerkki: Tämä tehtävä on ${word.fi}.`;
  }
  if (word.pos === "adverb") {
    return `Esimerkki: Hän puhuu ${word.fi}.`;
  }
  if (word.pos === "pronoun") {
    return `Esimerkki: Sana "${word.fi}" auttaa keskustelussa.`;
  }
  return `Esimerkki: Käytän sanaa "${word.fi}" arjessa.`;
};

export default function App() {
  const [tab, setTab] = useState<Tab>("study");
  const [progressMap, setProgressMap] = useState<ProgressMap>(() => safeReadProgress());
  const [dailyGoal, setDailyGoal] = useState<number>(() => safeReadDailyGoal());
  const [studyFilter, setStudyFilter] = useState<StudyFilter>("all");
  const [studyWord, setStudyWord] = useState<VocabularyWord>(() => words[0]);
  const [reveal, setReveal] = useState(false);
  const [studyDecision, setStudyDecision] = useState<StudyDecision>("none");
  const [studyKnownSession, setStudyKnownSession] = useState(0);
  const [studyPracticeSession, setStudyPracticeSession] = useState(0);
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

  useEffect(() => {
    if (!studyPool.some((word) => word.id === studyWord.id)) {
      const fallback = studyPool.length > 0 ? studyPool[0] : words[0];
      setStudyWord(fallback);
      setReveal(false);
      setStudyDecision("none");
    }
  }, [studyPool, studyWord.id]);

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
    setStudyDecision("none");
  };

  const revealStudyWord = (): void => {
    setReveal(true);
    setStudyDecision("none");
  };

  const markStudyKnown = (): void => {
    if (!reveal || studyDecision !== "none") return;
    markWord(studyWord, true, true);
    setStudyDecision("known");
    setStudyKnownSession((prev) => prev + 1);
  };

  const markStudyPractice = (): void => {
    if (!reveal || studyDecision !== "none") return;
    markWord(studyWord, false, false);
    setStudyDecision("practice");
    setStudyPracticeSession((prev) => prev + 1);
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
                337 Finnish must-have words for YKI intermediate (grade 3), with English meaning and simple Finnish explanation.
              </p>
            </div>
            <div className="sun-gradient inline-flex rounded-2xl px-4 py-3 text-sm font-semibold text-ink">
              Known: {knownCount}/500
            </div>
          </div>

          <nav className="mt-6 grid gap-2 sm:grid-cols-2 md:grid-cols-4">
            <button
              className={`rounded-xl border px-3 py-2 text-sm font-semibold ${
                tab === "study"
                  ? "accent-gradient border-transparent text-white"
                  : "border-slate-300 bg-white text-slate-800 hover:bg-slate-50"
              }`}
              onClick={() => setTab("study")}
            >
              Study
            </button>
            <button
              className={`rounded-xl border px-3 py-2 text-sm font-semibold ${
                tab === "quiz"
                  ? "accent-gradient border-transparent text-white"
                  : "border-slate-300 bg-white text-slate-800 hover:bg-slate-50"
              }`}
              onClick={() => setTab("quiz")}
            >
              Quiz
            </button>
            <button
              className={`rounded-xl border px-3 py-2 text-sm font-semibold ${
                tab === "list"
                  ? "accent-gradient border-transparent text-white"
                  : "border-slate-300 bg-white text-slate-800 hover:bg-slate-50"
              }`}
              onClick={() => setTab("list")}
            >
              Word List
            </button>
            <button
              className={`rounded-xl border px-3 py-2 text-sm font-semibold ${
                tab === "progress"
                  ? "accent-gradient border-transparent text-white"
                  : "border-slate-300 bg-white text-slate-800 hover:bg-slate-50"
              }`}
              onClick={() => setTab("progress")}
            >
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
                  className={`rounded-lg border px-3 py-1 text-sm ${
                    studyFilter === mode
                      ? "accent-gradient border-transparent text-white"
                      : "border-slate-300 bg-slate-100 text-slate-800 hover:bg-slate-200"
                  }`}
                  onClick={() => setStudyFilter(mode)}
                >
                  {mode}
                </button>
              ))}
              <span className="ml-auto text-xs text-slate-700">Pool: {studyPool.length}</span>
            </div>

            <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <article className="rounded-2xl border border-slate-200 bg-white p-3">
                <p className="text-xs uppercase tracking-wide text-slate-600">Reviewed Today</p>
                <p className="mt-1 text-2xl font-bold text-ink">{reviewedToday}</p>
              </article>
              <article className="rounded-2xl border border-slate-200 bg-white p-3">
                <p className="text-xs uppercase tracking-wide text-slate-600">Accuracy</p>
                <p className="mt-1 text-2xl font-bold text-ink">{accuracy}%</p>
              </article>
              <article className="rounded-2xl border border-slate-200 bg-white p-3">
                <p className="text-xs uppercase tracking-wide text-slate-600">Session Known</p>
                <p className="mt-1 text-2xl font-bold text-ink">{studyKnownSession}</p>
              </article>
              <article className="rounded-2xl border border-slate-200 bg-white p-3">
                <p className="text-xs uppercase tracking-wide text-slate-600">Session Practice</p>
                <p className="mt-1 text-2xl font-bold text-ink">{studyPracticeSession}</p>
              </article>
            </div>

            <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-4">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-semibold text-ink">Daily goal progress</p>
                <span className="text-xs text-slate-700">
                  {reviewedToday}/{dailyGoal}
                </span>
              </div>
              <div className="h-3 rounded-full bg-slate-200">
                <div className="h-3 rounded-full bg-accent" style={{ width: `${goalPct}%` }} />
              </div>
              <div className="mt-3 flex items-center gap-2">
                <label htmlFor="daily-goal-study" className="text-sm text-slate-700">
                  Daily goal
                </label>
                <input
                  id="daily-goal-study"
                  type="number"
                  min={5}
                  max={200}
                  className="w-24 rounded-lg border border-slate-300 px-2 py-1 text-sm text-slate-900"
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

            <div className="rounded-3xl border border-slate-200 bg-white p-6 text-center">
              <div className="mb-3 flex flex-wrap justify-center gap-2">
                <span className="rounded-full border border-slate-300 bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-700">
                  {studyWord.topic}
                </span>
                <span className="rounded-full border border-slate-300 bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-700">
                  {studyWord.pos}
                </span>
              </div>
              <h2 className="mt-3 text-4xl font-extrabold text-ink md:text-5xl">{studyWord.fi}</h2>
              {!reveal && <p className="mt-4 text-sm text-slate-700">Try to recall the meaning, then reveal.</p>}
              {reveal && (
                <div className="mt-4 space-y-2">
                  <p className="text-xl font-semibold text-accent">{studyWord.en}</p>
                  <p className="text-sm text-slate-800">{studyWord.fiSimple}</p>
                  <p className="text-sm text-slate-700">{studyExample(studyWord)}</p>
                </div>
              )}
            </div>

            {!reveal && (
              <div className="mt-5 grid gap-2 sm:grid-cols-2">
                <button className="w-full rounded-xl bg-slate-800 px-4 py-3 text-sm font-semibold text-white" onClick={revealStudyWord}>
                  Reveal Meaning
                </button>
                <button
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-50"
                  onClick={nextStudyWord}
                >
                  Skip Card
                </button>
              </div>
            )}

            {reveal && studyDecision === "none" && (
              <div className="mt-5 grid gap-2 sm:grid-cols-2">
                <button className="w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white" onClick={markStudyKnown}>
                  Mark Known
                </button>
                <button className="w-full rounded-xl bg-amber-500 px-4 py-3 text-sm font-semibold text-white" onClick={markStudyPractice}>
                  Needs Practice
                </button>
                <button
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-50 sm:col-span-2"
                  onClick={nextStudyWord}
                >
                  Skip Without Marking
                </button>
              </div>
            )}

            {reveal && studyDecision !== "none" && (
              <div className="mt-5">
                <p className="mb-3 text-sm font-semibold text-slate-800">
                  {studyDecision === "known" ? "Saved as known." : "Saved as needs practice."}
                </p>
                <button className="w-full rounded-xl bg-slate-800 px-4 py-3 text-sm font-semibold text-white sm:w-auto" onClick={nextStudyWord}>
                  Next Card
                </button>
              </div>
            )}
          </section>
        )}

        {tab === "quiz" && (
          <section className="glass card-shadow rounded-3xl p-5 md:p-8">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-slate-700">Quiz mode:</span>
              <button
                className={`rounded-lg border px-3 py-1 text-sm ${
                  quizMode === "mcq"
                    ? "accent-gradient border-transparent text-white"
                    : "border-slate-300 bg-slate-100 text-slate-800 hover:bg-slate-200"
                }`}
                onClick={() => setQuizMode("mcq")}
              >
                Multiple Choice
              </button>
              <button
                className={`rounded-lg border px-3 py-1 text-sm ${
                  quizMode === "typing"
                    ? "accent-gradient border-transparent text-white"
                    : "border-slate-300 bg-slate-100 text-slate-800 hover:bg-slate-200"
                }`}
                onClick={() => setQuizMode("typing")}
              >
                Type Finnish
              </button>
              <span className="ml-auto text-xs text-slate-700">
                Score: {quizCorrect} correct / {quizWrong} wrong
              </span>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-6">
              {quizMode === "mcq" && (
                <>
                  <p className="text-sm text-slate-600">Pick the English meaning:</p>
                  <h2 className="mt-2 text-3xl font-bold text-ink">{quizWord.fi}</h2>
                  <div className="mt-5 grid gap-2 sm:grid-cols-2">
                    {quizOptions.map((option) => (
                      <button
                        key={`${quizWord.id}-${option}`}
                        className="rounded-xl border border-slate-300 px-3 py-3 text-left text-sm font-semibold text-slate-800 hover:bg-slate-50"
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
                  <p className="text-sm text-slate-600">Type the Finnish word:</p>
                  <h2 className="mt-2 text-2xl font-bold text-ink">{quizWord.en}</h2>
                  <input
                    className="mt-4 w-full rounded-xl border border-slate-300 px-3 py-2 text-base text-slate-900 focus:border-accent focus:outline-none"
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

              {quizFeedback && <p className="mt-4 text-sm font-semibold text-slate-800">{quizFeedback}</p>}
            </div>

            <button
              className="mt-4 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
              onClick={nextQuiz}
            >
              Next Question
            </button>
          </section>
        )}

        {tab === "list" && (
          <section className="glass card-shadow rounded-3xl p-5 md:p-8">
            <div className="grid gap-3 md:grid-cols-4">
              <input
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-accent focus:outline-none md:col-span-2"
                placeholder="Search Finnish, English, or explanation"
                value={searchValue}
                onChange={(event) => setSearchValue(event.target.value)}
              />
              <select
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-accent focus:outline-none"
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
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-accent focus:outline-none"
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

            <p className="mt-3 text-xs text-slate-700">Showing {filteredWords.length} of 500 words</p>

            <div className="mt-4 max-h-[60vh] overflow-auto rounded-2xl border border-slate-300 bg-white">
              <table className="w-full min-w-[700px] text-left text-sm">
                <thead className="sticky top-0 bg-slate-100 text-xs uppercase tracking-wide text-slate-700">
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
                    <tr key={word.id} className="border-t border-slate-200">
                      <td className="px-3 py-2 font-semibold text-ink">{word.fi}</td>
                      <td className="px-3 py-2 text-slate-800">{word.en}</td>
                      <td className="px-3 py-2 text-slate-700">{word.fiSimple}</td>
                      <td className="px-3 py-2 text-xs uppercase tracking-wide text-slate-600">{word.topic}</td>
                      <td className="px-3 py-2 text-slate-800">{progressMap[word.id]?.known ? "yes" : "no"}</td>
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
              <article className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-xs uppercase tracking-wide text-slate-600">Known Words</p>
                <p className="mt-2 text-3xl font-bold text-ink">{knownCount}</p>
              </article>
              <article className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-xs uppercase tracking-wide text-slate-600">Accuracy</p>
                <p className="mt-2 text-3xl font-bold text-ink">{accuracy}%</p>
              </article>
              <article className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-xs uppercase tracking-wide text-slate-600">Reviewed Today</p>
                <p className="mt-2 text-3xl font-bold text-ink">{reviewedToday}</p>
              </article>
            </div>

            <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-semibold text-ink">Daily goal progress</p>
                <span className="text-xs text-slate-700">
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
                  className="w-24 rounded-lg border border-slate-300 px-2 py-1 text-sm text-slate-900"
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






