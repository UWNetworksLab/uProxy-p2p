# copypaste-socks-chromeapp

This app runs a SOCKS proxy on port 9999, and allows two instances to
connect and proxy through one another. These instances can be run on
separate machines or on the same machine via Chrome profiles.

By default the signaling messages are unencrypted - if you click `Use
cryptography to sign/encrypt exchange?` before you get/give access,
then the messages will automatically be encrypted and signed with randomly
generated keypairs (one for each peer). You must then exchange
(copy/paste)  the public keys between the users before you exchange
the signaling messages. The signaling messages should have a PGP
Message header before you send them (this will happen automatically a
moment after generation if you've opted to use cryptography).

Note that for testing this does mean an increase from 2 total messages
to 4, but in actual use the public key exchange should only happen
once. Also note that in actual use the user ID should be set to
something meaningful, and ideally the passphrase should be a strong
secret known only by the user - however for this app both of those
would add more steps and so are not included.
