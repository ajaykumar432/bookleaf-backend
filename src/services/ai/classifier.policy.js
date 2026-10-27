import { PRIORITIES, PRIORITY_RANK } from '../../constants.js';

/**
 * Business rules the model must not be able to violate (KB: ISBN errors are high priority).
 * Applied to BOTH AI and fallback output.
 */
export function applyPolicyFloor(category, priority) {
  const p = PRIORITIES.includes(priority) ? priority : 'Medium';
  if (category === 'ISBN & Metadata Issues' && PRIORITY_RANK[p] < PRIORITY_RANK.High) return 'High';
  return p;
}
