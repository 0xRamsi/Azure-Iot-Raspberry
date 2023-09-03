"use strict";

const fs = require("fs");
const Gpio = require("onoff").Gpio;

const Client = require("azure-iot-device").Client;
const ConnectionString = require("azure-iot-device").ConnectionString;
const Message = require("azure-iot-device").Message;
const MqttProtocol = require("azure-iot-device-mqtt").Mqtt;

const i2c = require("./i2cDriver");

var client, config;

async function handleMessageAsync(message) {
  const { line0, line1 } = JSON.parse(message.toString());
  i2c.writeString(0, 0, "" + (line0 || "[unknown]").padEnd(16, " "));
  i2c.writeString(1, 0, "" + (line1 || "[unknown]").padEnd(16, " "));
}

function receiveMessageCallback(msg) {
  client.complete(msg, () => {
    const message = msg.getData().toString("utf-8");
    console.log("Received message:\n\t" + message);
    handleMessageAsync(message);
  });
}

function initClient(connectionStringParam, credentialPath) {
  var connectionString = ConnectionString.parse(connectionStringParam);
  var deviceId = connectionString.DeviceId;

  client = Client.fromConnectionString(connectionStringParam, MqttProtocol);

  // Configure the client to use X509 authentication if required by the connection string.
  if (connectionString.x509) {
    // Read X.509 certificate and private key.
    // These files should be in the current folder and use the following naming convention:
    // [device name]-cert.pem and [device name]-key.pem, example: myraspberrypi-cert.pem
    var connectionOptions = {
      cert: fs
        .readFileSync(path.join(credentialPath, deviceId + "-cert.pem"))
        .toString(),
      key: fs
        .readFileSync(path.join(credentialPath, deviceId + "-key.pem"))
        .toString(),
    };

    client.setOptions(connectionOptions);

    console.log("[Device] Using X.509 client certificate authentication");
  }

  if (connectionString.GatewayHostName && config.iotEdgeRootCertFilePath) {
    var deviceClientOptions = {
      sa: fs.readFileSync(config.iotEdgeRootCertFilePath, "utf-8"),
    };

    client.setOptions(deviceClientOptions, function (err) {
      if (err) {
        console.error(
          "[Device] error specifying IoT Edge root certificate: " + err
        );
      }
    });

    console.log("[Device] Using IoT Edge private root certificate");
  }

  return client;
}

(function (connectionString) {
  // read in configuration in config.json
  try {
    config = require("./config.json");
  } catch (err) {
    console.error("Failed to load config.json:\n\t" + err.message);
    return;
  }

  // create a client
  // read out the connectionString from process environment
  connectionString =
    connectionString || process.env["AzureIoTHubDeviceConnectionString"];
  client = initClient(connectionString, config);

  client.open((err) => {
    if (err) {
      console.error("[IoT Hub Client] Connect error:\n\t" + err.message);
      return;
    }

    // set C2D and device method callback
    client.on("message", receiveMessageCallback);
  });
})(process.argv[2]);

///-----------------
/// Button
///-----------------

let clickCounter = 0;
const button = new Gpio(config.LEDPinGPIO, "in", "rising", {
  debounceTimeout: 10,
});

button.watch((err, value) => {
  if (err) {
    throw err;
  }

  const clickEvent = { line0: "clickEvent", line1: ++clickCounter };
  const message = new Message(JSON.stringify(clickEvent));
  client.sendEvent(message, function (err) {
    if (err) {
      console.log(err.toString());
    } else {
      console.log(`Message sent ${JSON.stringify(clickEvent)}`);
      i2c.writeString(0, 0, "Message sent".padEnd(16, " "));
      i2c.writeString(1, 0, ("clickEvent " + clickCounter).padEnd(16, " "));
    }
  });
});

process.on("SIGINT", (_) => {
  console.log("exiting...");
  client.close();
  button.unexport();
});
