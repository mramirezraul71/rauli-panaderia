@echo off
echo Setting JAVA_HOME...
set JAVA_HOME=C:\Program Files\Android\Android Studio\jbr
set PATH=%JAVA_HOME%\bin;%PATH%

echo Building APK...
cd C:\dev\RauliERP-Panaderia-RAULI\frontend\android
.\gradlew.bat assembleDebug

echo APK Build completed!
pause
