@echo off
title ATE Intelligence Setup
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\setup_portable.ps1" -Root "%~dp0"
if errorlevel 1 pause
