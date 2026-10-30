// HIRING LEADS: a post opens (data/leads.js), Alice Chen sends its two candidates to Mail, and you hire one. No DOM.
//
// S.leads: { [area]: the hired candidate's id }
import { formatMoney } from '../core/util.js';
import { LEAD_POSTS } from '../data/leads.js';
import { S, log } from '../core/state.js';
import { memberJoined } from './team.js';

export const postOpen = area => LEAD_POSTS[area].opens == 'nasa' ? !!S.nasa : memberJoined('chen');
export const openPosts = () => Object.keys(LEAD_POSTS).filter(area => postOpen(area) && !S.leads[area]);
// The lead hired for an area: their candidate entry, or null.
export const hiredLead = area => LEAD_POSTS[area] && S.leads[area] ? LEAD_POSTS[area].candidates.find(candidate => candidate.id == S.leads[area]) : null;
export const leadsPayroll = () => Object.keys(S.leads).reduce((sum, area) => sum + (hiredLead(area) || { salary: 0 }).salary, 0);

// Hire a candidate. Returns an error text, or null if they joined.
export function hireLead(area, id) {
  const post = LEAD_POSTS[area], candidate = post && post.candidates.find(other => other.id == id);
  if (!candidate) return 'No such candidate.';
  if (!postOpen(area)) return 'That post is not open yet.';
  if (S.leads[area]) return 'That post is filled.';
  S.leads[area] = id;
  log(`[R&D] ${candidate.name} joins as ${post.title}, ${formatMoney(candidate.salary)} per cycle.`, 'hd');
  return null;
}
