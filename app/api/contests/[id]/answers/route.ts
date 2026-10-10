
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const validOptions = ["A", "B", "C", "D"];

function validParticipant(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= 10
  );
}

export async function GET(
  request: NextRequest,
  { params }: RouteContext
) {
  const { id } = await params;

  const participantId = Number(
    request.nextUrl.searchParams.get("participantId")
  );

  if (!uuidPattern.test(id) || !validParticipant(participantId)) {
    return NextResponse.json(
      { code: "INVALID_REQUEST" },
      { status: 400 }
    );
  }

  const { data, error } = await supabaseAdmin
    .from("answers")
    .select("selected_option, submitted_at")
    .eq("contest_id", id)
    .eq("participant_id", participantId)
    .maybeSingle();

  if (error) {
    console.error("Answer status failed:", error);

    return NextResponse.json(
      { code: "DATABASE_ERROR" },
      { status: 500 }
    );
  }

  return NextResponse.json(
    {
      alreadySubmitted: Boolean(data),
      selectedOption: data?.selected_option ?? null,
      submittedAt: data?.submitted_at ?? null,
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}

export async function POST(
  request: NextRequest,
  { params }: RouteContext
) {
  const { id } = await params;

  if (!uuidPattern.test(id)) {
    return NextResponse.json(
      { code: "INVALID_CONTEST_ID" },
      { status: 400 }
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { code: "INVALID_JSON" },
      { status: 400 }
    );
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json(
      { code: "INVALID_REQUEST" },
      { status: 400 }
    );
  }

  const { participantId, selectedOption } = body as {
    participantId?: unknown;
    selectedOption?: unknown;
  };

  if (
    !validParticipant(participantId) ||
    typeof selectedOption !== "string" ||
    !validOptions.includes(selectedOption)
  ) {
    return NextResponse.json(
      { code: "INVALID_ANSWER" },
      { status: 400 }
    );
  }

  const { data: contest, error: contestError } =
    await supabaseAdmin
      .from("contests")
      .select("starts_at, ends_at")
      .eq("id", id)
      .maybeSingle();

  if (contestError) {
    console.error("Contest validation failed:", contestError);

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

  if (
    currentTime < new Date(contest.starts_at).getTime() ||
    currentTime >= new Date(contest.ends_at).getTime()
  ) {
    return NextResponse.json(
      { code: "CONTEST_CLOSED" },
      { status: 410 }
    );
  }

  const { data, error } = await supabaseAdmin
    .from("answers")
    .insert({
      contest_id: id,
      participant_id: participantId,
      selected_option: selectedOption,
    })
    .select("submitted_at")
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        { code: "ALREADY_SUBMITTED" },
        { status: 409 }
      );
    }

    if (
      error.message.includes("Contest is not accepting answers")
    ) {
      return NextResponse.json(
        { code: "CONTEST_CLOSED" },
        { status: 410 }
      );
    }

    console.error("Answer submission failed:", error);

    return NextResponse.json(
      { code: "DATABASE_ERROR" },
      { status: 500 }
    );
  }

  return NextResponse.json(
    {
      code: "ANSWER_ACCEPTED",
      submittedAt: data.submitted_at,
    },
    { status: 201 }
  );
}
