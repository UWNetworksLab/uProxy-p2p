# src/chrome/

This is the source directory for all Chrome-specific uProxy code.


## The App & Extension split

At the moment, uProxy for Chrome is split into two components -
the **App** and the **Extension**. This is required because Chrome offers
different sets of browser permissions for 'Apps' and 'Extensions', and uProxy
requires all of them.

To achieve this end, there needs to be consistent communications
between both pieces. This is done using
[chrome Ports](https://developer.chrome.com/extensions/runtime#type-Port) which
allow messaging between pieces. **App** corresponds to uProxy's **Core**,
and the **Extension** corresponds to the uProxy's **UI**.

Hopefully in the future this split can be remedied so
that users will have a much simpler time for just a single installation.


## Directories

`app/` contains the Chrome App component of uProxy Chrome. The primary uProxy
Core is contained within the App. (See `src/generic_core`)

`extension/` contains the Chrome Extension component of uProxy Chrome. This is
primarily the UI part. (See `src/generic_Ui`).

`mocks/` contains testing mocks so that we can test the Chrome components of
uProxy with Jasmine. The Chrome APIs are not available in Jasmine, but they must
be mocked so that the code under test can function as expected. This includes
functionality like [chrome.runtime](https://developer.chrome.com/extensions/runtime)

`util/` contains code which is common to both the **App** and **Extension**.
This is primarily the communications requirements between the two parts - which
is implemented fully by both typescript's type-checking as well as the compiled
javascript for consistent *Enum* codes at runtime.
There are grunt tasks responsible for copying this into the target directories
in `build/chrome/app` and `build/chrome/extension`.
