
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import {
  evaluateContest,
  type AnswerRecord,
  type OptionKey,
} from "@/lib/rules";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  _request: Request,
  { params }: RouteContext
) {
  const { id } = await params;

  if (!uuidPattern.test(id)) {
    return NextResponse.json(
      { code: "INVALID_CONTEST_ID" },
      { status: 400 }
    );
  }

  const { data: contest, error: contestError } =
    await supabaseAdmin
      .from("contests")
      .select(
        "id, question, options, correct_option, starts_at, ends_at"
      )
      .eq("id", id)
      .maybeSingle();

  if (contestError) {
    console.error("Contest results fetch failed:", contestError);

    return NextResponse.json(
      { code: "DATABASE_ERROR" },
      { status: 500 }
    );
  }

  if (!contest) {
    return NextResponse.json(
      { code: "CONTEST_NOT_FOUND" },
      { status: 404 }
    );
  }

  const currentTime = Date.now();
  const endTime = new Date(contest.ends_at).getTime();

  if (currentTime < endTime) {
    return NextResponse.json(
      {
        status: "ACTIVE",
        endsAt: contest.ends_at,
        serverNow: new Date().toISOString(),
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  }

  const { data: answers, error: answersError } =
    await supabaseAdmin
      .from("answers")
      .select(
        "id, participant_id, selected_option, submitted_at"
      )
      .eq("contest_id", id);

  if (answersError) {
    console.error("Answers fetch failed:", answersError);

    return NextResponse.json(
      { code: "DATABASE_ERROR" },
      { status: 500 }
    );
  }

  const evaluation = evaluateContest(
    (answers ?? []) as AnswerRecord[],
    contest.correct_option as OptionKey,
    contest.starts_at
  );

  return NextResponse.json(
    {
      status: "FINISHED",
      contest: {
        id: contest.id,
        question: contest.question,
        options: contest.options,
        correctOption: contest.correct_option,
        startsAt: contest.starts_at,
        endsAt: contest.ends_at,
      },
      winnerId: evaluation.winnerId,
      participants: evaluation.participants,
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}
