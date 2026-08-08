# Merge all question files into single output
$outputPath = "..\试题迭代记录\round1\test_questions_round1.json"

$files = @(
    "..\试题迭代记录\round1\questions_ch1_4.json",
    "..\试题迭代记录\round1\questions_ch5_8.json",
    "..\试题迭代记录\round1\questions_ch9_12.json"
)

$allQuestions = @()
foreach ($f in $files) {
    if (Test-Path $f) {
        $data = Get-Content $f -Raw -Encoding UTF8 | ConvertFrom-Json
        $allQuestions += $data.questions
        Write-Output "Loaded: $f -> $($data.questions.Count) questions"
    } else {
        Write-Output "MISSING: $f"
    }
}

# Re-number IDs sequentially
$i = 1
foreach ($q in $allQuestions) {
    $q.id = "r1-{0:D3}" -f $i
    $i++
}

$output = @{
    round = 1
    total = $allQuestions.Count
    generated_at = "2026-07-22"
    questions = $allQuestions
}

$output | ConvertTo-Json -Depth 6 | Out-File -FilePath $outputPath -Encoding UTF8

Write-Output "`nMERGED: $($allQuestions.Count) questions -> $outputPath"

# Print summary stats
$byChap = $allQuestions | Group-Object chapter | Sort-Object Name
$byDiff = $allQuestions | Group-Object difficulty | Sort-Object Name
$byType = $allQuestions | Group-Object type | Sort-Object Name

Write-Output "`n=== Chapter Distribution ==="
$byChap | ForEach-Object { Write-Output "  $($_.Name): $($_.Count)" }
Write-Output "`n=== Difficulty Distribution ==="
$byDiff | ForEach-Object { Write-Output "  Level $($_.Name): $($_.Count)" }
Write-Output "`n=== Type Distribution ==="
$byType | ForEach-Object { Write-Output "  $($_.Name): $($_.Count)" }
