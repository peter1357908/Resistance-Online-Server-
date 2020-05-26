import Round from '../models/round_model';

export const startRound = (fields) => {
  const round = new Round(fields);
  return round.save();
};

export const voteRound = (vote) => {
  switch (vote) {
    case 'REJECT':
      Round.rejectedVotes += 1;
      break;
    case 'APPROVE':
      Round.approvedVotes += 1;
      break;
    default:
      console.log('error: ', vote);
  }
};
