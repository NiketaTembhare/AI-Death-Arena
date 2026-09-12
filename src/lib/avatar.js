const AVATAR_EMOJIS = [
  '🤖', '👾', '⚡', '🧠', '🚀', '🔥', '💻', '🔮', 
  '🦊', '🐱', '🐼', '🦁', '🐯', '🦄', '🐲', '🎯',
  '👑', '💎', '🌟', '💥', '🛸', '🛰️', '🧬', '🔬'
];

const AVATAR_BG_COLORS = [
  '#FF595E', '#FFCA3A', '#8AC926', '#1982C4', '#6A4C93',
  '#FF9F1C', '#2EC4B6', '#E71D36', '#9B5DE5', '#00F5D4'
];

export function getPlayerAvatar(identifier = '') {
  let hash = 0;
  for (let i = 0; i < identifier.length; i++) {
    hash = identifier.charCodeAt(i) + ((hash << 5) - hash);
  }
  const emojiIndex = Math.abs(hash) % AVATAR_EMOJIS.length;
  const colorIndex = Math.abs(hash >> 3) % AVATAR_BG_COLORS.length;

  return {
    emoji: AVATAR_EMOJIS[emojiIndex],
    bgColor: AVATAR_BG_COLORS[colorIndex]
  };
}
