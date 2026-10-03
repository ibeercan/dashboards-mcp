$ErrorActionPreference = "Stop"
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
  datasets = @(
    @{
      name = "main"
      rows = @()
      columns = @()
      values = @(
        @{ dataFieldId = 1 },
        @{ dataFieldId = 2 }
      )
      datasetType = $null
      ignoreDataRowsCountLimit = $false
    }
  )
  parameters = @()
}
try {
  $rd = Invoke-WebRequest "http://localhost:8014/api/Data" -Method POST -ContentType "application/json" -Body ($req | ConvertTo-Json -Depth 10) -UseBasicParsing -TimeoutSec 20
  $jd = $rd.Content | ConvertFrom-Json
  if ($jd.error) { Write-Output "DATA ERR: $($jd.error | ConvertTo-Json -Compress)"; exit 1 }
  $names = ($jd.data.datasets.PSObject.Properties.Name) -join ","
  Write-Output "DATA OK datasets: $names"
  $main = $jd.data.datasets.main
  if ($main) {
    $snippet = ($main.values | Select-Object -First 8) -join " | "
    Write-Output ("sample: " + $snippet.Substring(0, [Math]::Min(240, $snippet.Length)))
  }
} catch {
  Write-Output "HTTP fail: $($_.Exception.Message)"
  if ($_.ErrorDetails) { $er = $_.ErrorDetails.Message; Write-Output ("body: " + $er.Substring(0, [Math]::Min(300, $er.Length))) }
}
