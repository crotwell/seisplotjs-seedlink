

export function dataViewToString(dataView) {
  let out = "";
  for (let i=0; i< dataView.byteLength; i++) {
    out += String.fromCharCode(dataView.getUint8(i));
  }
  return out;
}
