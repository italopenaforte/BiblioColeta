$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
    throw 'Python 3 não encontrado. Instale Python antes de criar o aplicativo.'
}

python -m venv .venv-build
if ($LASTEXITCODE -ne 0) { throw 'Não foi possível criar o ambiente de construção.' }
$python = Join-Path $PSScriptRoot '.venv-build\Scripts\python.exe'
& $python -m pip install -r requirements.txt pyinstaller
if ($LASTEXITCODE -ne 0) { throw 'Não foi possível instalar as dependências.' }

# O navegador vai dentro da pasta do Playwright, que será incluída no aplicativo.
$env:PLAYWRIGHT_BROWSERS_PATH = '0'
& $python -m playwright install chromium
if ($LASTEXITCODE -ne 0) { throw 'Não foi possível instalar o Chromium.' }

& $python -m PyInstaller --noconfirm --clean --onedir --windowed --name BiblioPNRS --collect-all playwright --hidden-import bibliopnrs interface.py
if ($LASTEXITCODE -ne 0) { throw 'Não foi possível empacotar o aplicativo.' }

$installedBrowsers = (& $python -c "import pathlib, playwright; print(pathlib.Path(playwright.__file__).parent / 'driver' / 'package' / '.local-browsers')").Trim()
$browserFolder = Join-Path $PSScriptRoot 'dist\BiblioPNRS\_internal\playwright\driver\package\.local-browsers'
New-Item -ItemType Directory -Path $browserFolder -Force | Out-Null
Copy-Item -Path (Join-Path $installedBrowsers '*') -Destination $browserFolder -Recurse -Force
if (-not (Test-Path $browserFolder)) {
    throw "O navegador não foi incluído no pacote: $browserFolder"
}

$zip = Join-Path $PSScriptRoot 'BiblioPNRS-Windows.zip'
Compress-Archive -Path 'dist\BiblioPNRS' -DestinationPath $zip -Force
Write-Host "Pacote pronto: $zip"
