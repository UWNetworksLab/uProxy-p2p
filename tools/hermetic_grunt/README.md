# Hermetic Grunt (Beta)

This directory contains the files needed to create a Docker image that runs
grunt without the need to install any tools other than Docker. The only
dependencies for the hermetic grunt call is Docker and the uProxy repository.

This allows us to reproduce the build the same way in any machine, and makes it
easier to set up the development environment for new uProxy developers.

## Usage

You first need to install Docker: https://docs.docker.com/engine/installation/.

Then, **from your uProxy repository root** (where the .git directory is), run:
````
./tools/hermetic_grunt/hermetic_grunt.sh
````

This will:
1. Build a Docker image named `hermetic-grunt`
1. Start a new Docker container with that image
1. Run grunt in the container
1. Delete the container when done

You can pass regular grunt parameters to the call:
````
./tools/hermetic_grunt/hermetic_grunt.sh --verbose build_chrome
````

## Image Caching

The first time the command is run, the image will be built from scratch, which
takes a minute or so. Subsequent calls will use the cached image and be
much faster. If you make changes that affect the image, it will be rebuilt.

Notice that the image name globally identifies an image. So if you are working
on branches that modify files that affect the image, you will be rebuilding the
image whenever you switch branches. In that case you can specify the image name
by setting the `GRUNT_IMAGE` environment variable:
````
GRUNT_IMAGE=deps-change-grunt ./tools/hermetic_grunt/hermetic_grunt.sh
````

## Known Issues

1. Tests using the browser are not working yet. We need to install the browsers
and tweak the display port.

1. Every image build generates a bunch of intermediate images that take a lot of
disk space. You currently need to manually remove them. We need to find a better
way to not let them accumulate.
