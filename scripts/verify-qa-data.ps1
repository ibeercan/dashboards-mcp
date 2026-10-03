$ErrorActionPreference = "Stop"
$dash = "QA Emulator Data"
$id = [uri]::EscapeDataString($dash)
$r = Invoke-WebRequest "http://localhost:8014/api/Dashboards/$id" -UseBasicParsing -TimeoutSec 5
$j = $r.Content | ConvertFrom-Json
$c = $j.data.components[0]
Write-Output "GET ok: components=$($j.data.components.Count) ds=$($j.data.dataSources.Count)"
Write-Output "df columns: $((($c.dataFields | ForEach-Object { $_.columnId }) -join ','))"
# build /api/Data request from the dashboard's own datasource (read-only SELECT probe)
$req = @{
  dataSource = $j.data.dataSources[0]
  dataFields = @(
    @{ DataSourceFieldId = -19; TypeEnum = 0; SortOrder = 0 },
    @{ DataSourceFieldId = -51; TypeEnum = 1; SortOrder = 1 }
  )
  filter = $null
  sorting = @()
  datasets = @()
  parameters = @()
}
try {
  $rd = Invoke-WebRequest "http://localhost:8014/api/Data" -Method POST -ContentType "application/json" -Body ($req | ConvertTo-Json -Depth 10) -UseBasicParsing -TimeoutSec 15
  $jd = $rd.Content | ConvertFrom-Json
  if ($jd.error) { Write-Output "DATA ERR: $($jd.error | ConvertTo-Json -Compress)" }
  else {
    $vals = $jd.data.datasets.PSObject.Properties | ForEach-Object { $_.Name }
    Write-Output "DATA OK datasets: $($vals -join ',')"
    $main = $jd.data.datasets.main
    if ($main) { Write-Output "rows sample: $((($main.values | Select-Object -First 5) -join ' | ').Substring(0, [Math]::Min(200, (($main.values | Select-Object -First 5) -join ' | ').Length)))" }
  }
} catch {
  Write-Output "DATA HTTP fail: $($_.Exception.Message)"
}
