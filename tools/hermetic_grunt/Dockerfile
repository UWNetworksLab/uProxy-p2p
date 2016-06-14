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
# Install local build dependencies
###############################################################################

ENV BUILD_ROOT /root/build_root
RUN mkdir -p $BUILD_ROOT
WORKDIR $BUILD_ROOT

# Copy files needed by setup.sh install
COPY bower.json package.json setup.sh ./
COPY third_party third_party/
# TODO(fortuna): Move all build dependencies out of src/
COPY src/lib/build-tools src/lib/build-tools/

RUN ./setup.sh install

# Clean up all hidden files and src/
RUN rm -rf .[^.] .??* src

###############################################################################
# Setup grunt entry point
###############################################################################

ENV REPOSITORY_ROOT /root/repository_root
COPY tools/hermetic_grunt/entrypoint.sh build/tools
RUN chmod +x build/tools/entrypoint.sh
ENTRYPOINT ["./build/tools/entrypoint.sh"]
