# See README.md file for how this image is used.

FROM selenium/node-chrome

LABEL description="Docker container for uProxy build environment"

###############################################################################
# Install prerequisite global tools
###############################################################################
USER root

ADD https://deb.nodesource.com/setup_4.x /tmp/add_nodejs_repository.sh
RUN bash /tmp/add_nodejs_repository.sh && \
    apt-get -qq update && \
    apt-get install -qq build-essential git nodejs python && \
    npm install -g grunt-cli

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

# Remove files we don't need anymore.
RUN rm -rf bower.json setup.sh src

###############################################################################
# Setup grunt entry point
###############################################################################

ENV REPOSITORY_ROOT /root/repository_root
COPY tools/build_env/entrypoint.sh .
RUN chmod +x entrypoint.sh
ENTRYPOINT ["./entrypoint.sh"]
