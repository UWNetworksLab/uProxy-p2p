// Type definitions for ipaddr.js 0.1.3
// Project: https://github.com/whitequark/ipaddr.js
// Definitions by: Benjamin M. Schwartz <https://github.com/bemasc>

/*
ipaddrjs.d.ts may be freely distributed under the Apache 2 license
*/

declare module "ipaddr.js" {
  // returns true if the address is a valid IPv4 or IPv6 address, and false
  // otherwise. It does not throw any exceptions.
  export function isValid(address: string): boolean;

  export interface Address {
    // returns either "ipv6" or "ipv4".
    kind(): string;
    // returns a string representation (possibly compacted) of the address.
    toString(): string;
    // check if the address falls into a certain CIDR range.
    match(range: Address, bits: number): boolean;
    // returns one of predefined names for several special ranges defined by IP
    // protocols.
    range(): string;
    // returns the address's byte representation as an array of numbers in the
    // range of 0..255.
    toByteArray(): Array<number>
  }

  // returns an object representing the IP address, or throws an Error
  // if the passed string is not a valid representation of an IP address.
  export function parse(address: string): Address;

  // works just like ipaddr.parse, but automatically converts IPv4-mapped IPv6
  // addresses to their IPv4 counterparts before returning.
  export function process(address: string): Address;

  // Maps names of subnets to subnets, which are represented as Arrays of length
  // 2 whose first element is an Address, and whose second element is a number
  // indicating the depth of the subnet (# of MSB to preserve).  Values in the
  // map may also be arrays of subnets.
  interface SubnetMap { [s: string]: Array<any> }

  // returns the name of a matching subnet in rangeList, or returns defaultName
  // if there is no match in rangeList.
  export function subnetMatch(address: Address, rangeList: SubnetMap,
      defaultName: string): string;

  export interface IPv6Address extends Address {
    // returns an address where all zeroes are explicit.
    toNormalizedString(): string;
    // returns true if this address is an IPv4-mapped one.
    isIPv4MappedAddress(): boolean;
    // returns an IPv4 address object if this is an IPv4-mapped address.
    toIPv4Address(): IPv4Address;
    // the underlying binary representation of the address
    parts: Array<number>
  }

  export interface IPv4Address extends Address {
    // returns a corresponding IPv4-mapped IPv6 address.
    toIPv4MappedAddress(): IPv6Address
    // the underlying representation of the address
    octets: Array<number>
  }

  export interface VersionSpecificIpUtils<T> {
    // Construct an IPv4 or IPv6 object from a raw numeric representation.
    new(octetsOrParts:number[]) : T;
    isValid(address: string): boolean;
    parse(address: string): T;
  }

  var IPv4: VersionSpecificIpUtils<IPv4Address>;
  var IPv6: VersionSpecificIpUtils<IPv6Address>;
}
