var ipaddr = require('ipaddr.js');

var PortControl = function (dispatchEvent) {
  this.dispatchEvent = dispatchEvent;
};

/**
* List of popular router default IPs
* http://www.techspot.com/guides/287-default-router-ip-addresses/
*/
var routerIps = ['192.168.1.1', '192.168.2.1', '192.168.11.1',
  '192.168.0.1', '192.168.0.30', '192.168.0.50', '192.168.20.1',
  '192.168.30.1', '192.168.62.1', '192.168.100.1', '192.168.102.1',
  '192.168.1.254', '192.168.10.1', '192.168.123.254', '192.168.4.1',
  '10.0.1.1', '10.1.1.1', '10.0.0.13', '10.0.0.2', '10.0.0.138'];

/**
* An object representing a port mapping returned by mapping methods
* @typedef {Object} Mapping
* @property {string} internalIp
* @property {number} internalPort
* @property {string} externalIp Only provided by PCP, undefined for other protocols
* @property {number} externalPort The actual external port of the mapping, -1 on failure
* @property {number} lifetime The actual (response) lifetime of the mapping
* @property {string} protocol The protocol used to make the mapping ('natPmp', 'pcp', 'upnp')
* @property {number} timeoutId The timeout ID if the mapping is refreshed
* @property {array} nonce Only for PCP; the nonce field for deletion
*/

/**
* A table that keeps track of information about active mappings
* { externalPortNumber1: Mapping1, 
*   externalPortNumber2: Mapping2,
*   ...
* }
*/
var activeMappings = {};

/**
* Add a port mapping through the NAT with any protocol that works
* @public
* @method addMapping
* @param {number} intPort The internal port on the computer to map to
* @param {number} extPort The external port on the router to map to
* @param {number} lifetime Seconds that the mapping will last
*                          0 is infinity; handled differently per protocol
* @return {Promise<Mapping>} A promise for the port mapping object
*                            Mapping.externalPort === -1 on failure
**/
PortControl.prototype.addMapping = function (intPort, extPort, lifetime) {
  var _this = this;

  return _this.addMappingPmp(intPort, extPort, lifetime).then(function (mapping) {
    if (mapping.externalPort !== -1) { return mapping; }
    else { return _this.addMappingPcp(intPort, extPort, lifetime); }
  }).then(function (mapping) {
    if (mapping.externalPort !== -1) { return mapping; }
    else { return _this.addMappingUpnp(intPort, extPort, lifetime); }
  });
};

/**
* Delete the port mapping locally and from the router, and stop refreshes
* @public
* @method deleteMapping
* @param {number} extPort The external port of the mapping to delete
* @return {Promise<boolean>} True on success, false on failure
**/
PortControl.prototype.deleteMapping = function (extPort) {
  var _this = this;

  return new Promise(function (F, R) {
    // Get the protocol that this port was mapped with; may error
    var protocol = activeMappings[extPort].protocol;

    if (protocol === 'natPmp') {
      F(_this.deleteMappingPmp(extPort));
    } else if (protocol === 'pcp') {
      F(_this.deleteMappingPcp(extPort));
    } else if (protocol === 'upnp') {
      F(_this.deleteMappingUpnp(extPort));
    }
  }).catch(function (err) {
    return false;
  });
};

/**
* Probes the NAT for NAT-PMP, PCP, and UPnP support,
* and returns an object representing the NAT configuraiton
* @public
* @method probeProtocolSupport
* @return {Promise<{"natPmp": boolean, "pcp": boolean, "upnp": boolean}>}
*/
PortControl.prototype.probeProtocolSupport = function () {
  return Promise.all([this.probePmpSupport(), this.probePcpSupport(),
    this.probeUpnpSupport()]).then(function (support) {
      var protocolSupport = {
        natPmp: support[0],
        pcp: support[1],
        upnp: support[2]
      };
      return protocolSupport;
    });
};

/**
* Probe if NAT-PMP is supported by the router
* @public
* @method probePmpSupport
* @return {Promise<boolean>} A promise for a boolean
*/
PortControl.prototype.probePmpSupport = function () {
  return this.addMappingPmp(55555, 55555, 120).
      then(function (mapping) {
        if (mapping.externalPort !== -1) { return true; }
        return false;
      });
};

/**
* Makes a port mapping in the NAT with NAT-PMP,
* and automatically refresh the mapping every two minutes
* @public
* @method addMappingPmp
* @param {number} intPort The internal port on the computer to map to
* @param {number} extPort The external port on the router to map to
* @param {number} lifetime Seconds that the mapping will last
*                          0 is infinity, i.e. a refresh every 24 hours
* @return {Promise<Mapping>} A promise for the port mapping object
*                            Mapping.externalPort === -1 on failure
*/
PortControl.prototype.addMappingPmp = function (intPort, extPort, lifetime) {
  var _this = this;
  var mapping = {
    protocol: 'natPmp',
    internalPort: intPort,
    externalPort: -1
  };

  // If lifetime is zero, we want to refresh every 24 hours
  var reqLifetime = (lifetime === 0) ? 24*60*60 : lifetime;

  function _addMappingPmp() {
    // Construct an array of ArrayBuffers, which are the responses of
    // sendPmpRequest() calls on all the router IPs. An error result
    // is caught and re-passed as null.
    return Promise.all(routerIps.map(function (routerIp) {
        return _this.sendPmpRequest(routerIp, intPort, extPort, reqLifetime).
            then(function (pmpResponse) { return pmpResponse; }).
            catch(function (err) { return null; });
    })).then(function (responses) {
      // Check if any of the responses are successful (not null)
      // and parse the external port, router IP, and lifetime in the response
      for (var i = 0; i < responses.length; i++) {
        if (responses[i] !== null) {
          var responseView = new DataView(responses[i].data);
          mapping.externalPort = responseView.getUint16(10);
          mapping.lifetime = responseView.getUint32(12);
          return responses[i].address;  // Router's internal IP
        }
      }
    }).then(function (routerIntIp) {
      if (routerIntIp !== undefined) {
        // Find the longest prefix match for all the client's internal IPs with
        // the router IP. This was the internal IP for the new mapping. (We want
        // to identify which network interface the socket bound to, since NAT-PMP
        // uses the request's source IP, not a specified one, for the mapping.)
        return _this.getPrivateIps().then(function (privateIps) {
          mapping.internalIp = _this.longestPrefixMatch(privateIps, routerIntIp);
          return mapping;
        });
      } else {
        return mapping;
      }
    });
  }

  return _addMappingPmp().then(function (mapping) {
    // If the actual lifetime is less than the requested lifetime,
    // setTimeout to refresh the mapping when it expires
    var timeoutId;
    var dLifetime = reqLifetime - mapping.lifetime;
    if (mapping.externalPort !== -1 && dLifetime > 0) {
      timeoutId = setTimeout(_this.addMappingPmp.bind(_this, intPort,
        mapping.externalPort, dLifetime), mapping.lifetime*1000);
      mapping.timeoutId = timeoutId;
    }
    // If the original lifetime is 0, refresh every 24 hrs indefinitely
    else if (mapping.externalPort !== -1 && lifetime === 0) {
      timeoutId = setTimeout(_this.addMappingPmp.bind(_this, intPort,
        mapping.externalPort, 0), 24*60*60*1000);
      mapping.timeoutId = timeoutId;
    }
    // If we're not refreshing, delete the entry from activeMapping at expiration
    else if (mapping.externalPort !== -1) {
      setTimeout(function () {
        delete activeMappings[mapping.externalPort];
      }, mapping.lifetime*1000);
    }

    // If the mapping operation is successful, add it to activeMappings
    if (mapping.externalPort !== -1) {
      activeMappings[mapping.externalPort] = mapping;
    }
    return mapping;
  });
};

/**
* Deletes a port mapping in the NAT with NAT-PMP
* @public
* @method deleteMappingPmp
* @param {number} extPort The external port of the mapping to delete
* @return {Promise<boolean>} True on success, false on failure
*/
PortControl.prototype.deleteMappingPmp = function (extPort) {
  var _this = this;

  return new Promise(function (F, R) {
    // Retrieve internal port of this mapping; this may error
    F(activeMappings[extPort].internalPort);
  }).then(function (intPort) {
    // Construct an array of ArrayBuffers, which are the responses of
    // sendPmpRequest() calls on all the router IPs. An error result
    // is caught and re-passed as null.
    return Promise.all(routerIps.map(function (routerIp) {
      return _this.sendPmpRequest(routerIp, intPort, 0, 0).
          then(function (pmpResponse) { return pmpResponse; }).
          catch(function (err) { return null; });
    }));
  }).then(function (responses) {
    // Return true if any of the responses are successful (not null)
    for (var i = 0; i < responses.length; i++) {
      if (responses[i] !== null) {
        // Check that the success code of the response is 0
        var responseView = new DataView(responses[i].data);
        var successCode = responseView.getUint16(2);
        if (successCode === 0) {
          clearTimeout(activeMappings[extPort].timeoutId);
          delete activeMappings[extPort];
          return true;
        }
      }
    }
    return false;
  }).catch(function (err) {
    return false;
  });
};

/**
* Send a NAT-PMP request to the router to add or delete a port mapping
* @private
* @method sendPmpRequest
* @param {string} routerIp The IP address that the router can be reached at
* @param {number} intPort The internal port on the computer to map to
* @param {number} extPort The external port on the router to map to
* @param {number} lifetime Seconds that the mapping will last
* @return {Promise<{"resultCode": number, "address": string, "port": number, "data": ArrayBuffer}>}
*         A promise that fulfills with the full NAT-PMP response object, or rejects on timeout
*/
PortControl.prototype.sendPmpRequest = function (routerIp, intPort, extPort, 
                                                 lifetime) {
  var socket;
  var _this = this;

  var _sendPmpRequest = new Promise(function (F, R) {
    socket = freedom['core.udpsocket']();

    // Fulfill when we get any reply (failure is on timeout in wrapper function)
    socket.on('onData', function (pmpResponse) {
      // We need to return the entire pmpResponse, not just the ArrayBuffer,
      // since we need the router's internal IP to guess the client's internal IP
      _this.closeSocket(socket);
      F(pmpResponse);
    });

    // TODO(kennysong): Handle an error case for all socket.bind() when this issue is fixed:
    // https://github.com/uProxy/uproxy/issues/1687

    // Bind a UDP port and send a NAT-PMP request
    socket.bind('0.0.0.0', 0).then(function (result) {
      // Construct the NAT-PMP map request as an ArrayBuffer
      var pmpBuffer = new ArrayBuffer(12);
      var pmpView = new DataView(pmpBuffer);
      // Version and OP fields (1 byte each)
      pmpView.setInt8(0, 0);
      pmpView.setInt8(1, 1);
      // Reserved, internal port, external port fields (2 bytes each)
      pmpView.setInt16(2, 0, false);
      pmpView.setInt16(4, intPort, false);
      pmpView.setInt16(6, extPort, false);
      // Mapping lifetime field (4 bytes)
      pmpView.setInt32(8, lifetime, false);

      socket.sendTo(pmpBuffer, routerIp, 5351);
    });
  });

  // Give _sendPmpRequest 2 seconds before timing out
  return Promise.race([
    this.countdownReject(2000, 'No NAT-PMP response', function () {
      _this.closeSocket(socket);
    }),
    _sendPmpRequest
  ]);
};

/**
* Probe if PCP is supported by the router
* @public
* @method probePcpSupport
* @return {Promise<boolean>} A promise for a boolean
*/
PortControl.prototype.probePcpSupport = function () {
  return this.addMappingPcp(55556, 55556, 120).
      then(function (mapping) {
        if (mapping.externalPort !== -1) { return true; }
        return false;
      });
};

/**
* Makes a port mapping in the NAT with PCP,
* and automatically refresh the mapping every two minutes
* @public
* @method addMappingPcp
* @param {number} intPort The internal port on the computer to map to
* @param {number} extPort The external port on the router to map to
* @param {number} lifetime Seconds that the mapping will last
*                          0 is infinity, i.e. a refresh every 24 hours
* @return {Promise<Mapping>} A promise for the port mapping object 
*                            mapping.externalPort is -1 on failure
*/
PortControl.prototype.addMappingPcp = function (intPort, extPort, lifetime) {
  var _this = this;
  var mapping = {
    protocol: 'pcp',
    internalPort: intPort,
    externalPort: -1
  };

  // If lifetime is zero, we want to refresh every 24 hours
  var reqLifetime = (lifetime === 0) ? 24*60*60 : lifetime;

  var _addMappingPcp = function () {
    return _this.getPrivateIps().then(function (privateIps) {
      // Construct an array of ArrayBuffers, which are the responses of
      // sendPcpRequest() calls on all the router IPs. An error result
      // is caught and re-passed as null.
      return Promise.all(routerIps.map(function (routerIp) {
        // Choose a privateIp based on the currently selected routerIp,
        // using a longest prefix match, and send a PCP request with that IP
        var privateIp = _this.longestPrefixMatch(privateIps, routerIp);
        return _this.sendPcpRequest(routerIp, privateIp, intPort, extPort, 
                                    reqLifetime).
            then(function (pcpResponse) {
              return {"pcpResponse": pcpResponse, "privateIp": privateIp};
            }).
            catch(function (err) {
              return null;
            });
      }));
    }).then(function (responses) {
      // Check if any of the responses are successful (not null)
      for (var i = 0; i < responses.length; i++) {
        if (responses[i] !== null) {
          var responseView = new DataView(responses[i].pcpResponse);
          var ipOctets = [responseView.getUint8(56), responseView.getUint8(57),
                          responseView.getUint8(58), responseView.getUint8(59)];
          var extIp = ipOctets.join('.');

          mapping.externalPort = responseView.getUint16(42);
          mapping.externalIp = extIp;
          mapping.internalIp = responses[i].privateIp;
          mapping.lifetime = responseView.getUint32(4);
          mapping.nonce = [responseView.getUint32(24), 
                           responseView.getUint32(28),
                           responseView.getUint32(32)];
        }
      }
      return mapping;
    });
  };

  return _addMappingPcp().then(function (mapping) {
    // If the actual lifetime is less than the requested lifetime,
    // setTimeout to refresh the mapping when it expires
    var timeoutId;
    var dLifetime = reqLifetime - mapping.lifetime;
    if (mapping.externalPort !== -1 && dLifetime > 0) {
      timeoutId = setTimeout(_this.addMappingPcp.bind(_this, intPort,
        mapping.externalPort, dLifetime), mapping.lifetime*1000);
      mapping.timeoutId = timeoutId;
    }
    // If the original lifetime is 0, refresh every 24 hrs indefinitely
    else if (mapping.externalPort !== -1 && lifetime === 0) {
      timeoutId = setTimeout(_this.addMappingPcp.bind(_this, intPort,
        mapping.externalPort, 0), 24*60*60*1000);
      mapping.timeoutId = timeoutId;
    }
    // If we're not refreshing, delete the entry in activeMapping at expiration
    else if (mapping.externalPort !== -1) {
      setTimeout(function () {
        delete activeMappings[mapping.externalPort];
      }, mapping.lifetime*1000);
    }

    // If the mapping operation is successful, add it to activeMappings
    if (mapping.externalPort !== -1) {
      activeMappings[mapping.externalPort] = mapping;
    }
    return mapping;
  });
};

/**
* Deletes a port mapping in the NAT with PCP
* @public
* @method deleteMappingPcp
* @param {number} extPort The external port of the mapping to delete
* @return {Promise<boolean>} True on success, false on failure
*/
PortControl.prototype.deleteMappingPcp = function (extPort) {
  var _this = this;

  return _this.getPrivateIps().then(function (privateIps) {
    // Get the internal port and nonce for this mapping; this may error
    var intPort = activeMappings[extPort].internalPort;
    var nonce = activeMappings[extPort].nonce;

    // Construct an array of ArrayBuffers, which are the responses of
    // sendPmpRequest() calls on all the router IPs. An error result
    // is caught and re-passed as null.
    return Promise.all(routerIps.map(function (routerIp) {
        // Choose a privateIp based on the currently selected routerIp,
        // using a longest prefix match, and send a PCP request with that IP
        var privateIp = _this.longestPrefixMatch(privateIps, routerIp);
        return _this.sendPcpRequest(routerIp, privateIp, intPort, 0, 0, nonce).
            then(function (pcpResponse) { return pcpResponse; }).
            catch(function (err) { return null; });
      }));
  }).then(function (responses) {
    // Return true if any of the responses are successful (not null)
    for (var i = 0; i < responses.length; i++) {
      if (responses[i] !== null) {
        // Check that the success code of the response is 0 or 8
        // Success code 8 (NO_RESOURCES) may denote that the mapping does not
        // exist on the router, so we accept it as well
        var responseView = new DataView(responses[i]);
        var successCode = responseView.getUint8(3);
        if (successCode === 0 || successCode === 8) {
          clearTimeout(activeMappings[extPort].timeoutId);
          delete activeMappings[extPort];
          return true;
        } 
      }
    }
    return false;
  }).catch(function (err) {
    return false;
  });
};

/**
* Send a PCP request to the router to map a port
* @private
* @method sendPcpRequest
* @param {string} routerIp The IP address that the router can be reached at
* @param {string} privateIp The private IP address of the user's computer
* @param {number} intPort The internal port on the computer to map to
* @param {number} extPort The external port on the router to map to
* @param {number} lifetime Seconds that the mapping will last
* @param {array} nonce (Optional) A specified nonce for the PCP request
* @return {Promise<ArrayBuffer>} A promise that fulfills with the PCP response
*                                or rejects on timeout
*/
PortControl.prototype.sendPcpRequest = function (routerIp, privateIp, intPort, 
                                                 extPort, lifetime, nonce) {
  var socket;
  var _this = this;

  var _sendPcpRequest = new Promise(function (F, R) {
    socket = freedom['core.udpsocket']();

    // Fulfill when we get any reply (failure is on timeout in wrapper function)
    socket.on('onData', function (pcpResponse) {
      _this.closeSocket(socket);
      F(pcpResponse.data);
    });

    // Bind a UDP port and send a PCP request
    socket.bind('0.0.0.0', 0).then(function (result) {
      // Create the PCP MAP request as an ArrayBuffer
      // Map internal port 55556 to external port 55556 w/ 120 sec lifetime
      var pcpBuffer = new ArrayBuffer(60);
      var pcpView = new DataView(pcpBuffer);
      // Version field (1 byte)
      pcpView.setInt8(0, parseInt('00000010', 2));
      // R and Opcode fields (1 bit + 7 bits)
      pcpView.setInt8(1, parseInt('00000001', 2));
      // Reserved field (2 bytes)
      pcpView.setInt16(2, 0, false);
      // Requested lifetime (4 bytes)
      pcpView.setInt32(4, lifetime, false);
      // Client IP address (128 bytes; we use the IPv4 -> IPv6 mapping)
      pcpView.setInt32(8, 0, false);
      pcpView.setInt32(12, 0, false);
      pcpView.setInt16(16, 0, false);
      pcpView.setInt16(18, 0xffff, false);
      // Start of IPv4 octets of the client's private IP
      var ipOctets = ipaddr.IPv4.parse(privateIp).octets;
      pcpView.setInt8(20, ipOctets[0]);
      pcpView.setInt8(21, ipOctets[1]);
      pcpView.setInt8(22, ipOctets[2]);
      pcpView.setInt8(23, ipOctets[3]);
      // Mapping Nonce (12 bytes)
      if (nonce === undefined) {
        nonce = [_this.randInt(0, 0xffffffff), 
                 _this.randInt(0, 0xffffffff), 
                 _this.randInt(0, 0xffffffff)];
      }
      pcpView.setInt32(24, nonce[0], false);
      pcpView.setInt32(28, nonce[1], false);
      pcpView.setInt32(32, nonce[2], false);
      // Protocol (1 byte)
      pcpView.setInt8(36, 17);
      // Reserved (3 bytes)
      pcpView.setInt16(37, 0, false);
      pcpView.setInt8(39, 0);
      // Internal and external ports
      pcpView.setInt16(40, intPort, false);
      pcpView.setInt16(42, extPort, false);
      // External IP address (128 bytes; we use the all-zero IPv4 -> IPv6 mapping)
      pcpView.setFloat64(44, 0, false);
      pcpView.setInt16(52, 0, false);
      pcpView.setInt16(54, 0xffff, false);
      pcpView.setInt32(56, 0, false);

      socket.sendTo(pcpBuffer, routerIp, 5351);
    });
  });

  // Give _sendPcpRequest 2 seconds before timing out
  return Promise.race([
    this.countdownReject(2000, 'No PCP response', function () {
      _this.closeSocket(socket);
    }),
    _sendPcpRequest
  ]);
};

/**
* Probe if UPnP AddPortMapping is supported by the router
* @public
* @method probeUpnpSupport
* @return {Promise<boolean>} A promise for a boolean
*/
PortControl.prototype.probeUpnpSupport = function () {
  return this.addMappingUpnp(55557, 55557, 120).
      then(function (mapping) {
        if (mapping.externalPort !== -1) { return true; }
        return false;
      });
};

/**
* Makes a port mapping in the NAT with UPnP AddPortMapping
* @public
* @method addMappingUpnp
* @param {number} intPort The internal port on the computer to map to
* @param {number} extPort The external port on the router to map to
* @param {number} lifetime Seconds that the mapping will last
*                          0 is infinity; a static AddPortMapping request
* @return {Promise<Mapping>} A promise for the port mapping object 
*                               mapping.externalPort is -1 on failure
*/
PortControl.prototype.addMappingUpnp = function (intPort, extPort, lifetime) {
  var _this = this;
  var mapping = {
    protocol: 'upnp',
    internalPort: intPort,
    externalPort: -1
  };

  var _addMappingUpnp = function () {
    return _this.sendUpnpRequest(intPort, extPort, lifetime).then(function (intIp) {
      // Success response to AddPortMapping (the internal IP of the mapping)
      // The requested external port will always be mapped on success, 
      // and the lifetime will always be the requested lifetime; errors otherwise
      mapping.externalPort = extPort;
      mapping.internalIp = intIp;
      mapping.lifetime = lifetime;
      return mapping;
    }).catch(function (err) {
      // Either timeout, runtime error, or error response to AddPortMapping
      console.log("UPnP failed at: " + err.message);
      return mapping;
    });
  };

  return _addMappingUpnp().then(function (mapping) {
    // Note: We never refresh for UPnP as the requested lifetime is always
    // the actual lifetime of the mapping, and 0 is infinity per the protocol

    // Delete the entry from activeMapping at expiration
    if (mapping.externalPort !== -1 && lifetime !== 0) {
      setTimeout(function () {
        delete activeMappings[mapping.externalPort];
      }, mapping.lifetime*1000);
    }

    // If the mapping operation is successful, add it to activeMappings
    if (mapping.externalPort !== -1) {
      activeMappings[mapping.externalPort] = mapping;
    }
    return mapping;
  });
};

/**
* Deletes a port mapping in the NAT with UPnP DeletePortMapping
* @public
* @method deleteMappingUpnp
* @param {number} extPort The external port of the mapping to delete
* @return {Promise<boolean>} True on success, false on failure
*/
PortControl.prototype.deleteMappingUpnp = function (extPort) {
  var _this = this;

  return _this.sendSsdpRequest().then(function (ssdpResponses) {
    // After collecting all the SSDP responses, try to get the
    // control URL field for each response, and return an array
    return Promise.all(ssdpResponses.map(function (ssdpResponse) {
      return _this.fetchControlUrl(ssdpResponse).
          then(function (controlUrl) { return controlUrl; }).
          catch(function (err) { return null; });
    }));
  }).then(function (controlUrls) {
    // Find the first control URL that we received; we use it for DeletePortMapping
    var controlUrl;
    for (var i = 0; i < controlUrls.length; i++) {
      if (controlUrls[i] !== null) {
        controlUrl = controlUrls[i];
        break;
      }
    }
    // Send the DeletePortMapping request
    if (controlUrl !== undefined) {
      return _this.sendDeletePortMapping(controlUrl, extPort);
    } else {
      R(new Error("No UPnP devices have a control URL"));
    }
  }).then(function (result) {
    delete activeMappings[extPort];
    return true;
  }).catch(function (err) {
    return false;
  });
};

/**
* Runs the UPnP procedure for mapping a port
* @private
* @method sendUpnpRequest
* @param {number} intPort The internal port on the computer to map to
* @param {number} extPort The external port on the router to map to
* @param {number} lifetime Seconds that the mapping will last
* @return {Promise<string>} A promise that fulfills with the internal IP of the 
*                           mapping, or rejects on timeout.
*/
PortControl.prototype.sendUpnpRequest = function (intPort, extPort, lifetime) {
  var _this = this;
  var internalIp;

  return new Promise(function (F, R) {
    _this.sendSsdpRequest().then(function (ssdpResponses) {
      // After collecting all the SSDP responses, try to get the
      // control URL field for each response, and return an array
      return Promise.all(ssdpResponses.map(function (ssdpResponse) {
        return _this.fetchControlUrl(ssdpResponse).
            then(function (controlUrl) { return controlUrl; }).
            catch(function (err) { return null; });
      }));
    }).then(function (controlUrls) {
      // Find the first control URL that we received; use it for AddPortMapping
      var routerIp;
      var controlUrl;
      for (var i = 0; i < controlUrls.length; i++) {
        controlUrl = controlUrls[i];
        if (controlUrl !== null) {
          // Parse the router IP from the control URL
          routerIp = (new URL(controlUrl)).hostname;
          break;
        }
      }

      if (routerIp !== undefined) {
        // Get the correct internal IP (if there are multiple network interfaces)
        // for this UPnP router, by doing a longest prefix match, and use it to
        // send an AddPortMapping request
        return _this.getPrivateIps().then(function(privateIps) {
          internalIp = _this.longestPrefixMatch(privateIps, routerIp);

          return _this.sendAddPortMapping(controlUrl, internalIp, intPort, 
                                          extPort, lifetime);
        });
      } else {
        R(new Error("No UPnP devices have a control URL"));
      }
    }).then(function (result) {
      F(internalIp);  // Result is a non-descriptive success message, no need to return
    }).catch(function (err) {
      R(err);
    });
  });
};

/**
* Send a UPnP SSDP request on the network and collects responses
* @private
* @method sendSsdpRequest
* @return {Promise<Array>} A promise that fulfills with an array of SSDP response,
*                          or rejects on timeout
*/
PortControl.prototype.sendSsdpRequest = function () {
  var _this = this;
  var ssdpResponses = [];
  var socket = freedom['core.udpsocket']();

  // Fulfill when we get any reply (failure is on timeout or invalid parsing)
  socket.on('onData', function (ssdpResponse) {
    ssdpResponses.push(ssdpResponse.data);
  });

  // Bind a socket and send the SSDP request
  socket.bind('0.0.0.0', 0).then(function (result) {
    // Construct and send a UPnP SSDP message
    var ssdpStr = 'M-SEARCH* HTTP/1.1\r\n' +
                  'HOST: 239.255.255.250:1900\r\n' +
                  'MAN: ssdp:discover\r\n' +
                  'MX: 10\r\n' +
                  'ST: urn:schemas-upnp-org:device:InternetGatewayDevice:1';
    var ssdpBuffer = _this.stringToArrayBuffer(ssdpStr);
    socket.sendTo(ssdpBuffer, '239.255.255.250', 1900);
  });

  // Collect SSDP responses for 1 second before timing out
  return new Promise(function (F, R) {
    setTimeout(function () {
      if (ssdpResponses.length > 0) { F(ssdpResponses); }
      else { R(new Error("SSDP timeout")); }
    }, 1000);
  });
};

/**
* Fetch the control URL from the information provided in the SSDP response
* @private
* @method fetchControlUrl
* @param {ArrayBuffer} ssdpResponse The ArrayBuffer response to the SSDP message
* @return {string} The string of the control URL for the router
*/
PortControl.prototype.fetchControlUrl = function (ssdpResponse) {
  var _this = this;

  var _fetchControlUrl = new Promise(function (F, R) {
    var ssdpStr = _this.arrayBufferToString(ssdpResponse);
    var startIndex = ssdpStr.indexOf('LOCATION:') + 9;
    var endIndex = ssdpStr.indexOf('\n', startIndex);
    var locationUrl = ssdpStr.substring(startIndex, endIndex).trim();

    // Reject if there is no LOCATION header
    if (startIndex === 8) {
      R(new Error('No LOCATION header for UPnP device'));
      return;
    }

    // Get the XML device description at location URL
    var xhr = new XMLHttpRequest();
    xhr.open('GET', locationUrl, true);
    xhr.onreadystatechange = function () {
      if (xhr.readyState === 4) {
        // Get control URL from XML file
        // (Ideally we would parse and traverse the XML tree,
        // but DOMParser is not available here)
        var xmlDoc = xhr.responseText;
        var preIndex = xmlDoc.indexOf('WANIPConnection');
        var startIndex = xmlDoc.indexOf('<controlURL>', preIndex) + 13;
        var endIndex = xmlDoc.indexOf('</controlURL>', startIndex);

        // Reject if there is no controlUrl
        if (preIndex === -1 || startIndex === 12) {
          R(new Error('Could not parse control URL'));
          return;
        }

        // Combine the controlUrl path with the locationUrl
        var controlUrlPath = xmlDoc.substring(startIndex, endIndex);
        var locationUrlParser = new URL(locationUrl);
        var controlUrl = 'http://' + locationUrlParser.host +
                         '/' + controlUrlPath;

        F(controlUrl);
      }
    };
    xhr.send();
  });

  // Give _fetchControlUrl 1 second before timing out
  return Promise.race([
    _this.countdownReject(1000, 'Time out when retrieving description XML'),
    _fetchControlUrl
  ]);
};

/**
* Send an AddPortMapping request to the router's control URL
* @private
* @method sendAddPortMapping
* @param {string} controlUrl The control URL of the router
* @param {string} privateIp The private IP address of the user's computer
* @param {number} intPort The internal port on the computer to map to
* @param {number} extPort The external port on the router to map to
* @param {number} lifetime Seconds that the mapping will last
* @return {string} The response string to the AddPortMapping request
*/
PortControl.prototype.sendAddPortMapping = function (controlUrl, privateIp, intPort, extPort, lifetime) {
  var _sendAddPortMapping = new Promise(function (F, R) {

    // Create the AddPortMapping SOAP request string
    var apm = '<?xml version="1.0"?>' +
              '<s:Envelope s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/" xmlns:s="http://schemas.xmlsoap.org/soap/envelope/">' +
               '<s:Body>' +
                  '<u:AddPortMapping xmlns:u="urn:schemas-upnp-org:service:WANIPConnection:1">' +
                     '<NewExternalPort>' + extPort + '</NewExternalPort>' +
                     '<NewProtocol>UDP</NewProtocol>' +
                     '<NewInternalPort>' + intPort + '</NewInternalPort>' +
                     '<NewInternalClient>' + privateIp + '</NewInternalClient>' +
                     '<NewEnabled>1</NewEnabled>' +
                     '<NewPortMappingDescription>uProxy UPnP</NewPortMappingDescription>' +
                     '<NewLeaseDuration>' + lifetime + '</NewLeaseDuration>' +
                  '</u:AddPortMapping>' +
                '</s:Body>' +
              '</s:Envelope>';

    // Create an XMLHttpRequest that encapsulates the SOAP string
    var xhr = new XMLHttpRequest();
    xhr.open('POST', controlUrl, true);
    xhr.setRequestHeader('Content-Type', 'text/xml');
    xhr.setRequestHeader('SOAPAction', '"urn:schemas-upnp-org:service:WANIPConnection:1#AddPortMapping"');

    // Send the AddPortMapping request
    xhr.onreadystatechange = function () {
      if (xhr.readyState === 4 && xhr.status === 200) {
        // Success response to AddPortMapping
        F(xhr.responseText);
      } else if (xhr.readyState === 4 && xhr.status === 500) {
        // Error response to AddPortMapping
        var responseText = xhr.responseText;
        var startIndex = responseText.indexOf('<errorDescription>') + 18;
        var endIndex = responseText.indexOf('</errorDescription>', startIndex);
        var errorDescription = responseText.substring(startIndex, endIndex);
        R(new Error('AddPortMapping Error: ' + errorDescription));
      }
    };
    xhr.send(apm);
  });

  // Give _sendAddPortMapping 1 second to run before timing out
  return Promise.race([
    this.countdownReject(1000, 'AddPortMapping time out'),
    _sendAddPortMapping
  ]);
};

/**
* Send a DeletePortMapping request to the router's control URL
* @private
* @method sendDeletePortMapping
* @param {string} controlUrl The control URL of the router
* @param {number} extPort The external port of the mapping to delete
* @return {string} The response string to the AddPortMapping request
*/
PortControl.prototype.sendDeletePortMapping = function (controlUrl, extPort) {
  var _sendDeletePortMapping = new Promise(function (F, R) {
    // Create the DeletePortMapping SOAP request string
    var apm = '<?xml version="1.0"?>' +
              '<s:Envelope s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/" xmlns:s="http://schemas.xmlsoap.org/soap/envelope/">' +
               '<s:Body>' +
                  '<u:DeletePortMapping xmlns:u="urn:schemas-upnp-org:service:WANIPConnection:1">' +
                     '<NewRemoteHost></NewRemoteHost>' +
                     '<NewExternalPort>' + extPort + '</NewExternalPort>' +
                     '<NewProtocol>UDP</NewProtocol>' +
                  '</u:DeletePortMapping>' +
                '</s:Body>' +
              '</s:Envelope>';

    // Create an XMLHttpRequest that encapsulates the SOAP string
    var xhr = new XMLHttpRequest();
    xhr.open('POST', controlUrl, true);
    xhr.setRequestHeader('Content-Type', 'text/xml');
    xhr.setRequestHeader('SOAPAction', '"urn:schemas-upnp-org:service:WANIPConnection:1#DeletePortMapping"');

    // Send the DeletePortMapping request
    xhr.onreadystatechange = function () {
      if (xhr.readyState === 4 && xhr.status === 200) {
        // Success response to DeletePortMapping
        F(xhr.responseText);
      } else if (xhr.readyState === 4 && xhr.status === 500) {
        // Error response to DeletePortMapping
        // It seems that this almost never errors, even with invalid port numbers
        var responseText = xhr.responseText;
        var startIndex = responseText.indexOf('<errorDescription>') + 18;
        var endIndex = responseText.indexOf('</errorDescription>', startIndex);
        var errorDescription = responseText.substring(startIndex, endIndex);
        R(new Error('DeletePortMapping Error: ' + errorDescription));
      }
    };
    xhr.send(apm);
  });

  // Give _sendDeletePortMapping 1 second to run before timing out
  return Promise.race([
    this.countdownReject(1000, 'DeletePortMapping time out'),
    _sendDeletePortMapping
  ]);
};

/**
* Returns the current value of activeMappings
* @public
* @method getActiveMappings
* @return {Promise<Array<Mapping>>} A promise that resolves to activeMappings
*/
PortControl.prototype.getActiveMappings = function () {
  return Promise.resolve(activeMappings);
};

/**
* Return the private IP addresses of the computer
* @public
* @method getPrivateIps
* @return {Promise<string>} A promise that fulfills with a list of IP address, 
*                           or rejects on timeout
*/
PortControl.prototype.getPrivateIps = function () {
  var privateIps = [];
  var pc = freedom['core.rtcpeerconnection']({iceServers: []});

  // Find all the ICE candidates that are "host" candidates
  pc.on('onicecandidate', function (candidate) {
    if (candidate.candidate) {
      var cand = candidate.candidate.candidate.split(' ');
      if (cand[7] === 'host') {
        var privateIp = cand[4];
        if (ipaddr.IPv4.isValid(privateIp)) {
          if (privateIps.indexOf(privateIp) == -1) {
            privateIps.push(privateIp);
          }
        }
      }
    }
  });

  // Set up the PeerConnection to start generating ICE candidates
  pc.createDataChannel('dummy data channel').
      then(pc.createOffer).
      then(pc.setLocalDescription);

  // Gather candidates for 2 seconds before returning privateIps or timing out
  return new Promise(function (F, R) {
    setTimeout(function () {
      if (privateIps.length > 0) { F(privateIps); }
      else { R(new Error("getPrivateIps() failed")); }
    }, 2000);
  });
};

/**
* Return a promise that rejects in a given time with an Error message,
* and can call a callback function before rejecting
* @private
* @method countdownReject
* @param {number} time Time in seconds
* @param {number} msg Message to encapsulate in the rejected Error
* @param {function} callback Function to call before rejecting
* @return {Promise} A promise that will reject in the given time
*/
PortControl.prototype.countdownReject = function (time, msg, callback) {
  return new Promise(function (F, R) {
    setTimeout(function () {
      if (callback !== undefined) { callback(); }
      R(new Error(msg));
    }, time);
  });
};

/**
* Close the OS-level sockets and discard its Freedom object
* @private
* @method closeSocket
* @param {freedom_UdpSocket.Socket} socket The socket object to close
*/
PortControl.prototype.closeSocket = function (socket) {
  socket.destroy().then(function () {
    freedom['core.udpsocket'].close(socket);
  });
};

/**
* Deletes all the currently active port mappings
* @public
* @method close
*/
PortControl.prototype.close = function () {
  var _this = this;

  return new Promise(function (F, R) {
    // Get all the keys (extPorts) of activeMappings
    var extPorts = [];
    for (var extPort in activeMappings) {
      if (activeMappings.hasOwnProperty(extPort)) {
        extPorts.push(extPort);
      }
    }

    // Delete them all
    Promise.all(extPorts.map(_this.deleteMapping.bind(_this))).then(function () {
      F();
    });
  });
};

/**
* Takes a list of IP addresses (a user's private IPs) and an IP address for a
* router/subnet, and returns the IP that has the longest prefix match with the
* router's IP
* @private
* @method longestPrefixMatch
* @param {Array} ipList List of IP addresses to find the longest prefix match in
* @param {string} routerIp The router's IP address as a string
* @return {string} The IP from the given list with the longest prefix match
*/
PortControl.prototype.longestPrefixMatch = function (ipList, routerIp) {
  var prefixMatches = [];
  routerIp = ipaddr.IPv4.parse(routerIp);
  for (var i = 0; i < ipList.length; i++) {
    var ip = ipaddr.IPv4.parse(ipList[i]);
    // Use ipaddr.js to find the longest prefix length (mask length)
    for (var mask = 1; mask < 32; mask++) {
      if (!ip.match(routerIp, mask)) {
        prefixMatches.push(mask - 1);
        break;
      }
    }
  }

  // Find the argmax for prefixMatches, i.e. the index of the correct private IP
  var maxIndex = prefixMatches.indexOf(Math.max.apply(null, prefixMatches));
  var correctIp = ipList[maxIndex];
  return correctIp;
};

/**
* Return a random integer in a specified range
* @private
* @method randInt
* @param {number} min Lower bound for the random integer
* @param {number} max Upper bound for the random integer
* @return {number} A random number between min and max
*/
PortControl.prototype.randInt = function (min, max) {
  return Math.floor(Math.random()* (max - min + 1)) + min;
};

/**
* Convert an ArrayBuffer to a UTF-8 string
* @private
* @method arrayBufferToString
* @param {ArrayBuffer} buffer ArrayBuffer to convert
* @return {string} A string converted from the ArrayBuffer
*/
PortControl.prototype.arrayBufferToString = function (buffer) {
    var bytes = new Uint8Array(buffer);
    var a = [];
    for (var i = 0; i < bytes.length; ++i) {
        a.push(String.fromCharCode(bytes[i]));
    }
    return a.join('');
};

/**
* Convert a UTF-8 string to an ArrayBuffer
* @private
* @method stringToArrayBuffer
* @param {string} s String to convert
* @return {ArrayBuffer} An ArrayBuffer containing the string data
*/
PortControl.prototype.stringToArrayBuffer = function (s) {
    var buffer = new ArrayBuffer(s.length);
    var bytes = new Uint8Array(buffer);
    for (var i = 0; i < s.length; ++i) {
        bytes[i] = s.charCodeAt(i);
    }
    return buffer;
};

module.exports = PortControl;