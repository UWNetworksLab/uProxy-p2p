# To build and run the hermetic grunt:
# docker build -f tools/hermetic_grunt/Dockerfile -t uproxy-grunt . && \
# docker run --rm -v $(pwd):/root/repository_root -it uproxy-grunt
#
# You have to run from the repository root. The output is written to the out/
# directory.

FROM ubuntu

LABEL description="Docker container for hermetic grunt runs"

###############################################################################
# Install prerequisite global tools
###############################################################################

RUN apt-get update

RUN apt-get install -qqy git python build-essential

# Add a fresher repository for nodejs
RUN apt-get install curl && \
  curl -sL https://deb.nodesource.com/setup_4.x | bash - && \
  apt-get install -qqy nodejs && \
  apt-get purge -y --auto-remove curl

RUN npm install -g grunt-cli

###############################################################################
# Set up prerequisite local tools
###############################################################################

ENV BUILD_ROOT /root/build_root
RUN mkdir -p $BUILD_ROOT
WORKDIR $BUILD_ROOT

# Install node_modules/
COPY package.json .
RUN npm install

# Install build/third_party
COPY third_party/ build/third_party/
COPY bower.json .
RUN node_modules/.bin/bower install --allow-root --config.interactive=false \
  --config.directory=build/third_party/bower

RUN cd build/third_party && $BUILD_ROOT/node_modules/.bin/typings install
RUN mkdir -p build/third_party/freedom-port-control
RUN cp -r node_modules/freedom-port-control/dist build/third_party/freedom-port-control/

# Install tools/
COPY src/lib/build-tools/*.ts build/tools/
RUN node_modules/.bin/tsc --module commonjs --noImplicitAny build/tools/*.ts

# Clean up all hidden files
RUN rm -rf .[^.] .??*

###############################################################################
# Setup grunt entry point
###############################################################################

ENV REPOSITORY_ROOT /root/repository_root
COPY tools/hermetic_grunt/entrypoint.sh build/tools
RUN chmod +x build/tools/entrypoint.sh
ENTRYPOINT ["./build/tools/entrypoint.sh"]
