FROM soycode/uproxy-sshd

COPY banner /
RUN chmod 644 /banner
RUN chown giver: /banner

COPY hostname /
RUN chmod 644 /hostname
RUN chown giver: /hostname

RUN chown root:root /issue_invite.sh
RUN chmod 755 /issue_invite.sh
# http://ubuntuforums.org/showthread.php?t=1132821
RUN echo 'giver ALL=(root)NOPASSWD:/issue_invite.sh "",/issue_invite.sh -d *' > /etc/sudoers

RUN chown root:root /login.sh && chmod 755 /login.sh

RUN mkdir -p /var/run/sshd

EXPOSE 22
CMD /usr/bin/supervisord -n
