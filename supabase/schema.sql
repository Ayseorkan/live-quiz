-- Complete, rerunnable schema for the single-stream Live Quiz prototype.
-- Existing contests and answers are retained.

CREATE TABLE IF NOT EXISTS public.contests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question TEXT NOT NULL,
    options JSONB NOT NULL,
    correct_option VARCHAR(1) NOT NULL
        CHECK (correct_option IN ('A', 'B', 'C', 'D')),
    duration_seconds INTEGER NOT NULL
        CHECK (duration_seconds IN (30, 60, 120)),
    starts_at TIMESTAMPTZ NOT NULL,
    ends_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT valid_contest_time CHECK (ends_at > starts_at)
);

CREATE TABLE IF NOT EXISTS public.answers (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    contest_id UUID NOT NULL REFERENCES public.contests(id) ON DELETE CASCADE,
    participant_id INTEGER NOT NULL CHECK (participant_id BETWEEN 1 AND 10),
    selected_option VARCHAR(1) NOT NULL CHECK (selected_option IN ('A', 'B', 'C', 'D')),
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT unique_contest_participant UNIQUE (contest_id, participant_id)
);

-- Both tables are server-access-only through the service role.
ALTER TABLE public.contests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.answers ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.validate_answer_submission()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE
    contest_start TIMESTAMPTZ;
    contest_end TIMESTAMPTZ;
    received_at TIMESTAMPTZ;
BEGIN
    SELECT starts_at, ends_at INTO contest_start, contest_end
    FROM public.contests WHERE id = NEW.contest_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Contest not found';
    END IF;

    received_at := pg_catalog.clock_timestamp();
    IF received_at < contest_start OR received_at >= contest_end THEN
        RAISE EXCEPTION 'Contest is not accepting answers';
    END IF;

    NEW.submitted_at := received_at;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS check_answer_submission ON public.answers;
CREATE TRIGGER check_answer_submission
BEFORE INSERT ON public.answers
FOR EACH ROW EXECUTE FUNCTION public.validate_answer_submission();

-- Atomic create: one active contest per demo livestream.
CREATE OR REPLACE FUNCTION public.create_contest_if_available(
    p_question TEXT,
    p_options JSONB,
    p_correct_option TEXT,
    p_duration_seconds INTEGER
)
RETURNS TABLE (
    contest_id UUID,
    contest_starts_at TIMESTAMPTZ,
    contest_ends_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
    v_now TIMESTAMPTZ;
    v_id UUID;
    v_start TIMESTAMPTZ;
    v_end TIMESTAMPTZ;
BEGIN
    PERFORM pg_catalog.pg_advisory_xact_lock(918278601);
    v_now := pg_catalog.clock_timestamp();

    IF EXISTS (
        SELECT 1 FROM public.contests c
        WHERE c.starts_at <= v_now AND c.ends_at > v_now
    ) THEN
        RAISE EXCEPTION 'ACTIVE_CONTEST_EXISTS' USING ERRCODE = 'P0001';
    END IF;

    IF p_duration_seconds NOT IN (30, 60, 120)
       OR p_correct_option NOT IN ('A', 'B', 'C', 'D')
       OR p_question IS NULL OR length(trim(p_question)) = 0
       OR length(p_question) > 500
       OR jsonb_typeof(p_options) IS DISTINCT FROM 'object'
       OR (SELECT count(*) FROM pg_catalog.jsonb_object_keys(p_options)) <> 4
    THEN
        RAISE EXCEPTION 'INVALID_CONTEST_DATA' USING ERRCODE = '22023';
    END IF;

    INSERT INTO public.contests (
        question, options, correct_option, duration_seconds, starts_at, ends_at
    ) VALUES (
        trim(p_question), p_options, p_correct_option, p_duration_seconds,
        v_now, v_now + p_duration_seconds * INTERVAL '1 second'
    )
    RETURNING id, starts_at, ends_at INTO v_id, v_start, v_end;

    RETURN QUERY SELECT v_id, v_start, v_end;
END;
$$;

REVOKE ALL ON FUNCTION public.create_contest_if_available(TEXT, JSONB, TEXT, INTEGER)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_contest_if_available(TEXT, JSONB, TEXT, INTEGER)
TO service_role;

NOTIFY pgrst, 'reload schema';
