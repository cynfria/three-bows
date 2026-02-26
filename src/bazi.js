/**
 * Ba Zi (八字) Four Pillars calculation
 *
 * Calculates the Year, Month, Day, and Hour pillars from a birth date/time.
 * Each pillar = Heavenly Stem (天干) + Earthly Branch (地支).
 */

// ─── Heavenly Stems (天干) ───────────────────────────────────────────────────
const STEMS = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'];
const STEM_ELEMENTS = ['Wood','Wood','Fire','Fire','Earth','Earth','Metal','Metal','Water','Water'];
const STEM_POLARITY  = ['Yang','Yin','Yang','Yin','Yang','Yin','Yang','Yin','Yang','Yin'];

// ─── Earthly Branches (地支) ─────────────────────────────────────────────────
const BRANCHES = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
const BRANCH_ANIMALS   = ['Rat','Ox','Tiger','Rabbit','Dragon','Snake','Horse','Goat','Monkey','Rooster','Dog','Pig'];
const BRANCH_ELEMENTS  = ['Water','Earth','Wood','Wood','Earth','Fire','Fire','Earth','Metal','Metal','Earth','Water'];

// ─── Solar Term (節氣) dates for year pillar cutover ─────────────────────────
// Li Chun (立春 = Start of Spring) is ~Feb 4 each year.
// Years where Li Chun falls on Feb 3 vs Feb 4: for simplicity, use Feb 4 at 00:00.
// This is an approximation; full accuracy requires exact Li Chun times.
function liChunDate(year) {
  return new Date(year, 1, 4); // Feb 4
}

// ─── Year Pillar ─────────────────────────────────────────────────────────────
export function yearPillar(date) {
  let y = date.getFullYear();
  // If before Li Chun, use previous Chinese year
  if (date < liChunDate(y)) y -= 1;
  // Cycle from 4 CE (甲子 = stem 0, branch 0)
  const stemIdx   = (y - 4) % 10;
  const branchIdx = (y - 4) % 12;
  return makePillar(
    ((stemIdx % 10) + 10) % 10,
    ((branchIdx % 12) + 12) % 12
  );
}

// ─── Month Pillar ────────────────────────────────────────────────────────────
// Month branch (寅月 = index 2) starts at Li Chun (~Feb 4).
// Each month corresponds to a Solar Term pair. We use approximate dates.
// Month branch: Jan=11(丑), Feb=0(寅) after Feb4, ... but traditional starts:
// Jieqi months: Tiger=Feb4, Rabbit=Mar6, Dragon=Apr5, Snake=May6,
//               Horse=Jun6, Goat=Jul7, Monkey=Aug7, Rooster=Sep8,
//               Dog=Oct8, Pig=Nov7, Rat=Dec7, Ox=Jan6
const JIEQI_STARTS = [6,4,6,5,6,7,7,8,8,7,7,6]; // day of month for each branch month
// branch index 0(Rat/子)=Dec, 1(Ox/丑)=Jan, 2(Tiger/寅)=Feb, ...
// Simpler: map calendar month+day to branch index
function monthBranchIndex(date) {
  const m = date.getMonth() + 1; // 1-12
  const d = date.getDate();
  // Approximate Jieqi cutover days
  const cuts = [0, 6, 4, 6, 5, 6, 7, 7, 8, 8, 7, 7, 7]; // index 1=Jan6, 2=Feb4...
  // branch 0 = Rat = Dec, branch 1 = Ox = Jan, branch 2 = Tiger = Feb...
  let branch;
  if (m === 1) {
    branch = d < cuts[1] ? 11 : 0; // before Jan 6 = Rat(prev Dec), after = Ox
    // actually: Jan belongs mostly to Ox (丑) branch
    branch = d < cuts[1] ? 11 : 1;
  } else {
    branch = m; // Feb=2(Tiger), Mar=3(Rabbit)... but we need to shift by 2
    // branch index 2=Tiger=Feb, so month-based: branchIdx = (m - 2 + 12) % 12 + 2
    // Map: Feb->2, Mar->3, Apr->4, May->5, Jun->6, Jul->7, Aug->8, Sep->9, Oct->10, Nov->11, Dec->0
    const cutday = cuts[m] || 6;
    const branchForMonth = ((m - 2 + 12) % 12 + 2) % 12;
    const branchPrev = ((m - 3 + 12) % 12 + 2) % 12;
    branch = d < cutday ? branchPrev : branchForMonth;
    if (m === 12) branch = d < 7 ? 11 : 0; // Dec: before 7th=Pig(亥=11)? No...
    // Simpler approach below
  }
  return branch;
}

// Cleaner month branch lookup
function getMonthBranch(date) {
  const m = date.getMonth(); // 0-indexed
  const d = date.getDate();
  // Approximate Jieqi start days (of that month)
  // Tiger月(寅) starts Feb 4, Rabbit(卯) Mar 6, Dragon(辰) Apr 5,
  // Snake(巳) May 6, Horse(午) Jun 6, Goat(未) Jul 7,
  // Monkey(申) Aug 7, Rooster(酉) Sep 8, Dog(戌) Oct 8,
  // Pig(亥) Nov 7, Rat(子) Dec 7, Ox(丑) Jan 6
  const jieqiDay = [6,4,6,5,6,6,7,7,8,8,7,7]; // [Jan,Feb,Mar,Apr,May,Jun,Jul,Aug,Sep,Oct,Nov,Dec]
  // Branch for the Jieqi month that starts THIS calendar month:
  // Jan->Ox(1), Feb->Tiger(2), Mar->Rabbit(3), ... Dec->Rat(0) then Ox next
  // After Jieqi day: Tiger(2)=Feb, else still Ox(1)=Jan late
  const branchMap = [1,2,3,4,5,6,7,8,9,10,11,0]; // index by month (0=Jan)
  const prevBranchMap = [0,1,2,3,4,5,6,7,8,9,10,11];
  return d >= jieqiDay[m] ? branchMap[m] : prevBranchMap[m];
}

export function monthPillar(date) {
  const yearBranch = yearPillar(date).branchIndex;
  const mb = getMonthBranch(date);
  // Month stem formula: year stem determines the stem cycle for that year's Tiger month
  // Year stem * 2 + month branch = stem start offset
  // Tiger month stem for each year stem pair:
  // 甲/己年 -> 丙寅 (stem 2), 乙/庚年 -> 戊寅 (stem 4),
  // 丙/辛年 -> 庚寅 (stem 6), 丁/壬年 -> 壬寅 (stem 8),
  // 戊/癸年 -> 甲寅 (stem 0)
  const yp = yearPillar(date);
  const yearStemMod = yp.stemIndex % 5; // 0=甲己, 1=乙庚, 2=丙辛, 3=丁壬, 4=戊癸
  const tigerStem = [2, 4, 6, 8, 0][yearStemMod]; // stem index for Tiger month
  // Month stem = tigerStem + (monthBranch - 2 + 12) % 12
  const stemIdx = (tigerStem + ((mb - 2 + 12) % 12)) % 10;
  return makePillar(stemIdx, mb);
}

// ─── Day Pillar ──────────────────────────────────────────────────────────────
// Uses the Julian Day Number method.
// Reference: Jan 1, 2000 = JD 2451545 was a 甲子(stem0, branch0) day.
export function dayPillar(date) {
  const jd = julianDay(date.getFullYear(), date.getMonth() + 1, date.getDate());
  const refJD = 2451545; // Jan 1, 2000 (甲子 day, stem=0, branch=0)
  const diff = jd - refJD;
  const stemIdx   = ((diff % 10) + 10) % 10;
  const branchIdx = ((diff % 12) + 12) % 12;
  return makePillar(stemIdx, branchIdx);
}

function julianDay(y, m, d) {
  // Standard Julian Day calculation
  if (m <= 2) { y -= 1; m += 12; }
  const A = Math.floor(y / 100);
  const B = 2 - A + Math.floor(A / 4);
  return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + B - 1524;
}

// ─── Hour Pillar ─────────────────────────────────────────────────────────────
// Two-hour blocks (時辰): Rat=23-1, Ox=1-3, Tiger=3-5, Rabbit=5-7, ...
export function hourPillar(date, timeStr) {
  if (!timeStr) return null;
  const [hh, mm] = timeStr.split(':').map(Number);
  const totalMin = hh * 60 + mm;
  // Shichen boundaries (start minutes from midnight)
  // 子=23:00-1:00, 丑=1:00-3:00, 寅=3:00-5:00, ...
  let branchIdx;
  if (totalMin >= 23 * 60 || totalMin < 60) branchIdx = 0;       // 子 Rat
  else if (totalMin < 3 * 60)   branchIdx = 1;  // 丑 Ox
  else if (totalMin < 5 * 60)   branchIdx = 2;  // 寅 Tiger
  else if (totalMin < 7 * 60)   branchIdx = 3;  // 卯 Rabbit
  else if (totalMin < 9 * 60)   branchIdx = 4;  // 辰 Dragon
  else if (totalMin < 11 * 60)  branchIdx = 5;  // 巳 Snake
  else if (totalMin < 13 * 60)  branchIdx = 6;  // 午 Horse
  else if (totalMin < 15 * 60)  branchIdx = 7;  // 未 Goat
  else if (totalMin < 17 * 60)  branchIdx = 8;  // 申 Monkey
  else if (totalMin < 19 * 60)  branchIdx = 9;  // 酉 Rooster
  else if (totalMin < 21 * 60)  branchIdx = 10; // 戌 Dog
  else                          branchIdx = 11; // 亥 Pig

  // Hour stem: day stem determines the cycle
  const dp = dayPillar(date);
  const dayStemMod = dp.stemIndex % 5;
  const ratHourStem = [0, 2, 4, 6, 8][dayStemMod]; // stem for Rat(子) hour
  const stemIdx = (ratHourStem + branchIdx) % 10;
  return makePillar(stemIdx, branchIdx);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function makePillar(stemIdx, branchIdx) {
  return {
    stemIndex:   stemIdx,
    branchIndex: branchIdx,
    stem:        STEMS[stemIdx],
    branch:      BRANCHES[branchIdx],
    element:     STEM_ELEMENTS[stemIdx],
    polarity:    STEM_POLARITY[stemIdx],
    animal:      BRANCH_ANIMALS[branchIdx],
    branchElement: BRANCH_ELEMENTS[branchIdx],
  };
}

// ─── Main export ─────────────────────────────────────────────────────────────
export function calculateBaZi(dateStr, timeStr) {
  const date = new Date(dateStr + 'T12:00:00'); // use noon to avoid TZ issues
  const yp = yearPillar(date);
  const mp = monthPillar(date);
  const dp = dayPillar(date);
  const hp = timeStr ? hourPillar(date, timeStr) : null;
  return { year: yp, month: mp, day: dp, hour: hp };
}
