var freedom;
(function (freedom) {
    // Status of a client; used for both this client (in which case it will be
    // either ONLINE or OFFLINE)
    (function (Social) {
        (function (Status) {
            Status[Status["OFFLINE"] = 4000] = "OFFLINE";

            // This client runs the same freedom.js app as you and is online
            Status[Status["ONLINE"] = 4001] = "ONLINE";

            // This client is online, but not with the same application/agent type
            // (i.e. can be useful to invite others to your freedom.js app)
            Status[Status["ONLINE_WITH_OTHER_APP"] = 4002] = "ONLINE_WITH_OTHER_APP";
        })(Social.Status || (Social.Status = {}));
        var Status = Social.Status;
    })(freedom.Social || (freedom.Social = {}));
    var Social = freedom.Social;
})(freedom || (freedom = {}));
