FROM library/ubuntu:trusty

RUN apt-get update -qq
RUN apt-get install -y openssh-server supervisor dnsutils jq unattended-upgrades

RUN addgroup giver
RUN adduser --disabled-password --gecos 'uProxy Giver' --ingroup giver giver
RUN mkdir -p /home/giver/.ssh && chown -R giver: /home/giver/.ssh
RUN touch /home/giver/.ssh/authorized_keys && chown giver: /home/giver/.ssh/authorized_keys

RUN addgroup getter
RUN adduser --disabled-password --gecos 'uProxy Getter' --ingroup getter getter
RUN mkdir -p /home/getter/.ssh && chown -R getter: /home/getter/.ssh
RUN touch /home/getter/.ssh/authorized_keys && chown getter: /home/getter/.ssh/authorized_keys

COPY issue_invite.sh /
COPY login.sh /
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf