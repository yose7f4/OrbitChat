@echo off
title OrbitChat
echo Starting OrbitChat Server...
start "" node server.js
timeout /t 2 /nobreak >nul
echo Starting Public Cloudflare Tunnel...
cloudflared.exe tunnel --url http://localhost:3000
pause
