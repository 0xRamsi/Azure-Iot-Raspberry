const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const path = require("path");
const EventHubReader = require("./scripts/event-hub-reader.js");

var Client = require("azure-iothub").Client;
var Message = require("azure-iot-common").Message;

const iotHubConnectionString =
  process.argv[2] || process.env.IotHubConnectionString;

if (!iotHubConnectionString) {
  console.error(
    `Environment variable IotHubConnectionString must be specified.`
  );
  return;
}
console.log(`Using IoT Hub connection string [${iotHubConnectionString}]`);

var client = Client.fromConnectionString(iotHubConnectionString);

const eventHubConsumerGroup =
  process.argv[3] || process.env.EventHubConsumerGroup;
if (!eventHubConsumerGroup) {
  console.error(
    `Environment variable EventHubConsumerGroup must be specified.`
  );
  return;
}
console.log(`Using event hub consumer group [${eventHubConsumerGroup}]`);

// Redirect requests to the public subdirectory to the root
const app = express();
app.use(express.static(path.join(__dirname, "public")));
app.use((req, res /* , next */) => {
  res.redirect("/");
});

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

wss.broadcast = (data) => {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      try {
        console.log(`Broadcasting data ${data}`);
        client.send(data);
      } catch (e) {
        console.error(e);
      }
    }
  });
};

const targetDevice = "raspberry-pi";
let iotMessageSender;

client.open(function (err) {
  if (err) {
    console.error("Could not connect: " + err.message);
    process.exit(-1);
  } else {
    console.log("Client connected");
    iotMessageSender = (stringToDisplay) => {
      const message = new Message(stringToDisplay);
      client.send(targetDevice, message, function (err) {
        if (err) {
          console.error(err.toString());
          process.exit(-1);
        } else {
          console.log("sent c2d message");
        }
      });
    };

    let message = JSON.stringify({
      line0: "Hallo Welt,",
      line1: "localhost:" + server.address().port,
    });
    iotMessageSender(message);
  }
});

wss.on("connection", (ws, req) => {
  ws.on("message", function (message) {
    console.log(`[WebSocket] Received message ${message}`);
    // `message` should be a string in the format that the Raspi is expecting.
    // `{line0: 'text for first line', line1: 'text for second line'}`
    iotMessageSender(message);
  });
});

server.listen(process.env.PORT || "3000", () => {
  console.log("Listening on %d.", server.address().port);
});

const eventHubReader = new EventHubReader(
  iotHubConnectionString,
  eventHubConsumerGroup
);

(async () => {
  await eventHubReader.startReadMessage((message, date, deviceId) => {
    try {
      const payload = {
        IotData: message,
        MessageDate: date || Date.now().toISOString(),
        DeviceId: deviceId,
      };

      wss.broadcast(JSON.stringify(payload));
    } catch (err) {
      console.error("Error broadcasting: [%s] from [%s].", err, message);
    }
  });
})().catch();
