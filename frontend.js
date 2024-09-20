$(function () {
  "use strict";

  window.chatwoot = {};
  chatwoot.inboxIdentifier = "C2a9rvpq8KXj2oPp2qmzFJej";
  chatwoot.chatwootAPIUrl = "https://livetest.cloud/public/api/v1/";

  // Elements
  var content = $("#content");
  var input = $("#input");
  var status = $("#status");

  // WebSocket initialization
  var connection = new WebSocket("wss://livetest.cloud/cable");

  connection.onopen = async function () {
    await setUpContact();
    await setUpConversation();

    connection.send(
      JSON.stringify({
        command: "subscribe",
        identifier: JSON.stringify({
          channel: "RoomChannel",
          pubsub_token: sessionStorage.getItem("pubsubToken"),
        }),
      })
    );

    input.removeAttr("disabled");
    status.text("Send Message:");
  };

  connection.onerror = function (error) {
    content.html(
      $("<p>", {
        text: "Sorry, but there's some problem with your connection or the server is down.",
      })
    );
  };

  connection.onmessage = function (message) {
    try {
      var json = JSON.parse(message.data);
      console.log("Received message data:", json); // Log the entire message data for full inspection

      if (
        json.message &&
        json.message.event === "message.created" &&
        json.message.data.message_type === 1
      ) {
        var isUser = json.message.data.sender.type === "contact"; 
        addMessage(
          json.message.data.sender.name,
          json.message.data.content,
          json.message.data.attachments || [],
          isUser
        );
      }
    } catch (e) {
      console.log("This doesn't look like a valid JSON:", message.data);
    }
  };

  function addMessage( message, attachments, isUser) {
    let messageContent = document.createElement("div");
    messageContent.classList.add("message", isUser ? "outgoing" : "incoming");

    if (message) {
      let textContent = document.createElement("span");
      textContent.textContent = `${message}`;
      messageContent.appendChild(textContent);
    }

    if (attachments && attachments.length > 0) {
      attachments.forEach((attachment) => {
        if (attachment.file_type.startsWith("image")) {
          let img = document.createElement("img");
          img.src =
            attachment.thumb_url || attachment.data_url || attachment.file_url;
          img.alt = "Sent image";
          img.style = "max-width: 200px; max-height: 200px;";
          messageContent.appendChild(img);
        }
      });
    }

    document.getElementById("content").appendChild(messageContent);
    document.getElementById("content").scrollTop =
      document.getElementById("content").scrollHeight;
  }

  async function setUpContact() {
    if (!sessionStorage.getItem("contactIdentifier")) {
      const response = await fetch(
        chatwoot.chatwootAPIUrl +
          "inboxes/" +
          chatwoot.inboxIdentifier +
          "/contacts",
        { method: "POST" }
      );
      const data = await response.json();
      sessionStorage.setItem("contactIdentifier", data.source_id);
      sessionStorage.setItem("pubsubToken", data.pubsub_token);
    }
  }

  async function setUpConversation() {
    if (!sessionStorage.getItem("contactConversation")) {
      const response = await fetch(
        chatwoot.chatwootAPIUrl +
          "inboxes/" +
          chatwoot.inboxIdentifier +
          "/contacts/" +
          sessionStorage.getItem("contactIdentifier") +
          "/conversations",
        { method: "POST" }
      );
      const data = await response.json();
      sessionStorage.setItem("contactConversation", data.id);
    }
  }

  async function sendMessage() {
    var msg = $("#input").val();
    var file = $("#fileInput")[0].files[0]; 

    if (!msg && !file) {
      console.log("No message or file to send.");
      return; 
    }

    const url =
      chatwoot.chatwootAPIUrl +
      "inboxes/" +
      chatwoot.inboxIdentifier +
      "/contacts/" +
      sessionStorage.getItem("contactIdentifier") +
      "/conversations/" +
      sessionStorage.getItem("contactConversation") +
      "/messages";

    const formData = new FormData();
    formData.append("content", msg);
    if (file) {
      formData.append("attachments[]", file);
    }

    await fetch(url, {
      method: "POST",
      body: formData,
    })
      .then((response) => response.json())
      .then((data) => {
        console.log("Message sent:", data);
        $("#input").val(""); 
        $("#fileInput").val(""); 
        $("#fileNameDisplay").text("");
        $("#fileNameDisplay").hide(); 
        $("#fileName").text("").css("display", "none");
        addMessage(
          msg,
          file
            ? [{ file_type: file.type, file_url: URL.createObjectURL(file) }]
            : [],
          true
        );
      })
      .catch((error) => console.log("Error sending message:", error));
  }

  $(document).ready(function () {
    $("#input").keydown(function (e) {
      if (e.keyCode === 13) {
        e.preventDefault();
        sendMessage();
      }
    });

    $(".send-button").click(function () {
      sendMessage();
    });
  });
});
