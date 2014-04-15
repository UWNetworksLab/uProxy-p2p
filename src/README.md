src/
===

This is the primary uProxy source directory.
It is all **Typescript**, which will compile to javascript (in `build/`) via the
grunt tasks responsible for compilation.
No outputs from the compilation process will ever end up in this directory.


uproxy.ts
---------

The file `uproxy.ts` contains all common code for all components of
uProxy. This is required for consistency between the various components, whether
generic or platform specific. The grunt tasks relevant to the compilation
process from typescript to javascript are responsible for copying this file to
multiple places within `build/`.


Directories
-----------

`generic_core/` contains the primary functionality for uProxy - the parts which
do the actual proxying. This deals with the network stack, signalling, and
consent. It also manages the user's state and local storage.

`generic_ui/` contains the user-interface portion of uProxy. This is
mostly Angular modules and controllers, as well as the CSS (which is written in
Sass).

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
