
# Live Quiz - API Smoke Tests
# Windows PowerShell 5.1 / PowerShell 7
# Two 30-second test contests will be created.

param(
    [string]$BaseUrl = "http://localhost:3000"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$BaseUrl = $BaseUrl.TrimEnd('/')

Add-Type -AssemblyName System.Net.Http

$client = New-Object System.Net.Http.HttpClient
$client.Timeout = [TimeSpan]::FromSeconds(20)

$passed = 0
$failed = 0

function Request-Api {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Method,

        [Parameter(Mandatory = $true)]
        [string]$Path,

        [object]$Body = $null
    )

    $url = "$BaseUrl$Path"

    $methodObject = [System.Net.Http.HttpMethod]::new($Method)
    $request = [System.Net.Http.HttpRequestMessage]::new(
        $methodObject,
        $url
    )

    try {
        $request.Headers.TryAddWithoutValidation(
            "Accept",
            "application/json"
        ) | Out-Null

        $request.Headers.TryAddWithoutValidation(
            "Cache-Control",
            "no-cache"
        ) | Out-Null

        if ($null -ne $Body) {
            $jsonBody = ConvertTo-Json `
                -InputObject $Body `
                -Depth 12 `
                -Compress

            $request.Content = [System.Net.Http.StringContent]::new(
                $jsonBody,
                [System.Text.Encoding]::UTF8,
                "application/json"
            )
        }

        $response = $client.SendAsync(
            $request
        ).GetAwaiter().GetResult()

        try {
            $raw = $response.Content.ReadAsStringAsync(
            ).GetAwaiter().GetResult()

            $json = $null

            if (-not [string]::IsNullOrWhiteSpace($raw)) {
                try {
                    $json = ConvertFrom-Json -InputObject $raw
                } catch {
                    # Keep raw response for diagnostics.
                }
            }

            return [pscustomobject]@{
                Status = [int]$response.StatusCode
                Json   = $json
                Raw    = $raw
                Url    = $url
            }
        } finally {
            $response.Dispose()
        }
    } finally {
        $request.Dispose()
    }
}

function Assert-Check {
    param(
        [Parameter(Mandatory = $true)]
        [bool]$Condition,

        [Parameter(Mandatory = $true)]
        [string]$Label,

        [string]$Details = ""
    )

    if ($Condition) {
        $script:passed++

        Write-Host "PASS: $Label" -ForegroundColor Green
        return
    }

    $script:failed++

    Write-Host "FAIL: $Label" -ForegroundColor Red

    if ($Details) {
        Write-Host "      $Details" -ForegroundColor Yellow
    }

    throw "Test failed: $Label"
}

function Assert-Status {
    param(
        $Response,
        [int]$Expected,
        [string]$Label
    )

    Assert-Check `
        -Condition ($Response.Status -eq $Expected) `
        -Label $Label `
        -Details "Expected HTTP $Expected, got $($Response.Status). Body: $($Response.Raw)"
}

function Read-ActiveContest {
    $result = Request-Api `
        -Method GET `
        -Path "/api/contests"

    Assert-Status `
        $result `
        200 `
        "Active contest API available"

    Assert-Check `
        -Condition (
            $null -ne $result.Json -and
            $null -ne $result.Json.PSObject.Properties['activeContestId']
        ) `
        -Label "Active contest response contains activeContestId" `
        -Details $result.Raw

    return $result.Json.activeContestId
}

function Wait-UntilContestEnds {
    param([string]$EndsAt)

    $endTime = [DateTimeOffset]::Parse($EndsAt)

    $seconds = [int][Math]::Max(
        0,
        [Math]::Ceiling(
            ($endTime - [DateTimeOffset]::UtcNow).TotalSeconds
        ) + 2
    )

    if ($seconds -gt 0) {
        Write-Host (
            "Waiting $seconds seconds for contest deadline..."
        ) -ForegroundColor Cyan

        Start-Sleep -Seconds $seconds
    }
}

function Wait-ForFinishedResults {
    param([string]$ContestId)

    for ($attempt = 0; $attempt -lt 8; $attempt++) {
        $result = Request-Api `
            -Method GET `
            -Path "/api/contests/$ContestId/results"

        if (
            $result.Status -eq 200 -and
            $null -ne $result.Json -and
            $result.Json.status -eq "FINISHED"
        ) {
            return $result
        }

        Start-Sleep -Seconds 1
    }

    throw "Results did not reach FINISHED for $ContestId"
}

function Find-Participant {
    param(
        $Participants,
        [int]$ParticipantId
    )

    return @(
        $Participants | Where-Object {
            $_.participantId -eq $ParticipantId
        }
    )[0]
}

try {
    Write-Host ""
    Write-Host "LIVE QUIZ SMOKE TESTS" -ForegroundColor Cyan
    Write-Host "API: $BaseUrl" -ForegroundColor Cyan
    Write-Host ""

    # ------------------------------------
    # 1. HOME PAGE
    # ------------------------------------

    $homePage = Request-Api `
        -Method GET `
        -Path "/"

    Assert-Status `
        $homePage `
        200 `
        "Home page is available"

    Assert-Check `
        -Condition ($homePage.Raw -match 'zleyici G.r.n.m.ne Ge.') `
        -Label "Host view shows the viewer-switch action" `
        -Details "Expected host-mode switch text was not found in the page HTML."

    # ------------------------------------
    # 2. PRECONDITION
    # ------------------------------------

    $alreadyActive = Read-ActiveContest

    if (
        $null -ne $alreadyActive -and
        "$alreadyActive" -ne ""
    ) {
        throw (
            "Contest already active: $alreadyActive. " +
            "Wait until it finishes and retry."
        )
    }

    Assert-Check `
        ($null -eq $alreadyActive -or "$alreadyActive" -eq "") `
        "No contest active before test"

    $suffix = [Guid]::NewGuid().ToString('N').Substring(0, 8)

    $firstPayload = @{
        question = "Smoke test $suffix - Which answer is correct?"
        options = @{
            A = "Option A $suffix"
            B = "Correct option B $suffix"
            C = "Option C $suffix"
            D = "Option D $suffix"
        }
        correctAnswer = "B"
        durationSeconds = 30
    }

    # ------------------------------------
    # 3. INPUT VALIDATION
    # ------------------------------------

    $badQuestion = @{
        question = " "
        options = $firstPayload.options
        correctAnswer = "B"
        durationSeconds = 30
    }

    Assert-Status `
        (Request-Api POST "/api/contests" $badQuestion) `
        400 `
        "Empty question rejected"

    $duplicateOptions = @{
        question = "Duplicated options"
        options = @{
            A = "same"
            B = "same"
            C = "other"
            D = "different"
        }
        correctAnswer = "B"
        durationSeconds = 30
    }

    Assert-Status `
        (Request-Api POST "/api/contests" $duplicateOptions) `
        400 `
        "Duplicate options rejected"

    $badDuration = @{
        question = "Bad duration"
        options = $firstPayload.options
        correctAnswer = "B"
        durationSeconds = 17
    }

    Assert-Status `
        (Request-Api POST "/api/contests" $badDuration) `
        400 `
        "Unsupported duration rejected"

    # ------------------------------------
    # 4. CREATE FIRST CONTEST
    # ------------------------------------

    $created = Request-Api `
        POST `
        "/api/contests" `
        $firstPayload

    Assert-Status `
        $created `
        201 `
        "First contest created"

    $firstId = [string]$created.Json.contestId

    Assert-Check `
        -Condition (
            $firstId -match '^[0-9a-fA-F-]{36}$' -and
            -not [string]::IsNullOrWhiteSpace(
                $created.Json.endsAt
            )
        ) `
        -Label "Creation returns contestId and endsAt" `
        -Details $created.Raw

    $active = Read-ActiveContest

    Assert-Check `
        ($active -eq $firstId) `
        "First contest is discoverable as active"

    # ------------------------------------
    # 5. BLOCK SECOND ACTIVE CONTEST
    # ------------------------------------

    $secondDuringFirst = Request-Api `
        POST `
        "/api/contests" `
        $firstPayload

    Assert-Status `
        $secondDuringFirst `
        409 `
        "Second contest blocked while first is active"

    Assert-Check `
        ($secondDuringFirst.Json.code -eq "ACTIVE_CONTEST_EXISTS") `
        "Active contest returns explicit error code"

    # ------------------------------------
    # 6. PUBLIC CONTEST SECURITY
    # ------------------------------------

    $publicContest = Request-Api `
        GET `
        "/api/contests/$firstId"

    Assert-Status `
        $publicContest `
        200 `
        "Public contest GET succeeds"

    Assert-Check `
        ($publicContest.Json.contest.question -eq $firstPayload.question) `
        "Question returned correctly"

    Assert-Check `
        -Condition (
            $publicContest.Raw -notmatch '"correctOption"\s*:' -and
            $publicContest.Raw -notmatch '"correct_option"\s*:'
        ) `
        -Label "Correct option hidden before deadline"

    # ------------------------------------
    # 7. ANSWER SUBMISSION
    # ------------------------------------

    $initialAnswer = Request-Api `
        GET `
        "/api/contests/$firstId/answers?participantId=1"

    Assert-Status `
        $initialAnswer `
        200 `
        "Participant answer status GET succeeds"

    Assert-Check `
        ($initialAnswer.Json.alreadySubmitted -eq $false) `
        "Participant 1 initially has no answer"

    $answer1 = Request-Api `
        POST `
        "/api/contests/$firstId/answers" `
        @{
            participantId = 1
            selectedOption = "B"
        }

    Assert-Status `
        $answer1 `
        201 `
        "Participant 1 correct answer accepted"

    Assert-Check `
        ($answer1.Json.code -eq "ANSWER_ACCEPTED") `
        "Accepted answer returns ANSWER_ACCEPTED"

    # ------------------------------------
    # 8. DUPLICATE ANSWER
    # ------------------------------------

    $duplicateAnswer = Request-Api `
        POST `
        "/api/contests/$firstId/answers" `
        @{
            participantId = 1
            selectedOption = "A"
        }

    Assert-Status `
        $duplicateAnswer `
        409 `
        "Duplicate answer rejected"

    $savedAnswer = Request-Api `
        GET `
        "/api/contests/$firstId/answers?participantId=1"

    Assert-Check `
        -Condition (
            $savedAnswer.Status -eq 200 -and
            $savedAnswer.Json.alreadySubmitted -eq $true -and
            $savedAnswer.Json.selectedOption -eq "B"
        ) `
        -Label "Original answer unchanged after duplicate" `
        -Details $savedAnswer.Raw

    # ------------------------------------
    # 9. MORE PARTICIPANTS
    # ------------------------------------

    Start-Sleep -Milliseconds 1100

    Assert-Status `
        (Request-Api POST "/api/contests/$firstId/answers" @{
            participantId = 2
            selectedOption = "B"
        }) `
        201 `
        "Participant 2 correct answer accepted"

    Assert-Status `
        (Request-Api POST "/api/contests/$firstId/answers" @{
            participantId = 3
            selectedOption = "A"
        }) `
        201 `
        "Participant 3 wrong answer recorded"

    Assert-Status `
        (Request-Api POST "/api/contests/$firstId/answers" @{
            participantId = 11
            selectedOption = "B"
        }) `
        400 `
        "Out-of-range participant rejected"

    Assert-Status `
        (Request-Api POST "/api/contests/$firstId/answers" @{
            participantId = 4
            selectedOption = "Z"
        }) `
        400 `
        "Invalid answer option rejected"

    # ------------------------------------
    # 10. RESULTS BEFORE DEADLINE
    # ------------------------------------

    $beforeResults = Request-Api `
        GET `
        "/api/contests/$firstId/results"

    Assert-Status `
        $beforeResults `
        200 `
        "Results endpoint available during contest"

    Assert-Check `
        ($beforeResults.Json.status -eq "ACTIVE") `
        "Results show ACTIVE before deadline"

    Assert-Check `
        -Condition (
            $beforeResults.Raw -notmatch '"correctOption"\s*:' -and
            $beforeResults.Raw -notmatch '"winnerId"\s*:'
        ) `
        -Label "Winner and correct answer hidden during contest"

    # ------------------------------------
    # 11. FINISH FIRST CONTEST
    # ------------------------------------

    Wait-UntilContestEnds ([string]$created.Json.endsAt)

    $lateAnswer = Request-Api `
        POST `
        "/api/contests/$firstId/answers" `
        @{
            participantId = 4
            selectedOption = "B"
        }

    Assert-Status `
        $lateAnswer `
        410 `
        "Late answer rejected after deadline"

    $finished1 = Wait-ForFinishedResults $firstId

    Assert-Check `
        ($finished1.Json.status -eq "FINISHED") `
        "First contest finished"

    Assert-Check `
        ($finished1.Json.contest.correctOption -eq "B") `
        "Correct option revealed after finish"

    Assert-Check `
        ($finished1.Json.winnerId -eq 1) `
        "First correct participant wins"

    # ------------------------------------
    # 12. SCORING AND RANKING
    # ------------------------------------

    $players = @($finished1.Json.participants)

    Assert-Check `
        ($players.Count -eq 10) `
        "All 10 simulated participants included"

    $p1 = Find-Participant $players 1
    $p2 = Find-Participant $players 2
    $p3 = Find-Participant $players 3
    $p4 = Find-Participant $players 4

    Assert-Check `
        (
            $p1.score -eq 100 -and
            $p1.rank -eq 1 -and
            $p1.isWinner -eq $true
        ) `
        "Participant 1 gets 100 points, rank 1, winner"

    Assert-Check `
        (
            $p2.score -eq 100 -and
            $p2.rank -eq 2 -and
            $p2.isWinner -eq $false
        ) `
        "Second correct participant gets rank 2"

    Assert-Check `
        (
            $p3.score -eq 0 -and
            $p3.outcome -eq "INCORRECT"
        ) `
        "Wrong answer gets zero points"

    Assert-Check `
        (
            $p4.outcome -eq "NOT_SUBMITTED" -and
            $null -eq $p4.selectedOption
        ) `
        "Missing answer remains unsubmitted"

    # ------------------------------------
    # 13. ACTIVE CONTEST CLEARED
    # ------------------------------------

    $idle = Read-ActiveContest

    Assert-Check `
        ($null -eq $idle -or "$idle" -eq "") `
        "Active contest cleared after deadline"

    # ------------------------------------
    # 14. CREATE SECOND CONTEST
    # ------------------------------------

    $secondPayload = @{
        question = "Smoke test $suffix - Nobody answers this round"
        options = @{
            A = "One $suffix"
            B = "Two $suffix"
            C = "Three $suffix"
            D = "Four $suffix"
        }
        correctAnswer = "D"
        durationSeconds = 30
    }

    $created2 = Request-Api `
        POST `
        "/api/contests" `
        $secondPayload

    Assert-Status `
        $created2 `
        201 `
        "New contest allowed after first contest ends"

    $secondId = [string]$created2.Json.contestId

    Assert-Check `
        ($secondId -ne $firstId) `
        "Second contest has a different ID"

    Assert-Check `
        ((Read-ActiveContest) -eq $secondId) `
        "Second contest becomes active"

    # ------------------------------------
    # 15. HISTORICAL RESULTS PRESERVED
    # ------------------------------------

    $historic = Request-Api `
        GET `
        "/api/contests/$firstId/results"

    Assert-Check `
        -Condition (
            $historic.Status -eq 200 -and
            $historic.Json.status -eq "FINISHED" -and
            $historic.Json.winnerId -eq 1
        ) `
        -Label "First contest results preserved during second contest"

    # ------------------------------------
    # 16. NO ANSWERS / NO WINNER
    # ------------------------------------

    Wait-UntilContestEnds ([string]$created2.Json.endsAt)

    $finished2 = Wait-ForFinishedResults $secondId

    Assert-Check `
        ($finished2.Json.status -eq "FINISHED") `
        "Second contest finished"

    Assert-Check `
        ($null -eq $finished2.Json.winnerId) `
        "No answers means no winner"

    Assert-Check `
        (@($finished2.Json.participants).Count -eq 10) `
        "No-answer results include all 10 participants"

    $lastActive = Read-ActiveContest

    Assert-Check `
        ($null -eq $lastActive -or "$lastActive" -eq "") `
        "No active contest after second deadline"

    # ------------------------------------
    # FINAL RESULT
    # ------------------------------------

    Write-Host ""
    Write-Host "ALL TESTS PASSED! $passed checks." -ForegroundColor Green

    Write-Host "Contests created:" -ForegroundColor Gray
    Write-Host $firstId -ForegroundColor Gray
    Write-Host $secondId -ForegroundColor Gray

    Write-Host "Existing data was not deleted." -ForegroundColor Gray

    exit 0

} catch {
    if ($script:failed -eq 0) {
        $script:failed++
    }

    Write-Host ""
    Write-Host "SMOKE TEST FAILED: $($_.Exception.Message)" -ForegroundColor Red

    Write-Host "Passed: $passed | Failed: $failed" -ForegroundColor Yellow

    Write-Host "Check Next.js, Supabase, and the SQL RPC function." -ForegroundColor Yellow

    exit 1

} finally {
    $client.Dispose()
}
