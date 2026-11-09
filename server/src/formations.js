// 6-a-side formations. Slot 0 is always the goalkeeper spot;
// the numbers are outfield lines from defence to attack and always add up to 5.
export const FORMATIONS = {
  '2-2-1': [2, 2, 1],
  '2-1-2': [2, 1, 2],
  '1-3-1': [1, 3, 1],
  '1-2-2': [1, 2, 2],
  '3-1-1': [3, 1, 1],
  '1-1-3': [1, 1, 3],
  '3-2': [3, 2],
  '2-3': [2, 3],
};

export const DEFAULT_FORMATION = '2-2-1';
export const SIDE_SIZE = 6;
export const POSITIONS = ['GK', 'DEF', 'MID', 'FWD', 'ANY'];

export function isFormation(key) {
  return Object.prototype.hasOwnProperty.call(FORMATIONS, key);
}
