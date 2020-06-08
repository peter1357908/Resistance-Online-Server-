## CLIENT CREATES A GAME
Client sends to the server on the event `createGame`:
```
{
    playerID: String,
    sessionID: String,
    sessionPassword: String,
}
```

If any of the following conditions is met, the `createGame` request should be rejected:

* Any of the input fields in the above message is empty
* `sessionID` already exists

If the `createGame` request should be rejected, the server sends back to `socket.id` on the event `createGame`:
```
{
    playerID: `null`,
    failMessage: String,
}
```

Otherwise, server will create a room with the same name as the `sessionID`, record the client as the creator of the session, and join the client into the aforementioned room. Then the server should emit to `socket.id` as follows:

Server sends to the client on the event `createGame`:
```
{
    playerID: String,
    sessionID: String,
}
```
Then the server broadcasts to the room `sessionID` on the event `lobby`:
```
{
    action: 'someoneJoined',
    creatorID: String,
    playerIDs: [String],
}
```

## CLIENT JOINS A GAME
Client sends to the server on the event `joinGame`:
```
{
    playerID: String,
    sessionID: String,
    sessionPassword: String,
}
```

If any of the following conditions is met, the `joinGame` request should be rejected:

* Any of the input fields in the above message is empty
* `sessionID` is not found
* `password` is incorrect
* session specified by `sessionID` is no longer accepting new players (it may be because the session is no longer "in lobby", the session lobby is full, etc.)
* `playerID` is already taken in the session specified by `sessionID`

If the `joinGame` request should be rejected, the server sends back to `socket.id` on the event `joinGame`:
```
{
    playerID: `null`,
    failMessage: String,
}
```

Otherwise, server will join the client into the room specified by `sessionID` in the message. Then:

Server sends to the client on the event `joinGame`:
```
{
    playerID: String,
    sessionID: String,
}
```

Server sends to the client on the event `chat` (notice that the following it basically an array of tuples):
```
[
    { playerID: String, message: String }
]
```

server broadcasts to the room `sessionID` on the event `lobby`:
```
{
    action: 'someoneJoined',
    creatorID: String,
    playerIDs: [String],
}
```

## CLIENT QUITS FROM LOBBY
client sends to the server on the event `lobby`:
```
{
    action: 'quitLobby',
}
```

The server will first remove the player's data structure (identified by `socket.id`), then:

* If: the quitter is the only player in the lobby, the game session data structure should be removed entirely.
* Else:
    * If: the quitter is the game's creator, another player takes over the creator status.
    * The player's reference is removed from the game's data strucutre.


Server then removes `socket.id` from the room `sessionID` and sends to the `socket.id` on the event `lobby`:
```
{
    action: 'quitAcknowledged',
}
```

* If: the last player quit from the room, the room should be destroyed.
* Else: Server broadcasts to the room `sessionID` on the event `lobby`:
```
{
    action: 'someoneQuit',
    playerIDs: [String],
    creatorID: String,
}
```

## CLIENT STARTS A GAME
Client sends to the server on the event `lobby`:
```
{
    action: 'startGame',
}
```

If any of the following conditions is met, the `startGame` request should be rejected:

* the client identified by `socket.id` is not the creator of the session
* the number of players in the lobby is too low / too high ("too high" should not be possible without messing with the back-end) for a game to start
* the session is not "in lobby"

If the `startGame` request should be rejected, the server sends back to `socket.id` on the event:
```
{
    action: 'fail',
    failMessage: String,
}
```

Otherwise, server records the session as no longer "in lobby" (all new `joinGame` requests should be rejected until the session is back "in lobby").

Then, server broadcasts to the room `sessionID` on the event `lobby`:
```
{
    action: 'gameStarted',
}
```

Server broadcasts to the room `sessionID` on the event `inGame`:
```
{
    action: 'gameStarted',
    playerIDs: [String],
}
```

Server also sends, to **the spies only**, on the event `inGame`:
```
{
    action: 'youAreSpy',
    spies: [String],
}
```

Each client should assume that their faction is `RESISTANCE` unless they receive the above message with action `youAreSpy`.

Note that the front end should assume that the first playerID in the playerIDs is the leader for the first round of the first mission.

Once the clients receive this message, they start listening on event `inGame`.

## CLIENT CLICKS 'OK' AFTER VIEWING THEIR FACTION
client sends to the server on the event `inGame`:
```
{
    action: 'factionViewed',
}
```

once server receives a client's request, check to see if the `waitingFor` array needs to be updated; if it is, broadcast the following message to `sessionID` on event `inGame`:
```
{
    action: 'waitingFor',
    waitingFor: [String], // playerIDs
}
```

Once the server has received a 'factionViewed' action from the last client, it broadcasts to all the clients on the event `inGame`:
```
{
    action: 'everyoneViewedFaction',
    currentLeaderID: String, // the playerID of the current leader
    currentMission: Integer, // from 1-5
    currentRound: Integer, // 1-5
    missionSize: Integer, // how many players are needed on the current mission
}
```

## ROUND LEADER CLICKS ON CARD
client sends to the server on the event `inGame`:
```
{
    action: 'cardClicked',
    cardPlayerID: String,
}
```

if the above message came from the round leader and that the cardPlayerID is a valid playerID, broadcast the following message to `sessionID` on event `inGame`:
```
{
    action: 'cardClicked',
    cardPlayerID: String,
}
```

Upon receiving the above message, the client should invert the status of the specified card (e.g. from `highlighted` to `not highlighted`).

## ROUND LEADER SUBMITS TEAM PROPOSAL
client sends to the server on the event `inGame` after user finalizes on the team proposal:
```
{
    action: 'proposeTeam',
    proposedTeam: [String], // playerIDs
}
```

if the proposal came from the current round's leader, and that the playerIDs specified are valid, server broadcasts to the room `sessionID` on event `inGame`:
```
{
    action: 'proposeTeam',
    proposedTeam: [String], // playerIDs
}
```

Both the server and the client should assume that the game is proceeding to the next phase (*voting on proposed team*) upon sending/receiving the above server response.

## CLIENT VOTES ON PROPOSED TEAM
client sends to the server on the event `inGame` after user finalizes on the vote for team proposal:
```
{
    action: 'voteOnTeamProposal',
    voteType: String, // 'APPROVE' or 'REJECT'
}
```

If the vote came from someone who has not cast a vote yet, record the vote and broadcast to the room `sessionID` on event `inGame`:
```
{
    action: 'waitingFor',
    waitingFor: [String], // playerIDs
}
```

Once the last vote is received, the server broadcasts to the room `sessionID` on event `inGame`:
```
{
    action: 'roundVotes',
    voteComposition: { playerID: voteType }, // an object whose keys are playerIDs and each value is the corresponding player's voteType ('APPROVE' / 'REJECT')
    roundOutcome: String, // Either 'APPROVED' or 'REJECTED', depending on which gets the majority (confirmed with the rule: tie goes to 'REJECTED')
    concludedRound: Integer, // what round we are on NOW (1-5). If the vote passed, we're on round 1. If the vote failed, round is prev_round + 1
}
```

## CLIENT CLICKS 'OK' AFTER VIEWING VOTES
After the user clicks 'ok', client sends to the server on the event 'inGame'
```
{
    action: 'votesViewed',
}
```

Once server receives a client's request, check to see if the `waitingFor` array needs to be updated; if it does, broadcast the following message to `sessionID` on event `inGame`:
```
{
    action: 'waitingFor',
    waitingFor: [String], // playerIDs
}
```

Once the server receives the 'votesViewed' message from the last client, the server broadcasts the following message to `sessionID` on event `inGame`:

If the team proposal was approved:
```
{
    action: 'missionStarting'
    playersOnMission: [String] // array of playerIDs
}
```

Else if (the team proposal was rejected, but it was not the 5th proposal for the same mission that was rejected):
```
{
    action: 'teamSelectionStarting',
    currentLeaderID: String, // PlayerID
    currentMission: Integer, // expecting an integer between 1 and 5, inclusive (redundant information, because the mission should stay the same)
    currentRound: Integer, // what round we are on now (1-5). If the vote passed, we're on round 1. If the vote failed, round is prev_round + 1
    missionSize: Integer, // how many players are needed on the current mission (redundant information, because the mission should stay the same)
}
```

Else (it was the 5th proposal for the same mission that was rejected):

The game ends with the spies winning; handle it the same way as described below ("**If the game has ended**").

## CLIENT WHO IS ON THE MISSION VOTES FOR SUCCESS OR FAIL FOR THE MISSION
client sends to the server on the event `inGame` after user finalizes on the vote for mission's outcome:
```
{
    action: 'voteOnMissionOutcome',
    voteType: String, // 'SUCCESS' or 'FAIL'
}
```

if the vote came from someone who needs to cast a vote but has not done so yet, record the vote and broadcast to the room `sessionID` on event `inGame`:
```
{
    action: 'waitingFor',
    waitingFor: [String], // playerIDs
}
```

After everyone voted, the server broadcasts the following message to the room `sessionID` on event `inGame`:
```
{
    action: 'missionVotes',
    numFailVotes: Integer, // how many 'FAIL' votes were received
    missionOutcome: String, // either 'SUCCEEDED' OR 'FAILED'
    concludedMission: Integer, // what mission we were on, 1-5
}
```

**If the game has not ended**, the server then emits to `sessionID` on event `inGame`:
```
{
    action: 'teamSelectionStarting',
    currentLeaderID: String,
    currentMission: Integer,
    currentRound: Integer, // what round we are on now (1-5). If the vote passed, we're on round 1. If the vote failed, round is prev_round + 1
    missionSize: Integer, // how many players are needed on the current mission
}
```

**If the game has ended** (conditions are met for some faction to win), the server emits to `sessionID` on event `inGame`:
```
{
    action: 'gameFinished',
    victoriousFaction: String, // 'RESISTANCE' or 'SPY' (redundant information; the outcome can be determined from `gameHistory` below)
}
```

The server emits to `sessionID` on event `postGame`:
```
{
    action: 'gameHistory',
    victoriousFaction: String, // 'RESISTANCE' or 'SPY' (redundant information; the outcome can be determined from `gameHistory` below)
    spies: [String], // playerIDs
    gameHistory: `gameHistoryObject`, // defined below
}
```

`gameHistoryObject`:
```
{
    missions: [`missionObject`], // `missionObject` is defined below; in the order of the missions that took place
}
```
(note that `gameHistoryObject` is here to allow easy addition of other information not yet accounted for)

`missionObject`:
```
{
    missionOutcome: String, // 'SUCCEEDED' or 'FAILED' (redundant information; the outcome can be determined from `missionVoteComposition` below)
    missionVoteComposition: { playerID: voteType }, // an object whose keys are playerIDs and each value is the corresponding player's voteType ('SUCCESS' / 'FAIL'); note that this also implies which players went on the mission, as only those who did would appear as keys in this object.
    rounds: [`roundObject`], // `roundObject` is defined below; in the order of the rounds that took place
}
```

`roundObject`:
```
{
    roundOutcome: String, // 'APPROVED' or 'REJECTED' (redundant information; the last round is the only round whose proposal was approved)
    roundVoteComposition: { playerID: voteType }, // an object whose keys are playerIDs and each value is the corresponding player's voteType ('APPROVE' / 'REJECT')
    roundLeader: String, // playerID of the round's leader
    proposedTeam: [String], // playerIDs
}
```

## CLIENT FINISHES VIEWING GAME HISTORY
client sends to the server on the event `postGame` after user finishes viewing game history:
```
{
    action: 'finishViewingGameHistory',
}
```

if the request came from a player who has not announced so yet **and** that the game has already concluded **and** the session is not "in lobby" yet:

server broadcasts to `sessionID` on event `postGame`:
```
{
    action: 'waitingFor',
    waitingFor: [String], // playerIDs
}
```

Both the server and the client should assume that the session is proceeding to the next phase (*clients go back to lobby*) upon sending/receiving the above server response with an empty `waitingFor` array (before the broadcast, the server should record the session as "in lobby"; after receiving the message, the client should display the lobby component).

## CLIENT SENDS CHAT MESSAGE
client sends to the server on the event `chat`:
```
{
    message: String
}
```

if the client is an existing player, broadcast to the corresponding `sessionID` on event `chat`:
```
{
    messageFrom: String // playerID
    message: String
}
```

## TODOs
* refactor the code so that the chat component persists throughout the three phases of a session (lobby, in-game, post-game).
* refactor the `youAreSpy` procedure to be less ambiguous (e.g. by sending also `youAreResistance`)
* handle unexpected disconnections (replace player with AI, remove player from lobby upon disconnection, etc.)
* make it so that the player joins the game with a random name, and is allowed to change it in the lobby at will, until the game starts
* rename the `creator` status to be `lobby master` status
* allow reconnecting to an ongoing game after disconnecting
* allow spectating games
* implement a `cardHoveredOver` action to complement `cardClicked` action
* merge 'everyoneViewedFaction' with 'teamSelectionStarting' (alternatively, distinguish between the three similar use cases by what fields are meaningful to each)

