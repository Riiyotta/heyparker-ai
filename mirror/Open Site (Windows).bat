@echo off
set PYTHONDONTWRITEBYTECODE=1
cd /d "%~dp0"
python "_serve.py"
pause
