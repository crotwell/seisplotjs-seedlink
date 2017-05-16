# seisplotjs-seedlink
Connect to a [ringserver](https://seiscode.iris.washington.edu/projects/ringserver) seedlink server using websockets and received miniseed data from it. The server must be capable of accepting http connections and upgrading them to websockets for this to work.

See 

http://ds.iris.edu/ds/nodes/dmc/services/seedlink/

http://www.seiscomp3.org/wiki/doc/applications/seedlink

### Building

```
npm i seisplotjs-seedlink
```

or

You need [npm](http://npmjs.com) installed first. Then run ```npm install``` to pull in dependencies and install the package locally.

```npm run lint``` will display lint errors

```npm run compile``` will run the babel transpiler and output to the lib dir. This is what will be used if
you depend on this package from another npm package.

```npm run standalone``` will both run babel to transpile and browserify to load dependencies and generate a self contained js file. This is probably easiest to use if you just want to play in a single web page.

### Examples

There are two examples. The first, consoleLogSeedlink, makes the seedlink websocket connection and logs each arriving packet into a textarea. The second, multipleChans.html, plots the waveforms using [seisplotjs-waveformplot](http://github.com/crotwell/seisplotjs-waveformplot). The first just requires the standalone js file output from ```npm run standalone``` while the second also requires the standalone js file from seisplotjs-waveformplot.
