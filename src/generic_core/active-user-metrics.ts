/// <reference path='../../third_party/typings/index.d.ts' />

import logging = require('../lib/logging/logging');
import simple_date = require('../metrics/model/simple_date');
import storage = require('../interfaces/storage');

let log :logging.Log = new logging.Log('metrics');

interface ActivityReport {
  newDate :simple_date.SimpleDate;
  newCountry :string;
  previousDate ?:simple_date.SimpleDate;
  previousCountry ?:string;
}

class StoredActivityMetrics {
  public version = 1;
  public unreportedActivities :ActivityReport[] = [];
  public lastDate :simple_date.SimpleDate;
  public lastCountry :string;
};

export class Metrics {
  public onceLoaded_ :Promise<void>;
  private data_ :StoredActivityMetrics;

  constructor(private storage_ :storage.Storage,
              private postCallback_ :((data :string) => Promise<void>)) {
    this.onceLoaded_ =
    this.storage_.load('activity-metrics').then(
        (storedData :StoredActivityMetrics) => {
      log.info('Loaded activity metrics from storage', storedData);
      this.data_ = storedData;
    }).catch((e :Error) => {
      // Not an error if no metrics are found storage, this happens the first
      // time the user loads uProxy.
      log.info('No actity metrics found in storage');
      this.data_ = new StoredActivityMetrics();
    });
  }

  public reportGetterUse = () => {
    this.onceLoaded_.then(() => {
      // ZZ indicates unknown until we implement country lookup.
      let country = 'ZZ';
      let today = simple_date.datefromLocalJsDate(new Date());
      if (!this.data_.lastDate.equals(today) ||
          this.data_.lastCountry != country) {
        // The user is either reporting getting for the first time, or the
        // date or country has changed since the last report.
        // Generate a new activity report.
        let newActivityReport :ActivityReport = {
          newDate: today,
          newCountry: country,
          previousDate: this.data_.lastDate,
          previousCountry: this.data_.lastCountry
        };
        this.data_.unreportedActivities.push(newActivityReport);

        // Store new date and country for use in the next report.
        this.data_.lastDate = today;
        this.data_.lastCountry = country;
        this.saveToStorage_();
      }

      // Post any activity reports that may be on the queue.
      this.postActivityQueue_();
    });
  }

  private postActivityQueue_ = () => {
    if (this.data_.unreportedActivities.length === 0) {
      return;
    }
    var activityReport = this.data_.unreportedActivities[0];
    var postData = JSON.stringify({
      date: activityReport.newDate.toString(),
      country: activityReport.newCountry,
      previous_date: activityReport.previousDate ?
          activityReport.previousDate.toString() : undefined,
      previous_country: activityReport.previousCountry
    });
    this.postCallback_(postData).then(() => {
      this.data_.unreportedActivities.shift();
      this.saveToStorage_().then(() => {
        // Call postActivityQueue_ recursively, stopping once the queue
        // is empty or the postCallback rejects.
        this.postActivityQueue_();
      });
    }).catch((e :Error) => {
      log.error('Error posting activity', e);
    })
  }

  private saveToStorage_ = () : Promise<StoredActivityMetrics> => {
    return this.storage_.save('activity-metrics', this.data_);
  }
}
