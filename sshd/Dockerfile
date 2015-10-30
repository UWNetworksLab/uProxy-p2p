FROM ubuntu:trusty
MAINTAINER Trevor Johnston <trevj@google.com>

RUN apt-get update -qq
RUN apt-get install -y openssh-server supervisor

RUN addgroup giver
RUN adduser --disabled-password --gecos 'uProxy Giver' --ingroup giver giver
COPY giverpw /
RUN echo giver:`cat /giverpw` | chpasswd

COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf

RUN mkdir -p /var/run/sshd

EXPOSE 22
CMD /usr/bin/supervisord -n
