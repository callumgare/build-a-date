import type { CardInput } from '@/lib/validation'

export const starterTags = [
  'active',
  'at home',
  'creative',
  'culture',
  'food & drink',
  'free',
  'games',
  'night',
  'outside',
  'relaxed',
] as const

type StarterTag = (typeof starterTags)[number]

// Offered when someone starts a deck from suggestions. These are kept general
// enough to work anywhere, so there are no venues, links or dates.
export const starterCards: (CardInput & { tags: StarterTag[] })[] = [
  {
    title: 'Picnic in the Park',
    description: 'Pack a blanket, some snacks and something cold to drink, and find a patch of grass.',
    tags: ['food & drink', 'outside', 'relaxed'],
  },
  {
    title: 'Cook Something New',
    description: 'Pick a cuisine neither of you has cooked before and make a meal of it together.',
    tags: ['at home', 'food & drink', 'creative'],
  },
  {
    title: 'Board Game Night',
    description: 'Dig out an old favourite or learn a new one. Loser makes the tea.',
    tags: ['at home', 'games', 'night'],
  },
  {
    title: 'Sunrise Walk',
    description: 'Set an early alarm, bring a thermos, and watch the day start.',
    tags: ['active', 'free', 'outside'],
  },
  {
    title: 'Stargazing',
    description: 'Get away from the city lights with a blanket and a star map app.',
    tags: ['free', 'night', 'outside', 'relaxed'],
  },
  {
    title: 'Museum or Gallery',
    description: 'Wander an exhibition, then each pick the piece you would take home.',
    tags: ['culture', 'relaxed'],
  },
  {
    title: 'Pottery Class',
    description: 'Get your hands muddy at a beginner wheel-throwing or hand-building class.',
    tags: ['creative'],
  },
  {
    title: 'Paint Each Other',
    description: 'Cheap canvases, a few paints, and portraits of each other. No talent required.',
    tags: ['at home', 'creative'],
  },
  {
    title: "Farmers' Market Breakfast",
    description: 'Graze your way around a weekend market, then cook with what you bring home.',
    tags: ['food & drink', 'outside'],
  },
  {
    title: 'Trivia Night',
    description: 'Join a pub quiz as a team of two, or rope in some friends.',
    tags: ['games', 'night', 'food & drink'],
  },
  {
    title: 'Karaoke',
    description: 'Book a private room and take turns choosing songs for each other.',
    tags: ['night', 'games'],
  },
  {
    title: 'Bike Ride',
    description: 'Pick a trail or a quiet stretch of road, and somewhere to stop for lunch.',
    tags: ['active', 'outside'],
  },
  {
    title: 'Movie Marathon',
    description: 'Build a blanket fort, pick a trilogy, and make proper popcorn.',
    tags: ['at home', 'night', 'relaxed'],
  },
  {
    title: 'Bookshop Crawl',
    description: 'Visit a few bookshops and pick out a book for each other under a set budget.',
    tags: ['culture', 'relaxed'],
  },
  {
    title: 'Live Music',
    description: 'Find a small gig by a band neither of you has heard of.',
    tags: ['culture', 'night'],
  },
  {
    title: 'Escape Room',
    description: 'Lock yourselves in and find out how well you work under pressure.',
    tags: ['games'],
  },
  {
    title: 'Mini Golf',
    description: 'Keep score. Take it far too seriously.',
    tags: ['games', 'outside'],
  },
  {
    title: 'Dessert Crawl',
    description: 'Skip dinner and go straight to dessert, at three different places.',
    tags: ['food & drink', 'night'],
  },
  {
    title: 'Day at the Water',
    description: 'A beach, a lake or a river: swim, paddle, or just sit by it.',
    tags: ['outside', 'relaxed', 'free'],
  },
  {
    title: 'Volunteer Together',
    description: 'Spend a morning at a community garden, food bank or animal shelter.',
    tags: ['free', 'active'],
  },
  {
    title: 'Hike to a Lookout',
    description: 'Pick a walk with a view at the end, and pack lunch to eat up there.',
    tags: ['active', 'outside', 'free'],
  },
  {
    title: 'Comedy Night',
    description: 'Catch a stand-up show or an open mic night.',
    tags: ['culture', 'night'],
  },
  {
    title: 'Wine or Beer Tasting',
    description: 'Visit a winery, brewery or distillery, or run a blind tasting at home.',
    tags: ['food & drink'],
  },
  {
    title: 'Try a Dance Class',
    description: 'Salsa, swing or tango. Stepping on each other is part of it.',
    tags: ['active', 'night'],
  },
  {
    title: 'Cinema Trip',
    description: 'See whatever is on next, without reading anything about it first.',
    tags: ['culture', 'night'],
  },
  {
    title: 'Build a Puzzle',
    description: 'A thousand pieces, some music, and a night in.',
    tags: ['at home', 'games', 'relaxed'],
  },
  {
    title: 'Photo Walk',
    description: 'Walk a neighbourhood and give each other photo challenges along the way.',
    tags: ['creative', 'free', 'outside'],
  },
  {
    title: 'Botanic Gardens',
    description: 'A slow wander among the plants, maybe with a coffee in hand.',
    tags: ['outside', 'relaxed', 'free'],
  },
  {
    title: 'Arcade Night',
    description: 'Pool your tokens and win the worst possible prize.',
    tags: ['games', 'night'],
  },
  {
    title: 'Cooking Class',
    description: 'Learn to make pasta, dumplings or sushi from someone who knows how.',
    tags: ['food & drink', 'creative'],
  },
  {
    title: 'Write Letters',
    description: 'Write each other a letter to open in a year. Seal them and hide them away.',
    tags: ['at home', 'creative', 'free'],
  },
  {
    title: 'Surprise Day Trip',
    description: 'One of you plans a day somewhere new. The other only finds out on the way.',
    tags: ['outside'],
  },
]
