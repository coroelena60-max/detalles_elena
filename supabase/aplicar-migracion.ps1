# Aplica UNA migración en la base real (nrwamzgxwttgvaqqodfp) por la API de Supabase,
# para quien no tiene acceso al SQL Editor pero sí un access token.
#
# Uso, desde la raíz del repo:
#   powershell -ExecutionPolicy Bypass -File supabase/aplicar-migracion.ps1 0027_devolver_cobro.sql
#
# El token se pide al correr (no se muestra ni se guarda en ningún archivo).
# Nunca pasarle todas las migraciones juntas: una por vez, solo la nueva (ver CLAUDE.md §4).
param(
  [Parameter(Mandatory = $true)]
  [string]$Archivo
)

$ErrorActionPreference = 'Stop'
$proyecto = 'nrwamzgxwttgvaqqodfp'

if ($Archivo -notmatch '^\d{4}_[\w-]+\.sql$') {
  throw 'Pasá el nombre de UNA migración, por ejemplo 0027_devolver_cobro.sql'
}
$ruta = Join-Path $PSScriptRoot (Join-Path 'migrations' $Archivo)
if (-not (Test-Path $ruta)) { throw "No existe $ruta" }

$sql = [IO.File]::ReadAllText($ruta, [Text.Encoding]::UTF8)
Write-Host "Se va a aplicar $Archivo en el proyecto $proyecto ($($sql.Length) caracteres)."
$confirmar = Read-Host 'Escribí SI para seguir'
if ($confirmar -ne 'SI') { Write-Host 'Cancelado.'; exit 1 }

$seguro = Read-Host 'Pegá el access token de Supabase (no se ve al escribir)' -AsSecureString
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($seguro)
try {
  $token = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
  $cuerpo = [Text.Encoding]::UTF8.GetBytes((@{ query = $sql } | ConvertTo-Json -Compress))
  $respuesta = Invoke-RestMethod -Method Post `
    -Uri "https://api.supabase.com/v1/projects/$proyecto/database/query" `
    -Headers @{ Authorization = "Bearer $token" } `
    -ContentType 'application/json; charset=utf-8' `
    -Body $cuerpo
  Write-Host "Listo: $Archivo aplicada." -ForegroundColor Green
  if ($respuesta) { $respuesta | ConvertTo-Json -Depth 5 }
}
catch {
  Write-Host "No se pudo aplicar: $($_.Exception.Message)" -ForegroundColor Red
  if ($_.ErrorDetails.Message) { Write-Host $_.ErrorDetails.Message }
  exit 1
}
finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
  Remove-Variable token -ErrorAction SilentlyContinue
}
