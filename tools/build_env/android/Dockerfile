# Many of the Android build tools require glibc and are
# built for 32 bit systems. Running such binaries is a
# lot easier on Ubuntu than on Alpine.  
FROM ubuntu:xenial
LABEL description="Docker container for building uProxy for Android"

RUN apt-get update
RUN apt-get install -y curl unzip \
# Android SDK.
openjdk-8-jdk \
# CCA.
git \
# NDK.
make libc6-i386 lib32z1 lib32gcc1 \
# replace_xwalk_in_apk.sh.
zip

# Node.js.
RUN curl -sL https://deb.nodesource.com/setup_4.x | bash -
RUN apt-get install -y nodejs

# Without this, NPM 2.x silently drops install/postinstall scripts:
#   https://github.com/nodejs/docker-node/issues/93
RUN echo 'unsafe-perm = true' > /root/.npmrc

# Android SDK.
# Since the command-line tools are not well documented,
# these steps are cobbled together from trial and error,
# hunting around online, and old pinball machine parts.
# Bitrise, in particular, maintain a bunch of Docker
# images for Android development:
#   https://github.com/bitrise-docker/android 
RUN curl -o /tmp/android-sdk.tgz http://dl.google.com/android/android-sdk_r24-linux.tgz && \
    tar xvf /tmp/android-sdk.tgz -C /opt && \
    rm /tmp/android-sdk.tgz
ENV PATH ${PATH}:/opt/android-sdk-linux/tools:/opt/android-sdk-linux/platform-tools
ENV ANDROID_HOME /opt/android-sdk-linux

# We need versions 23 and 24 of the Android SDK.
# 24 is the latest (as of September 2016) and bundled
# with the above download, and for some reason unavailable
# for installation via this method.
RUN echo y | android update sdk --no-ui --all --filter android-23

# Android SDK Build Tools:
#   https://developer.android.com/studio/releases/build-tools.html
# We just need the latest version; run this command and find the
# most recent version that hasn't been obsoleted:
#   android list sdk -all --extended
RUN echo y | android update sdk --no-ui --all --filter build-tools-23.0.1

# Google Repository.
# There seems to only be one version available at any given time.
RUN echo y | android update sdk --no-ui --all --filter extra-google-m2repository

# Android Support Repository.
# Again, this doesn't seem to be versioned.
RUN echo y | android update sdk --no-ui --all --filter extra-android-m2repository

# Android NDK.
# Find the latest download here:
#   https://developer.android.com/ndk/downloads/index.html
RUN curl -o /tmp/android-ndk.zip http://dl.google.com/android/repository/android-ndk-r12b-linux-x86_64.zip && \
    unzip /tmp/android-ndk.zip -d /opt && \
    rm /tmp/android-ndk.zip
ENV PATH ${PATH}:/opt/android-ndk-r12b
