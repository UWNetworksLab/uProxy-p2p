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
  openssh-server \
  git \
  default-jre vnc4server aptitude  

# Install sshd (might be useful)
# (pulled from https://docs.docker.com/examples/running_ssh_service/)
RUN apt-get update && apt-get install -y openssh-server
RUN mkdir /var/run/sshd
RUN echo 'root:screencast' | chpasswd
RUN sed -i 's/PermitRootLogin without-password/PermitRootLogin yes/' /etc/ssh/sshd_config
# SSH login fix. Otherwise user is kicked off after login
RUN sed 's@session\s*required\s*pam_loginuid.so@session optional pam_loginuid.so@g' -i /etc/pam.d/sshd
ENV NOTVISIBLE "in users profile"
RUN echo "export VISIBLE=now" >> /etc/profile


# Install Chrome Beta
RUN wget -qO- https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add -
RUN echo 'deb http://dl.google.com/linux/chrome/deb/ stable main' >> /etc/apt/sources.list.d/google-chrome.list
RUN apt-get update -qq -y
RUN apt-get install -qq -y google-chrome-beta

RUN wget -q https://chromedriver.storage.googleapis.com/$(wget -qO- https://chromedriver.storage.googleapis.com/LATEST_RELEASE)/chromedriver_linux64.zip
RUN unzip -qq chromedriver_linux64.zip -d /usr/bin && rm chromedriver_linux64.zip
RUN chromedriver --version

# Install Firefox Beta
RUN apt-key adv --recv-keys --keyserver keyserver.ubuntu.com 247510BE
RUN echo 'deb http://ppa.launchpad.net/ubuntu-mozilla-daily/firefox-aurora/ubuntu trusty main' >> /etc/apt/sources.list.d/firefox.list
RUN echo 'deb-src http://ppa.launchpad.net/ubuntu-mozilla-daily/firefox-aurora/ubuntu trusty main'  >> /etc/apt/sources.list.d/firefox.list
RUN apt-get update -qq -y
RUN apt-get install -qq -y firefox

# delete all the apt list files since they're big and get stale quickly
RUN rm -rf /var/lib/apt/lists/*

# Freedom-specific installs & hacks
RUN ln -s /usr/bin/nodejs /usr/bin/node; npm install -g grunt-cli; 

RUN mkdir /src
COPY src /src
RUN chmod +x /src/*

# Run sshd.
EXPOSE 22
EXPOSE 5900
CMD ["/usr/sbin/sshd", "-D"]
