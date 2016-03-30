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

COPY banner /
RUN chmod 644 /banner
RUN chown giver: /banner

COPY hostname /
RUN chmod 644 /hostname
RUN chown giver: /hostname

COPY issue_invite.sh /
RUN chown root:root /issue_invite.sh
RUN chmod 755 /issue_invite.sh
# http://ubuntuforums.org/showthread.php?t=1132821
RUN echo 'giver ALL=(root)NOPASSWD:/issue_invite.sh "",/issue_invite.sh -d *' > /etc/sudoers

COPY login.sh /
RUN chown root:root /login.sh && chmod 755 /login.sh

COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf

RUN mkdir -p /var/run/sshd

EXPOSE 22
CMD /usr/bin/supervisord -n
