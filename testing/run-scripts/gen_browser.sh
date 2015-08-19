#!/bin/bash

#
# setup_browser.sh - Generate commands to download a web browser (by type and version) for a docker image.
#
# Usage:
#   setup_browser.sh type version
#    - Type: 'chrome' or 'firefox'
#    - Version: 'stable' or 'beta' or 'canary'

source "${BASH_SOURCE%/*}/utils.sh" || (echo "cannot find utils.sh" && exit 1)

# $1 is the version
function get_chrome () {
  DRIVERURL=https://chromedriver.storage.googleapis.com/$(wget -qO- https://chromedriver.storage.googleapis.com/LATEST_RELEASE)/chromedriver_linux64.zip
  
  case $1 in
      stable)
          URL=https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb
          ;;
      beta)
          URL=https://dl.google.com/linux/direct/google-chrome-beta_current_amd64.deb
          ;;
      canary)
          URL=https://dl.google.com/linux/direct/google-chrome-unstable_current_amd64.deb
          ;;
      *)
          log "Unknown chrome version $1. Options are stable, beta, and canary."
          exit 1
          ;;
  esac
          cat <<EOF
RUN echo BROWSER=chrome >/etc/test.conf
ADD $DRIVERURL /tmp/driver.zip
RUN unzip -qq /tmp/driver.zip -d /usr/bin
RUN wget $URL -O /tmp/chrome.deb
RUN dpkg -i /tmp/chrome.deb
EOF
}

function get_localchrome () {
    # validate the path.   
    case $1 in
        stable)
            VERSION=release    
            chrome_build_path Release
            ;;
        debug)
            VERSION=debug
            chrome_build_path Debug
            ;;
        *)
            log "Unknown localchrome version $1. Options are stable and debug."
            exit 1
            ;;
    esac
    # localchrome is an additional mount at runtime, into
    # /test/chrome.  Just generate a wrapper script here.
        cat <<EOF
RUN echo BROWSER=chrome >/etc/test.conf
RUN echo '#!/bin/bash' >/usr/bin/google-chrome; echo 'pushd /test/chrome; ./chrome --no-sandbox \$@' >>/usr/bin/google-chrome ; chmod +x /usr/bin/google-chrome
EOF
}

function get_firefox () {
    case $1 in
        stable)
            URL=https://ftp.mozilla.org/pub/mozilla.org/firefox/releases/latest/linux-x86_64/en-US/
            PATTERN='*.tar.bz2'
            ;;
        beta)
            URL=https://ftp.mozilla.org/pub/mozilla.org/firefox/releases/latest-beta/linux-x86_64/en-US/
            PATTERN='*.tar.bz2'
            ;;
        canary)
            URL=https://ftp.mozilla.org/pub/mozilla.org/firefox/nightly/latest-mozilla-aurora/
            PATTERN='*linux-x86_64.tar.bz2'
            ;;
        *)
            log "Unknown firefox version $1. Options are stable, beta, and canary."
            ;;
    esac
    cat <<EOF
RUN echo BROWSER=firefox >/etc/test.conf
RUN cd /tmp ; mkdir ff ; cd ff ; wget -r -l1 -np -nd -A '$PATTERN' $URL
RUN cd /usr/share ; tar xf /tmp/ff/*.bz2
RUN ln -s /usr/share/firefox/firefox /usr/bin/firefox
RUN npm install jpm -g
EOF

}
case $1 in
    chrome)
        get_chrome $2
        ;;
    firefox)
        get_firefox $2
        ;;
    localchrome)
        get_localchrome $2 $3
        ;;
    *)
        log "Unknown browser $1.  Options are chrome, localchrome, and firefox."
        exit 1
esac
