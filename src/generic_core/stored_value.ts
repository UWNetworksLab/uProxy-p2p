/// <reference path='../../third_party/typings/index.d.ts' />

import globals = require('./globals');
import _ = require('lodash');

class StoredValue<T> {
  private loaded_ :Promise<void>;

  // accepts the name of the key to load from storage and the default value for
  // that key (if it is not found in storage)
  constructor(private name_ :string, private value_ :T = null) {
    this.loaded_ = globals.storage.load(this.name_).then((v :T) => {
      this.value_ = v;
    }).catch((e) => {
      if (e === 'non-existing key') {
        // the storage library throws an exception when a key is not found, we
        // want to treat that as expected so we switch to just returning nothing
        return;
      }

      throw e;
    });
  }

  public get = () => {
    return this.loaded_.then(() => {
      // don't return an actual reference, tiny bit of extra overhead but makes
      // sure we don't end up with bad state
      return _.clone(this.value_);
    });
  }

  public set = (val :T) :Promise<void> => {
    var saved = globals.storage.save(this.name_, val).then(() => {
      this.value_ = val;
    });

    // we don't want to return any values while we have a pending transaction,
    // but we also want to go back to just returning the previous value if we
    // fail to save
    this.loaded_ = saved.catch(() => {
      return;
    });

    // return any actual errors to the person trying to save
    return saved;
  }
}

export = StoredValue;
