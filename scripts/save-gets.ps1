$ErrorActionPreference = "Stop"
$base = "C:\Users\roman.fetisov\Desktop\Box\industry\Web\Dashboards\mcp-server\scripts"
foreach ($n in @("4.1 WC Piece T Control", "QA Emulator Test")) {
  $id = [uri]::EscapeDataString($n)
  $r = Invoke-WebRequest "http://localhost:8014/api/Dashboards/$id" -UseBasicParsing -TimeoutSec 5
  $j = $r.Content | ConvertFrom-Json
  $safe = $n -replace " ", "_"
  [System.IO.File]::WriteAllText("$base\get-$safe.json", ($j.data | ConvertTo-Json -Depth 10))
  Write-Output "$n saved"
}
