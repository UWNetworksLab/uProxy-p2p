# Build: docker build -t uproxy-dev .
# Run: docker run --rm -it -v ~/workspace/test/uProxy:/root/uProxy uproxy-grunt bash

FROM ubuntu

RUN apt-get update

RUN apt-get install -qqy git python build-essential

# Add a fresher repository for nodejs
RUN apt-get install curl && \
  curl -sL https://deb.nodesource.com/setup_4.x | bash - && \
  apt-get install -qqy nodejs && \
  apt-get purge -y --auto-remove curl

RUN npm install -g grunt-cli

WORKDIR /root/

# Installs node_modules/
COPY package.json .
RUN npm install

# Install build/third_party
COPY third_party/ build/third_party/
COPY bower.json .
RUN /root/node_modules/.bin/bower install --allow-root --config.interactive=false --config.directory=build/third_party/bower

RUN cd build/third_party && /root/node_modules/.bin/typings install
RUN mkdir -p build/third_party/freedom-port-control
RUN cp -r node_modules/freedom-port-control/dist build/third_party/freedom-port-control/

# Installs tools/
COPY src/lib/build-tools/*.ts build/tools/
RUN node_modules/.bin/tsc --module commonjs --noImplicitAny build/tools/*.ts

#COPY src/ src/
#COPY Gruntfile.coffee version.py ./

ENTRYPOINT ["grunt"]
