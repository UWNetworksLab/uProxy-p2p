### Building and installing and running for Firefox

These are the steps to try uProxy in the Firefox browser.

- To run the add-on you need to have the Firefox add-on SDK installed.
Instructions can be found here: https://developer.mozilla.org/en-US/Add-ons/SDK/Tutorials/Installation
    - A quick way to get started is to download/extract the zip mentioned in "Prerequisites"

- Navigate inside the extracted add-on SDK folder and run `source bin/activate`

- Run `grunt build_firefox` from the root directory of the repository to compile

- Run `cd build/dev/firefox`

- Run `cfx run` and Firefox should launch with the uProxy add-on installed
