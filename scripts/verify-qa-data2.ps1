$ErrorActionPreference = "Stop"
$base = "C:\Users\roman.fetisov\Desktop\Box\industry\Web\Dashboards\mcp-server\scripts"
$dash = Invoke-WebRequest "http://localhost:8014/api/Dashboards/QA%20Emulator%20Data" -UseBasicParsing -TimeoutSec 5
$j = $dash.Content | ConvertFrom-Json
$req = @{
  dataSource = $j.data.dataSources[0]
  dataFields = @(
    @{ Id = 1; DataSourceFieldId = -19; TypeEnum = 0; SortOrder = 0 },
    @{ Id = 2; DataSourceFieldId = -51; TypeEnum = 1; SortOrder = 1 }
  )
  filter = $null
  sorting = @()
  datasets = @()
  parameters = @()
}
$rd = Invoke-WebRequest "http://localhost:8014/api/Data" -Method POST -ContentType "application/json" -Body ($req | ConvertTo-Json -Depth 10) -UseBasicParsing -TimeoutSec 15
$jd = $rd.Content | ConvertFrom-Json
if ($jd.error) { Write-Output "DATA ERR: $($jd.error | ConvertTo-Json -Compress)"; exit 1 }
$names = ($jd.data.datasets.PSObject.Properties.Name) -join ","
Write-Output "DATA OK datasets: $names"
$main = $jd.data.datasets.main
if ($main) {
  $snippet = ($main.values | Select-Object -First 6) -join " | "
  Write-Output ("sample: " + $snippet.Substring(0, [Math]::Min(220, $snippet.Length)))
}
