$ErrorActionPreference = "Stop"
$body = '{"name":"Industry"}'
$r = Invoke-WebRequest "http://localhost:8014/api/TablesInfo" -Method POST -ContentType "application/json" -Body $body -UseBasicParsing -TimeoutSec 10
$j = $r.Content | ConvertFrom-Json
$tables = $j.data
Write-Output "tables total: $($tables.Count)"
$machine = $tables | Where-Object { $_.name -ieq "machine" }
if ($machine) {
  Write-Output "machine schema=$($machine.schema) type=$($machine.type) columns=$($machine.columns.Count)"
  $machine.columns | ForEach-Object { Write-Output "  col $($_.name) | $($_.dataTypeName) | allowNull=$($_.allowNull)" }
} else {
  Write-Output "NO machine table. candidates:"
  $tables | Where-Object { $_.name -match "mach" } | ForEach-Object { Write-Output "  $($_.schema).$($_.name)" }
  Write-Output "first 20 tables:"
  $tables | Select-Object -First 20 | ForEach-Object { Write-Output "  $($_.schema).$($_.name)" }
}
