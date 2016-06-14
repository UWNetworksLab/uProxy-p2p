# Hermetic Grunt

This directory contains the files needed to create a Docker image that runs
grunt without the need to install any tools other than Docker.

This allows us to reproduce the build the same way in any machine, and makes it
easier to set up the development environment for new uProxy developers.

## Usage

You first need to install Docker: https://docs.docker.com/engine/installation/.

Then, **from your uProxy repository root** (where the .git directory is), run:
````
docker build -f tools/hermetic_grunt/Dockerfile -t hermetic-grunt . &&
docker run --rm -v $(pwd):/root/repository_root -it hermetic-grunt
````

This will build the Docker image and then run grunt.

You can pass regular grunt parameters to the run call:
````
docker run --rm -v $(pwd):/root/repository_root -it hermetic-grunt --verbose build_chrome
````

### Details

The `docker build` command builds a new image named `hermetic-grunt` according
to the `tools/hermetic_grunt/Dockerfile` specification. It uses the current
directory as the source for `COPY` commands.

The `docker run` command starts a new Docker container using the
`hermetic-grunt` image and runs grunt. The current host directory is
mounted as `/root/repository_root` in the container. The container is deleted
when grunt is done (`--rm`).

## Image Caching

The first time the command is run, the image will be built from scratch, which
takes a couple of minutes. Subsequent calls will use the cached image and be
much faster. If you make changes that affect the image, it will be rebuilt.

Notice that the image cache key is the image name. So if you are working on
branches with differing files that affect the image, you will be rebuilding the
image multiple times. In that case you may want to give them different names,
based on your branch.
