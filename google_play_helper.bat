@echo off
echo 🚀 COMANDOS RÁPIDOS - GOOGLE PLAY CONSOLE
echo ======================================

echo ABRIR_APK:
echo start C:\dev\RauliERP-Panaderia-RAULI\frontend\android\app\build\outputs\apk\debug
echo.
echo VERIFICAR_APK:
echo cd C:\dev\RauliERP-Panaderia-RAULI\frontend\android\app\build\outputs\apk\debug && aapt dump badging app-debug.apk
echo.
echo ABRIR_CONSOLE:
echo start https://play.google.com/console
echo.
echo ABRIR_GUIA:
echo start C:\dev\RauliERP-Panaderia-RAULI\google_play_creation_guide.md
echo.
echo Elige una opción:
echo 1 - Abrir carpeta del APK
echo 2 - Verificar APK
echo 3 - Abrir Google Play Console
echo 4 - Abrir guía
echo 5 - Salir
set /p choice=Selecciona una opción (1-5): 
if '%choice%'=='1' start C:\dev\RauliERP-Panaderia-RAULI\frontend\android\app\build\outputs\apk\debug
if '%choice%'=='2' cd C:\dev\RauliERP-Panaderia-RAULI\frontend\android\app\build\outputs\apk\debug && aapt dump badging app-debug.apk
if '%choice%'=='3' start https://play.google.com/console
if '%choice%'=='4' start C:\dev\RauliERP-Panaderia-RAULI\google_play_creation_guide.md
if '%choice%'=='5' exit
