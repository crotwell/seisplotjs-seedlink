
//var seedlink = require('seisplotjs-seedlink');
// this global comes from the seisplotjs_seedlink standalone js
var seedlink = seisplotjs_seedlink

//var wp = require('seisplotjs-waveformplot');
// this global comes from the seisplotjs_waveformplot standalone js
var wp = seisplotjs_waveformplot;

var clockOffset = 0; // should get from server somehow
var duration = 300;
var maxSteps = -1; // max num of ticks of the timer before stopping, for debugin
var timeWindow = wp.calcStartEndDates(null, null, duration, clockOffset);
console.log("timeWindow: "+timeWindow.start+" "+timeWindow.end);
var protocol = 'http:';
if ("https:" == document.location.protocol) {
  protocol = 'https:'
}
var wsProtocol = 'ws:';
if (protocol == 'https:') {
  wsProtocol = 'wss:';
}
//
// Note: currently rtserve.iris does not support wss, and so this will
// not work from https pages as you cannot use non-encrypted (ws)
// loaded from a https web page
//
var IRIS_HOST = "rtserve.iris.washington.edu";
var host = IRIS_HOST;
var port = 80;
var datalinkUrl = wsProtocol+"//"+host+(port==80?'':'80')+'/datalink';
console.log("URL: "+datalinkUrl);

var match =
  'TA_KMSC__HHZ/MSEED'
  +'|'
  +'CO_JSC_00_HHZ/MSEED'
  +'|'
  +'CO_HAW_00_HHZ/MSEED'
  +'|'
  +'N4_Y57A__BHZ/MSEED';

wp.d3.select('span.match').text(match);

//wp.createPlotsBySelector('div.myseisplot');
console.log("before select");
var svgParent = wp.d3.select('div.realtime');
if (wsProtocol == 'wss:' && host == IRIS_HOST) {
  svgParent.append("h3").attr('class', 'waitingondata').text("IRIS currently does not support connections from https pages, try from a http page instead.");
} else {
  svgParent.append("p").attr('class', 'waitingondata').text("waiting on first data");
}

var allSeisPlots = {};
var margin = {top: 20, right: 20, bottom: 50, left: 60};

var callbackFn = function(dlPacket) {
  var codes = dlPacket.miniseed.codes();
  //console.log("datalink: pktid="+dlPacket.pktid+" "+codes);
  var seismogram = wp.miniseed.createSeismogram([dlPacket.miniseed]);
  if (allSeisPlots[ codes ]) {
    allSeisPlots[ codes ].trim(timeWindow);
    allSeisPlots[ codes ].append(seismogram);
  } else {
    svgParent.select("p.waitingondata").remove();
    var seisDiv = svgParent.append('div').attr('class', codes);
//    seisDiv.append('p').text(codes);
    var plotDiv = seisDiv.append('div').attr('class', 'realtimePlot');
    var seisPlot = new wp.Seismograph(plotDiv, [seismogram], timeWindow.start, timeWindow.end);
    seisPlot.disableWheelZoom();
    seisPlot.setXSublabel(codes);
    seisPlot.setMargin(margin );
    seisPlot.draw();
    allSeisPlots[dlPacket.miniseed.codes()] = seisPlot;
  }
}

var paused = false;
var stopped = false;
var numSteps = 10;
var timerInterval = (timeWindow.end.valueOf()-timeWindow.start.valueOf())/
                    (parseInt(svgParent.style("width"))-margin.left-margin.right);
var timer = wp.d3.interval(function(elapsed) {
  if ( paused) {
    return;
  }
  if ( Object.keys(allSeisPlots).length > 1) {
    numSteps++;
    if (maxSteps > 0 && numSteps > maxSteps ) {
      console.log("quit after max steps: "+maxSteps);
      timer.stop();
      dlConn.close();
    }
  }
  timeWindow = wp.calcStartEndDates(null, null, duration, clockOffset);
  for (var key in allSeisPlots) {
    if (allSeisPlots.hasOwnProperty(key)) {
      allSeisPlots[key].setPlotStartEnd(timeWindow.start, timeWindow.end);
    }
  }
}, timerInterval);

wp.d3.select("button#pause").on("click", function(d) {
  console.log("Pause..."+paused);
  paused = ! paused;
  if (paused) {
    wp.d3.select(this).text("Play");
  } else {
    wp.d3.select(this).text("Pause");
  }
});

wp.d3.select("button#disconnect").on("click", function(d) {
  console.log("disconnect..."+stopped);
  stopped = ! stopped;
  if (stopped) {
    dlConn.endStream();
    wp.d3.select(this).text("Reconnect");
  } else {
    dlConn.stream();
    wp.d3.select(this).text("Disconnect");
  }
});

var errorFn = function(error) {
  console.log("error: "+error);
  svgParent.select("p").text("Error: "+error);
};

var dlConn = new seedlink.DataLinkConnection(datalinkUrl, callbackFn, errorFn);
var promise = dlConn.connect();
promise = promise.then(function() {
  return dlConn.awaitDLCommand("MATCH", match);
});
promise = promise.then(function() {
  // get epoch millis, convert to epoch micros
  var startMicros = 1000*timeWindow.start.valueOf();
  console.log("start: "+timeWindow.start.toISOString()+" "+timeWindow.start.valueOf());
  return dlConn.awaitDLCommand("POSITION AFTER "+startMicros);
}).then(function() {
  return dlConn.stream();
})
