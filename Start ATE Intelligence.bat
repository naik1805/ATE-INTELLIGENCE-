@echo off
title ATE Intelligence
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start_app.ps1" -Root "%~dp0"
if errorlevel 1 pause
