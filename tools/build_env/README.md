# Hermetic Build Environment (Beta)

This directory contains the files needed to create a Docker image that runs a
build environment for uProxy development without the need to install any tools
other than Docker. The only dependencies for the hermetic development
environment is Docker and the uProxy repository.

This allows us to reproduce the build the same way in any machine, and makes it
easier to set up the development environment for new uProxy developers.

## Usage

You first need to install Docker:
https://docs.docker.com/engine/installation/.

Then you will be calling `./tools/build_env/build_env.sh` to interact with the
build environment. You must **call `build_env.sh` from your uProxy repository
root** (where the .git directory is).

In the first usage, `build_env` will fetch `uproxy/build` Docker image tagged
with the value from `IMAGE_VERSION.txt`, if it's not yet in your machine. A new
image will also be fetch as needed whenever `IMAGE_VERSION.txt` is modified.

### Entering the environment

Use the `enter` command:
````
./tools/build_env/build_env.sh enter
````

This will:

1. Start a new Docker container with the `uproxy/build:<tag>` image
1. Run bash in the container
1. Delete the container when you are done

While inside the container, you can run any shell command, such as `grunt`.

### Running one-off commands

Use the `run` command:
````
./tools/build_env/build_env.sh run grunt --verbose build_chrome
````

## Updating the Image

If you make any changes that affect the build environment image, you must update
it:
````
./tools/build_env/build_env.sh update_image
````

This will create a new image with the changes and update the `IMAGE_VERSION.txt`
file.

If you pull an upstream change that also affects the image, you will get a
conflict on `IMAGE_VERSION.txt`. Resolve the conflict by calling `update_image`
after the pull.

Before submitting code that affects the image, you must publish the
corresponding image, so that the image is available available to other
developers:
````
docker login  # If you are not yet authenticated
./tools/build_env/build_env.sh publish_image
````

## Known Issues

1. Tests with Jasmine and PhantomJS are not working yet. We get some `property
'pid' not found` error.

1. Not every uProxy committer have permission to submit to the uproxy Docker
   repository.
