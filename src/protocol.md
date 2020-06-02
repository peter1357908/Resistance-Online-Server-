NOTE
The client should be emitting and listening in on three different events: `joinGame`, `createGame`, `inGame`.
The server:
* On `inGame`, will react according to `messageType`. The server should then emit messages to select clients


## CLIENT CREATES A GAME
Client sends to the server on the event `createGame`:
{
    playerID: String
    sessionID: String
    sessionPassword: String
}

On `createGame`, server will create a room with the same name as the `sessionID`, record the client as the creator of the session, and join the client into the aforementioned room. Then the server should emit a success/fail message to the client as follows:

Server sends to the client on the event `createGame`:
{
    playerID: String // `null` if creation failed
    \[failMessage: String\]
}

// upon successfully creating a game

// server broadcasts to the room on the event `lobby`:
{
    action: 'someoneJoined'
    creatorID: String
    playerIDs: \[String\]
}

## CLIENT JOINS A GAME
// TODO: make it so that the player join the game with a random name, and is allowed to change it in the lobby at will, until the game starts
Client sends to the server on the event `joinGame`:
{
    playerID: String
    sessionID: String
    sessionPassword: String
}

On the event `joinGame`, if another player in the lobby already has `playerID`, the join request is rejected, sending to the client the following:

{
    playerID: `null`
    failMessage: 'playerID already taken in the target session'
}

Otherwise, server will join the client into the room specified by `sessionID` in the message. Then the server should emit a success/fail message to all clients in the room with `sessionID` as follows:

Server sends to the client on the event `joinGame`:
{
    playerID: String // `null` if join failed
    \[failMessage: String\]
}

// upon successfully joining a game

// TODO: emit to other clients only the newly joined player?
server broadcasts to the room on the event `lobby`:
{
    action: 'someoneJoined'
    creatorID: String
    playerIDs: \[String\]
}

## CLIENT STARTS A GAME
Client sends to the server on the event `lobby`:
{
    action: 'startGame',
}

The server checks if the client sending the message is the creator of the game (get the client's play model by their `socket.id`) whose sessionID is specified in the player data stored on the server, as well as if the game can be started (e.g. right number of players).

If number of players is not right, server sends to the `socket.id`:
{
    action: 'fail',
    failMessage: 'do not start a game until right number of players are in the lobby'
}

Server broadcasts to the room on the event `lobby`:
{
    action: 'gameStarted'
}

Server broadcasts to the room on the event `inGame`:
{
    currentLeaderID: String
    playerIDs: \[String\]
    // TODO: send more game information to allow "resuming a game" / "join an existing game"
}

Once the clients receive this message, they start listening on `inGame`.

## CLIENT QUITS FROM LOBBY
// client sends to the server on the event `lobby`:
{
    action: 'quitLobby'
}
// (client does not expect anything from the server)

* If: the quitter is the only player in the lobby, the game data structure should be removed from the back-end.
* Else:
    * If: the quitter is the game's creator, another player takes over the creator status (TODO: rename it to "lobby master"?).
    * The player's reference is removed from the game's data strucutre.

Finally, the server will remove the player's data structure (find it with `socket.id`; there should be a player model associated with it already).

Server sends to the `socket.id` on the event `lobby`:
{
    action: 'quitAcknowledged'
}

Server then removes `socket.id` from the room `sessionID`. If the last player quit from the room, the room should be destroyed.

Server then broadcasts to the room `sessionID` on the event `lobby`:
{
    action: 'someoneQuit'
    playerIDs: \[String\]
    creatorID: String
}

// ___________TEAM PROPOSAL___________
// client sends to the server: 
{
    ProposedTeam: Array[Number]
}

// client receives from the server 
{
   verification/error (it's good to send something so the client knows if the message was received) 
}

// ___________VOTE IN A ROUND___________
// client sends to the server:
{
    messageType: 'APPROVE' or 'REJECT'
    sessionID: String;
    playerID: String;
}

// ___________  ROUND RESULT ___________
// client sends to the server: 
{
    null
}

// client receives from the server 
{
   roundOutcome: 'APPROVED' or 'REJECTED'
}



// ___________ VOTE ON A MISSION ___________
// client sends to the server: 

{
    vote: 'SUCCEED' or 'FAIL'
    sessionID: String;
    playerID: String;
}

// client receives from the server 
{
   verification/error (it's good to send something so the client knows if the message was received) 
}


// ___________ MISSION RESULT ___________
// client sends to the server: 
{
    null
}

// client receives from the server 
{
    missionOutcome: 'SUCCESS' or 'FAIL';
    game status:
      if last round:
        game over
      else:
        currentMission: Number
        currentLeaderID: String
        currentRound: Number
        currentProposedTeam: Array[Number] // initalized at null
        currentApprovedTeam: Array[Number] // initialized at null
}

// _________ SEND CHAT MESSAGE ____________