@echo off
cd /d "%~dp0"
echo === Deploy Network - Proxy Cloudflare + api_robot.txt ===
node deploy_network.js
pause
