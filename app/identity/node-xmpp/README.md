Node-XMPP. The Chrome Version
======

This project aims to compile a fully native Javascript xmpp client.
The technique is to port the [node-xmpp](https://github.com/astro/node-xmpp) project
by using a modified version of [node-browserify](https://github.com/substack/node-browserify).

This folder contains compilation support, and modifications to the standard
implementation.  Layout is as follows:

* Vagrantfile
    Descriptor for [Vagrant](http://vagrantup.com) to compile the product JS file in a clean VM
* Puppetfile
    Descriptor for puppet for what to do in a clean Vagrant VM to set up the proejct.
* manifests/
    Helper files for compilation of the source.  node-xmpp.pp defines the specific commands run in compilation.
* chrome-support/
    Overridden classes from the native version of node-xmpp.
  * rules.js
      Defines the transformations to node-xmpp.  Applied by [node-browserify-override](https://github.com/willscott/node-browserify-override)

Todo
----

* Efficiency

    In particular, the current implementation of sockets & streams uses the buffer-browserify implementation of buffers, which are stored as javascript arrays.  Storing this data as ArrayBuffers would be preferable.

* SSL

    Browserify does not implement the TLS class, currently causing failures.
    This can potentially be implemented using [Forge](https://github.com/digitalbazaar/forge)
    or alternatively, could be exposed by chrome ([Bug](https://code.google.com/p/chromium/issues/detail?id=132896))
