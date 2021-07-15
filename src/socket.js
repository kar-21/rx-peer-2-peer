import React from "react";
import io from "socket.io-client";
const SERVER_URL = process.env.REACT_APP_URL;
// Creating the peer
export const peer = new RTCPeerConnection({
  iceServers: [
    {
      urls: ["stun:stun1.l.google.com:19302", "stun:stun2.l.google.com:19302"],
    },
  ],
  iceCandidatePoolSize: 10,
});

export const socket = io.connect(SERVER_URL);
export const SocketContext = React.createContext();
