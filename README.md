# Docker Images

This is a repository of stock docker images for our use, and scripts that build/use them.

# TL;DR
  Docker creates a very lightweight version of a virtual machine[1] (VM).  The scripts here create VMs with different versions of chrome, firefox, and uproxy (`uproxy-lib`, the backend), and do different things with that, including launching a pair of VMs that connect via uproxy and form a proxy.
  
  We can add new scripts and new configurations (web browsers, network performance attributes, NAT types, etc) as we desire.  It runs on Linux, MacOS X, and Windows.  The last two using an actual virtual machine system.

# Concepts
 * *Docker Image* - A file[2] storing a runnable image of a docker VM[1].  Think of this like a bootable `.iso` file.
 * *Docker Container* - A running instance of a docker VM, based on a specified image.  Any files written are saved in that container.  By default, when the last process of a container exits, the written/modified files of the container are kept.  You'll probably want to clear these out once in a while.
 * *Browser Spec* - A uproxy-docker specific format for specifying a browser and version.  Super simple: `chrome`, `localchrome`, or `firefox` as the browser, a dash (-), and a relative version:
   * `stable`, `beta`, `canary` for `chrome` or `firefox`
   * `debug` or release for `localchrome`
   Examples include `chrome-stable` and `firefox-beta`. 

# Script Directory
 There are lots more scripts in here, but some of those are (a) in-progress or (b) components used by the scripts listed here:
 * `testing/run-scripts/run_pair.sh` - Makes docker images and launches a full proxy example.  Run this by itself and it'll do everything else you need. Example Use:
> run_pair.sh chrome-stable chrome-beta

 * `testing/run-scripts/image_make.sh` - Make a docker image with the specified browser and version.  Example use:
> image_make.sh chrome-beta

 * `testing/run-scripts/connect-pair.py` - Connect two running copies of the uproxy adventure examples together.  They should be listening to their default ports of 9000 and 9010.

# Local Chrome
 A special `localchrome` target will use a locally-built chrome binary.  Set the environment variable `CHROME_BUILD_DIR` to your `src/` directory, and specify `debug` or `release` as versions.  These will correspond to `out/Debug`, and `out/Release`.
 
# Footnotes: Lies I've just told you
 1. Docker doesn't create actual VMs.  They're regular linux processes, but with their filesystem and networking access heavily modified.  Super, super light weight.
 2. Docker images aren't single files.  They're a collection of files that each represent a filesystem image. Docker assembles them together (via mount) into a single directory tree.  You don
