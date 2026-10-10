"use client";

import {

  useCallback,

  useEffect,

  useRef,

  useState,

  type FormEvent,

  type ReactNode,

} from "react";

import { live } from "@/locales/live";

import type { OptionKey, ParticipantResult } from "@/lib/rules";

type Panel = "none" | "create" | "join" | "contest" | "results";

type Mode = "host" | "viewer";

type Contest = {

  id: string;

  question: string;

  options: Record<OptionKey, string>;

  startsAt: string;

  endsAt: string;

  durationSeconds: number;

};

type CreatedContest = {

  contestId: string;

  startsAt: string;

  endsAt: string;

};

type FinishedResults = {

  status: "FINISHED";

  contest: Contest & { correctOption: OptionKey };

  winnerId: number | null;

  participants: ParticipantResult[];

};

const optionKeys: OptionKey[] = ["A", "B", "C", "D"];

const VIEW_MODE_STORAGE_KEY = "liveQuizViewMode";

const uuidPattern =

  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function Widget({

  title,

  onClose,

  children,

}: {

  title: string;

  onClose: () => void;

  children: ReactNode;

}) {

  useEffect(() => {

    const onEscape = (event: KeyboardEvent) => {

      if (event.key === "Escape") onClose();

    };

    window.addEventListener("keydown", onEscape);

    return () => window.removeEventListener("keydown", onEscape);

  }, [onClose]);

  return (

    <div className="pointer-events-none absolute inset-x-3 bottom-24 top-16 z-30 flex items-center justify-center sm:inset-x-6 sm:top-20">

      <section

        role="dialog"

        aria-label={title}

        className="pointer-events-auto flex max-h-full min-h-0 w-full max-w-[480px] flex-col overflow-hidden rounded-2xl bg-white text-slate-900 shadow-[0_24px_70px_rgba(0,0,0,.5)]"

      >

        <header className="flex shrink-0 items-center justify-between border-b border-slate-200 px-4 py-3">

          <h2 className="truncate font-bold">{title}</h2>

          <button

            type="button"

            aria-label={live.nav.close}

            onClick={onClose}

            className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-slate-100 text-xl hover:bg-slate-200"

          >

            ×

          </button>

        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">

          {children}

        </div>

      </section>

    </div>

  );

}

function CreateContestForm({

  onCreated,

}: {

  onCreated: (value: CreatedContest) => void;

}) {

  const [question, setQuestion] = useState("");

  const [options, setOptions] = useState<Record<OptionKey, string>>({

    A: "",

    B: "",

    C: "",

    D: "",

  });

  const [correctAnswer, setCorrectAnswer] = useState<OptionKey>("A");

  const [duration, setDuration] = useState(60);

  const [creating, setCreating] = useState(false);

  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {

    event.preventDefault();

    if (creating) return;

    setError("");

    if (!question.trim() || optionKeys.some((key) => !options[key].trim())) {

      setError(live.errors.required);

      return;

    }

    if (question.length > 500 || optionKeys.some((key) => options[key].length > 200)) {

      setError(live.errors.tooLong);

      return;

    }

    const normalized = optionKeys.map((key) =>

      options[key].trim().toLocaleLowerCase("tr-TR")

    );

    if (new Set(normalized).size !== 4) {

      setError(live.errors.duplicate);

      return;

    }

    setCreating(true);

    try {

      const response = await fetch("/api/contests", {

        method: "POST",

        headers: { "Content-Type": "application/json" },

        body: JSON.stringify({

          question: question.trim(),

          options,

          correctAnswer,

          durationSeconds: duration,

        }),

      });

      if (response.status === 409) {

        setError(live.errors.activeContest);

        return;

      }

      if (!response.ok) throw new Error("CREATE_FAILED");

      const data: CreatedContest = await response.json();

      if (!data.contestId) throw new Error("INVALID_RESPONSE");

      onCreated(data);

    } catch {

      setError(live.errors.create);

    } finally {

      setCreating(false);

    }

  }

  return (

    <form onSubmit={submit} className="space-y-4">

      <div>

        <label htmlFor="quiz-question" className="mb-2 block text-sm font-semibold">

          {live.form.question}

        </label>

        <textarea

          id="quiz-question"

          required

          rows={2}

          maxLength={500}

          value={question}

          onChange={(event) => setQuestion(event.target.value)}

          placeholder={live.form.questionPlaceholder}

          className="w-full rounded-xl border border-slate-300 p-3 text-sm outline-none focus:border-indigo-500"

        />

      </div>

      <fieldset>

        <legend className="mb-2 text-sm font-semibold">{live.form.options}</legend>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">

          {optionKeys.map((key) => (

            <div key={key} className="flex min-w-0 items-center gap-2">

              <span className="grid h-10 w-9 shrink-0 place-items-center rounded-lg bg-indigo-50 font-bold text-indigo-700">

                {key}

              </span>

              <input

                required

                value={options[key]}

                maxLength={200}

                onChange={(event) =>

                  setOptions((previous) => ({ ...previous, [key]: event.target.value }))

                }

                aria-label={`${live.form.optionPlaceholder} ${key}`}

                placeholder={`${live.form.optionPlaceholder} ${key}`}

                className="min-w-0 flex-1 rounded-lg border border-slate-300 p-2.5 text-sm outline-none focus:border-indigo-500"

              />

            </div>

          ))}

        </div>

      </fieldset>

      <div className="grid grid-cols-2 gap-3">

        <div className="min-w-0">

          <label htmlFor="quiz-correct" className="mb-2 block text-xs font-semibold">

            {live.form.correct}

          </label>

          <select

            id="quiz-correct"

            value={correctAnswer}

            onChange={(event) => setCorrectAnswer(event.target.value as OptionKey)}

            className="w-full rounded-lg border border-slate-300 bg-white p-3 text-sm"

          >

            {optionKeys.map((key) => <option key={key} value={key}>{key}</option>)}

          </select>

        </div>

        <div className="min-w-0">

          <label htmlFor="quiz-duration" className="mb-2 block text-xs font-semibold">

            {live.form.duration}

          </label>

          <select

            id="quiz-duration"

            value={duration}

            onChange={(event) => setDuration(Number(event.target.value))}

            className="w-full rounded-lg border border-slate-300 bg-white p-3 text-sm"

          >

            {[30, 60, 120].map((seconds) => (

              <option key={seconds} value={seconds}>

                {seconds} {live.form.seconds}

              </option>

            ))}

          </select>

        </div>

      </div>

      <div className="rounded-xl bg-slate-50 p-3">

        <h3 className="mb-2 text-xs font-bold">{live.contest.rulesTitle}</h3>

        <ul className="list-disc space-y-1 pl-4 text-xs leading-5 text-slate-600">

          {live.rules.map((rule) => <li key={rule}>{rule}</li>)}

        </ul>

      </div>

      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}

      <button

        type="submit"

        disabled={creating}

        className="w-full rounded-xl bg-indigo-600 p-3 font-bold text-white hover:bg-indigo-700 disabled:opacity-50"

      >

        {creating ? live.form.creating : live.form.start}

      </button>

    </form>

  );

}

function AnswerWidget({

  contest,

  now,

  serverOffset,

}: {

  contest: Contest;

  now: number;

  serverOffset: number;

}) {

  const [participantId, setParticipantId] = useState(1);

  const [selectedOption, setSelectedOption] = useState<OptionKey | null>(null);

  const [status, setStatus] = useState<"checking" | "ready" | "submitted" | "error">("checking");

  const [checkedKey, setCheckedKey] = useState("");

  const [submitting, setSubmitting] = useState(false);

  const [message, setMessage] = useState("");

  const participantKey = `${contest.id}:${participantId}`;

  useEffect(() => {

    let cancelled = false;

    async function check() {

      setStatus("checking");

      setCheckedKey("");

      setSelectedOption(null);

      setMessage("");

      try {

        const response = await fetch(

          `/api/contests/${contest.id}/answers?participantId=${participantId}`,

          { cache: "no-store" }

        );

        if (!response.ok) throw new Error("CHECK_FAILED");

        const data = await response.json();

        if (cancelled) return;

        setStatus(data.alreadySubmitted ? "submitted" : "ready");

        setSelectedOption(data.selectedOption ?? null);

        setCheckedKey(participantKey);

      } catch {

        if (!cancelled) setStatus("error");

      }

    }

    void check();

    return () => { cancelled = true; };

  }, [contest.id, participantId, participantKey]);

  const remaining = Math.max(

    0,

    Math.ceil((new Date(contest.endsAt).getTime() - (now + serverOffset)) / 1000)

  );

  const canSubmit =

    remaining > 0 && status === "ready" && checkedKey === participantKey &&

    selectedOption !== null && !submitting;

  async function submit() {

    if (!canSubmit || !selectedOption) return;

    setSubmitting(true);

    setMessage("");

    try {

      const response = await fetch(`/api/contests/${contest.id}/answers`, {

        method: "POST",

        headers: { "Content-Type": "application/json" },

        body: JSON.stringify({ participantId, selectedOption }),

      });

      const data = await response.json();

      if (response.status === 409) {

        setStatus("submitted");

        setMessage(live.contest.already);

      } else if (response.status === 410) {

        setMessage(live.contest.closed);

      } else if (!response.ok) {

        throw new Error("SUBMIT_FAILED");

      } else if (data.code === "ANSWER_ACCEPTED") {

        setStatus("submitted");

        setMessage(live.contest.submitted);

      }

    } catch {

      setMessage(live.errors.request);

    } finally {

      setSubmitting(false);

    }

  }

  return (

    <div className="space-y-4">

      <div className="flex items-center justify-between rounded-xl bg-indigo-50 p-3 text-indigo-700">

        <span className="text-xs">{live.contest.timeLeft}</span>

        <span className="text-xl font-bold tabular-nums">

          {String(Math.floor(remaining / 60)).padStart(2, "0")}:

          {String(remaining % 60).padStart(2, "0")}

        </span>

      </div>

      <div>

        <label htmlFor="participant" className="mb-2 block text-sm font-semibold">

          {live.contest.participant}

        </label>

        <select

          id="participant"

          value={participantId}

          disabled={submitting}

          onChange={(event) => {

            setStatus("checking");

            setCheckedKey("");

            setParticipantId(Number(event.target.value));

          }}

          className="w-full rounded-xl border border-slate-300 bg-white p-3 text-sm"

        >

          {Array.from({ length: 10 }, (_, index) => (

            <option key={index} value={index + 1}>

              {live.contest.participant} {index + 1}

            </option>

          ))}

        </select>

      </div>

      <div className="rounded-xl bg-indigo-50 p-4 font-semibold break-words">

        {contest.question}

      </div>

      <fieldset

        disabled={remaining === 0 || status !== "ready" || checkedKey !== participantKey || submitting}

        className="space-y-2"

      >

        {optionKeys.map((key) => (

          <label

            key={key}

            className={`flex min-w-0 cursor-pointer items-center gap-3 rounded-xl border p-3 ${

              selectedOption === key ? "border-indigo-500 bg-indigo-50" : "border-slate-200"

            }`}

          >

            <input

              type="radio"

              name="contest-answer"

              checked={selectedOption === key}

              onChange={() => setSelectedOption(key)}

              className="h-4 w-4 shrink-0 accent-indigo-600"

            />

            <span className="font-bold text-indigo-700">{key}</span>

            <span className="min-w-0 break-words text-sm">{contest.options[key]}</span>

          </label>

        ))}

      </fieldset>

      <div className="rounded-xl bg-slate-50 p-3">

        <h3 className="mb-2 text-xs font-bold">{live.contest.rulesTitle}</h3>

        <ul className="list-disc space-y-1 pl-4 text-xs leading-5 text-slate-600">

          {live.rules.map((rule) => <li key={rule}>{rule}</li>)}

        </ul>

      </div>

      {status === "checking" && <p className="text-xs">{live.contest.checking}</p>}

      {status === "error" && <p role="alert" className="text-xs text-red-600">{live.errors.request}</p>}

      {status === "submitted" && (

        <p className="rounded-lg bg-green-50 p-3 text-sm text-green-700">

          {message || live.contest.already}

        </p>

      )}

      {message && status !== "submitted" && <p role="alert" className="text-sm text-red-600">{message}</p>}

      <button

        type="button"

        onClick={submit}

        disabled={!canSubmit}

        className="w-full rounded-xl bg-indigo-600 p-3 font-bold text-white disabled:opacity-40"

      >

        {submitting ? live.contest.submitting : live.contest.submit}

      </button>

    </div>

  );

}

function ResultsWidget({ results }: { results: FinishedResults }) {

  const { contest, winnerId } = results;

  const participants = [...results.participants].sort((a, b) => {

    const weight = (item: ParticipantResult) =>

      item.outcome === "CORRECT" ? 0 : item.outcome === "INCORRECT" ? 1 : 2;

    return weight(a) - weight(b) || (a.rank ?? 99) - (b.rank ?? 99) || a.participantId - b.participantId;

  });

  function explanation(person: ParticipantResult) {

    if (person.isWinner) return live.results.reasonWinner;

    if (person.outcome === "CORRECT") return live.results.reasonCorrect;

    if (person.outcome === "INCORRECT") {

      return live.results.reasonWrong.replace("{correct}", contest.correctOption);

    }

    return live.results.reasonAbsent;

  }

  return (

    <div className="space-y-4">

      <div className="rounded-xl bg-indigo-50 p-4">

        <p className="break-words font-bold">{contest.question}</p>

        <p className="mt-3 text-xs text-indigo-700">{live.results.correctAnswer}</p>

        <p className="mt-1 break-words font-bold text-indigo-900">

          {contest.correctOption}) {contest.options[contest.correctOption]}

        </p>

      </div>

      <div className="rounded-xl bg-green-50 p-4">

        {winnerId === null ? (

          <>

            <h3 className="font-bold">{live.results.noWinner}</h3>

            <p className="text-sm">{live.results.noWinnerReason}</p>

          </>

        ) : (

          <>

            <p className="text-sm font-bold text-green-700">🏆 {live.results.winner}</p>

            <h3 className="mt-1 text-xl font-bold text-green-900">

              {live.contest.participant} {winnerId}

            </h3>

            <p className="text-xs text-green-700">{live.results.reasonWinner}</p>

          </>

        )}

      </div>

      <div className="space-y-2">

        {participants.map((person) => (

          <div

            key={person.participantId}

            className={`rounded-xl border p-3 ${person.isWinner ? "border-green-300 bg-green-50" : "border-slate-200"}`}

          >

            <div className="flex justify-between gap-2 text-sm font-bold">

              <span>{live.contest.participant} {person.participantId}</span>

              <span>{person.rank === null ? "—" : `#${person.rank}`}</span>

            </div>

            <div className="mt-2 flex flex-wrap gap-2 text-xs">

              <span className="rounded bg-slate-100 p-1">

                {live.results.selected}: {person.selectedOption ?? "—"}

              </span>

              <span className="rounded bg-slate-100 p-1">

                {live.results.score}: {person.score ?? "—"}

              </span>

            </div>

            {person.responseTimeMs !== null && (

              <p className="mt-2 text-xs text-slate-500">

                {live.results.time}: {(person.responseTimeMs / 1000).toLocaleString("tr-TR", { maximumFractionDigits: 2 })} sn

              </p>

            )}

            <p className="mt-2 text-xs leading-5 text-slate-600">{explanation(person)}</p>

          </div>

        ))}

      </div>

    </div>

  );

}

function ContestBadge({

  finished,

  remaining,

  onClick,

}: {

  finished: boolean;

  remaining: number;

  onClick: () => void;

}) {

  return (

    <button

      type="button"

      onClick={onClick}

      className="flex items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-100"

    >

      <span className={`h-2 w-2 shrink-0 rounded-full ${finished ? "bg-indigo-500" : "bg-green-500"}`} />

      <span className="truncate">{finished ? live.host.finished : live.host.active}</span>

      {!finished && <span className="tabular-nums">{remaining}s</span>}

    </button>

  );

}

function Chat({

  onClose,

  badge,

}: {

  onClose: () => void;

  badge: ReactNode;

}) {

  return (

    <div className="flex h-full min-h-0 flex-col bg-white text-slate-900">

      <header className="shrink-0 border-b border-slate-200 p-3 sm:p-4">

        <div className="flex items-center justify-between gap-2">

          <h2 className="font-bold">{live.chat.title}</h2>

          <button

            type="button"

            aria-label={live.chat.close}

            onClick={onClose}

            className="grid h-8 w-8 place-items-center rounded-full bg-slate-100 text-xl hover:bg-slate-200"

          >

            ×

          </button>

        </div>

        {badge && <div className="mt-3">{badge}</div>}

      </header>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3 sm:space-y-4 sm:p-4">

        {live.chat.messages.map((message, index) => (

          <div key={index} className="flex items-start gap-3">

            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">

              {message.user.charAt(0)}

            </span>

            <div className="min-w-0">

              <p className="text-xs font-semibold">{message.user}</p>

              <p className="mt-1 break-words text-sm text-slate-600">{message.text}</p>

            </div>

          </div>

        ))}

      </div>

      <div className="shrink-0 border-t border-slate-200 p-2.5 sm:p-3">

        <input

          disabled

          placeholder={live.chat.placeholder}

          className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-400"

        />

      </div>

    </div>

  );

}

export default function HomePage() {

  const [mode, setMode] = useState<Mode>("host");

  const [panel, setPanel] = useState<Panel>("none");

  const [desktopChatOpen, setDesktopChatOpen] = useState(true);

  const [mobileChatOpen, setMobileChatOpen] = useState(false);

  const [activeContestId, setActiveContestId] = useState<string | null>(null);

  const [activeChecked, setActiveChecked] = useState(false);

  const [contestId, setContestId] = useState("");

  const [joinId, setJoinId] = useState("");

  const [contest, setContest] = useState<Contest | null>(null);

  const [results, setResults] = useState<FinishedResults | null>(null);

  const [loading, setLoading] = useState(false);

  const [error, setError] = useState("");

  const [now, setNow] = useState(0);

  const [serverOffset, setServerOffset] = useState(0);

  const pinnedSelection = useRef(false);

  useEffect(() => {

    setNow(Date.now());

    const timer = window.setInterval(() => setNow(Date.now()), 500);

    return () => window.clearInterval(timer);

  }, []);

  useEffect(() => {

    const id = new URLSearchParams(window.location.search).get("contestId");

    // Keep the broadcaster view after refreshing a contest URL in this tab.
    // This only controls the demo UI; it is not authorization.
    let savedMode: Mode | null = null;
    try {
      const stored = window.sessionStorage.getItem(VIEW_MODE_STORAGE_KEY);
      if (stored === "host" || stored === "viewer") savedMode = stored;
    } catch {
      // Browser storage can be disabled; fall back to viewer for shared URLs.
    }

    if (id && uuidPattern.test(id)) {

      pinnedSelection.current = true;

      setContestId(id);

      setJoinId(id);

      setMode(savedMode ?? "viewer");

      setPanel("contest");

    } else if (savedMode) {

      setMode(savedMode);

    }

  }, []);

  // Discover an active contest and follow new contests in the demo stream.

  useEffect(() => {

    let cancelled = false;

    async function checkActive() {

      try {

        const response = await fetch("/api/contests", { cache: "no-store" });

        if (!response.ok) throw new Error("LOOKUP_FAILED");

        const data = await response.json();

        if (cancelled) return;

        const id: string | null = data.activeContestId ?? null;

        setActiveContestId(id);

        setActiveChecked(true);

        if (id && !pinnedSelection.current && id !== contestId) {

          setContestId(id);

          setJoinId(id);

          setPanel("contest");

          setResults(null);

          setContest(null);

        }

      } catch {

        if (!cancelled) setActiveChecked(true);

      }

    }

    void checkActive();

    const timer = window.setInterval(() => { void checkActive(); }, 3000);

    return () => {

      cancelled = true;

      window.clearInterval(timer);

    };

  }, [contestId]);

  useEffect(() => {

    if (!contestId) return;

    let cancelled = false;

    let polling = false;

    let timer: ReturnType<typeof setInterval> | undefined;

    setLoading(true);

    setError("");

    setContest(null);

    setResults(null);

    async function checkResults(): Promise<boolean> {

      if (cancelled || polling) return false;

      polling = true;

      try {

        const response = await fetch(

          `/api/contests/${encodeURIComponent(contestId)}/results`,

          { cache: "no-store" }

        );

        if (!response.ok) return false;

        const data = await response.json();

        if (cancelled) return false;

        if (data.status === "FINISHED") {

          setResults(data as FinishedResults);
          // Release this contest locally as soon as the server confirms it ended.
          // Another active contest (different ID) remains protected.
          setActiveContestId((previous) => previous === contestId ? null : previous);
          // This runs once for a finished contest. Closing X stays closed.
          setPanel("results");

          if (timer) clearInterval(timer);

          return true;

        }

        return false;

      } catch {

        return false;

      } finally {

        polling = false;

      }

    }

    async function initialize() {

      try {

        const response = await fetch(

          `/api/contests/${encodeURIComponent(contestId)}`,

          { cache: "no-store" }

        );

        if (!response.ok) throw new Error("NOT_FOUND");

        const data = await response.json();

        if (cancelled) return;

        setContest(data.contest);

        setServerOffset(new Date(data.serverNow).getTime() - Date.now());

        const finished = await checkResults();

        if (!finished && !cancelled) {

          timer = setInterval(() => { void checkResults(); }, 2000);

        }

      } catch {

        if (!cancelled) setError(live.join.notFound);

      } finally {

        if (!cancelled) setLoading(false);

      }

    }

    void initialize();

    return () => {

      cancelled = true;

      if (timer) clearInterval(timer);

    };

  }, [contestId]);

  const closeWidget = useCallback(() => setPanel("none"), []);

  const currentContest = contest?.id === contestId ? contest : null;

  const currentResults = results?.contest.id === contestId ? results : null;

  const remaining = currentContest

    ? Math.max(0, Math.ceil((new Date(currentContest.endsAt).getTime() - (now + serverOffset)) / 1000))

    : 0;

  const finished = currentResults !== null;

  // A stale active-contest ID must not keep the create button disabled
  // after the currently displayed contest has ended.
  const creationBlocked = activeContestId !== null && !(
    activeContestId === contestId &&
    currentContest !== null &&
    (remaining === 0 || finished)
  );

  function selectContest(id: string, nextMode: Mode, pin = false) {

    const value = id.trim();

    if (!uuidPattern.test(value)) {

      setError(live.join.invalid);

      return;

    }

    pinnedSelection.current = pin;

    try {
      window.sessionStorage.setItem(VIEW_MODE_STORAGE_KEY, nextMode);
    } catch {
      // Storage is optional for demo view state.
    }

    setMode(nextMode);

    setContestId(value);

    setJoinId(value);

    setError("");

    setPanel("contest");

    setMobileChatOpen(false);

    setContest(null);

    setResults(null);

    window.history.replaceState(null, "", `/?contestId=${encodeURIComponent(value)}`);

  }

  function openContest() {

    setMobileChatOpen(false);

    const target: Panel = !contestId ? "join" : finished ? "results" : "contest";

    setPanel((previous) => previous === target ? "none" : target);

  }

  function openCreate() {

    if (!activeChecked || creationBlocked) return;

    setPanel("create");

    setMobileChatOpen(false);

  }

  function handleJoin(event: FormEvent<HTMLFormElement>) {

    event.preventDefault();

    selectContest(joinId, "viewer", true);

  }

  const badge = contestId ? (

    <ContestBadge finished={finished} remaining={remaining} onClick={openContest} />

  ) : null;

  function panelBody() {

    if (panel === "create") {

      return (

        <CreateContestForm

          onCreated={(data) => {

            setActiveContestId(data.contestId);

            selectContest(data.contestId, "host");

          }}

        />

      );

    }

    if (panel === "join") {

      return (

        <form onSubmit={handleJoin} className="space-y-4">

          <p className="text-sm text-slate-500">{live.join.description}</p>

          <input

            value={joinId}

            onChange={(event) => setJoinId(event.target.value)}

            placeholder={live.join.placeholder}

            aria-label={live.join.placeholder}

            className="w-full rounded-xl border border-slate-300 p-3 text-sm"

          />

          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}

          <button type="submit" className="w-full rounded-xl bg-indigo-600 p-3 font-bold text-white">

            {live.join.button}

          </button>

        </form>

      );

    }

    if (loading && !currentContest) return <p>{live.join.loading}</p>;

    if (!currentContest) return <p role="alert" className="text-red-600">{error || live.join.description}</p>;

    if (currentResults) return <ResultsWidget results={currentResults} />;

    if (panel === "results" || remaining === 0) {

      return (

        <div className="py-8 text-center">

          <p className="text-xl">⏳</p>

          <p className="mt-3 font-bold">{live.contest.waiting}</p>

          <p className="mt-2 text-sm text-slate-500">{live.contest.timeLeft}: {remaining}s</p>

        </div>

      );

    }

    return <AnswerWidget key={currentContest.id} contest={currentContest} now={now} serverOffset={serverOffset} />;

  }

  const panelTitle = panel === "create" ? live.form.title

    : panel === "join" ? live.join.title

    : finished || panel === "results" ? live.results.title

    : live.contest.title;

  return (

    <main className="h-dvh w-full overflow-hidden bg-[#f3f4f6] text-slate-900 lg:px-6 lg:py-10 xl:py-12">

      <div className={`mx-auto grid h-full max-w-[1500px] min-w-0 grid-cols-1 gap-4 ${

        desktopChatOpen ? "lg:grid-cols-[minmax(0,1fr)_330px]" : "lg:grid-cols-1"

      }`}>

        {/* The entire mobile viewport is the video stage. */}

        <section className="relative h-full min-w-0 overflow-hidden bg-[#111827] lg:rounded-2xl">

          <div className="absolute inset-0 bg-gradient-to-br from-[#273658] via-[#131c32] to-[#070b14]" />

          <header className="absolute inset-x-0 top-0 z-20 flex items-center justify-between gap-2 bg-gradient-to-b from-black/80 to-transparent p-3 sm:p-5">

            <div className="flex min-w-0 items-center gap-2 text-white">

              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-indigo-600 text-sm font-bold">LQ</span>

              <div className="min-w-0">

                <p className="truncate text-sm font-bold">{live.brand}</p>

                <p className="hidden truncate text-xs text-slate-300 sm:block">{live.stream.topic}</p>

              </div>

            </div>

            <div className="flex shrink-0 items-center gap-2">

              <button

                type="button"

                onClick={() => {
                  const nextMode: Mode = mode === "host" ? "viewer" : "host";
                  setMode(nextMode);
                  try {
                    window.sessionStorage.setItem(VIEW_MODE_STORAGE_KEY, nextMode);
                  } catch {
                    // Keep working without browser storage.
                  }
                  setPanel("none");
                }}

                className="rounded-lg border border-white/20 bg-black/40 px-2 py-2 text-[11px] text-white sm:px-3"

              >

                {mode === "host" ? live.host.viewerMode : live.host.hostMode}

              </button>

              <button

                type="button"

                onClick={() => setMobileChatOpen(true)}

                className="rounded-lg border border-white/20 bg-black/40 px-3 py-2 text-xs text-white lg:hidden"

              >

                {live.chat.title}

              </button>

              {!desktopChatOpen && (

                <div className="hidden items-center gap-2 lg:flex">

                  {badge}

                  <button

                    type="button"

                    onClick={() => setDesktopChatOpen(true)}

                    className="rounded-lg bg-white px-4 py-2 text-xs font-bold text-slate-900"

                  >

                    {live.chat.open}

                  </button>

                </div>

              )}

            </div>

          </header>

          {/* Mock video only. No real livestream is connected. */}

          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-5 text-center text-white">

            <div className="mb-5 grid h-20 w-20 place-items-center rounded-full border border-white/20 bg-white/10 text-3xl">▶</div>

            <h1 className="text-xl font-bold sm:text-3xl">{live.stream.title}</h1>

            <p className="mt-3 max-w-sm text-sm text-slate-300">{live.stream.description}</p>

            <span className="mt-5 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs">{live.stream.badge}</span>

          </div>

          {/* Controls stay at the bottom on both screen sizes. */}

          <nav className="absolute inset-x-0 bottom-0 z-20 flex items-center justify-center gap-2 bg-gradient-to-t from-black/95 via-black/60 to-transparent px-2 pb-[max(16px,env(safe-area-inset-bottom))] pt-10 sm:gap-3 sm:px-5">

            {mode === "host" && (

              <button

                type="button"

                onClick={openCreate}

                disabled={!activeChecked || creationBlocked}

                className="min-w-0 flex-1 rounded-xl bg-indigo-600 px-2 py-3 text-[11px] font-bold text-white disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none sm:px-5 sm:text-sm"

              >

                {creationBlocked ? "Yarışma Devam Ediyor" : `+ ${live.host.create}`}

              </button>

            )}

            {creationBlocked && (
              <button
                type="button"
                onClick={openContest}
                className="min-w-0 flex-1 rounded-xl border border-white/20 bg-white/15 px-2 py-3 text-[11px] font-semibold text-white sm:flex-none sm:px-5 sm:text-sm"
              >
                {live.nav.join}
              </button>
            )}

            {finished && (
              <button
                type="button"
                onClick={() => setPanel((previous) => previous === "results" ? "none" : "results")}
                className="min-w-0 flex-1 rounded-xl border border-white/20 bg-white/15 px-2 py-3 text-[11px] font-semibold text-white sm:flex-none sm:px-5 sm:text-sm"
              >
                {live.nav.results}
              </button>
            )}

          </nav>

          {panel !== "none" && (

            <Widget title={panelTitle} onClose={closeWidget}>

              {panelBody()}

            </Widget>

          )}

          {/* Mobile chat drawer; desktop chat has a dedicated column. */}

          {mobileChatOpen && (

            <div className="absolute inset-0 z-50 lg:hidden">

              <button

                type="button"

                onClick={() => setMobileChatOpen(false)}

                aria-label={live.chat.close}

                className="absolute inset-0 bg-black/25"

              />

              <aside className="absolute right-3 top-[70px] h-[min(65dvh,460px)] max-h-[calc(100dvh-160px)] w-[min(85vw,330px)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_16px_60px_rgba(0,0,0,0.28)]">

                <Chat

                  onClose={() => setMobileChatOpen(false)}

                  badge={contestId ? (

                    <ContestBadge finished={finished} remaining={remaining} onClick={() => { setMobileChatOpen(false); openContest(); }} />

                  ) : null}

                />

              </aside>

            </div>

          )}

        </section>

        {desktopChatOpen && (

          <aside className="hidden min-h-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm lg:block">

            <Chat onClose={() => setDesktopChatOpen(false)} badge={badge} />

          </aside>

        )}

      </div>

    </main>

  );

}
