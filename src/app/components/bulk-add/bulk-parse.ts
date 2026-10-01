/**
 * Turns a pasted list into task drafts.
 *
 *   - Call the accountant !high @tomorrow #calls
 *   * [x] Already done +Website
 *     an indented line becomes a note on the task above
 *
 * Bullets (-, *, •, +, 1., 1)), checkboxes ([ ], [x]) and blank lines are understood.
 * Tokens: !priority  #tag  +project  @today|@tomorrow|@backlog|@mon…@sun|@YYYY-MM-DD
 */
import { addDays, parseIsoDate, toIsoDate } from '../../core/dates';
import { Project, Tag, WorkspaceContext } from '../../core/models';

export interface Draft {
  title: string;
  notes: string;
  done: boolean;
  priority: Tag | null;
  tags: Tag[];
  project: Project | null;
  /** undefined = use the dialog's default day; null = backlog. */
  date: string | null | undefined;
  warnings: string[];
}

const BULLET = /^(?:[-*•+]|\d+[.)])\s+/;
const CHECKBOX = /^\[( |x|X)\]\s*/;
const WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const norm = (s: string) => s.toLowerCase().replace(/[-_]+/g, ' ').trim();

function parseDate(token: string, today: string): string | null | undefined {
  const t = token.toLowerCase();
  if (t === 'today') return today;
  if (t === 'tomorrow') return addDays(today, 1);
  if (t === 'backlog' || t === 'someday') return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  const wd = WEEKDAYS.findIndex((d) => t.startsWith(d));
  if (wd >= 0) {
    const base = parseIsoDate(today);
    const delta = (wd - base.getDay() + 7) % 7 || 7; // next occurrence, never today
    return toIsoDate(new Date(base.getFullYear(), base.getMonth(), base.getDate() + delta));
  }
  return undefined;
}

export function parseList(text: string, ctx: WorkspaceContext | undefined, today: string): Draft[] {
  const drafts: Draft[] = [];
  const lines = text.replace(/\t/g, '  ').split(/\r?\n/);
  const indents = lines.filter((l) => l.trim()).map((l) => l.length - l.trimStart().length);
  const base = indents.length ? Math.min(...indents) : 0;

  const priorities = ctx?.tag_groups.find((g) => g.kind === 'priority')?.tags ?? [];
  const labelTags = ctx?.tags.filter((t) => {
    const group = ctx.tag_groups.find((g) => g.id === t.group);
    return !group || group.kind === 'custom';
  }) ?? [];
  const projects = ctx?.projects.filter((p) => !p.archived) ?? [];

  for (const raw of lines) {
    if (!raw.trim()) continue;
    const indent = raw.length - raw.trimStart().length;
    let line = raw.trim().replace(BULLET, '');
    if (indent > base && drafts.length) {
      const last = drafts[drafts.length - 1];
      last.notes = (last.notes ? last.notes + '\n' : '') + line;
      continue;
    }
    const draft: Draft = { title: '', notes: '', done: false, priority: null, tags: [], project: null, date: undefined, warnings: [] };
    const box = line.match(CHECKBOX);
    if (box) {
      draft.done = box[1].toLowerCase() === 'x';
      line = line.slice(box[0].length);
    }
    const words: string[] = [];
    for (const word of line.split(/\s+/)) {
      const sigil = word[0];
      const value = word.slice(1);
      if (value && sigil === '!') {
        const p = priorities.find((t) => t.name.toLowerCase().startsWith(value.toLowerCase()));
        if (p) {
          draft.priority = p;
          continue;
        }
        draft.warnings.push(`No priority “${value}”`);
      } else if (value && sigil === '#') {
        const tag = labelTags.find((t) => norm(t.name) === norm(value) || norm(t.name) === norm('@' + value));
        if (tag) {
          if (tag.group !== null) draft.tags = draft.tags.filter((t) => t.group !== tag.group);
          draft.tags.push(tag);
          continue;
        }
        draft.warnings.push(`No tag “${value}”`);
      } else if (value && sigil === '+') {
        const project = projects.find((p) => norm(p.name) === norm(value)) ?? projects.find((p) => norm(p.name).startsWith(norm(value)));
        if (project) {
          draft.project = project;
          continue;
        }
        draft.warnings.push(`No project “${value}”`);
      } else if (value && sigil === '@') {
        const tag = labelTags.find((t) => norm(t.name) === norm(word));
        if (tag) {
          // Tags like "@home" from a Context group
          if (tag.group !== null) draft.tags = draft.tags.filter((t) => t.group !== tag.group);
          draft.tags.push(tag);
          continue;
        }
        const date = parseDate(value, today);
        if (date !== undefined) {
          draft.date = date;
          continue;
        }
        draft.warnings.push(`Didn't understand “${word}”`);
      }
      words.push(word);
    }
    draft.title = words.join(' ').trim();
    if (draft.title) drafts.push(draft);
  }
  return drafts;
}
