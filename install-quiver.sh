#!/bin/sh

# Installs docker if needed, then starts a Quiver server in a Docker container,
# listening on port 80.


command_exists() {
  command -v "$@" > /dev/null 2>&1
}

do_install() {
  # Since we cannot currently use DigitalOcean's Docker slug, install Docker
  # if necessary. We also run a few other dependency checks to help those
  # running on unsupported systems. Note that git is *not* present by default
  # on DigitalOcean's Ubuntu 14.04 image: Docker's installer installs it. This
  # is why we check for Docker first, even though it may seem cleaner to test
  # for lighter-weight dependencies first.
  if ! command_exists docker
  then
    if [ "$USER" != "root" ]
    then
      echo "User must be root to install docker."
      exit 1
    fi
    echo "Docker not found, running Docker installer."
    curl -fsSL https://get.docker.com/ | sh
  fi

  docker run --restart=always --log-driver=syslog --log-opt tag=quiver --name uproxy-quiver -d -p 80:3000 uproxy/quiver
}

# Wrapped in a function for some protection against half-downloads.
do_install
