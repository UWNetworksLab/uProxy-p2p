import arraybuffers = require('../arraybuffers/arraybuffers');
import defragmenter = require('./defragmenter');
import fragments = require('./fragment');
import logging = require('../logging/logging');

var log :logging.Log = new logging.Log('fragmentation shaper');

const CHUNK_SIZE: number = 16;
const IV_SIZE: number = 16;

// Accepted in serialised form by configure().
export interface FragmentationConfig {
  maxLength :number
}

// Creates a sample (non-random) config, suitable for testing.
export var sampleConfig = () : FragmentationConfig => {
  return {
    maxLength: 1440
  };
}

// A transformer that enforces a maximum packet length.
export class FragmentationShaper {
  private maxLength_ :number;

  private fragmentBuffer_ :defragmenter.Defragmenter =
    this.fragmentBuffer_ = new defragmenter.Defragmenter();

  public constructor() {
    this.configure(JSON.stringify(sampleConfig()));
  }

  // Configure with the target length.
  public configure = (json :string) :void => {
    var config = JSON.parse(json);

    // Required parameter 'maxLength'
    if ('maxLength' in config) {
      var fragmentationConfig = <FragmentationConfig>config;
      this.maxLength_ = fragmentationConfig.maxLength;
    } else {
      throw new Error('Fragmentation shaper requires maxLength parameter');
    }
  }

  // Perform the following steps:
  // - Break buffer into one or more fragments
  // - Add fragment headers to each fragment
  // - Add fill if necessary to pad each fragment to a multiple of CHUNK_SIZE
  // - Encode fragments into new buffers
  public transform = (buffer :ArrayBuffer) :ArrayBuffer[] => {
    var fragmentList = this.makeFragments_(buffer);
    var results :ArrayBuffer[] = [];
    for(var index=0; index < fragmentList.length; index++) {
      var result = fragments.encode(fragmentList[index]);
      results.push(result);
    }

    return results;
  }

  // Perform the following steps:
  // - Decode buffer into a fragment
  // - Remove fill
  // - Remove fragment headers
  // - Attempt to defragment, yielding zero or more new buffers
  public restore = (buffer :ArrayBuffer) :ArrayBuffer[] => {
    var fragment = fragments.decode(buffer);
    this.fragmentBuffer_.addFragment(fragment);
    if (this.fragmentBuffer_.completeCount() > 0) {
      var complete = this.fragmentBuffer_.getComplete();
      return complete;
    } else {
      return [];
    }
  }

  // Perform the following steps:
  // - Break buffer into one or more fragments
  // - Add fragment headers to each fragment
  // - Add fill if necessary to pad each fragment to a multiple of CHUNK_SIZE
  private makeFragments_ = (buffer :ArrayBuffer) :fragments.Fragment[] => {
    var payloadSize = buffer.byteLength + fragments.HEADER_SIZE + IV_SIZE;
    var fillSize = CHUNK_SIZE - (payloadSize % CHUNK_SIZE);
    var packetSize = payloadSize + fillSize;

    if (packetSize <= this.maxLength_) {
      var fill = new Uint8Array(fillSize);
      if (fillSize > 0) {
        crypto.getRandomValues(fill);
      }

      // One fragment
      var fragment = {
        length: buffer.byteLength,
        id: fragments.makeRandomId(),
        index: 0,
        count: 1,
        payload: buffer,
        padding: fill
      };

      return [fragment];
    } else {
      // Multiple fragments
      var firstLength = this.maxLength_ - (fragments.HEADER_SIZE + IV_SIZE + fillSize);
      var restLength = buffer.byteLength - firstLength;
      var parts = arraybuffers.split(buffer, firstLength);
      var first = this.makeFragments_(parts[0]);
      var rest = this.makeFragments_(parts[1]);
      var fragmentList = first.concat(rest);
      FragmentationShaper.fixFragments_(fragmentList);

      return fragmentList;
    }
  }

  // Rewrite the fragments to impose the following constraints:
  // - All fragments have the same id
  // - Each fragment has a unique, incremental index
  // - All fragments have the same, correct count
  static fixFragments_ = (fragmentList :fragments.Fragment[]) :void => {
    var id = fragmentList[0].id;
    var count = fragmentList.length;
    for(var index = 0; index < count; index++) {
      fragmentList[index].id = id;
      fragmentList[index].index = index;
      fragmentList[index].count = count;
    }
  }
}
