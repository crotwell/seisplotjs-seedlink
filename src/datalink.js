/**
 * Philip Crotwell
 * University of South Carolina, 2016
 * http://www.seis.sc.edu
 */

import {dataViewToString} from './util';
import * as miniseed from 'seisplotjs-miniseed';
import * as RSVP from 'rsvp';
import moment from 'moment';

/* reexport */
export { miniseed, RSVP };

export const DATALINK_PROTOCOL = "1.0";
export const QUERY_MODE = "QUERY";
export const STREAM_MODE = "STREAM";
export const MAX_PROC_NUM = Math.pow(2, 16)-2;
export const USER_BROWSER = "browser";

export const ERROR = "PACKET";
export const PACKET = "PACKET";
export const ENDSTREAM = "ENDSTREAM";

let defaultHandleResponse = function(message) {
  console.log("Unhandled datalink response: "+message);
};

export class DataLinkConnection {

  constructor(url, packetHandler, errorHandler) {
    this.url = url;
    this.mode = QUERY_MODE;
    this.packetHandler = packetHandler;
    this.errorHandler = errorHandler;
    this.serverId = null;
    // meant to be processId, so use 1 <= num <= 2^15 to be safe
    this.clientIdNum = Math.floor(Math.random() * MAX_PROC_NUM)+1;
    this.username = USER_BROWSER;
    this.responseHandler = null;
  }

/** creates the websocket connection and sends the client
*  ID. Returns a Promise that resolves to the server's
* ID.
*/
  connect() {
    console.log("connect");
    const that = this;
    return new RSVP.Promise(function(resolve, reject) {
      const webSocket = new WebSocket(that.url, DATALINK_PROTOCOL);
      that.webSocket = webSocket;
      webSocket.binaryType = 'arraybuffer';
      webSocket.onmessage = function(event) {
        that.handle(event);
      };
      webSocket.onerror = function(event) {
        that.handleError(""+event);
      };
      webSocket.onclose = function(event) {
        that.webSocket = null; // clean up
        that.handleError(event);
      };
      webSocket.onopen = function() {
        console.log("webSocket.onopen");
        resolve(that);
      };
    }).then(datalink => {
      return datalink.sendId();
    }).then( idmsg => {
      that.serverId = idmsg;
      return idmsg;
    });
  }

  stream() {
    console.log("datalink stream");
    if (this.mode === STREAM_MODE) {return;}
    this.mode = STREAM_MODE;
    this.sendDLCommand("STREAM");
  }

  endStream() {
    console.log("datalink endstream");
    if (this.mode === QUERY_MODE) {return;}
    this.mode = QUERY_MODE;
    this.sendDLCommand(ENDSTREAM);
  }

  close() {
    console.log("datalink close");
    if (this.webSocket) {
      this.endStream(); // end streaming just in case
      this.webSocket.close();
      this.webSocket = null;
    }
  }

  /**
  * Send a ID Command. Command is a string.
  * Returns a Promise.
  */
  sendId() {
    const that = this;
    return this.awaitDLCommand("ID seisplotjs:"+this.username+":"+this.clientIdNum+":javascript")
    .then(replyMsg => {
        if (replyMsg.startsWith("ID DataLink ")) {
          that.serverId = replyMsg;
          return replyMsg;
        } else {
          throw new Error("not ID line: "+replyMsg);
        }
    });
  }

/** encodes command with optional data section as
 * a string. This works for client generated commands
 * but not for a PACKET, which would have binary data.
 * PACKET is what client receives, but should never
 * send as we do not generate data. */
  encodeDLCommand(command, dataString) {
    let cmdLen = command.length;
    let len = 3+command.length;
    let lenStr = "";
    if (dataString && dataString.length > 0) {
      lenStr = String(dataString.length);
      len+=lenStr.length+1;
      cmdLen += lenStr.length+1;
      len+=dataString.length;

    }
    console.log("encodeDLCommane len="+len+" cmdLen="+cmdLen);
    let rawPacket = new ArrayBuffer(len);
    let packet = new DataView(rawPacket);
    packet.setUint8(0, 68); // ascii D
    packet.setUint8(1, 76); // ascii L
    packet.setUint8(2, cmdLen);
    let i = 3;
    for (const c of command) {
      packet.setUint8(i, c.charCodeAt(0));
      console.log(i+"-"+c+" "+c.charCodeAt(0));
      i++;
    }
    const SPACE = ' ';
    if (dataString && dataString.length > 0) {
      packet.setUint8(i, SPACE.charCodeAt(0)); // ascii space
      console.log(i+"-"+SPACE+"-"+SPACE.charCodeAt(0));
      i++;
      for (const c of lenStr) {
        packet.setUint8(i, c.charCodeAt(0));
        console.log(i+"-"+c+" "+c.charCodeAt(0));
        i++;
      }
      for (const c of dataString) {
        packet.setUint8(i, c.charCodeAt(0));
        console.log(i+"-"+c+" "+c.charCodeAt(0));
        i++;
      }
    }
    console.log("encode: DL<"+cmdLen+">"+command+" "+lenStr+"|"+dataString+" i="+i);
console.log("  len="+len+"  lenStr='"+lenStr+"' cmdLen="+cmdLen);
console.log("packet: ''"+dataViewToString(new DataView(rawPacket))+"'");
    return rawPacket;
  }

  sendDLCommand(command, dataString) {
    console.log("send: "+command);
    const rawPacket = this.encodeDLCommand(command, dataString);
    this.webSocket.send(rawPacket);
  }

  /**
  * Send a DataLink Command and await the response. Command is a string.
  * Returns a Promise that resolves with the webSocket MessageEvent.
  */
  awaitDLCommand(command, dataString) {
    console.log("await "+command+" | "+dataString);
    let that = this;
    let promise = new RSVP.Promise(function(resolve, reject) {
      console.log("setting handlers");
      that.responseHandler = resolve;
      that.responseError = reject;
      console.log("send cmd");
      that.sendDLCommand(command, dataString);
    }).then(response => {
      console.log("then after send cmd: "+response);
        that.responseHandler = null;
        that.responseError = null;
        return response;
    });
    return promise;
  }

  handle(wsEvent) {
    console.log("handle wsEvent");
    let dlPreHeader = new DataView(wsEvent.data, 0, 3);
    if ('D' === String.fromCharCode(dlPreHeader.getUint8(0))
        && 'L' === String.fromCharCode(dlPreHeader.getUint8(1))) {
      const headerLen = dlPreHeader.getUint8(2);
      console.log("Got DL, headerLen: "+headerLen);
      const header = dataViewToString(new DataView(wsEvent.data, 3, headerLen));

        console.log("   header: "+header+"  orig: "+dataViewToString(new DataView(wsEvent.data)));
      if (header.startsWith(PACKET)) {
        if (this.packetHandler) {
          let packet = new DataLinkPacket(header, new DataView(wsEvent.data, 3+headerLen));
          this.packetHandler(packet);
        } else {
          this.errorHandler(new Error("packetHandler not defined"));
        }
      } else if (header.startsWith(ERROR)) {
        const split = header.split();
        const dataSize = Number.parseInt(split[2]);
        const errorMsg = dataViewToString(new DataView(wsEvent.data, 3+headerLen));
        this.handleError(errorMsg);
      } else if (this.responseHandler) {
        this.responseHandler(header);
      } else {
        defaultHandleResponse(header);
      }
    } else {
      throw new Error("DataLink Packet did not start with DL");
    }
  }

  handleError(error) {
    if (this.responseError) {
      this.responseError(error);
    }
    if (this.errorHandler) {
      this.errorHandler(error);
    }
    console.log("handleError: "+error);
  }
}

export class DataLinkPacket {
  constructor(header, dataview) {
    this.header = header;
    this.data = dataview;
    let split = this.header.split();
    this.streamId = split[0];
    this.pktid = split[1];
    this.dataSize = Number.parseInt(split[5]);
    if (dataview.byteLength < this.dataSize) {
      throw new Error("not enough bytes in dataview for packet: "+this.dataSize);
    }
    this.miniseed = new miniseed.DataRecord(dataView);
  }

}
