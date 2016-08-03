// Types for communications between socks-to-rtc and rtc-to-net.

// Useful abbreviation for this common interface.

// TODO: Rename this to TransportAddress.
export interface Endpoint {
  // TODO: rename to IpAddress or can it be a domain name too?
  address:string;
  port:number;
}
