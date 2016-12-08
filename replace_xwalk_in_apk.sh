#!/bin/bash

#
# Script for replacing the copy of Crosswalk in an APK with our modified build.
#
# Our modified build of Crosswalk includes support for obfuscating WebRTC output
# in native code.  This is how we implement obfuscation on Android, where we
# have the ability to provide our own modified browser runtime and the CPU is
# not fast enough for our implementation of CHURN in javascript to perform well.
#

# Get the directory where this script is and set ROOT_DIR to that path. This
# allows script to be run from different directories but always act on the
# directory of the project (which is where this script is located).
ROOT_DIR="$(cd "$(dirname $0)"; pwd)";

readonly APK_PATH="$ROOT_DIR/build/src/android/platforms/android/build/outputs/apk"

APK_UNALIGNED="$APK_PATH/android-armv7-$1-unaligned.apk"
APK_FINAL="$APK_PATH/android-armv7-$1.apk"

LIB_URL="https://github.com/uProxy/webrtc-mod/releases/download/v22.1/libxwalkcore.so"
if [ -z "$TMPDIR" ]; then TMPDIR="/tmp"; fi
LIB_PATH="lib/armeabi-v7a"
LIB_NAME="libxwalkcore.so"

# Download the crosswalk library into a temporary directory
mkdir -p "$TMPDIR/$LIB_PATH"
# -L ensures that curl follows the redirect
curl $LIB_URL -o "$TMPDIR/$LIB_PATH/$LIB_NAME" -L

# Replace the Crosswalk library inside the apk
jar -ufv $APK_UNALIGNED -C $TMPDIR "$LIB_PATH/$LIB_NAME"

# Delete the META-INF directory to allow re-signing
zip -d $APK_UNALIGNED "META-INF/*"

# Re-sign
if [ "$1" = "debug" ]; then
  KEY_DIR="$HOME/.android"
  storeFile="debug.keystore"
  storePassword="android"
  keyAlias="androiddebugkey"
  keyPassword="android"
elif [ "$1" = "release" ]; then
  # Release owners should symlink the key directory onto keys/
  KEY_DIR="keys"
  # Load $storeFile, $storePassword, $keyAlias, and $keyPassword
  source "$KEY_DIR/android-release-keys.properties"
else
  echo "Unknown build type $1"
  exit 1
fi

jarsigner -keystore "$KEY_DIR/$storeFile" -storepass $storePassword -keypass $keyPassword $APK_UNALIGNED $keyAlias

# Overwrite the aligned apk with a new one.  zipalign isn't on the path, and
# more than one might be installed, so first we have to pick one.
ZIPALIGN_TOOLS=( $ANDROID_HOME/build-tools/*/zipalign )
ZIPALIGN="${ZIPALIGN_TOOLS[${#ZIPALIGN_TOOLS[@]}-1]}"
$ZIPALIGN -f 4 $APK_UNALIGNED $APK_FINAL

