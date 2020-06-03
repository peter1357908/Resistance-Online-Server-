## CLIENT CREATES A GAME
Client sends to the server on the event `createGame`:
{
    playerID: String,
    sessionID: String,
    sessionPassword: String,
}

If any of the following conditions is met, the `createGame` request should be rejected:
* Any of the input fields in the above message is empty
* `sessionID` already exists

If the `createGame` request should be rejected, the server sends back to `socket.id` on the event `createGame`:
{
    playerID: `null`,
    failMessage: String,
}

Otherwise, server will create a room with the same name as the `sessionID`, record the client as the creator of the session, and join the client into the aforementioned room. Then the server should emit to `socket.id` as follows:

Server sends to the client on the event `createGame`:
{
    playerID: String
}

Then the server broadcasts to the room `sessionID` on the event `lobby`:
{
    action: 'someoneJoined',
    creatorID: String,
    playerIDs: \[String\],
}

## CLIENT JOINS A GAME
// TODO: make it so that the player join the game with a random name, and is allowed to change it in the lobby at will, until the game starts
Client sends to the server on the event `joinGame`:
{
    playerID: String,
    sessionID: String,
    sessionPassword: String,
}

If any of the following conditions is met, the `joinGame` request should be rejected:
* Any of the input fields in the above message is empty
* `sessionID` is not found
* `password` is incorrect
* session specified by `sessionID` is no longer accepting new players (it may be because that the session currently has an ongoing game, that the session is full, etc.)
* `playerID` is already taken in the session specified by `sessionID`

If the `joinGame` request should be rejected, the server sends back to `socket.id` on the event `joinGame`:
{
    playerID: `null`,
    failMessage: String,
}

Otherwise, server will join the client into the room specified by `sessionID` in the message. Then:

Server sends to the client on the event `joinGame`:
{
    playerID: String
}

server broadcasts to the room `sessionID` on the event `lobby`:
{
    action: 'someoneJoined',
    creatorID: String,
    playerIDs: \[String\],
}

## CLIENT QUITS FROM LOBBY
client sends to the server on the event `lobby`:
{
    action: 'quitLobby',
}

* If: the quitter is the only player in the lobby, the game data structure should be removed from the back-end.
* Else:
    * If: the quitter is the game's creator, another player takes over the creator status (TODO: rename it to "lobby master"?).
    * The player's reference is removed from the game's data strucutre.

Finally, the server will remove the player's data structure (find it with `socket.id`; there should be a player model associated with it already).

Server sends to the `socket.id` on the event `lobby`:
{
    action: 'quitAcknowledged',
}

Server then removes `socket.id` from the room `sessionID`. If the last player quit from the room, the room should be destroyed.

Server then broadcasts to the room `sessionID` on the event `lobby`:

Note that the front end should assume that the first playerID in the playerIDs is the leader for the first round of the first mission.
{
    action: 'someoneQuit',
    playerIDs: \[String\],
    creatorID: String,
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
    failMessage: 'Not enough people are in the lobby to start the game', // assuming that the client is not hacking to produce more than 10 players
}

Otherwise, server records the session as no longer "in lobby" (all new `joinGame` requested should be rejected until the session is back "in lobby").

Then, server broadcasts to the room `sessionID` on the event `lobby`:
{
    action: 'gameStarted',
}

Server broadcasts to the room `sessionID` on the event `inGame`:
{
    action: 'begin',
    playerIDs: \[String\],
    // TODO: send more game information to allow "resuming a game" / "join an existing game",
}

Server also sends, to each spy only, on the event `inGame`:
{
    action: 'setSpy',
    spies: \[String\],
}

Each client should assume that their faction is `RESISTANCE` unless they receive the above message with action `setSpy`.
// question: would the front-end end up displaying the role as `RESISTANCE` if it hasn't received the `inGame` message with action `setSpy` yet?

Once the clients receive this message, they start listening on event `inGame`.

## CLIENT CLICKS 'OK' AFTER VIEWING THEIR FACTION
client sends to the server on the event `inGame`:
{
    action: 'factionViewed',
}

once server receives a client's request, check to see if the `waitingFor` array needs to be updated; if it is, broadcast the following message to `sessionID` on event `inGame`:
{
    action: 'waitingFor',
    waitingFor: \[String\], // player IDs
}

Both the server and the client should assume that the game is proceeding to the next phase (*first round begins*) upon sending/receiving the above server response with an empty `waitingFor` array.

// the following action enables the eye candy for displaying the choices in real time
// question: do we want this to reflect 'cardHoveredOver' instead?
## ROUND LEADER CLICKS ON CARD
client sends to the server on the event `inGame`:
{
    action: 'cardClicked',
    cardPlayerID: String,
}

if the above message came from the round leader and that the cardPlayerID is a valid playerID, broadcast the following message to `sessionID` on event `inGame`:
{
    action: 'cardClicked',
    cardPlayerID: String,
}

Upon receiving the above message, the client should invert the status of the specified card (e.g. from `highlighted` to `not highlighted`).

## ROUND LEADER SUBMITS TEAM PROPOSAL
client sends to the server on the event `inGame` after user finalizes on the team proposal:
{
    action: 'proposeTeam',
    proposedTeam: \[String\], // player IDs
}

if the proposal came from the current round's leader, and that the playerIDs specified are valid, server broadcasts to the room `sessionID` on event `inGame`:
{
    action: 'proposeTeam',
    proposedTeam: \[String\], // player IDs
}

Both the server and the client should assume that the game is proceeding to the next phase (*voting on proposed team*) upon sending/receiving the above server response.

## CLIENT VOTES ON PROPOSED TEAM
client sends to the server on the event `inGame` after user finalizes on the vote for team proposal:
{
    action: 'voteOnTeamProposal',
    voteType: String, // 'APPROVE' or 'REJECT'
}

if the vote came from someone who has not cast a vote yet, record the vote and broadcast to the room `sessionID` on event `inGame`:
{
    action: 'waitingFor',
    waitingFor: \[String\], // player IDs
    nextLeader: String, // `null` if the team proposal is approved or if there are still players who haven't voted; otherwise, the playerID for leader of the current mission's next round.
    voteComposition: { playerID: voteType } // `null` if there are still players who haven't voted; otherwise, an object whose keys are playerIDs and each value is the corresponding player's voteType ('APPROVE' / 'REJECT')
    teamComposition: \[String\], // `null` if the team proposal is rejected or if there are still players who haven't voted; otherwise, player IDs of the players that are in the mission
}

Both the server and the client should assume that the game is proceeding to the next phase (*client views votes and either another round starts or the mission starts*) upon sending/receiving the above server response with an empty `waitingFor` array (or a non-`null` `voteComposition`/`teamComposition`).

## CLIENT WHO IS ON THE MISSION VOTES FOR SUCCESS OR FAIL FOR THE MISSION
client sends to the server on the event `inGame` after user finalizes on the vote for mission's outcome:
{
    action: 'voteOnMissionOutcome',
    voteType: String, // 'SUCCESS' or 'FAIL'
}

if the vote came from someone needs to cast a vote but has not done so yet, record the vote and broadcast to the room `sessionID` on event `inGame`:
{
    action: 'waitingFor',
    waitingFor: \[String\], // player IDs
    nextLeader: String, // `null` if there are still players who haven't voted; otherwise, the playerID for the leader of the next mission's first round.
    missionOutcome: String, // `null` if there are still players who haven't voted; otherwise, 'SUCCESS' or 'FAIL'
}

Both the server and the client should assume that the game is proceeding to the next phase (*client views mission outcome and either the next mission's first round starts or the game ends*) upon sending/receiving the above server response with an empty `waitingFor` array (or a non-`null` `missionOutcome`).

**If** the above message is for the outcome of the last mission (conditions are met for some faction to win):
The server sends to `sessionID` on event `inGame`:
{
    action: 'gameFinished',
}

The server sends to `socket.id` on event `postGame`:
{
    action: 'gameHistory',
    victoriousFaction: String, // 'RESISTANCE' or 'SPIES' (redundant information; the outcome can be determined from `gameHistory` below)
    gameHistory: `gameHistoryObject`, // defined below
}

`gameHistoryObject`:
{   
    missions: \[`missionObject`\], // `missionObject` is defined below; in the order of the missions that took place
}

`missionObject`:
{
    missionOutcome: String, // 'SUCCESS' or 'FAIL' (redundant information; the outcome can be determined from `missionVoteComposition` below)
    missionVoteComposition: { playerID: voteType }, // an object whose keys are playerIDs and each value is the corresponding player's voteType ('SUCCESS' / 'FAIL')
    rounds: \[`roundObject`\], // `roundObject` is defined below; in the order of the rounds that took place
}

`roundObject`:
{
    roundOutcome: String, // 'APPROVED' or 'REJECTED' (redundant information; the last round is the only round whose proposal was approved)
    roundVoteComposition: { playerID: voteType }, // an object whose keys are playerIDs and each value is the corresponding player's voteType ('APPROVE' / 'REJECT')
    roundLeader: String, // playerID of the round's leader
}

## CLIENT FINISHES VIEWING GAME HISTORY
client sends to the server on the event `postGame` after user finishes viewing game history:
{
    action: 'finishViewingGameHistory',
}

if the request came from a player who has not announced so yet **and** that the game has already concluded **and** the session is not "in lobby" yet:

server broadcasts to `sessionID` on event `postGame`:
{
    action: 'waitingFor',
    waitingFor: \[String\], // player IDs
}

Both the server and the client should assume that the session is proceeding to the next phase (*clients go back to lobby*) upon sending/receiving the above server response with an empty `waitingFor` array (before the broadcast, the server should record the session as "in lobby"; after receiving the message, the client should display the lobby component).

## CLIENT SENDS CHAT MESSAGE
client sends to the server on the event `chat`:
{
    message: String
}

if the client is an existing player, broadcast to the corresponding `sessionID` on event `chat`:
{
    messageFrom: String // playerID
    message: String
}

// TODO: refactor the code so that the chat component persists throughout the three phases of a session (lobby, in-game, post-game).
// TODO: handle unexpected disconnections
