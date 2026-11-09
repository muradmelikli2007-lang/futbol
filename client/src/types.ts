export type Side = 'A' | 'B';
export type Result = 'W' | 'D' | 'L';
export type Position = 'GK' | 'DEF' | 'MID' | 'FWD' | 'ANY';

export interface PlayerRef {
  id: number;
  name: string;
  position: Position;
  photoUrl: string | null;
}

export interface Season {
  id: number;
  name: string;
  matchCount: number;
}

export interface BestPerformance {
  matchId: number;
  playedAt: string;
  goals: number;
  assists: number;
  rating: number | null;
  result: Result;
  scoreFor: number;
  scoreAgainst: number;
  isMvp: boolean;
}

export interface PlayerStats {
  matches: number;
  goals: number;
  assists: number;
  goalsAssists: number;
  goalsPerMatch: number | null;
  assistsPerMatch: number | null;
  wins: number;
  draws: number;
  losses: number;
  winPct: number | null;
  avgRating: number | null;
  ratedMatches: number;
  highestRating: number | null;
  lowestRating: number | null;
  mvp: number;
  points: number;
  avgPoints: number | null;
  bestPerformance: BestPerformance | null;
  form: Result[];
}

export interface PlayerWithStats extends PlayerRef {
  createdAt: string;
  stats: PlayerStats;
}

export interface MatchParticipant {
  player: PlayerRef;
  slot: number | null;
  isGoalkeeper: boolean;
  rating: number | null;
  goals: number;
  assists: number;
  isMvp: boolean;
}

export interface MatchGoal {
  id: number;
  side: Side;
  minute: number | null;
  scorer: PlayerRef;
  assist: PlayerRef | null;
  scoreAfter: { a: number; b: number };
}

export interface MatchView {
  id: number;
  seasonId: number;
  seasonName: string;
  playedAt: string;
  formationA: string;
  formationB: string;
  scoreA: number;
  scoreB: number;
  result: 'A' | 'B' | 'draw';
  notes: string;
  mvp: PlayerRef | null;
  sideA: MatchParticipant[];
  sideB: MatchParticipant[];
  goals: MatchGoal[];
  ratedCount: number;
  bestRated: { player: PlayerRef; rating: number } | null;
}

export interface MatchFormData {
  seasonId: number;
  playedAt: string;
  formationA: string;
  formationB: string;
  notes: string;
  mvpPlayerId: number | null;
  participants: { playerId: number; side: Side; slot: number | null; rating: number | null }[];
  goals: { side: Side; scorerId: number; assistId: number | null; minute: number | null }[];
}

export interface Meta {
  formations: Record<string, number[]>;
  positions: Position[];
  sideSize: number;
  points: { goal: number; assist: number; win: number; draw: number; mvp: number };
  defaultMinMatches: number;
  rankings: { type: string; label: string; metric: string }[];
}

export interface Scope {
  season: { id: number; name: string } | null;
}

export interface RankingRow {
  rank: number;
  player: PlayerRef;
  value: number;
  stats: PlayerStats;
}

export interface Ranking extends Scope {
  type: string;
  label: string;
  metric: string;
  description: string;
  decimals: number;
  minMatches: number | null;
  minMatchesRequested: number | null;
  relaxed: boolean;
  rows: RankingRow[];
}

export interface Leader extends RankingRow {
  tiedCount: number;
}

export interface PerformanceBrief extends BestPerformance {
  player: PlayerRef;
}

export interface ResultsDistribution {
  sideWins: { A: number; B: number; draws: number };
  margins: { label: string; count: number }[];
}

export interface Dashboard extends Scope {
  totals: { matches: number; goals: number; assists: number; players: number; activePlayers: number; goalsPerMatch: number | null };
  mvp: Leader | null;
  topScorer: Leader | null;
  topAssister: Leader | null;
  topRated: Leader | null;
  topRatedRelaxed: boolean;
  topRatedMinMatches: number | null;
  latestMatches: MatchView[];
  topPlayers: RankingRow[];
  topPlayersRelaxed: boolean;
  recentPerformances: PerformanceBrief[];
  goalsTrend: { matchId: number; date: string; goalsA: number; goalsB: number; goals: number }[];
  resultsDistribution: ResultsDistribution;
}

export interface RecordHolders {
  value: number;
  count: number;
  holders: PerformanceBrief[];
}

export interface Statistics extends Scope {
  totals: { matches: number; goals: number; assists: number; goalsPerMatch: number | null };
  records: {
    highestScoringMatch: { total: number; match: MatchView } | null;
    biggestWin: { margin: number; match: MatchView } | null;
    mostGoalsInMatch: RecordHolders | null;
    mostAssistsInMatch: RecordHolders | null;
    mostMvp: { value: number; leaders: RankingRow[] } | null;
    hatTricks: {
      total: number;
      byPlayer: { player: PlayerRef; count: number }[];
      recent: PerformanceBrief[];
    };
    longestWinStreak: { player: PlayerRef; length: number; from: string; to: string; current: number } | null;
    winStreaks: { player: PlayerRef; length: number; from: string; to: string; current: number }[];
    bestWinPercentage: { ranking: { minMatches: number | null; relaxed: boolean }; leaders: RankingRow[] } | null;
  };
  charts: {
    timeline: {
      matchId: number;
      date: string;
      goals: number;
      goalsA: number;
      goalsB: number;
      assists: number;
      cumulativeGoals: number;
      cumulativeAssists: number;
    }[];
    resultsDistribution: ResultsDistribution;
    performanceTrends: {
      player: PlayerRef;
      points: {
        matchId: number;
        date: string;
        rating: number | null;
        goals: number;
        assists: number;
        cumulativeGA: number;
      }[];
    }[];
  };
}

export interface HistoryEntry extends BestPerformance {
  seasonName: string;
  side: Side;
  slot: number | null;
  teammates: PlayerRef[];
  opponents: PlayerRef[];
}

export interface PlayerProfile extends Scope {
  player: PlayerRef;
  stats: PlayerStats;
  history: HistoryEntry[];
  ratingHistory: { matchId: number; date: string; rating: number }[];
  contributionHistory: { matchId: number; date: string; goals: number; assists: number }[];
  bySeason: {
    seasonId: number;
    seasonName: string;
    matches: number;
    goals: number;
    assists: number;
    wins: number;
    draws: number;
    losses: number;
    avgRating: number | null;
    mvp: number;
  }[];
}

export interface CompareRow {
  key: string;
  label: string;
  a: number | Result[] | null;
  b: number | Result[] | null;
  better: 'a' | 'b' | 'tie' | null;
  format: 'int' | 'dec' | 'pct' | 'form';
}

export interface Comparison extends Scope {
  a: { player: PlayerRef; stats: PlayerStats; trend: { matchId: number; date: string; rating: number | null; goals: number; assists: number }[] };
  b: { player: PlayerRef; stats: PlayerStats; trend: { matchId: number; date: string; rating: number | null; goals: number; assists: number }[] };
  rows: CompareRow[];
}

export interface HeadToHeadSide {
  player: PlayerRef;
  wins: number;
  draws: number;
  losses: number;
  winPct: number | null;
  goals: number;
  assists: number;
  avgRating: number | null;
  ratedMatches: number;
}

export interface HeadToHead extends Scope {
  matches: number;
  a: HeadToHeadSide;
  b: HeadToHeadSide;
  draws: number;
  latest: {
    match: MatchView;
    winner: 'a' | 'b' | 'draw';
    a: { side: Side; goals: number; assists: number; rating: number | null };
    b: { side: Side; goals: number; assists: number; rating: number | null };
  }[];
}
