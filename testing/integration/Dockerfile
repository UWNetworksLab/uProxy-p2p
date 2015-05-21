FROM ubuntu:14.04

MAINTAINER Lally Singh <lally.singh@gmail.com>

ENV LC_ALL C
ENV DEBIAN_FRONTEND noninteractive
ENV DEBCONF_NONINTERACTIVE_SEEN true

RUN apt-get update -qq -y && apt-get install -qq -y \
  wget \
  x11vnc \
  libav-tools \
  xvfb \
  unzip \
  nodejs nodejs-dev npm \
  git \
  default-jre vnc4server aptitude  


# Install Chrome Beta
RUN wget -qO- https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add -
RUN echo 'deb http://dl.google.com/linux/chrome/deb/ stable main' >> /etc/apt/sources.list.d/google-chrome.list
RUN apt-get update -qq -y
RUN apt-get install -qq -y google-chrome-beta

RUN wget -q https://chromedriver.storage.googleapis.com/$(wget -qO- https://chromedriver.storage.googleapis.com/LATEST_RELEASE)/chromedriver_linux64.zip
RUN unzip -qq chromedriver_linux64.zip -d /usr/bin && rm chromedriver_linux64.zip
RUN chromedriver --version


EXPOSE 9000

