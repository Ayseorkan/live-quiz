
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

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

  const { data, error } = await supabaseAdmin
    .from("contests")
    .select(
      "id, question, options, duration_seconds, starts_at, ends_at"
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("Contest fetch failed:", error);

    return NextResponse.json(
      { code: "DATABASE_ERROR" },
      { status: 500 }
    );
  }

  if (!data) {
    return NextResponse.json(
      { code: "CONTEST_NOT_FOUND" },
      { status: 404 }
    );
  }

  return NextResponse.json(
    {
      contest: {
        id: data.id,
        question: data.question,
        options: data.options,
        durationSeconds: data.duration_seconds,
        startsAt: data.starts_at,
        endsAt: data.ends_at,
      },
      serverNow: new Date().toISOString(),
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}
