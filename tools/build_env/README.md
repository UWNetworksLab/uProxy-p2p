# Hermetic Build Environment (Beta)

This directory contains the files needed to create a Docker image that runs a
build environment for uProxy development. No other tools are needed.

This allows us to reproduce the build the same way in any machine and makes it
easier to set up the development environment for new uProxy developers.

This approach is based on [Microcontainers](https://www.iron.io/microcontainers-tiny-portable-containers/), using [mhart's Node.js images](https://github.com/mhart/alpine-node).

## Usage

First, install Docker:
https://docs.docker.com/engine/installation/

Thereafter, you just need to add this prefix to your commands: `./tools/build_env/build_env.sh`

So, to install dependencies and build uProxy for Chrome:
```bash
./tools/build_env/build_env.sh npm install
./tools/build_env/build_env.sh npm run grunt build_chrome
```

What's happening when you use this "script prefix"? Roughly:

 1. Starts a new Docker container, fetching the `uproxy/build-default` image from Docker Hub if necessary.
 1. Runs the specified command in the container.
 1. Makes you the owner of all files in the repository (because commands in the container run as `root`, any new files created in the previous step will be owned by `root`).
 1. Deletes the container.

### Android

**This image won't work for `build_android`.** The Android tools are **huge**: we maintain a separate image for Android development.

It's named `uproxy/build-android` and can be used via `-v`, e.g.:
```bash
./tools/build_env/build_env.sh -v android npm run grunt build_chrome
```

## Updating the Image

Build the image locally:

```bash
./tools/build_env/build_env.sh -b
```

Upload to Docker Hub:
```bash
./tools/build_env/build_env.sh -p
```

The `-b` and `-p` switches may be used together but please test before uploading to Docker Hub.

**Note: Add `-t android` for Android builds.**
