# DualCrypt Enterprise Android ProGuard / R8 Protection & Obfuscation Rules

# Optimize and shrink code
-repackageclasses ''
-allowaccessmodification
-renamesourcefileattribute SourceFile
-keepattributes *Annotation*,Signature,InnerClasses,EnclosingMethod

# Keep Capacitor Bridge & Plugins
-keep public class com.getcapacitor.** { *; }
-keep public class * extends com.getcapacitor.Plugin { *; }
-keep public class * extends com.getcapacitor.BridgeActivity { *; }
-keep public class com.enterprise.dualcrypt.auth.MainActivity { *; }

# Keep JavaScript Interface Methods for WebView communication
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Suppress harmless warnings for optional Google Play services
-dontwarn com.google.android.gms.**
-dontwarn androidx.**
