# Many of the Android build tools require glibc and are
# built for 32 bit systems. Running such binaries is a
# lot easier on Ubuntu than on Alpine.  
FROM ubuntu:xenial
LABEL description="Docker container for building uProxy for Android"

RUN apt-get update
RUN apt-get install -y curl unzip \
# For installing phantomjs via NPM.
bzip2 \
# Android SDK.
openjdk-8-jdk \
# CCA.
git \
# NDK.
make libc6-i386 lib32z1 lib32gcc1 \
# replace_xwalk_in_apk.sh.
zip

# Node.js.
RUN curl -sL https://deb.nodesource.com/setup_6.x | bash -
RUN apt-get install -y nodejs

# Without this, NPM silently drops install/postinstall scripts:
#   https://github.com/nodejs/docker-node/issues/93
RUN echo 'unsafe-perm = true' > /root/.npmrc

RUN npm install -g --production grunt-cli yarn

# Android SDK:
#   https://developer.android.com/studio/index.html#downloads
# Since the command-line tools are poorly documented, these
# steps are cobbled together from lots of trial and error,
# old pinball machine parts, and various Dockerfiles lying
# around Github. In particular, Bitrise, maintain some Docker
# images with a bunch of good hints:
#   https://github.com/bitrise-docker/android 
RUN curl -o /tmp/android-sdk.tgz http://dl.google.com/android/android-sdk_r24.4.1-linux.tgz && \
    tar xvf /tmp/android-sdk.tgz -C /opt && \
    rm /tmp/android-sdk.tgz
ENV PATH ${PATH}:/opt/android-sdk-linux/tools:/opt/android-sdk-linux/platform-tools
ENV ANDROID_HOME /opt/android-sdk-linux

# Android SDK Build Tools:
#   https://developer.android.com/studio/releases/build-tools.html
# We just need the latest version - unfortunately, there's no
# short-hand alias, To find the latest version's label:
#   android list sdk --all --extended|grep build-tools
RUN echo y | android update sdk --no-ui --all --filter build-tools-25.0.0

# We need version 23 of the Android SDK.
RUN echo y | android update sdk --no-ui --all --filter android-23

# Google Repository.
RUN echo y | android update sdk --no-ui --all --filter extra-google-m2repository

# Android Support Repository.
RUN echo y | android update sdk --no-ui --all --filter extra-android-m2repository

# Google Play services.
RUN echo y | android update sdk --no-ui --all --filter extra-google-google_play_services

# Android NDK:
#   https://developer.android.com/ndk/downloads/index.html
RUN curl -o /tmp/android-ndk.zip http://dl.google.com/android/repository/android-ndk-r13-linux-x86_64.zip && \
    unzip /tmp/android-ndk.zip -d /opt && \
    rm /tmp/android-ndk.zip
ENV PATH ${PATH}:/opt/android-ndk-r13
