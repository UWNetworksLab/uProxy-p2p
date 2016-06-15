# Script to help testing and debugging changes to the Docker image.
# When run, it will run bash in a container with the built image.
image_name=${GRUNT_IMAGE:-hermetic-grunt}
docker build -f $(dirname $0)/Dockerfile -t $image_name . &&
docker run --rm --entrypoint=bash -it $image_name
