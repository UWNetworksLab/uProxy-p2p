import storage_interface = require('../interfaces/storage');

export class MockStorage implements storage_interface.Storage {
  constructor(private data_ ?:any) {
  }
  public reset = () : Promise<void> => {
    return Promise.resolve<void>();
  }
  public load<T>(key :string) : Promise<T> {
    if (this.data_[key]) {
      return Promise.resolve(this.data_[key]);
    } else {
      return Promise.reject('non-existing key');
    }
  }
  public save<T>(key :string, val :T) : Promise<T> {
    this.data_[key] = val;
    return Promise.resolve();
  }
  public destroy(key :string) : Promise<void> {
    if (this.data_[key]) {
      return Promise.resolve(this.data_[key]);
    } else {
      return Promise.reject('non-existing key');
    }
  }
  public keys = () : Promise<string[]> => {
    return Promise.resolve(Object.keys(this.data_));
  }
}  // class MockStorage
