 // Blu Button trigger the same action across multiple devices
// CHANGE HERE

let TARGET_LIST = {
  // CHANGE HERE TO ADD GEN 1 DEVICES - UP TO 5 DEVICES
  "GEN1":['192.168.0.15','192.168.0.16','192.168.0.17','192.168.0.18'],
  // CHANGE HERE TO ADD GEN 2 DEVICES - UP TO 5 DEVICES
  "GEN2":['192.168.15.15','192.168.15.16','192.168.15.17','192.168.15.18'],
};

let COMMAND_LIST = {
  // CHANGE HERE TO LIST THE COMMANDS YOU WANT TO BE EXECUTED - IT HAS NOTHING TO DO WITH THE BUTTON
  "1":'/relay/0?turn=on',                 // IN THIS EXAMPLE, THIS IS A GEN 1 COMMAND
  "2":'/relay/0?turn=off',
  "3":'/rpc/Switch.Set?id=0&on=true',     // IN THIS EXAMPLE, THIS IS A GEN 2 COMMAND (/rpc/)
  "4":'/rpc/Switch.Set?id=0&on=false',
};


function shellyCall(URI){
  //print(URI);
  Shelly.call(
      "HTTP.REQUEST", 
      { 
          method: "GET",
          url: URI,
      },
      function (res, error_code, error_msg, self){
        if(error_code !== 0){
          print(JSON.stringify(res));
          print(JSON.stringify(error_code));
          print(JSON.stringify(error_msg));
        }
      }, 
      this
    );    
}

function buttonAction(BTHparsed) {
  let gen = 0;
  let id = 0;
  
  // CHANGE HERE TO SET THE DEVICE GENERATION LIST WE WILL USE AND THE COMMAND THAT WILL BE EXECUTED WHEN WE PRESS THE BUTTON 1 TIME
  if(BTHparsed.Button === 1){
    gen = "GEN1";     // FOR THIS EXAMPLE, IT WILL EXECUTE THE COMMAND #1 IN THE LIST FOR ALL GEN 1 DEVICES IN THE TARGET LIST
    id = "1";
  }
  // CHANGE HERE TO SET THE DEVICE GENERATION LIST WE WILL USE AND THE COMMAND THAT WILL BE EXECUTED WHEN WE PRESS THE BUTTON 2 TIMES
  if(BTHparsed.Button === 2){
    gen = "GEN1";     // FOR THIS EXAMPLE, IT WILL EXECUTE THE COMMAND #2 IN THE LIST FOR ALL GEN 1 DEVICES IN THE TARGET LIST
    id = "2";
  }
  // CHANGE HERE TO SET THE DEVICE GENERATION LIST WE WILL USE AND THE COMMAND THAT WILL BE EXECUTED WHEN WE PRESS THE BUTTON 3 TIMES
  if(BTHparsed.Button === 3){
    gen = "GEN2";     // FOR THIS EXAMPLE, IT WILL EXECUTE THE COMMAND #4 IN THE LIST FOR ALL GEN 2 DEVICES IN THE TARGET LIST
    id = "4";
  }
  // CHANGE HERE TO SET THE DEVICE GENERATION LIST WE WILL USE AND THE COMMAND THAT WILL BE EXECUTED WHEN WE LONG PRESS THE BUTTON
  if(BTHparsed.Button === 4){
    gen = "GEN2"; // FOR THIS EXAMPLE, IT WILL EXECUTE THE COMMAND #3 IN THE LIST FOR ALL GEN 2 DEVICES IN THE TARGET LIST
    id = "3";
  }

  for(let i = 0; i < TARGET_LIST[gen].length; i++){
      shellyCall("http://" + TARGET_LIST[gen][i] + COMMAND_LIST[id])
  }
}

let CONFIG = {
  actions: [
      {
          cond: {
              Button: 1,
          },
          action: buttonAction, // 1 short press
      },
      {
          cond: {
              Button: 2,
          },
          action: buttonAction, // 2 short press
      },
      {
          cond: {
              Button: 3,
          },
          action: buttonAction, // 3 short press
      },
      {
          cond: {
              Button: 4,
          },
          action: buttonAction, // long Press
      },  
  ],
};

// END OF CHANGE

let ALLTERCO_MFD_ID_STR = "0ba9";
let BTHOME_SVC_ID_STR = "fcd2";

let SCAN_DURATION = BLE.Scanner.INFINITE_SCAN;
let ACTIVE_SCAN =
  typeof CONFIG.shelly_blu_name_prefix !== "undefined" &&
  CONFIG.shelly_blu_name_prefix !== null;

let uint8 = 0;
let int8 = 1;
let uint16 = 2;
let int16 = 3;
let uint24 = 4;
let int24 = 5;

function getByteSize(type) {
  if (type === uint8 || type === int8) return 1;
  if (type === uint16 || type === int16) return 2;
  if (type === uint24 || type === int24) return 3;
  //impossible as advertisements are much smaller;
  return 255;
}

let BTH = [];
BTH[0x00] = { n: "pid", t: uint8 };
BTH[0x01] = { n: "Battery", t: uint8, u: "%" };
BTH[0x05] = { n: "Illuminance", t: uint24, f: 0.01 };
BTH[0x1a] = { n: "Door", t: uint8 };
BTH[0x20] = { n: "Moisture", t: uint8 };
BTH[0x2d] = { n: "Window", t: uint8 };
BTH[0x3a] = { n: "Button", t: uint8 };
BTH[0x3f] = { n: "Rotation", t: int16, f: 0.1 };

let BTHomeDecoder = {
  utoi: function (num, bitsz) {
    let mask = 1 << (bitsz - 1);
    return num & mask ? num - (1 << bitsz) : num;
  },
  getUInt8: function (buffer) {
    return buffer.at(0);
  },
  getInt8: function (buffer) {
    return this.utoi(this.getUInt8(buffer), 8);
  },
  getUInt16LE: function (buffer) {
    return 0xffff & ((buffer.at(1) << 8) | buffer.at(0));
  },
  getInt16LE: function (buffer) {
    return this.utoi(this.getUInt16LE(buffer), 16);
  },
  getUInt24LE: function (buffer) {
    return (
      0x00ffffff & ((buffer.at(2) << 16) | (buffer.at(1) << 8) | buffer.at(0))
    );
  },
  getInt24LE: function (buffer) {
    return this.utoi(this.getUInt24LE(buffer), 24);
  },
  getBufValue: function (type, buffer) {
    if (buffer.length < getByteSize(type)) return null;
    let res = null;
    if (type === uint8) res = this.getUInt8(buffer);
    if (type === int8) res = this.getInt8(buffer);
    if (type === uint16) res = this.getUInt16LE(buffer);
    if (type === int16) res = this.getInt16LE(buffer);
    if (type === uint24) res = this.getUInt24LE(buffer);
    if (type === int24) res = this.getInt24LE(buffer);
    return res;
  },
  unpack: function (buffer) {
    // beacons might not provide BTH service data
    if (typeof buffer !== "string" || buffer.length === 0) return null;
    let result = {};
    let _dib = buffer.at(0);
    result["encryption"] = _dib & 0x1 ? true : false;
    result["BTHome_version"] = _dib >> 5;
    if (result["BTHome_version"] !== 2) return null;
    //Can not handle encrypted data
    if (result["encryption"]) return result;
    buffer = buffer.slice(1);

    let _bth;
    let _value;
    while (buffer.length > 0) {
      _bth = BTH[buffer.at(0)];
      if (typeof _bth === "undefined") {
        console.log("BTH: unknown type");
        break;
      }
      buffer = buffer.slice(1);
      _value = this.getBufValue(_bth.t, buffer);
      if (_value === null) break;
      if (typeof _bth.f !== "undefined") _value = _value * _bth.f;
      result[_bth.n] = _value;
      buffer = buffer.slice(getByteSize(_bth.t));
    }
    return result;
  },
};

let ShellyBLUParser = {
  getData: function (res) {
    let result = BTHomeDecoder.unpack(res.service_data[BTHOME_SVC_ID_STR]);
    result.addr = res.addr;
    result.rssi = res.rssi;
    return result;
  },
};

let last_packet_id = 0x100;


function scanCB(ev, res) {
if (ev !== BLE.Scanner.SCAN_RESULT) return;
// skip if there is no service_data member
if (
  typeof res.service_data === "undefined" ||
  typeof res.service_data[BTHOME_SVC_ID_STR] === "undefined"
)
  return;
// skip if we are looking for name match but don't have active scan as we don't have name
if (
  typeof CONFIG.shelly_blu_name_prefix !== "undefined" &&
  (typeof res.local_name === "undefined" ||
    res.local_name.indexOf(CONFIG.shelly_blu_name_prefix) !== 0)
)
  return;
// skip if we don't have address match
if (
  typeof CONFIG.shelly_blu_address !== "undefined" &&
  CONFIG.shelly_blu_address !== res.addr
)
  return;
let BTHparsed = ShellyBLUParser.getData(res);
// skip if parsing failed
if (BTHparsed === null) {
  console.log("Failed to parse BTH data");
  return;
}
// skip, we are deduping results
if (last_packet_id === BTHparsed.pid) return;
last_packet_id = BTHparsed.pid;
// console.log("Shelly BTH packet: ", JSON.stringify(BTHparsed));
// execute actions from CONFIG
let aIdx = null;
for (aIdx in CONFIG.actions) {
  // skip if no condition defined
  if (typeof CONFIG.actions[aIdx]["cond"] === "undefined") continue;
  let cond = CONFIG.actions[aIdx]["cond"];
  let cIdx = null;
  let run = true;
  for (cIdx in cond) {
    if (typeof BTHparsed[cIdx] === "undefined") run = false;
    if (BTHparsed[cIdx] !== cond[cIdx]) run = false;
  }
  //print(CONFIG.actions[aIdx]["action"]);
  if (run) CONFIG.actions[aIdx]["action"](BTHparsed);
}
}

// retry several times to start the scanner if script was started before
// BLE infrastructure was up in the Shelly
function startBLEScan() {
  let bleScanSuccess = BLE.Scanner.Start({ duration_ms: SCAN_DURATION, active: ACTIVE_SCAN }, scanCB);
  if( bleScanSuccess === false ) {
    Timer.set(1000, false, startBLEScan);
  } else {
    console.log('Success: BLU scanner running');
  }
}

//Check for BLE config and print a message if BLE is not enabled on the device
let BLEConfig = Shelly.getComponentConfig('ble');
if(BLEConfig.enable === false) {
  console.log('Error: BLE not enabled');
} else {
  Timer.set(1000, false, startBLEScan);
}