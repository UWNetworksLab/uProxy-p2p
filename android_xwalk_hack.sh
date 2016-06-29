#!/bin/bash

# Get the directory where this script is and set ROOT_DIR to that path. This
# allows script to be run from different directories but always act on the
# directory of the project (which is where this script is located).
ROOT_DIR="$(cd "$(dirname $0)"; pwd)";

if [ "$1" = "debug" ]; then
  APK_FILE="$ROOT_DIR/build/dev/uproxy/android/platforms/android/build/outputs/apk/android-armv7-debug.apk"
elif [ "$1" = "release" ]; then
  APK_FILE="$ROOT_DIR/build/dist/android/platforms/android/build/outputs/apk/android-armv7-release.apk"
else
  echo "Unknown build type $1"
  exit 1
fi

LIB_URL="https://github.com/uProxy/uproxy/releases/download/v0.9.1/libxwalkcore.so"
if [ -z "$TMPDIR" ]; then TMPDIR="/tmp"; fi
LIB_PATH="lib/armeabi-v7a"
LIB_NAME="libxwalkcore.so"

# Download the crosswalk library into a temporary directory
mkdir -p "$TMPDIR/$LIB_PATH"
# -L ensures that curl follows the redirect
curl $LIB_URL -o "$TMPDIR/$LIB_PATH/$LIB_NAME" -L

# Replace the Crosswalk library inside the apk
jar -ufv $APK_FILE -C $TMPDIR "$LIB_PATH/$LIB_NAME"

# Delete the META-INF directory to allow re-signing
zip -d $APK_FILE "META-INF/*"

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

jarsigner -keystore "$KEY_DIR/$storeFile" -storepass $storePassword -keypass $keyPassword $APK_FILE $keyAlias
