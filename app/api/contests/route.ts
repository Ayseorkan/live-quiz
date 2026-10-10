
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

const optionKeys = ["A", "B", "C", "D"] as const;
const durations = [30, 60, 120];

type CreatedContestRow = {
  contest_id: string;
  contest_starts_at: string;
  contest_ends_at: string;
};

function isCreatedContestRow(
  value: unknown
): value is CreatedContestRow {
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return false;
  }

  const row = value as Record<string, unknown>;

  return (
    typeof row.contest_id === "string" &&
    typeof row.contest_starts_at === "string" &&
    typeof row.contest_ends_at === "string"
  );
}

// Aktif yarışmayı PostgreSQL saatine göre bul.
export async function GET() {
  const { data, error } = await supabaseAdmin.rpc(
    "get_active_contest_id"
  );

  if (error) {
    console.error("Active contest lookup failed:", error);

    return NextResponse.json(
      { code: "DATABASE_ERROR" },
      { status: 500 }
    );
  }

  return NextResponse.json(
    {
      activeContestId: data ?? null,
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}

// Yeni yarışma oluştur.
export async function POST(request: NextRequest) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { code: "INVALID_JSON" },
      { status: 400 }
    );
  }

  if (
    !body ||
    typeof body !== "object" ||
    Array.isArray(body)
  ) {
    return NextResponse.json(
      { code: "INVALID_REQUEST" },
      { status: 400 }
    );
  }

  const {
    question,
    options,
    correctAnswer,
    durationSeconds,
  } = body as Record<string, unknown>;

  // Soru kontrolü.
  if (
    typeof question !== "string" ||
    !question.trim() ||
    question.length > 500
  ) {
    return NextResponse.json(
      { code: "INVALID_QUESTION" },
      { status: 400 }
    );
  }

  // Şıkların kontrolü.
  if (
    !options ||
    typeof options !== "object" ||
    Array.isArray(options) ||
    optionKeys.some((key) => {
      const value = (options as Record<string, unknown>)[key];

      return (
        typeof value !== "string" ||
        !value.trim() ||
        value.length > 200
      );
    })
  ) {
    return NextResponse.json(
      { code: "INVALID_OPTIONS" },
      { status: 400 }
    );
  }

  const values = options as Record<string, string>;

  const cleanOptions = Object.fromEntries(
    optionKeys.map((key) => [
      key,
      values[key].trim(),
    ])
  );

  // Aynı şık birden fazla kez girilemesin.
  const normalized = Object.values(cleanOptions).map(
    (value) => value.toLocaleLowerCase("tr-TR")
  );

  if (new Set(normalized).size !== 4) {
    return NextResponse.json(
      { code: "DUPLICATE_OPTIONS" },
      { status: 400 }
    );
  }

  // Doğru cevap ve süre kontrolü.
  if (
    !optionKeys.some((key) => key === correctAnswer) ||
    typeof durationSeconds !== "number" ||
    !durations.includes(durationSeconds)
  ) {
    return NextResponse.json(
      { code: "INVALID_CONFIGURATION" },
      { status: 400 }
    );
  }

  // PostgreSQL'de atomik yarışma oluşturma.
  const { data, error } = await supabaseAdmin
    .rpc("create_contest_if_available", {
      p_question: question.trim(),
      p_options: cleanOptions,
      p_correct_option: correctAnswer,
      p_duration_seconds: durationSeconds,
    })
    .single();

  if (error) {
    if (error.message.includes("ACTIVE_CONTEST_EXISTS")) {
      return NextResponse.json(
        { code: "ACTIVE_CONTEST_EXISTS" },
        { status: 409 }
      );
    }

    console.error("Contest creation failed:", error);

    return NextResponse.json(
      { code: "DATABASE_ERROR" },
      { status: 500 }
    );
  }

  // Supabase sonucunun beklenen alanları taşıdığını doğrula.
  if (!isCreatedContestRow(data)) {
    console.error("Invalid contest creation response:", data);

    return NextResponse.json(
      { code: "INVALID_DATABASE_RESPONSE" },
      { status: 500 }
    );
  }

  // Artık TypeScript bu alanların varlığını biliyor.
  return NextResponse.json(
    {
      contestId: data.contest_id,
      startsAt: data.contest_starts_at,
      endsAt: data.contest_ends_at,
    },
    { status: 201 }
  );
}
