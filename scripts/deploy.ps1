param(
  [string]$Remote = "origin",
  [string]$Branch = "main"
)

Write-Host "== RAULI Deploy ==" -ForegroundColor Cyan
Write-Host "Remote: $Remote  Branch: $Branch"

git status --short

if ($LASTEXITCODE -ne 0) {
  Write-Error "Git no disponible o repo no inicializado."
  exit 1
}

Write-Host "Haciendo pull..."
git pull $Remote $Branch

Write-Host "Haciendo push..."
git push $Remote $Branch

Write-Host "Listo. Vercel/Render desplegaran automaticamente si estan conectados al repo."
