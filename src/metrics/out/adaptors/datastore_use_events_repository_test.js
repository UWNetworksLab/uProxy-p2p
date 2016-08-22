"use strict";
//let gcloud = require("gcloud");
/*
console.log("Creating repository");

let repo = new DatastoreUseEventsRepository(gcloud().datastore({
  projectId: "uproxy-metrics",
  namespace: "test"
}));

console.log("Inserting entries");
let insertions = [
  ["2016-07-01", "2016-06-01"],
  ["2016-08-01", "2016-07-01"],
  ["2016-09-01", "2016-08-01"]
].map((pair) => {
  return repo.recordUseEvent(umr.eventDatefromString(pair[0]), umr.eventDatefromString((pair[1])));
});

Promise.all(insertions).then(() => {
  console.log("Insertion successful")
  repo.getUniqueClients(umr.eventDatefromString("2016-06-02"), umr.eventDatefromString("2016-07-02")).then((num_users) => {
    console.log("Unique users: %d", num_users);
  }, (error) => {
    throw new Error(error);
  })
});
*/
// console.log("Sending record request");
// repo.recordUse("2016-07-21", "2016-04-19", function(error) {
//   if (error) {
//     return console.error(error);
//   }
//   console.log("Success!");
// });
