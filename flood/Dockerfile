FROM ubuntu:trusty
MAINTAINER Trevor Johnston <trevj@google.com>

RUN apt-get update -qq
RUN apt-get install -y nmap

COPY flood.sh /flood.sh
ENTRYPOINT ["/flood.sh"]
