@echo off
setlocal
cd /d "%~dp0"
title BiblioColeta

if exist ".venv\Scripts\python.exe" goto ready

where py >nul 2>nul
if %errorlevel%==0 (
  py -3 -m venv .venv
) else (
  where python >nul 2>nul
  if errorlevel 1 goto no_python
  python -m venv .venv
)
if errorlevel 1 goto failure

:ready
".venv\Scripts\python.exe" -c "import playwright" >nul 2>nul
if errorlevel 1 (
  echo Preparando a ferramenta. Isso pode levar alguns minutos...
  ".venv\Scripts\python.exe" -m pip install -r requirements.txt
  if errorlevel 1 goto failure
)
".venv\Scripts\python.exe" -m playwright install chromium
if errorlevel 1 goto failure
".venv\Scripts\python.exe" interface.py
if errorlevel 1 goto failure
exit /b 0

:no_python
echo Python 3 nao foi encontrado. Instale-o em https://www.python.org/downloads/windows/
echo Marque a opcao "Add python.exe to PATH" durante a instalacao.
goto failure

:failure
echo.
echo Nao foi possivel abrir a ferramenta. Envie uma captura desta janela ao responsavel.
pause
exit /b 1
