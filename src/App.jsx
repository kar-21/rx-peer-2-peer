import React, { useEffect, useRef, useState } from "react";
import { SocketContext, socket } from "./socket";
import logo from "./logo.svg";
import "./App.css";

const peer = new RTCPeerConnection({
  iceServers: [
    {
      urls: "stun:stun.stunprotocol.org",
    },
  ],
});

const cellArray = new Array(3).fill(null).map(() => new Array(3).fill(null));

const App = () => {
  const [init, setInit] = useState(true);
  const [isNameAssigned, setIsNamedAssigned] = useState(false);
  const [name, setName] = useState("");
  const [localSelectedCells, setLocalSelectedCells] = useState([]);
  const [remoteSelectedCells, setRemoteSelectedCells] = useState([]);
  const [callerAvailableList, setCallerAvailableList] = useState([]);
  const [winner, setWinner] = useState("");
  const [selectedUser, setSelectedUser] = useState("");
  const localStream = useRef();
  const remoteStream = useRef();

  const handleAssignName = async () => {
    setIsNamedAssigned(true);
    socket.emit("sendName", {
      name: name,
      id: socket.id,
    });
  };

  const handleInputChange = (event) => {
    setName(event.target.value);
  };

  const handleSelect = (caller) => {
    setSelectedUser(caller.id);
  };

  const handleCalling = async (caller) => {
    const localPeerOffer = await peer.createOffer();
    await peer.setLocalDescription(new RTCSessionDescription(localPeerOffer));
    console.log(">>> media offer on handle call", localPeerOffer);
    socket.emit("mediaOffer", {
      offer: localPeerOffer,
      from: socket.id,
      to: selectedUser,
    });
  };

  const handleLocalClick = (columnIndex, rowIndex) => {
    cellArray[columnIndex][rowIndex] = "X";
    setLocalSelectedCells([...localSelectedCells, columnIndex * 3 + rowIndex]);
    socket.emit("sendPosition", {
      from: socket.id,
      to: selectedUser,
      position: `${columnIndex}-${rowIndex}`,
    });
    checkForWinner(
      [...localSelectedCells, columnIndex * 3 + rowIndex],
      remoteSelectedCells
    );
  };

  const handleRemoteClick = (columnIndex, rowIndex) => {
    cellArray[columnIndex][rowIndex] = "O";
    setRemoteSelectedCells([
      ...remoteSelectedCells,
      columnIndex * 3 + rowIndex,
    ]);
    checkForWinner(localSelectedCells, [
      ...remoteSelectedCells,
      columnIndex * 3 + rowIndex,
    ]);
  };

  const checkForWinner = (local, remote) => {
    if (local.length > 2 || remote.length > 2) {
      if (checkRow(local)) {
        console.log(">>> winner is local");
        setWinner(name);
      } else if (checkRow(remote)) {
        console.log(">>> winner is remote");
        setWinner(
          callerAvailableList.filter((caller) => caller.id === selectedUser)[0]
            .name
        );
      }
    }
  };

  const checkRow = (selectedCells) => {
    if (
      selectedCells.includes(0) &&
      selectedCells.includes(1) &&
      selectedCells.includes(2)
    ) {
      return true;
    } else if (
      selectedCells.includes(3) &&
      selectedCells.includes(4) &&
      selectedCells.includes(5)
    ) {
      return true;
    } else if (
      selectedCells.includes(6) &&
      selectedCells.includes(7) &&
      selectedCells.includes(8)
    ) {
      return true;
    } else if (
      selectedCells.includes(0) &&
      selectedCells.includes(3) &&
      selectedCells.includes(6)
    ) {
      return true;
    } else if (
      selectedCells.includes(1) &&
      selectedCells.includes(4) &&
      selectedCells.includes(7)
    ) {
      return true;
    } else if (
      selectedCells.includes(2) &&
      selectedCells.includes(5) &&
      selectedCells.includes(8)
    ) {
      return true;
    } else if (
      selectedCells.includes(0) &&
      selectedCells.includes(4) &&
      selectedCells.includes(8)
    ) {
      return true;
    } else if (
      selectedCells.includes(2) &&
      selectedCells.includes(4) &&
      selectedCells.includes(6)
    ) {
      return true;
    }
    return false;
  };

  socket.on("remotePosition", async (data) => {
    const [columnIndex, rowIndex] = data.position.split("-");
    handleRemoteClick(+columnIndex, +rowIndex);
  });

  useEffect(() => {
    console.log(cellArray);
    if (isNameAssigned) {
      socket.emit("requestUserList");
      navigator.mediaDevices
        .getUserMedia({ video: true, audio: true })
        .then((stream) => {
          console.log(stream);
          localStream.current.srcObject = stream;
          stream.getTracks().forEach((track) => {
            console.log(">>track", track);
            peer.addTrack(track, stream);
          });
        })
        .catch((error) => {
          console.log(error);
        });
    }
  }, [isNameAssigned]);

  useEffect(() => {
    if (init) {
      setInit(false);
      socket.on("connect", () => {
        console.log(`I'm connected with the back-end`);
        socket.emit("requestUserList");
      });

      peer.onicecandidate = (event) => {
        console.log(">> on ice candidate", event);
        socket.emit("iceCandidate", {
          to: selectedUser,
          candidate: event.candidate,
        });
      };

      peer.addEventListener("track", (event) => {
        console.log(">> add event listener", event.streams);
        const [stream] = event.streams;
        remoteStream.current.srcObject = stream;
      });

      socket.on("update-user-list", (data) => {
        if (data.users) {
          const users = data.users.filter((user) => user.id !== socket.id);
          setCallerAvailableList(users);
        }
      });

      socket.on("remotePeerIceCandidate", async (data) => {
        try {
          const candidate = new RTCIceCandidate(data.candidate);
          await peer.addIceCandidate(candidate);
        } catch (error) {
          // Handle error, this will be rejected very often
        }
      });

      socket.on("mediaOffer", async (data) => {
        await peer.setRemoteDescription(new RTCSessionDescription(data.offer));
        const peerAnswer = await peer.createAnswer();
        await peer.setLocalDescription(new RTCSessionDescription(peerAnswer));
        console.log(">> media offer from socket", peerAnswer);
        socket.emit("mediaAnswer", {
          answer: peerAnswer,
          from: socket.id,
          to: data.from,
        });
      });

      socket.on("mediaAnswer", async (data) => {
        console.log(">> media answer from socket", data);
        await peer.setRemoteDescription(new RTCSessionDescription(data.answer));
      });
    }
  }, [init, selectedUser]);

  return (
    <SocketContext.Provider value={socket}>
      <div className="App">
        <header className="App-header">
          <img src={logo} className="App-logo" alt="logo" />
        </header>
        {isNameAssigned ? (
          <>
            <div className="callContainer">
              <div className="remote-video">
                <h2>Call:</h2>
                <video
                  className="remoteVideo"
                  playsInline
                  autoPlay
                  ref={remoteStream}
                ></video>
              </div>
              <div>
                <h3>Tic-Tac-Toe</h3>
                {cellArray.map((column, columnIndex) => (
                  <div key={`${columnIndex}-column`} className="column">
                    {column.map((element, rowIndex) => (
                      <div
                        key={columnIndex * 3 + rowIndex}
                        className="cell"
                        onClick={() => handleLocalClick(columnIndex, rowIndex)}
                      >
                        {element}
                      </div>
                    ))}
                  </div>
                ))}
                {winner ? <h5> {winner} is the Winner</h5> : <></>}
              </div>
              <div className="local-video">
                <h3>
                  Me <strong>[{name}]</strong>:
                </h3>
                <video
                  className="localVideo"
                  playsInline
                  autoPlay
                  muted
                  ref={localStream}
                ></video>
              </div>
            </div>
            <div className="caller-list">
              <div>Users:</div>
              {callerAvailableList.length > 0 ? (
                <>
                  {callerAvailableList.map((caller) => (
                    <div
                      className={
                        selectedUser
                          ? "caller-container-selected"
                          : "caller-container"
                      }
                      key={`${caller.id}+container`}
                    >
                      {caller.name}
                      <button
                        key={caller.id}
                        onClick={() => handleSelect(caller)}
                      >
                        select
                      </button>
                    </div>
                  ))}
                </>
              ) : (
                <div id="usersList">No users connected</div>
              )}
              <button onClick={() => handleCalling()}>Call</button>
            </div>
          </>
        ) : (
          <div>
            <h2>Please Enter Your Name</h2>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => handleInputChange(e)}
            />
            <button id="assignName" onClick={handleAssignName}>
              Assign Name
            </button>
          </div>
        )}
      </div>
    </SocketContext.Provider>
  );
};

export default App;
