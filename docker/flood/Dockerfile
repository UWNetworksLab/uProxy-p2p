FROM alpine:3.5

RUN apk update
RUN apk add socat

COPY flood.sh /flood.sh
ENTRYPOINT ["/flood.sh"]
