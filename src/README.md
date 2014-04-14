src
===

This is the primary uProxy source directory.
It (should) all be Typescript, which will compile to javascript in the build
directory.

The file `uproxy.ts` contains all common code which all components of
uProxy require in order for there to be consistency in how they interact with
each other.


directories
-----------

`generic_core` contains the primary functionality of uProxy, which deals mostly
with the network stack, signalling and consent, and local storage.

`generic_ui` contains the user-interface related portion of uProxy. This
involves Angular modules and controllers.

`chrome/` contains all the uProxy code specific to Chrome.

`firefox/` contains all the uProxy code specific to Firefox.

`uistatic/` contains all the uProxy code specific to Firefox.

`interfaces/` contains strictly `d.ts` files which declare Typescript
interfaces that allow type checking. These only provide compile-time checking -
they do not generate actual javascript files.

`interfaces/lib` contains third party `d.ts` files for quality type checking
with external libraries, i.e. from
[DefinitelyTyped](https://github.com/borisyankov/DefinitelyTyped).

`icons/` contains icons and similar assets.
