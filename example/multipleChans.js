
var seedlink = require('seisplotjs-seedlink');

var wp = require('seisplotjs-waveformplot');

let clockOffset = 0; // should get from server somehow
let duration = 300;
let timeWindow = wp.calcStartEndDates(null, null, duration, clockOffset);
console.log("timeWindow: "+timeWindow.start+" "+timeWindow.end);
let host = "service.iris.edu";
let config = [
  'STATION JSC CO',
  'SELECT 00HHZ.D',
  'SELECT 00HHN.D',
  'SELECT 00HHE.D' ];


//wp.createPlotsBySelector('div.myseisplot');
console.log("before select");
let svgParent = wp.d3.select('div.realtime');
svgParent.append("p").text("waiting on first data");

let allSeisPlots = {};

let callbackFn = function(slPacket) {
  let codes = slPacket.miniseed.codes();
  console.log("seedlink: seq="+slPacket.sequence+" "+codes);
  let seismogram = wp.miniseed.createSeismogram([slPacket.miniseed]);
  if (allSeisPlots[ codes ]) {
    allSeisPlots[ codes ].append(seismogram);
  } else {
    let plotDiv = svgParent.append('div').attr('class', codes);
    let seisPlot = new wp.chart(plotDiv, [seismogram], timeWindow.start, timeWindow.end);
    seisPlot.draw();
    allSeisPlots[slPacket.miniseed.codes()] = seisPlot;
  }
}

let numSteps = 0;
let timer = wp.d3.interval(function(elapsed) {
if ( Object.keys(allSeisPlots).length > 1) { 
  numSteps++;
if (numSteps > 30 ) { 
timer.stop();
slConn.close();
}
}
  timeWindow = wp.calcStartEndDates(null, null, duration, clockOffset);
  //console.log("reset time window for "+timeWindow.start+" "+timeWindow.end );
  for (var key in allSeisPlots) {
   if (allSeisPlots.hasOwnProperty(key)) {
     allSeisPlots[key].setPlotStartEnd(timeWindow.start, timeWindow.end);
   }
  }
}, 1000);

let errorFn = function(error) {
  console.log("error: "+error);
};

let slConn = new seedlink.SeedlinkConnection('ws://rtserve.iris.washington.edu:17000/seedlink', config, callbackFn, errorFn);
slConn.connect();

