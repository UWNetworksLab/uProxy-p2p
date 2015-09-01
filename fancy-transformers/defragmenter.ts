import arraybuffers = require('../arraybuffers/arraybuffers');
import fragments = require('./fragment');
import logging = require('../logging/logging');

var log :logging.Log = new logging.Log('defragmenter');

// The Defragmenter collects fragmented packets in a buffer and defragments them.
// The cache expiration strategy is taken from RFC 815: IP Datagram Reassembly
// Algorithms.
export class Defragmenter {
  // tracker_ associates packet identifiers with indexed lists of fragments
  private tracker_ :{[index:string]:ArrayBuffer[]} = {};
  // counter_ associates packet identifiers with counts of the number remaining
  // This is an optimization to avoid scanning tracker_ repeatedly for counts.
  private counter_ :{[index:string]:number} = {};
  // complete_ stores the packet identifiers for which we have all fragments
  private complete_:string[] = [];
  // timers_ stores the Timer objects for expiring each identifier
  // See RFC 815, section 7, paragraph 2 (p. 8)
  private timers_ :{[index:string]:NodeJS.Timer};

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
    var hexid = arraybuffers.arrayBufferToHexString(fragment.id);

    if (hexid in this.tracker_) {
      // A fragment for an existing packet

      // Get list of fragment contents for this packet identifier
      var fragmentList :ArrayBuffer[] = this.tracker_[hexid];
      if (fragmentList[fragment.index] !== null) {
        // Duplicate fragment

        // The fragmentation system does not retransmit dropped packets.
        // Therefore, a duplicate is an error.
        // However, it might be a recoverable error.
        // So let's log it and continue.
        log.warn('Duplicate fragment %1: %2 / %3', hexid, fragment.index, fragment.count);
      } else {
        // New fragment for an existing packet

        // Only the payload is stored explicitly.
        // The other information is stored implicitly in the data structure.
        fragmentList[fragment.index] = fragment.payload;
        this.tracker_[hexid] = fragmentList;

        // Decrement the count for this packet identifier
        this.counter_[hexid] = this.counter_[hexid]-1;

        // If we have all fragments for this packet identifier, it is complete.
        if (this.counter_[hexid] === 0) {
          this.complete_.push(hexid);

          // Delete the Timer now that the packet is complete
          clearTimeout(this.timers_[hexid]);
          delete this.timers_[hexid];
        }
      }
    } else {
      // A new fragment for a new packet

      // Make an empty list of fragments.
      var fragmentList :ArrayBuffer[] = [];
      for(var i = 0; i < fragment.count; i++) {
        fragmentList.push(null);
      }

      // Store this fragment in the fragment list.
      fragmentList[fragment.index] = fragment.payload;
      this.tracker_[hexid] = fragmentList;

      // Set the counter to the total number of fragments expected.
      // The decrement it as we have already received one fragment.
      this.counter_[hexid] = fragment.count-1;

      if (this.counter_[hexid] === 0) {
        // Deal with the case where there is only one fragment for this packet.
        this.complete_.push(hexid);
      } else {
        // Store the time the first fragment arrived, to set the cache expiration.
        // See RFC 815, section 7, paragraph 2 (p. 8)
        // Cache expiration is set to 60 seconds.
        this.timers_[hexid] = setTimeout(() => this.reap_(hexid), 60*1000);
      }
    }
  }

  // Returns the number of packets for which all fragments have arrived.
  public completeCount = () :number => {
    return this.complete_.length;
  }

  // Return an ArrayBuffer for each packet where all fragments are available.
  public getComplete = () :ArrayBuffer[] => {
    var packets :ArrayBuffer[]  =  [];

    for(var i = 0; i < this.complete_.length; i++) {
      // Obtain the packet identifier for the completed packet
      var hexid = this.complete_.pop();
      // Obtain the contents from the fragments with this identifier
      var fragmentList = this.tracker_[hexid];
      // Remove the fragments from the cache now that the packet is complete
      delete this.tracker_[hexid];
      delete this.counter_[hexid];

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
    delete this.counter_[hexid];

    // Delete the Timer now that it has been called.
    delete this.timers_[hexid];
  }
}
