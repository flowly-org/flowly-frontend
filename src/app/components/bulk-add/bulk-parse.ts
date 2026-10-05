/**
 * Turns a pasted list into task drafts.
 *
 *   - Call the accountant !high @tomorrow #calls
 *   * [x] Already done +Website
 *     an indented line becomes a note on the task above
 *
 * Bullets (-, *, •, +, 1., 1)), checkboxes ([ ], [x]) and blank lines are understood; an indented [ ] line is a
 * checklist item of the task above.
 * Tokens: !priority  #tag  +project  @today|@tomorrow|@backlog|@mon…@sun|@YYYY-MM-DD|@+3 (days after the start)
 *         ~30m|~1h|~1h30 (estimate)  =Anna (assignee: a member's name, first name or email)
 */
import { addDays, parseIsoDate, toIsoDate } from '../../core/dates';
import { ChecklistItem, Project, Tag, WorkspaceContext } from '../../core/models';

export interface Draft {
  title: string;
  notes: string;
  done: boolean;
  priority: Tag | null;
  tags: Tag[];
  project: Project | null;
  /** undefined = use the dialog's default day; null = backlog. */
  date: string | null | undefined;
  /** Untranslated message keys with a {value} placeholder; shown with the `t` pipe. */
  warnings: { key: string; value: string }[];
  estimate: number | null;
  checklist: ChecklistItem[];
  /** User id from an =Name token. */
  assignee: number | null;
  assigneeName: string | null;
}

/** "~30m", "~1h", "~1h30", "~1.5h", "~90" → minutes. */
export function parseEstimate(token: string): number | null {
  const m = token.match(/^~(\d+(?:[.,]\d+)?)(m|min|h)?(\d{1,2})?$/i);
  if (!m) return null;
  const value = parseFloat(m[1].replace(',', '.'));
  const minutes = (m[2] ?? 'm').toLowerCase() === 'h' ? value * 60 + Number(m[3] ?? 0) : value;
  return minutes > 0 && minutes <= 7 * 24 * 60 ? Math.round(minutes) : null;
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
  const rel = t.match(/^\+(\d{1,3})(d|w)?$/);
  if (rel) return addDays(today, Number(rel[1]) * (rel[2] === 'w' ? 7 : 1));
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
  const members = (ctx?.members ?? []).map((m) => m.user);
  const findMember = (value: string) => {
    const key = norm(value);
    const tests = [
      (u: { full_name: string; email: string }) => norm(u.full_name || '') === key,
      (u: { full_name: string; email: string }) => norm(u.email.split('@')[0].replace(/\./g, ' ')) === key || u.email.toLowerCase() === value.toLowerCase(),
      (u: { full_name: string; email: string }) => norm((u.full_name || '').split(' ')[0]) === key,
    ];
    for (const test of tests) {
      const found = members.filter(test);
      if (found.length === 1) return found[0];
    }
    return null;
  };

  for (const raw of lines) {
    if (!raw.trim()) continue;
    const indent = raw.length - raw.trimStart().length;
    let line = raw.trim().replace(BULLET, '');
    if (indent > base && drafts.length) {
      const last = drafts[drafts.length - 1];
      const item = line.match(CHECKBOX);
      if (item && line.slice(item[0].length).trim()) last.checklist.push({ text: line.slice(item[0].length).trim(), done: item[1].toLowerCase() === 'x' });
      else last.notes = (last.notes ? last.notes + '\n' : '') + line;
      continue;
    }
    const draft: Draft = { title: '', notes: '', done: false, priority: null, tags: [], project: null, date: undefined, warnings: [], estimate: null, checklist: [], assignee: null, assigneeName: null };
    const box = line.match(CHECKBOX);
    if (box) {
      draft.done = box[1].toLowerCase() === 'x';
      line = line.slice(box[0].length);
    }
    const words: string[] = [];
    for (const word of line.split(/\s+/)) {
      const sigil = word[0];
      const value = word.slice(1);
      if (value && sigil === '~' && parseEstimate(word)) {
        draft.estimate = parseEstimate(word);
        continue;
      }
      if (value && sigil === '=') {
        const member = findMember(value);
        if (member) {
          draft.assignee = member.id;
          draft.assigneeName = member.full_name || member.email;
          continue;
        }
        draft.warnings.push({ key: 'No member “{value}”: left in the title', value });
      }
      if (value && sigil === '!') {
        const p = priorities.find((t) => t.name.toLowerCase().startsWith(value.toLowerCase()));
        if (p) {
          draft.priority = p;
          continue;
        }
        draft.warnings.push({ key: 'No priority “{value}”: left in the title', value });
      } else if (value && sigil === '#') {
        const tag = labelTags.find((t) => norm(t.name) === norm(value) || norm(t.name) === norm('@' + value));
        if (tag) {
          if (tag.group !== null) draft.tags = draft.tags.filter((t) => t.group !== tag.group);
          draft.tags.push(tag);
          continue;
        }
        draft.warnings.push({ key: 'No tag “{value}”: left in the title', value });
      } else if (value && sigil === '+') {
        const project = projects.find((p) => norm(p.name) === norm(value)) ?? projects.find((p) => norm(p.name).startsWith(norm(value)));
        if (project) {
          draft.project = project;
          continue;
        }
        draft.warnings.push({ key: 'No project “{value}”: left in the title', value });
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
        draft.warnings.push({ key: 'Didn’t understand “{value}”: left in the title', value: word });
      }
      words.push(word);
    }
    draft.title = words.join(' ').trim();
    if (draft.title) drafts.push(draft);
  }
  return drafts;
}
