#!/bin/bash
set -e # any error is a real error

# Note: this makes the assumption that we are bumping the minor version
# Note: totally experimental, but guaranteed to have worked at least once

function gitPush {
  git push $@
}

function enterDir {
  cd uproxy-release
}

function setup {
  # make a repo to stage the release in
  git clone git@github.com:uProxy/uproxy.git uproxy-release
  enterDir
}

function openPages {
  # Give us information on what the change is
  doOpen "https://github.com/uProxy/uproxy/compare/v$versionPrev...master"
  doOpen "https://drive.google.com/a/google.com/folderview?id=0B6oXFcuW01xTfnpSMjBVMWVKX0drZkVnWF9IeDZDeFlJR0dpaGdZbmZabDZ3bS1ZSFh2bVE&usp=sharing"
}

function makeBuilds {
  # do the build
  ./setup.sh install && grunt dist

  # make the zip files
  cd build/dist
  zip -r uproxy-chrome.zip chrome
  cd ../..

  python removekey.py
  cd build/dist/chrome
  zip -r uproxy-chrome-app.zip app
  zip -r uproxy-chrome-extension.zip extension
  cd ../../..

  echo "uproxy-chrome.zip and uproxy-firefox.xpi are now in uproxy-release/build/dist and are ready for testing"
  echo "uproxy-chrome-app.zip and uproxy-chrome-extension are now in uproxy-release/build/dist/chrome and ready for release"
}

function updateWithRelease {
  echo "Adding tag - please remember to update github release"
  git tag "v$version"
  gitPush origin "v$version"

  git checkout -b "version-$versionNext"
  python version.py "$versionNext"
  git add bower.json package.json src/chrome/app/manifest.json src/chrome/extension/manifest.json src/chrome/app/managed_policy_schema.json src/chrome/extension/managed_policy_schema.json src/firefox/package.json
  git commit -m "Bump versions"
  gitPush origin "version-$versionNext:version-$versionNext"

  doOpen "https://github.com/uProxy/uproxy/compare/version-$versionNext?expand=1"
  doOpen "https://github.com/uProxy/uproxy/releases/new"

  echo "All done!  Please remember to update the github release and make a pull request."
}

function getLatest {
  git pull
}

function goUp {
  cd ..
}

function getVersions {
  version=$(jq -r ".version" ./package.json)
  # http://stackoverflow.com/a/6245903
  versionPrev="${version%.*}.$((${version##*.}-1))"
  versionNext="${version%.*}.$((${version##*.}+1))"
}

function doOpen {
  if hash xdg-open 2>/dev/null; then
    xdg-open "$@"
  elif hash open 2>/dev/null; then
    open "$@"
  else
    echo "Please open $@ manually"
  fi
}

hash jq 2>/dev/null || {
  echo "Please install jq to use this script (we use it to get the version number)"
  exit 1
}

echo "What would you like to do?"
echo -e "Begin:
    I have done no work, I want to start the release process.  I promise I do
    not have a subdirectory named uproxy-release"
echo -e "Redo:
    Oops, we had a bug in the release!  I merged the changes into master
    upstream, let's pull that down and redo the build from that."
echo -e "Final:
    I am so awesome!  The version I have checked out in the uproxy-release
    directory is so awesome, and totally on the webstore, let's celebrate
    by pushing tags!"

select action in Begin Redo Final Abort; do
  case $action in
    Begin)
      setup
      getVersions
      makeBuilds
      openPages
      goUp
      ;;
    Redo)
      enterDir
      getVersions
      getLatest
      makeBuilds
      openPages
      goUp
      ;;
    Final)
      echo "Are you sure you are ready (have you uploaded the releases to the webstore)?"

      select result in Yes No; do
        if [ "$result" == "Yes" ]; then
          break
        else
          exit
        fi
      done

      enterDir
      getVersions
      updateWithRelease
      goUp
      ;;
    Abort)
      exit
      ;;
  esac
done
