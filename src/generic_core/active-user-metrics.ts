/// <reference path='../../third_party/typings/index.d.ts' />

import logging = require('../lib/logging/logging');
import simple_date = require('../metrics/model/simple_date');

let log :logging.Log = new logging.Log('metrics');

// Activity information for each time getting access.
interface Activity {
  date :string;          // Date in "YYYY-MM-DD" form, user timezone.
  country :string;
}

// Type definition for data sent in each activity report.
interface ActivityReport {
  newActivity :Activity;
  previousActivity ?:Activity;
};

// Type definition for activity metrics data written to storage.
export class StoredActivityMetrics {
  public version :number = 1;
  public unreportedActivities :ActivityReport[] = [];
  public lastActivity :Activity;
};

// Metrics maintains activity metrics for a user, and can report getter usage
// using the supplied postCallback_ function.
export class Metrics {
  constructor(private data_ :StoredActivityMetrics,
              private saveCallback_ :((data :StoredActivityMetrics) => Promise<void>),
              private postCallback_ :((data :string) => Promise<void>)) {
    log.info('Activity metrics created with data', this.data_);
  }

  public reportGetterActivity() {
    let country = 'ZZ';  // ZZ means unknown until we have country lookup.
    let today = simple_date.datefromLocalJsDate(new Date()).toIsoString();
    if (!this.data_.lastActivity ||
        this.data_.lastActivity.date !== today ||
        this.data_.lastActivity.country !== country) {
      // The user is either reporting getting for the first time, or the
      // date or country has changed since the last report.
      // Generate a new activity report.
      let newActivityReport :ActivityReport = {
        newActivity: {date: today, country: country}
      };
      if (this.data_.lastActivity) {
        newActivityReport.previousActivity = {
          date: this.data_.lastActivity.date,
          country: this.data_.lastActivity.country,
        };
      }
      this.data_.unreportedActivities.push(newActivityReport);

      // Store new date and country for use in the next report.
      this.data_.lastActivity = {date: today, country: country};
      this.saveCallback_(this.data_);
    }

    // Post any activity reports that may be on the queue.
    this.postActivityQueue_();
  }

  // Post each element on unreportedActivities using the postCallback_.
  // Stops when the queue is empty or if there is an error posting.
  private postActivityQueue_() {
    if (this.data_.unreportedActivities.length === 0) {
      return;
    }
    var activityReport = this.data_.unreportedActivities[0];
    var postData = JSON.stringify({
      date: activityReport.newActivity.date,
      country: activityReport.newActivity.country,
      previous_date: activityReport.previousActivity ?
          activityReport.previousActivity.date : undefined,
      previous_country: activityReport.previousActivity ?
          activityReport.previousActivity.country : undefined
    });
    this.postCallback_(postData).then(() => {
      this.data_.unreportedActivities.shift();
      this.saveCallback_(this.data_).then(() => {
        // Call postActivityQueue_ recursively, stopping once the queue
        // is empty or the postCallback rejects.
        this.postActivityQueue_();
      });
    }).catch((e :Error) => {
      log.error('Error posting activity', e);
    })
  }
}
