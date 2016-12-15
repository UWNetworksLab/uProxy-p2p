FROM alpine:edge

RUN apk update
RUN apk add socat

COPY flood.sh /flood.sh
ENTRYPOINT ["/flood.sh"]
