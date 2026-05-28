const adjectives = [
  'swift', 'keen', 'bright', 'calm', 'bold', 'deft', 'warm', 'sharp',
  'nimble', 'brisk', 'clear', 'crisp', 'deep', 'fast', 'firm', 'full',
  'kind', 'light', 'neat', 'pure', 'rare', 'rich', 'safe', 'sure',
  'true', 'vast', 'wild', 'wise', 'solid', 'quiet', 'stark', 'steady',
];

const animals = [
  'fox', 'hawk', 'owl', 'wolf', 'bear', 'deer', 'lynx', 'crane',
  'otter', 'raven', 'heron', 'finch', 'robin', 'stoat', 'hare', 'wren',
  'egret', 'bison', 'cobra', 'dingo', 'eagle', 'gecko', 'ibis', 'koala',
];

export function randomAgentName(): string {
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const animal = animals[Math.floor(Math.random() * animals.length)];
  return `${adj}-${animal}`;
}
