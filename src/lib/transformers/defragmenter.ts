import * as arraybuffers from '../arraybuffers/arraybuffers';
import * as fragments from './fragment';
import * as logging from '../logging/logging';

var log :logging.Log = new logging.Log('defragmenter');

// Cache expiration is set to 60 seconds.
const CACHE_EXPIRATION_TIME :number = 60*1000;

// Tracks the fragments for a single packet identifier
interface PacketTracker {
  // Indexed lists of fragments for this packet
  pieces :ArrayBuffer[];

  // Counts of the number remaining
  // This is an optimization to avoid scanning pieces repeatedly for counts.
  counter :number;

  // Stores the Timer objects for expiring each identifier
  // See RFC 815, section 7, paragraph 2 (p. 8)
  timer :NodeJS.Timer
}

// The Defragmenter gathers fragmented packets in a buffer and defragments them.
// The cache expiration strategy is taken from RFC 815: IP Datagram Reassembly
// Algorithms.
export class Defragmenter {
  // Associates packet identifiers with indexed lists of fragments
  // The packet identifiers are converted from ArrayBuffers to hex strings so
  // that they can be used as map keys.
  private tracker_ :{[index:string]:PacketTracker} = {};

  // Stores the packet identifiers for which we have all fragments
  private complete_:ArrayBuffer[][] = [];

  // Add a fragment that has been received from the network.
  // Fragments are processed according to the following logic:
  //   If the packet identifier is recognized:
  //     If we have a fragment for this index:
  //       This fragment is a duplicate, drop it.
  //     Else:
  //      This fragment a new fragment for an existing packet
  //   Else:
  //     This fragment a new fragment for a new packet.
  public addFragment(fragment:fragments.Fragment) {
    // Convert ArrayBuffer to hex string so that it can be used as a map key
    var hexid = new Buffer(fragment.id).toString('hex');

    if (hexid in this.tracker_) {
      // A fragment for an existing packet

      // Get list of fragment contents for this packet identifier
      const fragmentList :ArrayBuffer[] = this.tracker_[hexid].pieces;
      if (fragmentList[fragment.index] !== null) {
        // Duplicate fragment

        // The fragmentation system does not retransmit dropped packets.
        // Therefore, a duplicate is an error.
        // However, it might be a recoverable error.
        // So let's log it and continue.
        log.warn('Duplicate fragment %1: %2 / %3', hexid, fragment.index,
          fragment.count);
      } else {
        // New fragment for an existing packet

        // Only the payload is stored explicitly.
        // The other information is stored implicitly in the data structure.
        fragmentList[fragment.index] = fragment.payload;
        this.tracker_[hexid].pieces = fragmentList;

        // Decrement the counter for this packet identifier
        this.tracker_[hexid].counter = this.tracker_[hexid].counter-1;

        // If we have all fragments for this packet identifier, it is complete.
        if (this.tracker_[hexid].counter === 0) {
          // Extract the completed packet fragments from the tracker
          this.complete_.push(this.tracker_[hexid].pieces);

          // Stop the Timer now that the packet is complete
          clearTimeout(this.tracker_[hexid].timer);
          // Delete the completed packet from the tracker
          delete this.tracker_[hexid];
        }
      }
    } else {
      // A new fragment for a new packet

      // Make an empty list of fragments.
      const fragmentList :ArrayBuffer[] = [];
      for(var i = 0; i < fragment.count; i++) {
        fragmentList.push(null);
      }

      // Store this fragment in the fragment list.
      fragmentList[fragment.index] = fragment.payload;

      // Set the counter to the total number of fragments expected.
      // The decrement it as we have already received one fragment.
      var counter = fragment.count-1;

      if (counter === 0) {
        // Deal with the case where there is only one fragment for this packet.
        this.complete_.push(fragmentList);
      } else {
        // Store time the first fragment arrived, to set the cache expiration.
        // See RFC 815, section 7, paragraph 2 (p. 8)
        // Cache expiration is set to 60 seconds.
        var timer = setTimeout(() => this.reap_(hexid), CACHE_EXPIRATION_TIME);

        // Store the fragment information in the tracker
        this.tracker_[hexid] = {
          pieces: fragmentList,
          counter: counter,
          timer: timer
        };
      }
    }
  }

  // Returns the number of packets for which all fragments have arrived.
  public completeCount = () :number => {
    return this.complete_.length;
  }

  // Return an ArrayBuffer for each packet where all fragments are available.
  // Calling this clears the set of stored completed fragments.
  public getComplete = () :ArrayBuffer[] => {
    var packets :ArrayBuffer[]  =  [];

    for(var i = 0; i < this.complete_.length; i++) {
      // Obtain the contents from the fragments for a completed packet
      var fragmentList = this.complete_.pop();

      // Assemble the fragment contents into one ArrayBuffer per packet
      if (fragmentList !== null && fragmentList.length > 0) {
        var packet = arraybuffers.concat(fragmentList);
        packets.push(packet);
      }
    }

    return packets;
  }

  private reap_ = (hexid:string) :void => {
    // Remove the fragments from the cache now that the packet has expired
    delete this.tracker_[hexid];
  }
}
