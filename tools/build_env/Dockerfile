# See README.md file for how this image is used.

FROM ubuntu:trusty

LABEL description="Docker container for uProxy build environment"

###############################################################################
# Install prerequisite global tools
###############################################################################
USER root

ADD https://deb.nodesource.com/setup_4.x /tmp/add_nodejs_repository.sh
ADD https://dl-ssl.google.com/linux/linux_signing_key.pub /tmp/google_key.pub
RUN bash /tmp/add_nodejs_repository.sh && \
    apt-key add /tmp/google_key.pub && \
    echo "deb https://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list && \
    apt-get -qq update && \
    apt-get install -qq git google-chrome-stable nodejs python xvfb && \
    apt-get -qq autoremove && \
    apt-get -qq clean && \
    npm install -g grunt-cli && \
    npm cache clean && \
    rm -rf /tmp/*

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

RUN npm install && npm cache clean && rm -rf /tmp/*

# Remove files we don't need anymore.
RUN rm -rf bower.json setup.sh src

###############################################################################
# Setup grunt entry point
###############################################################################

ENV REPOSITORY_ROOT /root/repository_root
COPY tools/build_env/entrypoint.sh .
RUN chmod +x entrypoint.sh
ENTRYPOINT ["./entrypoint.sh"]
