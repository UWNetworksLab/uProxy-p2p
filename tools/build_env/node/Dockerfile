# Carefully crafted, frequently updated minimal Node.js images:
#   https://github.com/mhart/alpine-node
FROM mhart/alpine-node:6
LABEL description="Docker container for uProxy build environment"

# Some of our NPMs require git in order to install.
RUN apk update
RUN apk add git

RUN npm install -g --production grunt-cli yarn
