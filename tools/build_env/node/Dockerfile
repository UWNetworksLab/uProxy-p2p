# Carefully crafted, frequently updated minimal Node.js images:
#   https://github.com/mhart/alpine-node
FROM mhart/alpine-node:4.4.7
LABEL description="Docker container for uProxy build environment"

# Some of our NPMs require git in order to install.
RUN apk update
RUN apk add git

RUN npm install -g --production grunt-cli yarn

# Without this, NPM 2.x silently drops install/postinstall scripts:
#   https://github.com/nodejs/docker-node/issues/93
RUN echo 'unsafe-perm = true' > /root/.npmrc
