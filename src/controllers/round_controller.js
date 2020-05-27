import Round from '../models/round_model';

export const startRound = (fields) => {
  const round = new Round(fields);
  return round.save();
};

export const voteRound = (fields) => {
  Round.findOne({ sessionID: fields.sessionID }).then((round) => {
    switch (fields.vote) {
      case 'REJECT':
        round.rejectedVotes += 1;
        break;
      case 'APPROVE':
        round.approvedVotes += 1;
        break;
      default:
        console.log('error: ', fields.vote);
    }
  }).catch((error) => {
    console.log('error: ', error);
  });
};
