export interface Storage {
  reset() : Promise<void>;
  load<T>(key :string) : Promise<T>;
  save<T>(key :string, val :T) : Promise<T>;
  keys() : Promise<string[]>;
}
