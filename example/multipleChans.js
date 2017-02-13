
//var seedlink = require('seisplotjs-seedlink');
// this global comes from the seisplotjs_seedlink standalone js
var seedlink = seisplotjs_seedlink

//var wp = require('seisplotjs-waveformplot');
// this global comes from the seisplotjs_seedlink standalone js
var wp = seisplotjs_waveformplot;

let clockOffset = 0; // should get from server somehow
let duration = 300;
let maxSteps = -1; // max num of ticks of the timer before stopping, for debugin
let timeWindow = wp.calcStartEndDates(null, null, duration, clockOffset);
console.log("timeWindow: "+timeWindow.start+" "+timeWindow.end);
let protocol = 'http:';
if ("https:" == document.location.protocol) {
  protocol = 'https:'
}
let wsProtocol = 'ws:';
if (protocol == 'https:') {
  wsProtocol = 'wss:';
}
//
// Note: currently rtserve.iris does not support wss, and so this will
// not work from https pages as you cannot use non-encrypted (ws) 
// loaded from a https web page
//
let IRIS_HOST = "rtserve.iris.washington.edu";
let host = IRIS_HOST;
let port = 80;
let seedlinkUrl = wsProtocol+"//"+host+(port==80?'':'80')+'/seedlink';
console.log("URL: "+seedlinkUrl);

let config = [
  'STATION KMSC TA',
  'SELECT --HHZ.D',
  'STATION JSC CO',
  'SELECT 00HHZ.D',
  'STATION Y57A N4',
  'SELECT --BHZ.D' ];


//wp.createPlotsBySelector('div.myseisplot');
console.log("before select");
let svgParent = wp.d3.select('div.realtime');
if (wsProtocol == 'wss:' && host == IRIS_HOST) {
  svgParent.append("h3").attr('class', 'waitingondata').text("IRIS currently does not support connections from https pages, try from a http page instead.");
} else {
  svgParent.append("p").attr('class', 'waitingondata').text("waiting on first data");
} 

let allSeisPlots = {};

let callbackFn = function(slPacket) {
  let codes = slPacket.miniseed.codes();
  console.log("seedlink: seq="+slPacket.sequence+" "+codes);
  let seismogram = wp.miniseed.createSeismogram([slPacket.miniseed]);
  if (allSeisPlots[ codes ]) {
    allSeisPlots[ codes ].trim(timeWindow);
    allSeisPlots[ codes ].append(seismogram);
  } else {
    svgParent.select("p.waitingondata").remove();
    let seisDiv = svgParent.append('div').attr('class', codes);
//    seisDiv.append('p').text(codes);
    let plotDiv = seisDiv.append('div').attr('class', 'realtimePlot');
    let seisPlot = new wp.chart(plotDiv, [seismogram], timeWindow.start, timeWindow.end);
    seisPlot.disableWheelZoom();
    seisPlot.setXSublabel(codes);
    seisPlot.setMargin({top: 20, right: 20, bottom: 50, left: 60} );
    seisPlot.draw();
    allSeisPlots[slPacket.miniseed.codes()] = seisPlot;
  }
}

let numSteps = 0;
let timer = wp.d3.interval(function(elapsed) {
  if ( Object.keys(allSeisPlots).length > 1) { 
    numSteps++;
    if (maxSteps > 0 && numSteps > maxSteps ) { 
      console.log("quit after max steps: "+maxSteps);
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
}, 500);

let errorFn = function(error) {
  console.log("error: "+error);
  svgParent.select("p").text("Error: "+error);
};

let slConn = new seedlink.SeedlinkConnection(seedlinkUrl, config, callbackFn, errorFn);
slConn.setTimeCommand(new Date(new Date().getTime()-duration*1000));
slConn.connect();

