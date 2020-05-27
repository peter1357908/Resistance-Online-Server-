{
    players_per_mission: {
        5: [2, 3, 2, 3, 3],
        6: [2, 3, 4, 3, 4]
        7: [2, 3, 3, 4, 4]
        8: [3, 4, 4, 5, 5]
        9: [3, 4, 4, 5, 5]
        10: [3, 4, 4, 5, 5]
    }

    player:{
        playerID: player schema

    }




    rooms:{
        game_id: game
    }

}


game data structure:
{
    // for before the game begins
    players: [{ type: Schema.Types.ObjectId, ref: 'Player' }]

    // following are populated once "start game" is clicked
    num_players = len(players)
    // num_spies = ceil(num_players/3)    
    spies: [1, 4, 7] // randomly generated
    resistance : [2, 3, 5] //populate with integers

    current_leader: 2 //randomly generated integer
    current_mission: 1 //initialized at 1

    num_passed: 0 //initalized at 0
    num_failed: 0 

    missions: [{ type: Schema.Types.ObjectId, ref: 'Mission' }]

}


mission:{
    players_per_mission // get from text file at top level. based on num_players and mission number
    current_round: 1 //initialized at 1
    rounds: [Round]

    if current_round = 6:
        game over. Spies win

     //list of players who will be voting
    mission_team: {
      3: success/failure //initialized at null
      4: success/failure
    }


    num_votes: 0 // initalized at 0
    num_succeed: 0 // initalized at 0
    num_failure: 0

    
   mission_outcome: success/failure //initialized at null
}
round:{
    round_leader = //initalize from game
    proposed_team: [3, 4, 5] //list_size taken from players_per_mission
    num_team_proposal_votes: 0 //integer initialized at 0. 
    team_proposal_votes: {
        approved: [3, 4]
        rejected: [1, 2]
    }
    if num_team_proposal_votes == num_players:
        increase current_leader by 1
        check for outcome

    round_outcome: approve/rejected
    //if approved: 
        go back to mission
        populate_mission_team

    //if rejected: 
        increase current_round by 1

}