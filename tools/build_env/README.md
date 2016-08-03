# Hermetic Build Environment (Beta)

This directory contains the files needed to create a Docker image that runs a
build environment for uProxy development. No other tools are needed.

This allows us to reproduce the build the same way in any machine and makes it
easier to set up the development environment for new uProxy developers.

## Usage

First, install Docker:
https://docs.docker.com/engine/installation/

Thereafter, you just need to add this prefix to your commands:
`docker run --rm -v "$PWD":/worker -w /worker uproxy/build`

So, to install dependencies and build uProxy for Chrome:
```bash
docker run --rm -v "$PWD":/worker -w /worker uproxy/build npm install
docker run --rm -v "$PWD":/worker -w /worker uproxy/build grunt build_chrome
```

You may wish to create an `alias` for the Docker prefix. What's happening when you use this prefix? Roughly:

 1. Starts a new Docker container, fetching the `uproxy/build` image from Docker Hub if necessary.
 1. Runs the specified command.
 1. Deletes the container.

## Updating the Image

Build the image locally:

```bash
docker build -t uproxy/build tools/build_env
```

Test, then upload to Docker Hub:
```bash
docker push uproxy/build
```
