import { getEmDashCollection } from 'emdash';

export async function published(collection: string) {
  const entries = [];
  let cursor: string | undefined;
  do {
    const page = await getEmDashCollection(collection, {
      status: 'published', orderBy: { published_at: 'desc' }, limit: 50, cursor,
    });
    if (page.error) throw new Error('Unable to load ' + collection);
    entries.push(...page.entries);
    cursor = page.nextCursor ?? undefined;
  } while (cursor);
  return entries;
}

export const sections = {
  'work-notes': { collection: 'journal', title: 'Work Journal', css: 'note-carousel', copy: 'essay', description: 'I keep notes here on conversations with customers, things we try as a team and what I learn along the way.' },
  'projects': { collection: 'projects', title: 'Projects', css: 'project-carousel', copy: 'catalogue-item', description: 'Small things I build or practise to understand an idea for myself. A few live in code. Others are part of my week.' },
  'outside-work': { collection: 'outside', title: 'Outside Work', css: 'photo-carousel', copy: 'journal-copy', description: 'I live in Amsterdam with Anna and our golden retriever, Fly. Let me show you around.' },
};
