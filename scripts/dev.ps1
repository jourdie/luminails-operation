$ErrorActionPreference = 'Stop'
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  $nodeDirectory = 'C:\Program Files\nodejs'
  if (-not (Test-Path -LiteralPath (Join-Path $nodeDirectory 'node.exe'))) {
    throw 'Install Node.js 22.13 or newer before running the application.'
  }
  $env:Path = $nodeDirectory + ';' + $env:Path
}
Set-Location -LiteralPath (Split-Path -Parent $PSScriptRoot)
& npm.cmd run dev
exit $LASTEXITCODE
