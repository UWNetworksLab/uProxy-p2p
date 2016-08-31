/// <reference path='../../third_party/typings/index.d.ts' />

import logging = require('../lib/logging/logging');
import storage = require('../interfaces/storage');

var log :logging.Log = new logging.Log('metrics');

interface ActivityReport {
  newDate :string;  // Date in "YYYY-MM-DD" form, user timezone.
  newCountry :string;
  previousDate ?:string;  // Date in "YYYY-MM-DD" form, user timezone.
  previousCountry ?:string;
}

class StoredActivityMetrics {
  public version = 1;
  public unreportedActivities :ActivityReport[] = [];
  public lastDate :string;    // Date in "YYYY-MM-DD" form, user timezone.
  public lastCountry :string;
};

export class Metrics {
  public onceLoaded_ :Promise<void>;
  private data_ :StoredActivityMetrics;

  constructor(private storage_ :storage.Storage,
              private checkIfProxying_ :(() => boolean)) {
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
      var country = 'ZZ';
      var today = getTodaysDateString();
      if (this.data_.lastDate != today ||
          this.data_.lastCountry != country) {
        // The user is either reporting getting for the first time, or the
        // date or country has changed since the last report.
        // Generate a new activity report.
        var newActivityReport :ActivityReport = {
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
    this.postSingleActivity_(this.data_.unreportedActivities[0]).then(() => {
      this.data_.unreportedActivities.shift();
      this.saveToStorage_().then(() => {
        this.postActivityQueue_();
      });
    }).catch((e :Error) => {
      log.error('Error posting activity', e);
    })
  }

  private postSingleActivity_ = (data :ActivityReport) => {
    log.debug('postSingleActivity_: ', data);
    if (!this.checkIfProxying_()) {
      // Not proxying right now, don't post activity.  This may occur if
      // proxying stops between multiple attempts to post metrics.
      return Promise.reject('Unable to post activity metrics, not proxying');
    }
    return new Promise(function(F, R) {
      var xhr = new XMLHttpRequest();
      xhr.open('POST', 'https://uproxy-metrics.appspot.com/recordUse');
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.onload = function() {
        log.debug('Got response from recordUse: ' + this.response);
        if (this.status === 200) {
          F();
        } else {
          R(new Error('Error posting activity: ' + this.status));
        }
      };
      xhr.onerror = function(e) {
        R(new Error('Failed to post activity: ' + e));
      };
      xhr.send(JSON.stringify({
        date: data.newDate,
        country: data.newCountry,
        previous_date: data.previousDate,
        previous_country: data.previousCountry
      }));
    });
  }

  private saveToStorage_ = () : Promise<StoredActivityMetrics> => {
    return this.storage_.save('activity-metrics', this.data_);
  }
}

// Returns today's date in user's timezone as a "YYYY-MM-DD" string.
function getTodaysDateString() {
  var d = new Date();
  var monthNum = d.getMonth() + 1;
  var monthString = monthNum < 10 ? '0' + monthNum : monthNum.toString();
  return d.getFullYear() + '-' + monthString + '-' + d.getDate();
}
