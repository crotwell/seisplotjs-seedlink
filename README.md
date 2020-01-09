
# Note:
This code has been merged directly into the main
[seisplotjs](https://github.com/crotwell/seisplotjs)
repo in version 2.0. Please use it instead. This repository
is no longer maintained and is read-only.


[![npm](https://img.shields.io/npm/v/seisplotjs-seedlink.svg)](https://www.npmjs.com/package/seisplotjs-seedlink)

# seisplotjs-seedlink
Connect to a [ringserver](https://seiscode.iris.washington.edu/projects/ringserver) seedlink or datalink server using websockets and received miniseed data from it. The server must be capable of accepting http connections and upgrading them to websockets for this to work.

See

http://ds.iris.edu/ds/nodes/dmc/services/seedlink/

http://www.seiscomp3.org/wiki/doc/applications/seedlink

### Install

```
npm i seisplotjs-seedlink
```

### Building

You need [npm](http://npmjs.com) installed first. Then run ```npm install``` to pull in dependencies and install the package locally.

```npm run lint``` will display lint errors

```npm run compile``` will run the babel transpiler and output to the lib dir. This is what will be used if
you depend on this package from another npm package.

```npm run standalone``` will both run babel to transpile and browserify to load dependencies and generate a self contained js file. This is probably easiest to use if you just want to play in a single web page.

### Examples

The example is available at [here](http://www.seis.sc.edu/~crotwell/seisplotjs_demo/realtime/)

There are two examples. The first,
[consoleLogSeedlink](http://www.seis.sc.edu/~crotwell/seisplotjs_demo/realtime/consoleLogSeedlink.html),
 makes the seedlink websocket connection and logs each arriving packet into a textarea. The second,
 [seedlink](http://www.seis.sc.edu/~crotwell/seisplotjs_demo/realtime/seedlink.html)
 , plots the waveforms using [seisplotjs-waveformplot](http://github.com/crotwell/seisplotjs-waveformplot). The first just requires the standalone js file output from ```npm run standalone``` while the second also requires the standalone js file from seisplotjs-waveformplot.

Two additional examples,
[consoleLogDataLink](http://www.seis.sc.edu/~crotwell/seisplotjs_demo/realtime/consoleLogDataLink.html)
 and [datalink](http://www.seis.sc.edu/~crotwell/seisplotjs_demo/realtime/datalink.html) are similar to the above but use the DataLink protocol instead of SeedLink.


 [API Documentation](http://www.seis.sc.edu/software/seisplotjs/seedlink/)
