{
    playerNames: array[String]
    missionStatuses: array[Integer] // the indices 0-4 represent missions 1-5; values will be mapped: 0 => not occured, 1 => success, 2 => fail
    currentMission: Integer // initalized at 1
    currentRound: Integer // initialized at 1
    gamePhase: String // possible values: "selecting_team", "voting_on_team", "on_mission", "spectating_mission",

    
    


}