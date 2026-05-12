import type { Player, Event, Score, Star } from '../schema.js'

// Player 型の検証
const _player: Player = {
  id: 'player-1',
  name: 'テストプレイヤー',
  pinHash: '$2b$10$hash',
  team: 'FIRST',
  title: null,
  mainUnit: null,
  createdAt: new Date(),
  isAdmin: false,
}

// team enum の検証
const _player2: Player = {
  id: 'player-2',
  name: 'プレイヤー2',
  pinHash: '$2b$10$hash',
  team: 'SECOND',
  title: '称号',
  mainUnit: 'ユニット名',
  createdAt: new Date(),
  isAdmin: true,
}

// Event 型の検証
const _event: Event = {
  id: 'event-1',
  heldAt: new Date(),
  phase: 'COLLECTING',
  revealPhase: 0,
  createdAt: new Date(),
}

const _event2: Event = {
  id: 'event-2',
  heldAt: new Date(),
  phase: 'REVEALING',
  revealPhase: 1,
  createdAt: new Date(),
}

const _event3: Event = {
  id: 'event-3',
  heldAt: new Date(),
  phase: 'DONE',
  revealPhase: 3,
  createdAt: new Date(),
}

// Score 型の検証
const _score: Score = {
  id: 'score-1',
  eventId: 'event-1',
  playerId: 'player-1',
  wins: 3,
  losses: 1,
  absent: false,
  submitted: true,
}

const _scoreAbsent: Score = {
  id: 'score-2',
  eventId: 'event-1',
  playerId: 'player-2',
  wins: 0,
  losses: 0,
  absent: true,
  submitted: false,
}

// Star 型の検証
const _star: Star = {
  id: 'star-1',
  eventId: 'event-1',
  fromPlayerId: 'player-1',
  toPlayerId: 'player-2',
  count: 3,
}

// 型が正しく export されていることを確認するためのダミー使用
void _player
void _player2
void _event
void _event2
void _event3
void _score
void _scoreAbsent
void _star
