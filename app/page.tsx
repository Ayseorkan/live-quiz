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
  wide = false,
  fixedActions = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
  fixedActions?: boolean;
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
        className={`pointer-events-auto flex max-h-full min-h-0 w-full flex-col overflow-hidden rounded-2xl bg-white text-slate-900 shadow-[0_24px_70px_rgba(0,0,0,.5)] ${fixedActions ? "h-full" : ""} ${wide ? "max-w-[800px]" : "max-w-[480px]"}`}
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
        <div className={fixedActions ? "min-h-0 flex-1 overflow-hidden" : "min-h-0 flex-1 overflow-y-auto overscroll-contain p-4"}>
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
    <form onSubmit={submit} className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-4">
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
            className="w-full rounded-xl border border-slate-300 p-3 text-sm outline-none focus:border-blue-500"
          />
        </div>
        <fieldset>
          <legend className="mb-2 text-sm font-semibold">{live.form.options}</legend>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {optionKeys.map((key) => (
              <div key={key} className="flex min-w-0 items-center gap-2">
                <span className="grid h-10 w-9 shrink-0 place-items-center rounded-lg bg-blue-50 font-bold text-blue-600">
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
                  className="min-w-0 flex-1 rounded-lg border border-slate-300 p-2.5 text-sm outline-none focus:border-blue-500"
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
      </div>
      <div className="shrink-0 border-t border-slate-200 bg-white p-4 shadow-[0_-10px_24px_rgba(15,23,42,.08)]">
        {error && <p role="alert" className="mb-2 text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={creating}
          className="w-full rounded-xl bg-blue-600 p-3 font-bold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {creating ? live.form.creating : live.form.start}
        </button>
      </div>
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
  const progress = Math.min(100, Math.max(0, (remaining / contest.durationSeconds) * 100));
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
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain p-4">
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0 flex-1">
            <label htmlFor="participant" className="mb-1 block text-xs font-semibold">
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
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm"
            >
              {Array.from({ length: 10 }, (_, index) => (
                <option key={index} value={index + 1}>
                  {live.contest.participant} {index + 1}
                </option>
              ))}
            </select>
          </div>
          <div className="shrink-0 text-right text-green-700">
            <p className="text-[10px] font-semibold uppercase tracking-wide">
              {live.contest.timeLeft}
            </p>
            <p className="text-xl font-bold tabular-nums">
              {String(Math.floor(remaining / 60)).padStart(2, "0")}:
              {String(remaining % 60).padStart(2, "0")}
            </p>
          </div>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-slate-200" aria-hidden="true">
          <div
            className="h-full rounded-full bg-green-600 transition-[width] duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex min-h-[126px] items-center justify-center rounded-xl bg-blue-50 p-5 text-center font-semibold break-words">
          {contest.question}
        </div>
        <fieldset
          disabled={remaining === 0 || status !== "ready" || checkedKey !== participantKey || submitting}
          className="space-y-2"
        >
          {optionKeys.map((key) => (
            <label
              key={key}
              className={`flex min-w-0 cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 transition ${
                selectedOption === key ? "border-blue-500 bg-blue-50" : "border-slate-200 bg-white"
              }`}
            >
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-slate-100 text-xs font-bold text-blue-600">
                {key}
              </span>
              <span className="min-w-0 flex-1 break-words text-sm font-medium">
                {contest.options[key]}
              </span>
              <input
                type="radio"
                name="contest-answer"
                checked={selectedOption === key}
                onChange={() => setSelectedOption(key)}
                className="h-4 w-4 shrink-0 accent-green-600"
              />
            </label>
          ))}
        </fieldset>
        <details className="rounded-xl bg-slate-50 p-3">
          <summary className="cursor-pointer text-xs font-bold">
            {live.contest.rulesTitle}
          </summary>
          <ul className="mt-2 list-disc space-y-1 pl-4 text-xs leading-5 text-slate-600">
            {live.rules.map((rule) => <li key={rule}>{rule}</li>)}
          </ul>
        </details>
      </div>
      <div className="shrink-0 border-t border-slate-200 bg-white p-4 shadow-[0_-10px_24px_rgba(15,23,42,.08)]">
        {status === "checking" && <p className="mb-2 text-xs">{live.contest.checking}</p>}
        {status === "error" && <p role="alert" className="mb-2 text-xs text-red-600">{live.errors.request}</p>}
        {status === "submitted" && (
          <p className="mb-2 rounded-lg bg-green-50 p-2 text-sm text-green-700">
            {message || live.contest.already}
          </p>
        )}
        {message && status !== "submitted" && <p role="alert" className="mb-2 text-sm text-red-600">{message}</p>}
        <button
          type="button"
          onClick={submit}
          disabled={!canSubmit}
          className="w-full rounded-xl bg-blue-500 p-3 font-bold text-white disabled:opacity-40"
        >
          {submitting ? live.contest.submitting : live.contest.submit}
        </button>
      </div>
    </div>
  );
}

function ResultsWidget({ results }: { results: FinishedResults }) {
  const { contest, winnerId } = results;
  const participants = [...results.participants].sort((a, b) => {
    const priority = (item: ParticipantResult) =>
      item.outcome === "CORRECT" ? 0 : item.outcome === "INCORRECT" ? 1 : 2;
    return (
      priority(a) - priority(b) ||
      (a.rank ?? 99) - (b.rank ?? 99) ||
      a.participantId - b.participantId
    );
  });
  // The podium is only for participants with a correct answer.
  // Wrong answers and non-participants remain visible in the table below.
  const topThree = participants
    .filter((person) => person.outcome === "CORRECT")
    .slice(0, 3);
  const podium = [
    { place: 2, person: topThree[1], surface: "bg-[#d9dee5]", text: "text-[#536171]", height: "h-[78px] sm:h-[106px]", circle: "border-[#d2d8e1] bg-[#edf0f4]" },
    { place: 1, person: topThree[0], surface: "bg-[#f0dfb6]", text: "text-[#88662c]", height: "h-[108px] sm:h-[143px]", circle: "border-[#ead5a1] bg-[#fbf3df]" },
    { place: 3, person: topThree[2], surface: "bg-[#ead2c4]", text: "text-[#a06e53]", height: "h-[62px] sm:h-[91px]", circle: "border-[#e4c8b8] bg-[#faf0ea]" },
  ];
  function responseTime(person: ParticipantResult): string {
    if (person.responseTimeMs === null) return "—";
    return `${(person.responseTimeMs / 1000).toLocaleString("tr-TR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} sn`;
  }
  function statusLabel(person: ParticipantResult) {
    if (person.outcome === "CORRECT") return "Doğru";
    if (person.outcome === "INCORRECT") return "Yanlış";
    return "Katılmadı";
  }
  function explanation(person: ParticipantResult) {
    if (person.isWinner) return live.results.reasonWinner;
    if (person.outcome === "CORRECT") return live.results.reasonCorrect;
    if (person.outcome === "INCORRECT") {
      return live.results.reasonWrong.replace("{correct}", contest.correctOption);
    }
    return live.results.reasonAbsent;
  }
  return (
    <div className="space-y-4 pb-1">
      {/* Question and its verified answer. */}
      <section className="rounded-2xl border border-slate-200 bg-[#fafbfc] p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
            Yarışma tamamlandı
          </p>
          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
            Sonuçlar kesinleşti
          </span>
        </div>
        <h3 className="mt-3 break-words text-sm font-bold leading-6 text-slate-900 sm:text-base">
          {contest.question}
        </h3>
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-200 pt-3">
          <span className="text-xs font-medium text-slate-500">{live.results.correctAnswer}</span>
          <span className="max-w-full break-words rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800">
            {contest.correctOption}) {contest.options[contest.correctOption]}
          </span>
        </div>
      </section>
      {/* 2nd / 1st / 3rd, like the shared leaderboard reference. */}
      {topThree.length > 0 ? (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-[#f5f6f8] px-3 pb-4 pt-5 sm:px-6 sm:pb-6">
          <p className="text-center text-[11px] font-bold uppercase tracking-[0.19em] text-slate-500">
            Liderlik Kürsüsü
          </p>
          <div className="mt-5 grid grid-cols-3 items-end gap-2 sm:gap-4">
            {podium.map(({ place, person, surface, text, height, circle }) => (
              <div key={place} className="flex min-w-0 flex-col items-center text-center">
                <div className={`grid h-10 w-10 place-items-center rounded-full border-2 text-[11px] font-bold sm:h-12 sm:w-12 sm:text-sm ${circle} ${text}`}>
                  {person ? `K${person.participantId}` : "—"}
                </div>
                <p className="mt-2 w-full truncate text-[11px] font-bold text-slate-800 sm:text-sm">
                  {person ? `${live.contest.participant} ${person.participantId}` : "—"}
                </p>
                <p className="mb-2 mt-0.5 text-[10px] tabular-nums text-slate-500 sm:text-xs">
                  {person ? responseTime(person) : "Doğru yanıt yok"}
                </p>
                <div className={`flex w-full flex-col items-center justify-center rounded-t-[20px] ${surface} ${height}`}>
                  <span className={`text-3xl font-black leading-none sm:text-5xl ${text}`}>
                    {person ? place : "—"}
                  </span>
                  <span className={`mt-1 text-[10px] font-semibold ${text}`}>
                    {person ? "SIRA" : "BOŞ"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : (
        <section className="rounded-2xl border border-slate-200 bg-[#f5f6f8] p-5 text-center">
          <p className="text-base font-semibold text-slate-800">{live.results.noWinner}</p>
          <p className="mt-1 text-xs text-slate-500">{live.results.noWinnerReason}</p>
        </section>
      )}
      {winnerId !== null && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-100 bg-[#fffaf0] p-3.5">
          <span className="mt-0.5 text-lg" aria-hidden="true">🏆</span>
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-900">
              {live.results.winner}: {live.contest.participant} {winnerId}
            </p>
            <p className="mt-1 text-xs leading-5 text-slate-600">
              {live.results.reasonWinner}
            </p>
          </div>
        </div>
      )}
      {/* Responsive standings: one-question scoring, not invented accuracy rates. */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between gap-2 px-4 py-3 sm:px-5">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Genel Sıralama</h3>
            <p className="mt-0.5 text-[11px] text-slate-500">Tüm 10 temsili katılımcı</p>
          </div>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
            {participants.length} kişi
          </span>
        </div>
        <div className="w-full overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-y border-slate-200 bg-[#f8f9fb] text-[10px] uppercase tracking-[0.06em] text-slate-500">
                <th scope="col" className="whitespace-nowrap px-3 py-3 font-semibold sm:px-4">Sıra</th>
                <th scope="col" className="px-2 py-3 font-semibold sm:px-4">Katılımcı</th>
                <th scope="col" className="whitespace-nowrap px-2 py-3 font-semibold sm:px-4">Şık</th>
                <th scope="col" className="hidden whitespace-nowrap px-3 py-3 font-semibold sm:table-cell">Puan</th>
                <th scope="col" className="hidden whitespace-nowrap px-3 py-3 font-semibold sm:table-cell">Yanıt süresi</th>
                <th scope="col" className="px-2 py-3 font-semibold sm:px-4">Durum</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {participants.map((person) => (
                <tr key={person.participantId} className={person.isWinner ? "bg-amber-50/50" : "bg-white"}>
                  <td className="px-3 py-3 align-middle sm:px-4">
                    <span className="font-semibold tabular-nums text-slate-700">
                      {person.rank !== null ? `#${person.rank}` : "—"}
                    </span>
                  </td>
                  <td className="px-2 py-3 align-middle sm:px-4">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-[10px] font-bold ${person.isWinner ? "bg-[#f1dfb5] text-[#775620]" : "bg-slate-100 text-slate-600"}`}>
                        K{person.participantId}
                      </span>
                      <div className="min-w-0">
                        <p className="whitespace-nowrap font-semibold text-slate-800">
                          {live.contest.participant} {person.participantId}
                        </p>
                        <p className="mt-0.5 whitespace-nowrap text-[10px] tabular-nums text-slate-500 sm:hidden">
                          {responseTime(person)} · {person.score ?? "—"} puan
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-2 py-3 align-middle font-semibold text-slate-700 sm:px-4">
                    {person.selectedOption ?? "—"}
                  </td>
                  <td className="hidden px-3 py-3 align-middle font-semibold tabular-nums text-slate-700 sm:table-cell">
                    {person.score ?? "—"}
                  </td>
                  <td className="hidden whitespace-nowrap px-3 py-3 align-middle tabular-nums text-slate-600 sm:table-cell">
                    {responseTime(person)}
                  </td>
                  <td className="px-2 py-3 align-middle sm:px-4">
                    <span className={`inline-flex rounded-full px-2 py-1 text-[10px] font-semibold ${
                      person.outcome === "CORRECT"
                        ? "bg-emerald-50 text-emerald-700"
                        : person.outcome === "INCORRECT"
                          ? "bg-rose-50 text-rose-700"
                          : "bg-slate-100 text-slate-500"
                    }`} title={explanation(person)}>
                      {statusLabel(person)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="border-t border-slate-100 bg-[#fafbfc] px-4 py-3 text-[11px] leading-5 text-slate-500 sm:px-5">
          Sıralama: Önce doğru yanıt, ardından gönderim zamanı. Eşit zamanda kayıt sırası belirleyicidir.
          Yanlış ve gönderilmeyen cevaplar ayrıca gösterilir.
        </p>
      </section>
    </div>
  );
}

function ContestBadge({
  finished,
  remaining,
  mode,
  onClick,
}: {
  finished: boolean;
  remaining: number;
  mode: Mode;
  onClick: () => void;
}) {
  const hours = Math.floor(remaining / 3600);
  const minutes = Math.floor((remaining % 3600) / 60);
  const seconds = remaining % 60;
  const countdown = [hours, minutes, seconds]
    .map((value) => String(value).padStart(2, "0"))
    .join(":");

  return (
    <div className="flex w-full min-w-0 items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-2 text-slate-900 shadow-sm">
      <span className="grid h-9 w-9 shrink-0 place-items-center text-xl" aria-hidden="true">
        🏆
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-bold">
          {finished ? live.host.finished : live.host.active}
        </p>
        <p className="mt-0.5 truncate text-[10px] font-medium text-slate-500">
          {finished ? "Sonuçlar hazır" : `Sona: ${countdown}`}
        </p>
      </div>
      {(finished || mode === "viewer") && (
        <button
          type="button"
          onClick={onClick}
          className="shrink-0 rounded-lg bg-amber-400 px-3 py-2 text-xs font-bold text-amber-950 transition hover:bg-amber-500"
        >
          {finished ? live.nav.results : live.nav.badgeJoin}
        </button>
      )}
    </div>
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
    const initialTimer = window.setTimeout(() => setNow(Date.now()), 0);
    const intervalTimer = window.setInterval(() => setNow(Date.now()), 500);
    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(intervalTimer);
    };
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => {
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
        const initialMode = savedMode ?? "viewer";
        pinnedSelection.current = true;
        setLoading(true);
        setContestId(id);
        setJoinId(id);
        setMode(initialMode);
        setPanel(initialMode === "host" ? "none" : "contest");
      } else if (savedMode) {
        setMode(savedMode);
      }
    }, 0);
    return () => window.clearTimeout(timer);
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
          setLoading(true);
          setError("");
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
    setLoading(true);
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
    if (mode === "host" && !finished) return;
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
    <ContestBadge finished={finished} remaining={remaining} mode={mode} onClick={openContest} />
  ) : null;
  function panelBody() {
    if (panel === "create") {
      return (
        <CreateContestForm
          onCreated={(data) => {
            setActiveContestId(data.contestId);
            selectContest(data.contestId, "viewer");
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
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-red-800 text-sm font-bold">LQ</span>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold">{live.brand}</p>
                <p className="hidden truncate text-xs text-slate-300 sm:block">{live.stream.topic}</p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                aria-label={mode === "host" ? "İzleyici görünümüne geç" : "Yayıncı görünümüne geç"}
                title={mode === "host" ? "İzleyici görünümüne geç" : "Yayıncı görünümüne geç"}
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
                className="min-w-0 flex-1 rounded-xl bg-blue-700 px-2 py-3 text-[11px] font-bold text-white disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none sm:px-5 sm:text-sm"
              >
                {creationBlocked ? live.nav.ongoing : `+ ${live.host.create}`}
              </button>
            )}
            {mode === "viewer" && creationBlocked && (
              <button
                type="button"
                onClick={openContest}
                className="min-w-0 flex-1 rounded-xl bg-blue-700 px-2 py-3 text-[11px] font-bold text-white sm:flex-none sm:px-5 sm:text-sm"
              >
                {live.nav.ongoing}
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
          {panel !== "none" && !(mode === "host" && panel === "contest" && !finished) && (
            <Widget
              title={panelTitle}
              onClose={closeWidget}
              wide={!!currentResults && panel !== "create" && panel !== "join"}
              fixedActions={panel === "create" || (panel === "contest" && !!currentContest && remaining > 0)}
            >
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
                    <ContestBadge finished={finished} remaining={remaining} mode={mode} onClick={() => { setMobileChatOpen(false); openContest(); }} />
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
