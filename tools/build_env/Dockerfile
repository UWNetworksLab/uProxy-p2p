# Carefully crafted, frequently updated minimal Node.js images:
#   https://github.com/mhart/alpine-node
FROM mhart/alpine-node:4.4.7
LABEL description="Docker container for uProxy build environment"

# Some of our NPMs require git in order to install.
RUN apk update
RUN apk add git

RUN npm install -g grunt-cli

# Without this, NPM 2.x silently drops install/postinstall scripts:
#   https://github.com/nodejs/docker-node/issues/93
RUN echo 'unsafe-perm = true' > /root/.npmrc

# Android!
RUN apk update
RUN apk add openjdk8 bash

ENV PATH ${PATH}:/opt/android-sdk-linux/tools
ENV ANDROID_HOME /opt/android-sdk-linux

# build tool versions:
# android list sdk -a -e|grep -i build-tools
# pick the latest that is not obsoleted.

# TODO: how to pipe in multiple ys

RUN mkdir /opt && cd /opt && \
    wget http://dl.google.com/android/android-sdk_r24-linux.tgz && \
    tar xvf android-sdk_r24-linux.tgz

RUN echo y | android update sdk --no-ui -a --filter android-23,android-24,build-tools-23.0.1 --no-https

# extra-google-m2repository -> Google Repository
RUN echo y | android update sdk --no-ui -a --filter extra-google-m2repository --no-https

# extra-android-m2repository -> Android Support Repository
RUN echo y | android update sdk --no-ui -a --filter extra-android-m2repository --no-https

# TODO: why does java get a symlink but not this?
RUN ln -s /usr/lib/jvm/default-jvm/bin/javac /usr/bin/javac

# NDK
# https://developer.android.com/ndk/downloads/index.html
RUN apk add make file gawk
ENV NDK_HOST_AWK /usr/bin/awk
RUN wget -O /opt/android-ndk.zip http://dl.google.com/android/repository/android-ndk-r12b-linux-x86_64.zip && \
    unzip /opt/android-ndk.zip -d /opt
# argh, no wildcards
ENV PATH ${PATH}:/opt/android-ndk-r12b

# TODO: ugh, /opt/android-ndk-r12b/toolchains/arm-linux-androideabi-4.9/prebuilt/linux-x86_64/bin/arm-linux-androideabi-gcc depends on glibc :-/
# even this trick doesn't work:
# https://hub.docker.com/r/redventures/docker-alpine/~/dockerfile/
# cd build/src/android/platforms/android/cordova-plugin-tun2socks/
# ndk-build

# AHA:
# https://github.com/sgerrand/alpine-pkg-glibc

# replace_xwalk_in_apk.sh
RUN apk add curl zip
RUN ln -s /usr/lib/jvm/default-jvm/bin/jar /usr/bin/jar
RUN ln -s /usr/lib/jvm/default-jvm/bin/jarsigner /usr/bin/jarsigner

# TODO: how to get zipalign (32 bit, statically linked) to run?
