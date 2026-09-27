# Cierra el registro público y sube el mínimo de contraseña en Supabase Auth,
# para quien no entra al dashboard pero sí tiene un access token.
#
# Uso, desde la raíz del repo:
#   powershell -ExecutionPolicy Bypass -File supabase/ajustar-auth.ps1
#   powershell -ExecutionPolicy Bypass -File supabase/ajustar-auth.ps1 -SiteUrl https://panel.detalleselena.com
#
# Deja: disable_signup = true (las cuentas se crean con Authentication -> Add user,
# ver CLAUDE.md 5.5) y password_min_length = 10. El -SiteUrl es opcional: hoy la
# base tiene http://localhost:3000, que rompe los enlaces de correo en produccion.
#
# El token se pide al correr (no se muestra ni se guarda en ningun archivo).
param(
  [string]$SiteUrl
)

$ErrorActionPreference = 'Stop'
$proyecto = 'nrwamzgxwttgvaqqodfp'

$ajustes = @{
  disable_signup      = $true
  password_min_length = 10
}
if ($SiteUrl) {
  if ($SiteUrl -notmatch '^https?://') { throw 'El -SiteUrl tiene que empezar con http:// o https://' }
  $ajustes.site_url = $SiteUrl
}

Write-Host "Se va a cambiar la configuracion de Auth del proyecto $proyecto :"
foreach ($clave in $ajustes.Keys) { Write-Host "  $clave = $($ajustes[$clave])" }
$confirmar = Read-Host 'Escribi SI para seguir'
if ($confirmar -ne 'SI') { Write-Host 'Cancelado.'; exit 1 }

$seguro = Read-Host 'Pega el access token de Supabase (no se ve al escribir)' -AsSecureString
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($seguro)
try {
  $token = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
  $cuerpo = [Text.Encoding]::UTF8.GetBytes(($ajustes | ConvertTo-Json -Compress))
  $respuesta = Invoke-RestMethod -Method Patch `
    -Uri "https://api.supabase.com/v1/projects/$proyecto/config/auth" `
    -Headers @{ Authorization = "Bearer $token" } `
    -ContentType 'application/json; charset=utf-8' `
    -Body $cuerpo
  Write-Host 'Listo. Asi quedo:' -ForegroundColor Green
  $respuesta | Select-Object disable_signup, password_min_length, site_url | Format-List
}
catch {
  Write-Host "No se pudo cambiar: $($_.Exception.Message)" -ForegroundColor Red
  if ($_.ErrorDetails.Message) { Write-Host $_.ErrorDetails.Message }
  exit 1
}
finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
  Remove-Variable token -ErrorAction SilentlyContinue
}
