#!/bin/bash

#
# setup_browser.sh - Generate commands to download a web browser (by type and version) for a docker image.
#
# Usage:
#   setup_browser.sh type version
#    - Type: 'chrome' or 'firefox'
#    - Version:
#      - For Chrome:
#        - dev
#        - release
#        - canary
#      - For Firefox:
#        - aurora
#        - beta
#        - release


# $1 is the version
function get_chrome () {
  DRIVERURL=https://chromedriver.storage.googleapis.com/$(wget -qO- https://chromedriver.storage.googleapis.com/LATEST_RELEASE)/chromedriver_linux64.zip
  
  case $1 in
      dev|DEV)
          URL=https://dl.google.com/linux/direct/google-chrome-beta_current_amd64.deb
          ;;
      rel|release|REL|RELEASE)
          URL=https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb
          ;;
      canary|CANARY)
          URL=https://dl.google.com/linux/direct/google-chrome-unstable_current_amd64.deb
          ;;
      *)
          echo "Unknown chrome version $1. Options are dev, rel(ease), and canary."
          exit 1
  esac
          cat <<EOF
RUN echo BROWSER=chrome >/etc/test.conf
ADD $DRIVERURL /tmp/driver.zip
RUN unzip -qq /tmp/driver.zip -d /usr/bin
RUN wget $URL -O /tmp/chrome.deb
RUN dpkg -i /tmp/chrome.deb
EOF
}

function get_firefox () {
    case $1 in
        aurora)
            URL=https://ftp.mozilla.org/pub/mozilla.org/firefox/nightly/$(date +%Y/%m/%Y-%m-%e-mozilla-aurora-debug)
            PATTERN='*linux-x86_64.tar.bz2'
            ;;
        beta)
            URL=https://ftp.mozilla.org/pub/mozilla.org/firefox/nightly/$(date +%Y/%m/%Y-%m-%e-mozilla-beta-debug)
            PATTERN='*linux-x86_64.tar.bz2'
            ;;
        rel|release)
            URL=https://ftp.mozilla.org/pub/mozilla.org/firefox/releases/latest/linux-x86_64/en-US/
            PATTERN='*.tar.bz2'
            ;;
        *)
            echo "Unknown firefox version $1.  Options are aurora, beta, and rel(ease)."
            ;;
    esac
    cat <<EOF
RUN echo BROWSER=firefox >/etc/test.conf
RUN cd /tmp ; mkdir ff ; cd ff ; wget -r -l1 --no-parent -A '$PATTERN' $URL
RUN cd /usr/share ; tar xf /tmp/ff/*/*/*/*/*/*/*/*/*.bz2
RUN ln -s /usr/share/firefox/firefox /usr/bin/firefox
RUN mkdir -p /tmp/jetpack ; cd /tmp/jetpack ; wget https://ftp.mozilla.org/pub/mozilla.org/labs/jetpack/jetpack-sdk-latest.tar.gz ; tar xvzf jetpack-sdk-latest.tar.gz
EOF

}
case $1 in
    chr|chrome|CHROME|Chrome)
        get_chrome $2
        ;;
    ff|firefox|FIREFOX|Firefox|FireFox)
        get_firefox $2
        ;;
    *)
        echo "Unknown browser $1.  Options are chrome and firefox."
        exit 1
esac
