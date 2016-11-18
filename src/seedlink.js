/**
 * Philip Crotwell
 * University of South Carolina, 2016
 * http://www.seis.sc.edu
 */

import * as miniseed from 'seisplotjs-miniseed';
import * as RSVP from 'rsvp';

/* reexport */
export { miniseed };

RSVP.on('error', function(reason) {
  console.assert(false, reason);
});

export class SeedlinkConnection {
  constructor(url, requestConfig, receiveMiniseedFn, errorFn) {
    this.url = url;
    this.requestConfig = requestConfig;
    this.receiveMiniseedFn = receiveMiniseedFn;
    this.errorFn = errorFn;
  }

  connect() {
    this.webSocket = new WebSocket(this.url, "seedlink");
//    this.webSocket.onmessage(this.handle);
    this.webSocket.binaryType = 'arraybuffer';
    const that = this;
    this.webSocket.onopen = function(event) {
      console.log("In onopen");
      that.sendHello(that.webSocket)
      .then(function(val) {
        return that.sendCmdArray(that.webSocket, that.requestConfig);
      })
      .then(function(val) {
        console.log("before send DATA");
        return that.sendCmdArray(that.webSocket, [ 'DATA' ]);
      })
      .then(function(val) {
        console.log("wait for miniseed ");
        that.webSocket.onmessage = function(event) {
          that.handle(event);
        };
        that.webSocket.send('END\r');
        return val;
      }, function(err) {
        console.log("reject: "+err);
        that.close();
      });
    };
  }

  close() {
    console.log("Closing webSocket.");
    if (this.webSocket) {
      this.webSocket.close();
    }
  }

  handle(event) {
    if (event.data.byteLength < 64) {
      //assume text
      console.log("handle text: "+event.data.byteLength+" "+arrayBufferToString(event.data));
    } else {
console.log("handle miniseed: "+event.data.byteLength);
      this.handleMiniseed(event);
    }
  }

  handleMiniseed(event) {
    try {
       // let arrBuf = new ArrayBuffer(event.data);
        if (event.data.byteLength < 64) {
          errorFn("message too small to be miniseed: "+event.data.byteLength +" "+arrayBufferToString(event.data));
console.log("message too small to be miniseed: "+event.data.byteLength);
          return;
        }
        let slHeader = new DataView(event.data, 0, 8);
        // check for 'SL' at start
        if (slHeader.getInt8(0) === 83 && slHeader.getInt8(1) === 76) {
          let seqStr = '';
          for (let i=0; i<6; i++) {
            seqStr = seqStr + String.fromCharCode(slHeader.getInt8(2+i));
          }
          let dataView = new DataView(event.data, 8, event.data.byteLength-8);
          let out = {
            rawsequence: seqStr,
            sequence: parseInt(seqStr, 16),
            miniseed: new miniseed.DataRecord(dataView)
          }
          this.receiveMiniseedFn(out);
        } else {
          errorFn("Not a seedlink packet, no starting SL: "+slHeader.getInt8(0)+' '+slHeader.getInt8(1));
        }
     } catch(e) {
console.log("catch "+e);
        this.close();
     }
  }

  sendHello(webSocket) {
console.log("in sendHello");
  let promise = new RSVP.Promise(function(resolve, reject) {
console.log('in sendHello promise');
    webSocket.onmessage = function(event) {
      console.log("msg: "+event);
      let replyMsg = arrayBufferToString(event.data);
      console.log("HELLO resp: "+replyMsg);
      let lines = replyMsg.trim().split('\r');
      if (lines.length == 2) {
        resolve(lines);
      } else {
        reject("not 2 lines: "+replyMsg);
      }
    };
console.log("send HELLO");
    webSocket.send("HELLO\r");
  });
  return promise;
}

  sendCmdArray(webSocket, cmd) {
    console.log('in sendCmdArray');
    let that = this;
    return cmd.reduce(function(cur, next) {
      return cur.then(function() {
        return that.createCmdPromise(webSocket, next);
      });
    }, RSVP.resolve());
  }

  createCmdPromise(webSocket, mycmd) {
console.log("create cmd promise for "+mycmd+" "+webSocket);
    let promise = new RSVP.Promise(function(resolve, reject) {
      console.log("my cmd: "+mycmd);
      webSocket.onmessage = function(event) {
        let replyMsg = arrayBufferToString(event.data).trim();
        console.log("resp: "+replyMsg);
        if (replyMsg === 'OK') {
console.log("sendCmd "+mycmd+" resp is OK");
          resolve(replyMsg);
        } else {
console.log("sendCmd "+mycmd+" resp is NOT ok "+replyMsg);
          reject("msg not OK: "+replyMsg);
        }
      }
      console.log("seedlink send cmd: "+mycmd);
      webSocket.send(mycmd+'\r\n');
    });
    return promise;
  }
};

export function arrayBufferToString(arrBuf) {
  let dataView = new DataView(arrBuf);
  let decoder = new TextDecoder('utf-8');
  let decodedString = decoder.decode(dataView);
  return decodedString;
};
