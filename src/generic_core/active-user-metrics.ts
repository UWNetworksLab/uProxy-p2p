/// <reference path='../../third_party/typings/index.d.ts' />

import logging = require('../lib/logging/logging');
import storage = require('../interfaces/storage');

var log :logging.Log = new logging.Log('metrics');

class StoredActivityMetrics {
  public version = 1;
  public lastGettingDate :string;  // Date in "YYYY-MM-DD" form, user timezone.
};

export class Metrics {
  public onceLoaded_ :Promise<void>;
  private data_ :StoredActivityMetrics;

  constructor(private storage_ :storage.Storage) {
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

  public updateActivityReport = () => {
    this.onceLoaded_.then(() => {
      var today = getTodaysDateString();
      if (today != this.data_.lastGettingDate) {
        // TODO: make XHR, test that this goes through the proxy, check for errors
        // TODO: if the XHR fails, we should try it again... but when?  should we save to storage the new values?
        this.postActivity_({
              date: today,
              previous_date: this.data_.lastGettingDate
            });
        this.data_.lastGettingDate = today;
        this.storage_.save('activity-metrics', this.data_);
      }
    });
  }

  // TODO: type data
  private postActivity_ = (data :any) => {
    return new Promise(function(F, R) {
      var xhr = new XMLHttpRequest();
      xhr.open('POST', 'http://localhost:8080/recordUse');  // TODO: use appengine with https
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.onload = function() {
        // TODO: error handling!
        console.log('got response: ' + this.response)
        F();
      };
      xhr.send(JSON.stringify(data));
    });
  }
}

// Returns today's date in user's timezone as a "YYYY-MM-DD" string.
// TODO: double check time zones
function getTodaysDateString() {
  var d = new Date();
  var monthNum = d.getMonth() + 1;
  var monthString = monthNum < 10 ? '0' + monthNum : monthNum.toString();
  return d.getFullYear() + '-' + monthString + '-' + d.getDate();
}
