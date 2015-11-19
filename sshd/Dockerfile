FROM ubuntu:trusty
MAINTAINER Trevor Johnston <trevj@google.com>

RUN apt-get update -qq
RUN apt-get install -y openssh-server supervisor dnsutils jq

RUN addgroup giver
RUN adduser --disabled-password --gecos 'uProxy Giver' --ingroup giver giver
RUN addgroup getter
RUN adduser --disabled-password --gecos 'uProxy Getter' --ingroup getter getter

COPY banner /
RUN chmod 644 /banner
RUN chown giver: /banner

COPY issue_invite.sh /
RUN chown root:root /issue_invite.sh
RUN chmod 755 /issue_invite.sh
# http://ubuntuforums.org/showthread.php?t=1132821
RUN echo 'giver ALL=(root)NOPASSWD:/issue_invite.sh "",/issue_invite.sh -d *' > /etc/sudoers

ARG issue_invite_args
RUN /issue_invite.sh -u giver $issue_invite_args > /initial-giver-invite-code

COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf

RUN mkdir -p /var/run/sshd

EXPOSE 22
CMD /usr/bin/supervisord -n
