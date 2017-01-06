FROM alpine:3.5

RUN apk update
RUN apk add openssh supervisor

RUN addgroup getter
RUN adduser -s /bin/sh -D -G getter -g uProxy getter
RUN mkdir -p /home/getter/.ssh

# sshd running without UsePAM, which is the case in Alpine, interprets
# passwords of ! in /etc/shadow as *disabled* rather than passwordless.
# This prevents key-based authentication from working for the user.
# To make it work we can set the password to *. This is safe because *
# cannot be the hash of any real password.
RUN echo getter:* | chpasswd -e

COPY issue_invite.sh /
RUN chown root:root /issue_invite.sh
RUN chmod 755 /issue_invite.sh

COPY login.sh /
RUN chown root:root /login.sh && chmod 755 /login.sh

RUN mkdir /etc/supervisor.d/
COPY sshd.ini /etc/supervisor.d/

EXPOSE 22
CMD /usr/bin/supervisord -n
