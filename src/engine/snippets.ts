export interface Snippet {
  key: string;
  sourceKey?: string;
}

export const snippets: Snippet[] = [
  { key: 'snip_1' },
  { key: 'snip_2' },
  { key: 'snip_3', sourceKey: 'snip_3_source' },
  { key: 'snip_4' }
];

export function getRandomSnippet(): Snippet {
  const index = Math.floor(Math.random() * snippets.length);
  return snippets[index];
}
