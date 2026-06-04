param(
    [string]$BaseUrl = "http://127.0.0.1:8011",
    [int]$AuditLimit = 10
)

$ErrorActionPreference = "Stop"

function Invoke-CheckedJson {
    param(
        [string]$Uri,
        [string]$Method = "Get",
        [object]$Body = $null,
        $WebSession = $null
    )

    $params = @{
        Uri = $Uri
        Method = $Method
    }

    if ($WebSession) {
        $params.WebSession = $WebSession
    }

    if ($null -ne $Body) {
        $params.ContentType = "application/json"
        $params.Body = ($Body | ConvertTo-Json -Compress)
    }

    return Invoke-RestMethod @params
}

function Get-StatusCode {
    param(
        [string]$Uri,
        $WebSession = $null
    )

    try {
        $params = @{ Uri = $Uri; UseBasicParsing = $true }
        if ($WebSession) {
            $params.WebSession = $WebSession
        }
        $response = Invoke-WebRequest @params
        return $response.StatusCode
    } catch {
        return $_.Exception.Response.StatusCode.value__
    }
}

$result = @{}

$homeStatus = Get-StatusCode -Uri "$BaseUrl/"
if ($homeStatus -ne 200) {
    throw "Home check failed with status $homeStatus"
}
$result.home = $homeStatus

$health = Invoke-CheckedJson -Uri "$BaseUrl/health"
if ($health.status -ne "ok") {
    throw "Health check failed: $($health | ConvertTo-Json -Compress)"
}
$result.health = $health.status

$analyst = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$admin = New-Object Microsoft.PowerShell.Commands.WebRequestSession

Invoke-CheckedJson -Uri "$BaseUrl/auth/demo-login" -Method Post -WebSession $analyst -Body @{
    email = "analyst@tracewise.local"
    name = "Demo Analyst"
    role = "analyst"
} | Out-Null

$created = Invoke-CheckedJson -Uri "$BaseUrl/api/requirements/intake" -Method Post -WebSession $analyst -Body @{
    stakeholder = "Smoke Script"
    priority = "High"
    raw_input = "Need deterministic smoke validation for requirement governance and traceability coverage."
}

$requirementId = $created.id
if (-not $requirementId) {
    throw "Requirement intake did not return an id"
}
$result.requirement_id = $requirementId

$clarify = Invoke-CheckedJson -Uri "$BaseUrl/api/requirements/$requirementId/clarify" -Method Post -WebSession $analyst
$result.clarification_questions = @($clarify.clarification_questions).Count

Invoke-CheckedJson -Uri "$BaseUrl/api/requirements/$requirementId/trace-links" -Method Post -WebSession $analyst -Body @{
    user_story = "As analyst I need confidence in smoke checks"
    task = "Run scripted validation"
    test_case = "Verify chain via API"
} | Out-Null

$matrix = Invoke-CheckedJson -Uri "$BaseUrl/api/traceability/matrix" -WebSession $analyst
$result.matrix_rows = @($matrix).Count

$dashboard = Invoke-CheckedJson -Uri "$BaseUrl/api/dashboard/summary" -WebSession $analyst
$result.total_requirements = $dashboard.total_requirements

$audit = Invoke-CheckedJson -Uri "$BaseUrl/api/audit/events?limit=$AuditLimit&actor=analyst&action=requirement.created&q=smoke" -WebSession $analyst
$result.audit_filtered_count = @($audit).Count

$analystExportStatus = Get-StatusCode -Uri "$BaseUrl/api/audit/events/export.csv?limit=5" -WebSession $analyst
$result.analyst_export_status = $analystExportStatus
if ($analystExportStatus -ne 403) {
    throw "Expected analyst export status 403, got $analystExportStatus"
}

Invoke-CheckedJson -Uri "$BaseUrl/auth/demo-login" -Method Post -WebSession $admin -Body @{
    email = "admin@tracewise.local"
    name = "Demo Admin"
    role = "admin"
} | Out-Null

$adminExportStatus = Get-StatusCode -Uri "$BaseUrl/api/audit/events/export.csv?limit=5" -WebSession $admin
$result.admin_export_status = $adminExportStatus
if ($adminExportStatus -ne 200) {
    throw "Expected admin export status 200, got $adminExportStatus"
}

$result.timestamp = (Get-Date).ToString("o")
$result | ConvertTo-Json -Compress
