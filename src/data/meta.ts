/**
 * Page titles and descriptions, shared by the app shell and the build-time
 * metadata pass so a crawler that does not run JavaScript still sees them.
 */

export const TITLES: Record<string, string> = {
  '#/game': 'Chronicle Frontier',
  '#/atlas': 'World Atlas',
  '#/puffwork': 'Puffwork — inflatable 3D illustrations',
  '#/about': 'About me',
  '#/apps': 'Apps',
  '#/reviews': 'Reviews & comments',
  '#/reviews/moderation': 'Review moderation',
  '#/request': 'Request software',
  '#/donate': 'Donate',
}

export const DESCRIPTIONS: Record<string, string> = {
  '#/apps':
    'Every app in the CensorisLabs suite — money, health, reading, media and everyday tools that keep their data on your device. Free, with every feature included.',
  '#/about':
    'The builder behind CensorisLabs on local-first software, honest privacy and tools that keep working with the network off.',
  '#/reviews':
    'Published notes from people using CensorisLabs apps, and a form for saying what works and what should change next.',
  '#/request':
    'Ask CensorisLabs for the tool you actually need. Describe the problem and it is read directly by the builder.',
  '#/donate':
    'CensorisLabs apps are free with every feature included. An optional UPI donation keeps the work going.',
  '#/puffwork':
    'Puffwork: soft inflatable 3D illustration packs with commercial licence options, made by CensorisLabs.',
  '#/atlas': 'The living world atlas — an interactive globe of places, conflicts and sources.',
  '#/game': 'Chronicle Frontier, an original voxel first-person shooter playable in the browser.',
}
