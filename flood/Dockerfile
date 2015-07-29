FROM ubuntu:15.04
MAINTAINER Trevor Johnston <trevj@google.com>

RUN apt-get update -qq
RUN apt-get install -y nmap pv

EXPOSE 1224

COPY flood.sh /flood.sh
ENTRYPOINT ["/flood.sh"]
