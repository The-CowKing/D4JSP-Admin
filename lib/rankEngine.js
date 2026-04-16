const RANKS = [
  { id: 1, name: 'Scavenger', xp: 0, fgReward: 5 },
  { id: 2, name: 'Wanderer', xp: 500, fgReward: 20 },
  { id: 3, name: 'Initiate', xp: 1200, fgReward: 25 },
  { id: 4, name: 'Acolyte', xp: 2500, fgReward: 40 },
  { id: 5, name: 'Marauder', xp: 4200, fgReward: 100 },
  { id: 6, name: 'Raider', xp: 6400, fgReward: 50 },
  { id: 7, name: 'Warrior', xp: 9000, fgReward: 50 },
  { id: 8, name: 'Berserker', xp: 12100, fgReward: 50 },
  { id: 9, name: 'Crusher', xp: 15700, fgReward: 50 },
  { id: 10, name: 'Assassin', xp: 19900, fgReward: 100 },
  { id: 11, name: 'Adept', xp: 24700, fgReward: 100 },
  { id: 12, name: 'Hunter', xp: 30200, fgReward: 100 },
  { id: 13, name: 'Guardian', xp: 36400, fgReward: 100 },
  { id: 14, name: 'Summoner', xp: 43400, fgReward: 100 },
  { id: 15, name: 'Brute', xp: 51200, fgReward: 100 },
  { id: 16, name: 'Slayer', xp: 59800, fgReward: 100 },
  { id: 17, name: 'Knight', xp: 69300, fgReward: 100 },
  { id: 18, name: 'Crusader', xp: 79700, fgReward: 100 },
  { id: 19, name: 'Avenger', xp: 91000, fgReward: 100 },
  { id: 20, name: 'Warden', xp: 103300, fgReward: 200 },
  { id: 21, name: 'Champion', xp: 116600, fgReward: 200 },
  { id: 22, name: 'Lord', xp: 130900, fgReward: 200 },
  { id: 23, name: 'Master', xp: 146300, fgReward: 200 },
  { id: 24, name: 'Inferno', xp: 162800, fgReward: 200 },
  { id: 25, name: 'Abyssal', xp: 180400, fgReward: 200 },
  { id: 26, name: 'Demonbane', xp: 199200, fgReward: 200 },
  { id: 27, name: 'Hellwalker', xp: 219200, fgReward: 200 },
  { id: 28, name: 'Sovereign', xp: 240400, fgReward: 200 },
  { id: 29, name: 'Conqueror', xp: 262900, fgReward: 200 },
  { id: 30, name: 'Bloodlord', xp: 286600, fgReward: 200 },
  { id: 31, name: 'Shadowlord', xp: 311700, fgReward: 300 },
  { id: 32, name: 'Flamelord', xp: 338100, fgReward: 300 },
  { id: 33, name: 'Stormlord', xp: 365900, fgReward: 300 },
  { id: 34, name: 'Warlord', xp: 395100, fgReward: 300 },
  { id: 35, name: 'Overlord', xp: 425700, fgReward: 300 },
  { id: 36, name: 'Archmage', xp: 457700, fgReward: 300 },
  { id: 37, name: 'Lich', xp: 491200, fgReward: 300 },
  { id: 38, name: 'Elder', xp: 526200, fgReward: 300 },
  { id: 39, name: 'Legend', xp: 562700, fgReward: 300 },
  { id: 40, name: 'Chosen', xp: 600800, fgReward: 300 },
  { id: 41, name: 'Keeper', xp: 640400, fgReward: 400 },
  { id: 42, name: 'Eternal', xp: 681700, fgReward: 400 },
  { id: 43, name: 'Bane', xp: 724600, fgReward: 400 },
  { id: 44, name: 'Prime', xp: 769200, fgReward: 400 },
  { id: 45, name: 'Titan', xp: 815500, fgReward: 400 },
  { id: 46, name: 'Apex', xp: 863500, fgReward: 400 },
  { id: 47, name: 'Supreme', xp: 913300, fgReward: 400 },
  { id: 48, name: 'Immortal', xp: 964800, fgReward: 400 },
  { id: 49, name: 'Hellbane', xp: 1018200, fgReward: 400 },
  { id: 50, name: 'Godslayer', xp: 1073500, fgReward: 500, special: 'glowing_avatar' },
];

// XP awards
export const XP_REWARDS = {
  signup: 50,
  post: 10,
  sale: 100,
  referral: 200,
  daily_quest: 35,
  weekly_quest: 150,
};

// Get highest rank user qualifies for — XP only
export function calculateRank(user) {
  const qualified = RANKS.filter(r => user.xp >= r.xp);
  return qualified[qualified.length - 1] || RANKS[0];
}

// Get XP progress to next rank
export function getRankProgress(user) {
  const current = calculateRank(user);
  const next = RANKS.find(r => r.id === current.id + 1);
  if (!next) return { current, next: null, percent: 100, xpNeeded: 0 };
  const xpNeeded = Math.max(0, next.xp - user.xp);
  const xpRange = next.xp - current.xp;
  const percent = xpRange > 0 ? Math.floor(Math.min((user.xp - current.xp) / xpRange, 1) * 100) : 0;
  return { current, next, percent: Math.min(Math.max(percent, 0), 99), xpNeeded };
}

export { RANKS };
