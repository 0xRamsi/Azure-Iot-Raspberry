window.addEventListener("DOMContentLoaded", () => {
  const protocol = document.location.protocol.startsWith("https")
    ? "wss://"
    : "ws://";
  const webSocket = new WebSocket(protocol + location.host);
  webSocket.onmessage = function onMessage(message) {
    console.log("Websocket sagt:", message);
    const iotData = JSON.parse(message.data).IotData;
    if (iotData.line0 === "clickEvent")
      document.getElementById("clickCounter").innerHTML = iotData.line1;
  };

  document.getElementById("sendTextToHub").addEventListener("click", () => {
    const line0 = document.getElementById("line0").value;
    const line1 = document.getElementById("line1").value;

    console.log("sending: ", line0, line1);
    webSocket.send(JSON.stringify({ line0, line1 }));
  });
});
