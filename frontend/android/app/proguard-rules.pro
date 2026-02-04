# Capacitor / WebView
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
-keepattributes JavascriptInterface
-keep class com.getcapacitor.** { *; }
-keep class com.raulipanaderia.app.** { *; }

# Preservar info para crash reports
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile
