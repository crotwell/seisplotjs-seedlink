
var seedlink = require('seisplotjs-seedlink');

var wp = require('seisplotjs-waveformplot');


//wp.createPlotsBySelector('div.myseisplot');
console.log("before select");
wp.d3.select('div.realtime').each(function(d) {
console.log("in select");
  let svgParent = wp.d3.select(this);
  let net = svgParent.attr("net");
  let sta = svgParent.attr("sta");
  let loc = svgParent.attr("loc");
  let chan = svgParent.attr("chan");
  let duration = svgParent.attr("duration");
  let host = svgParent.attr("host");
  if (! host) {
    host = "service.iris.edu";
  }
  let config = [ 'STATION '+sta+' '+net,
                  'SELECT --'+chan+'.D' ];

  let dataRecords = [];

  let callbackFn = function(slPacket) {
    console.log("seedlink: seq="+slPacket.sequence+" "+slPacket.miniseed.codes());
    dataRecords.push(slPacket.miniseed);
while (dataRecords.length > 30) {
//avoid filling memory
dataRecords.shift();
}

let byChannel = wp.miniseed.byChannel(dataRecords);
            let keys = Object.keys(byChannel);
            let segments = [];
            for(let i=0; i<keys.length; i++) {
              let key = keys[i];
              segments[i] = wp.miniseed.merge(byChannel[key]);
            }
svgParent.selectAll("svg").remove();

  let seismogram = new wp.chart(svgParent,  segments);
    seismogram.draw();
console.log("after draw "+dataRecords.length);
  };
  let errorFn = function(error) {
    console.log("error: "+error);
  };

  let slConn = new seedlink.SeedlinkConnection('ws://rtserve.iris.washington.edu:17000/seedlink', config, callbackFn, errorFn);
  slConn.connect();
});
