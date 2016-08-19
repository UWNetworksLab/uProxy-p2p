// See https://googlecloudplatform.github.io/gcloud-node/#/docs/v0.37.0/gcloud
// for gcloud-node API documentation.

declare namespace gcloud {
  interface Config {
    projectId?: string;
    keyFilename?: string;
    email?: string;
    credentials?: Credentials;
    autoRetry?: boolean;
    maxRetries?: number;
  }

  interface Credentials {
    client_email: string;
    private_key: string;
  }

  interface Api {
    datastore(options?: datastore.Options): datastore.Datastore;
  }

  export namespace datastore {
    interface Options extends Config {
      apiEndpoint?: string;
      namespace?: string;
    }

    interface Datastore {
      allocateIds(incompleteKey: Key, n: number, callback: (err: Object, keys: Key[], apiResponse: any) => void): void;
      createQuery(kind: string): Query;
      createQuery(namespace: string,
                  kind: string): Query;
      delete(key: Key | Key[],
             callback: (err: any, apiResponse: any) => void): void;
      double(value: number): any;
      geoPoint(coordinates: { latitude: number, longitude: number }): any;
      get(keys: Key | Key[],
          options: {consistency: string, maxApiCalls: boolean},
          callback: (err: any, entity: any | any[]) => void): void;
      get(keys: Key | Key[],
          callback: (err: any, entity: any | any[]) => void): void;
      insert(entities: Entity | Entity[], callback: (err: any, apiResponse: any) => void): void;
      int(value: number): any;
      key(path?: string | string[]): Key;
      key(options: { path?: string | string[]; namespace?: string; }): Key;
      runQuery(q: Query,
               callback?: (err: any, entities: Entity[], info: { endCursor: string, moreResults: string }) => void): void;
      runQuery(q: Query,
               options?: { consistency: string, maxApiCalls: boolean},
               callback?: (err: any, entities: Entity[], info: { endCursor: string, moreResults: string }) => void): void;
      save(entities: Entity | Entity[],
           callback: (err: any, apiResponse: any) => void): void;
      update(entities: Entity | Entity[],
             callback: (err: any, apiResponse: any) => void): void;
      upsert(entities: Entity | Entity[],
             callback: (err: any, apiResponse: any) => void): void;
    }

    interface Key {
      id: number;
      name: string;
      path: string[];
      kind: string;
      parent: Key;
    }

    interface Entity {
      key: Key,
      method?: string,
      data: any,
    }

    interface Query {
      namespace?: string;
      kind: string;
      filter(property:string, operator:string, value:any): Query;
      filter(property:string, value:any): Query;
    }
    type Transaction = Object;
  }
}

declare module '"gcloud' {
  const gcloud: (config?: gcloud.Config) => gcloud.Api;
  export = gcloud;
}
