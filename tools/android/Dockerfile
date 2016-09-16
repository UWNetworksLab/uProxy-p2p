FROM ubuntu:xenial
LABEL description="Docker container for building uProxy for Android"

# Install Node.js.
RUN apt-get update
RUN apt-get install -y curl
RUN curl -sL https://deb.nodesource.com/setup_4.x | bash -
RUN apt-get install -y nodejs

# Without this, NPM 2.x silently drops install/postinstall scripts:
#   https://github.com/nodejs/docker-node/issues/93
RUN echo 'unsafe-perm = true' > /root/.npmrc

RUN npm install -g grunt-cli

# Android!
RUN apt-get install -y openjdk-8-jdk

RUN apt-get install -y wget
RUN cd /opt && \
    wget http://dl.google.com/android/android-sdk_r24-linux.tgz && \
    tar xvf android-sdk_r24-linux.tgz
ENV PATH ${PATH}:/opt/android-sdk-linux/tools:/opt/android-sdk-linux/platform-tools
ENV ANDROID_HOME /opt/android-sdk-linux

# required by cca 
RUN apt-get install -y git

# we need android-23 and android-24 - right now android-24 is the default, so not explicitly available 
RUN echo y | android update sdk --no-ui --all --filter android-23

# build tool versions:
# android list sdk -a -e|grep -i build-tools
# pick the latest that is not obsoleted.
RUN echo y | android update sdk --no-ui --all --filter build-tools-23.0.1

# extra-google-m2repository -> Google Repository
RUN echo y | android update sdk --no-ui --all --filter extra-google-m2repository

# extra-android-m2repository -> Android Support Repository
RUN echo y | android update sdk --no-ui --all --filter extra-android-m2repository

# NDK
#   https://developer.android.com/ndk/downloads/index.html

RUN apt-get install -y unzip
RUN wget -O /opt/android-ndk.zip http://dl.google.com/android/repository/android-ndk-r12b-linux-x86_64.zip && \
    unzip /opt/android-ndk.zip -d /opt
ENV PATH ${PATH}:/opt/android-ndk-r12b

RUN apt-get install -y make
RUN apt-get install -y libc6-i386 lib32z1 lib32gcc1

# # replace_xwalk_in_apk.sh
RUN apt-get install -y zip
