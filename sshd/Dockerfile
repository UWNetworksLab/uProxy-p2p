FROM ubuntu:trusty
MAINTAINER Trevor Johnston <trevj@google.com>

RUN apt-get update -qq
RUN apt-get install -y openssh-server supervisor dnsutils

RUN addgroup giver
RUN adduser --disabled-password --gecos 'uProxy Giver' --ingroup giver giver
COPY giverpw /
RUN echo giver:`cat /giverpw` | chpasswd

RUN addgroup getter
RUN adduser --disabled-password --gecos 'uProxy Getter' --ingroup getter getter

COPY add_getter.sh /add_getter.sh
RUN chown root:root /add_getter.sh
RUN chmod 700 /add_getter.sh
RUN echo 'giver ALL=(ALL) NOPASSWD: /add_getter.sh' > /etc/sudoers

COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf

RUN mkdir -p /var/run/sshd

EXPOSE 22
CMD /usr/bin/supervisord -n
