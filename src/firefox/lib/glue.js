/**
 * @fileoverview Description of this file.
 */
function setUpConnection(freedom, panel) {
  freedom.on('2000', function(data) {
    panel.port.emit('2000', data);
  });

  freedom.on('2001', function(data) {
    panel.port.emit('2001', data);
  });

  freedom.on('2002', function(data) {
    panel.port.emit('2002', data);
  });

  freedom.on('2003', function(data) {
    panel.port.emit('2003', data);
  });

  freedom.on('2004', function(data) {
    panel.port.emit('2004', data);
  });

  freedom.on('2005', function(data) {
    panel.port.emit('2005', data);
  });

  freedom.on('2006', function(data) {
    panel.port.emit('2006', data);
  });

  freedom.on('2007', function(data) {
    panel.port.emit('2007', data);
  });

  freedom.on('2008', function(data) {
    panel.port.emit('2008', data);
  });

  freedom.on('2009', function(data) {
    panel.port.emit('2009', data);
  });

  freedom.on('2010', function(data) {
    panel.port.emit('2010', data);
  });


  freedom.on('2011', function(data) {
    panel.port.emit('2011', data);
  });

  freedom.on('2012', function(data) {
    panel.port.emit('2012', data);
  });

  freedom.on('2013', function(data) {
    panel.port.emit('2013', data);
  });

  panel.port.on('1000', function(data) {
    freedom.emit('1000', data);
  });

  panel.port.on('1001', function(data) {
    freedom.emit('1001', data);
  });

  panel.port.on('1002', function(data) {
    freedom.emit('1002', data);
  });

  panel.port.on('1003', function(data) {
    freedom.emit('1003', data);
  });

  panel.port.on('1004', function(data) {
    freedom.emit('1004', data);
  });

  panel.port.on('1005', function(data) {
    freedom.emit('1005', data);
  });

  panel.port.on('1006', function(data) {
    freedom.emit('1006', data);
  });

  panel.port.on('1007', function(data) {
    freedom.emit('1007', data);
  });

  panel.port.on('1008', function(data) {
    freedom.emit('1008', data);
  });

  panel.port.on('1009', function(data) {
    freedom.emit('1009', data);
  });

  panel.port.on('1010', function(data) {
    freedom.emit('1010', data);
  });


  panel.port.on('1011', function(data) {
    freedom.emit('1011', data);
  });

  panel.port.on('1012', function(data) {
    freedom.emit('1012', data);
  });

  panel.port.on('1013', function(data) {
    freedom.emit('1013', data);
  });

}

exports.setUpConnection = setUpConnection
