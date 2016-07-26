FROM phusion/baseimage:0.9.19

RUN apt-get update -qq
RUN curl -sL https://deb.nodesource.com/setup_4.x | bash
RUN apt-get install -y nodejs build-essential git-all

ARG SERVER_FILES=freedom-social-quiver-server
COPY ${SERVER_FILES} /quiver/freedom-social-quiver-server/

EXPOSE 3000

ENTRYPOINT PORT=3000 DEBUG=stats node /quiver/freedom-social-quiver-server/app.js