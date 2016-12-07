#!/bin/bash
docker inspect -f '{{ .Config.Labels.date }}' $*
