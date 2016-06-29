#!/bin/bash

# Get the directory where this script is and set ROOT_DIR to that path. This
# allows script to be run from different directories but always act on the
# directory of the project (which is where this script is located).
ROOT_DIR="$(cd "$(dirname $0)"; pwd)";

APK_FILE="$ROOT_DIR/build/dev/uproxy/android/platforms/android/build/outputs/apk/android-armv7-debug.apk";
TEAM_DIR="/google/data/ro/teams/uproxy";
XWALK_DIR="$TEAM_DIR/crosswalk-plus-transform";
XWALK_LIB="lib/armeabi-v7a/libxwalkcore.so";

# Replace the Crosswalk library
jar -uf $APK_FILE -C $XWALK_DIR $XWALK_LIB

# Delete the META-INF directory to allow re-signing
zip -d $APK_FILE "META-INF/*"

# Re-sign
jarsigner -keystore "$HOME/.android/debug.keystore" -storepass android -keypass android $APK_FILE androiddebugkey

