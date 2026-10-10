
export type OptionKey = "A" | "B" | "C" | "D";

export type AnswerRecord = {
  id: number;
  participant_id: number;
  selected_option: OptionKey;
  submitted_at: string;
};

export type ParticipantResult = {
  participantId: number;
  selectedOption: OptionKey | null;
  score: number | null;
  rank: number | null;
  isWinner: boolean;
  submittedAt: string | null;
  responseTimeMs: number | null;
  outcome: "CORRECT" | "INCORRECT" | "NOT_SUBMITTED";
};

export function evaluateContest(
  answers: AnswerRecord[],
  correctOption: OptionKey,
  startsAt: string
): {
  winnerId: number | null;
  participants: ParticipantResult[];
} {
  const startTime = new Date(startsAt).getTime();

  const correctAnswers = answers
    .filter((answer) => answer.selected_option === correctOption)
    .sort((a, b) => {
      const timeDifference =
        new Date(a.submitted_at).getTime() -
        new Date(b.submitted_at).getTime();

      return timeDifference || a.id - b.id;
    });

  const winnerId = correctAnswers[0]?.participant_id ?? null;

  const correctRanks = new Map<number, number>();

  correctAnswers.forEach((answer, index) => {
    correctRanks.set(answer.participant_id, index + 1);
  });

  const answersByParticipant = new Map(
    answers.map((answer) => [answer.participant_id, answer])
  );

  const participants: ParticipantResult[] = Array.from(
    { length: 10 },
    (_, index) => {
      const participantId = index + 1;
      const answer = answersByParticipant.get(participantId);

      if (!answer) {
        return {
          participantId,
          selectedOption: null,
          score: null,
          rank: null,
          isWinner: false,
          submittedAt: null,
          responseTimeMs: null,
          outcome: "NOT_SUBMITTED" as const,
        };
      }

      const isCorrect =
        answer.selected_option === correctOption;

      const responseTimeMs = Math.max(
        0,
        new Date(answer.submitted_at).getTime() - startTime
      );

      return {
        participantId,
        selectedOption: answer.selected_option,
        score: isCorrect ? 100 : 0,
        rank: isCorrect
          ? correctRanks.get(participantId) ?? null
          : null,
        isWinner: participantId === winnerId,
        submittedAt: answer.submitted_at,
        responseTimeMs,
        outcome: isCorrect
          ? ("CORRECT" as const)
          : ("INCORRECT" as const),
      };
    }
  );

  return {
    winnerId,
    participants,
  };
}
