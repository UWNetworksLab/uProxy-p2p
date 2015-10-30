// This is identical to ssh2-streams' index.js except for SFTPStream.
// We do this because sftp.js contains a call to process.bindings
// that raises an error in the browser. This is safe because we don't
// actually care about using SFTP, it's just that ssh2's Client sets
// some constants to point to some of SFTPStream's constants.
module.exports = {
  SFTPStream: {},
  SSH2Stream: require('ssh2-streams/lib/ssh'),
  utils: require('ssh2-streams/lib/utils'),
  constants: require('ssh2-streams/lib/constants')
};
