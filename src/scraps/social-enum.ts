// Status of a client; used for both this client (in which case it will be
// either ONLINE or OFFLINE)
module freedom.Social {
  export enum Status {
    OFFLINE = 4000,
    // This client runs the same freedom.js app as you and is online
    ONLINE,
    // This client is online, but not with the same application/agent type
    // (i.e. can be useful to invite others to your freedom.js app)
    ONLINE_WITH_OTHER_APP,
  }
}

