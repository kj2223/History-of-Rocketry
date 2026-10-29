@echo off
cd /d "%~dp0"
python -m per_aspera --pioneers %*
pause
