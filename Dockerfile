# Dockerfile for a standard uproxy grunt test 

FROM selenium/node-chrome

MAINTAINER Lalon <klazizpro@gmail.com>

USER root

RUN apt-get update -qqy \
  && apt-get -qqy install \
    nodejs nodejs-legacy git npm 
   

RUN npm install -g grunt-cli
RUN npm install -g bower
ADD . /uproxy
WORKDIR /uproxy

RUN npm install

ENV DISPLAY :10

ENTRYPOINT ["/uproxy/tools/docker-entrypoint.sh"]
