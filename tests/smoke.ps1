
$ErrorActionPreference = "Stop"
$baseUrl = "http://localhost:3000"

function Assert-Equal {
    param($Name, $Actual, $Expected)

    if ($Actual -ne $Expected) {
        throw "FAILED: $Name | Expected: $Expected | Actual: $Actual"
    }

    Write-Host "PASS: $Name" -ForegroundColor Green
}

function Send-Answer {
    param(
        [string]$ContestId,
        [int]$ParticipantId,
        [string]$Option
    )

    $body = @{
        participantId = $ParticipantId
        selectedOption = $Option
    } | ConvertTo-Json

    try {
        $response = Invoke-WebRequest `
            -Uri "$baseUrl/api/contests/$ContestId/answers" `
            -Method POST `
            -ContentType "application/json" `
            -Body $body `
            -UseBasicParsing

        return [int]$response.StatusCode
    }
    catch {
        if ($_.Exception.Response) {
            return [int]$_.Exception.Response.StatusCode
        }

        throw
    }
}

Write-Host "`nCreating test contest..."

$body = @{
    question = "3, 6, 12, 24, ?"
    options = @{
        A = "36"
        B = "48"
        C = "42"
        D = "50"
    }
    correctAnswer = "B"
    durationSeconds = 30
} | ConvertTo-Json -Depth 5

$contest = Invoke-RestMethod `
    -Uri "$baseUrl/api/contests" `
    -Method POST `
    -ContentType "application/json" `
    -Body $body

$id = $contest.contestId

Write-Host "Contest ID: $id"

# Test 1: Correct answer
$status = Send-Answer $id 2 "B"
Assert-Equal "Correct answer accepted" $status 201

# Test 2: Duplicate answer
$status = Send-Answer $id 2 "A"
Assert-Equal "Duplicate answer rejected" $status 409

# Test 3: Another correct answer
$status = Send-Answer $id 3 "B"
Assert-Equal "Second correct participant accepted" $status 201

# Test 4: Wrong answer
$status = Send-Answer $id 1 "A"
Assert-Equal "Wrong answer recorded" $status 201

# Test 5: Wait until contest ends
$endTime = [DateTimeOffset]::Parse($contest.endsAt)
$remaining = ($endTime - [DateTimeOffset]::UtcNow).TotalSeconds
$wait = [Math]::Max(0, [Math]::Ceiling($remaining) + 2)

Write-Host "`nWaiting $wait seconds for contest to end..."
Start-Sleep -Seconds ([int]$wait)

$status = Send-Answer $id 4 "B"
Assert-Equal "Late answer rejected" $status 410

# Test 6: Evaluate results
$result = Invoke-RestMethod `
    -Uri "$baseUrl/api/contests/$id/results" `
    -Method GET

Assert-Equal "Contest finished" $result.status "FINISHED"
Assert-Equal "Correct winner" $result.winnerId 2

$p1 = $result.participants | Where-Object participantId -eq 1
$p2 = $result.participants | Where-Object participantId -eq 2
$p3 = $result.participants | Where-Object participantId -eq 3
$p10 = $result.participants | Where-Object participantId -eq 10

Assert-Equal "Wrong answer score" $p1.score 0
Assert-Equal "Winner score" $p2.score 100
Assert-Equal "Winner rank" $p2.rank 1
Assert-Equal "Second correct score" $p3.score 100
Assert-Equal "Second correct rank" $p3.rank 2
Assert-Equal "Missing answer" $p10.outcome "NOT_SUBMITTED"
Assert-Equal "Participant count" @($result.participants).Count 10

Write-Host "`nALL TESTS PASSED!" -ForegroundColor Green
