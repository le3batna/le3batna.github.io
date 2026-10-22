/* على قد ثقتك: the web sampler's rules, number formatting and game state (v2).
 *
 * Ports of the app's code, checked against vectors generated from it
 * (tests/parity-vectors.json, by tools/parity/gen_vectors.dart):
 * - lib/engine/rules.dart: a choice question scores 1 point, 2 with دبل; a
 *   wrong دبل costs 1 point; a total never goes below 0; an adult team has
 *   3 دبل and 1 حذف جوابين in a قصيرة game (10 questions);
 * - lib/ui/format.dart: Arabic-Indic digits, pointsLabel, signedPoints,
 *   questionsLabel;
 * - lib/engine/game.dart: the 4 options are shuffled; حذف جوابين removes 2
 *   of the 3 wrong options at random and is spent at once; دبل is spent when
 *   the answer is confirmed.
 * No DOM here, so Node can test it (tests/core.test.mjs).
 */
(function (root) {
  'use strict';

  // ------------------------------------------------------------ rules

  /** GameRules.standard, for one adult team in a قصيرة game. */
  var RULES = {
    choicePoints: 1,
    doubleMultiplier: 2,
    doublePenalty: 1,
    doubles: 3,
    helps: 1
  };

  /** Raw points for a choice answer (before the never-below-0 rule). */
  function choiceScore(correct, doubled) {
    if (correct) return RULES.choicePoints * (doubled ? RULES.doubleMultiplier : 1);
    return doubled ? -RULES.doublePenalty : 0;
  }

  /** The change actually applied to [total] for [raw] points. */
  function applyNeverBelowZero(total, raw) {
    if (total < 0) throw new RangeError('total is below 0');
    return Math.max(0, total + raw) - total;
  }

  // ------------------------------------------------------------ randomness

  /** A small seeded generator (mulberry32) for tests and checks. */
  function seeded(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /** Fisher-Yates on a copy. */
  function shuffle(list, rng) {
    var out = list.slice();
    for (var i = out.length - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1));
      var t = out[i];
      out[i] = out[j];
      out[j] = t;
    }
    return out;
  }

  function samePackNeighbours(list) {
    for (var i = 1; i < list.length; i++) {
      if (list[i].pack === list[i - 1].pack) return true;
    }
    return false;
  }

  /** The questions in a random order with no two of the same pack next to
   *  each other (whenever such an order turns up in 500 shuffles; with 2 per
   *  pack about one shuffle in three qualifies). */
  function playOrder(questions, rng) {
    var best = shuffle(questions, rng);
    for (var tries = 0; tries < 500 && samePackNeighbours(best); tries++) {
      best = shuffle(questions, rng);
    }
    return best;
  }

  /** The 4 options of [q] in a random order, and where the right one is. */
  function shuffledOptions(q, rng) {
    var options = shuffle([q.correct].concat(q.wrong), rng);
    return { options: options, correct: options.indexOf(q.correct) };
  }

  /** حذف جوابين: 2 of the wrong options, at random (game.dart useHelp). */
  function removeTwo(optionCount, correct, rng) {
    var wrong = [];
    for (var i = 0; i < optionCount; i++) if (i !== correct) wrong.push(i);
    return shuffle(wrong, rng).slice(0, 2).sort(function (a, b) { return a - b; });
  }

  // ------------------------------------------------------------ the game

  /**
   * One visitor playing [questions] as one adult team.
   * Phases: 'answer' (pick, دبل, حذف جوابين, تأكيد), 'reveal', then 'done'
   * after the last question.
   */
  function Sampler(questions, rng) {
    if (!questions || !questions.length) throw new Error('no questions');
    this.rng = rng || Math.random;
    this.questions = playOrder(questions, this.rng);
    this.index = 0;
    this.total = 0;
    this.doublesLeft = RULES.doubles;
    this.helpsLeft = RULES.helps;
    this.history = [];
    this.phase = 'answer';
    this._deal();
  }

  Sampler.prototype._deal = function () {
    var q = this.questions[this.index];
    var dealt = shuffledOptions(q, this.rng);
    this.turn = {
      q: q,
      options: dealt.options,
      correct: dealt.correct,
      removed: [],
      picked: null,
      doubled: false,
      result: null
    };
  };

  Sampler.prototype.count = function () { return this.questions.length; };
  Sampler.prototype.isLast = function () { return this.index === this.questions.length - 1; };

  Sampler.prototype.canPick = function (i) {
    return this.phase === 'answer' && i >= 0 && i < this.turn.options.length
      && this.turn.removed.indexOf(i) < 0;
  };

  /** Picks option [i]; another tap moves the pick. */
  Sampler.prototype.pick = function (i) {
    if (!this.canPick(i)) return false;
    this.turn.picked = i;
    return true;
  };

  Sampler.prototype.canToggleDouble = function () {
    return this.phase === 'answer' && (this.turn.doubled || this.doublesLeft > 0);
  };

  Sampler.prototype.toggleDouble = function () {
    if (!this.canToggleDouble()) return false;
    this.turn.doubled = !this.turn.doubled;
    return true;
  };

  Sampler.prototype.canUseHelp = function () {
    return this.phase === 'answer' && this.helpsLeft > 0 && this.turn.removed.length === 0;
  };

  /** Removes 2 wrong options and spends the help at once. A pick on a
   *  removed option is cleared. */
  Sampler.prototype.useHelp = function () {
    if (!this.canUseHelp()) return null;
    var t = this.turn;
    t.removed = removeTwo(t.options.length, t.correct, this.rng);
    this.helpsLeft--;
    if (t.picked !== null && t.removed.indexOf(t.picked) >= 0) t.picked = null;
    return t.removed.slice();
  };

  Sampler.prototype.canConfirm = function () {
    return this.phase === 'answer' && this.turn.picked !== null;
  };

  /** Locks the answer, spends دبل, scores it and moves to the reveal. */
  Sampler.prototype.confirm = function () {
    if (!this.canConfirm()) return null;
    var t = this.turn;
    var correct = t.picked === t.correct;
    var raw = choiceScore(correct, t.doubled);
    var applied = applyNeverBelowZero(this.total, raw);
    if (t.doubled) this.doublesLeft--;
    this.total += applied;
    t.result = {
      id: t.q.id,
      correct: correct,
      doubled: t.doubled,
      helped: t.removed.length > 0,
      raw: raw,
      applied: applied,
      total: this.total
    };
    this.history.push(t.result);
    this.phase = 'reveal';
    return t.result;
  };

  /** From the reveal to the next question, or to the end. */
  Sampler.prototype.next = function () {
    if (this.phase !== 'reveal') return false;
    if (this.isLast()) {
      this.phase = 'done';
      return true;
    }
    this.index++;
    this.phase = 'answer';
    this._deal();
    return true;
  };

  Sampler.prototype.rightCount = function () {
    return this.history.filter(function (r) { return r.correct; }).length;
  };

  // ------------------------------------------------------------ formatting

  var AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';
  var LRI = '⁦';
  var PDI = '⁩';
  // ASCII digits with inner , or . groups, like the app's \d in Dart.
  var NUMBER_TOKEN = /[0-9]+(?:[.,][0-9]+)*/g;

  function toArabic(s) {
    var out = '';
    for (var i = 0; i < s.length; i++) {
      var c = s.charCodeAt(i);
      if (c >= 48 && c <= 57) out += AR_DIGITS[c - 48];
      else if (c === 44) out += '٬';
      else if (c === 46) out += '٫';
      else out += s[i];
    }
    return out;
  }

  /** Thousands separators only from 10,000 up (the app's number style). */
  function group(s) {
    if (s.length < 5) return s;
    var out = '';
    for (var i = 0; i < s.length; i++) {
      if (i > 0 && (s.length - i) % 3 === 0) out += ',';
      out += s[i];
    }
    return out;
  }

  /** NumberFormatter: [arabic] true is ٠-٩ (the app's default). */
  function Formatter(arabic) {
    this.arabic = arabic !== false;
  }

  Formatter.prototype.digits = function (text) {
    if (!this.arabic) return text;
    return text.replace(NUMBER_TOKEN, toArabic);
  };

  Formatter.prototype.integer = function (n) {
    var body = group(String(Math.abs(n)));
    if (this.arabic) body = toArabic(body);
    return n < 0 ? LRI + '−' + body + PDI : body;
  };

  /** "نقطة" / "نقطتين" / "٣ نقاط" / "١١ نقطة". */
  function pointsLabel(fmt, n) {
    if (n === 1) return 'نقطة';
    if (n === 2) return 'نقطتين';
    var m = Math.abs(n) % 100;
    if (n === 0) return fmt.integer(0) + ' نقاط';
    if (m >= 3 && m <= 10) return fmt.integer(n) + ' نقاط';
    return fmt.integer(n) + ' نقطة';
  }

  /** "+١" kept left to right, "−١" or "٠". */
  function signedPoints(fmt, n) {
    return n > 0 ? LRI + '+' + fmt.integer(n) + PDI : fmt.integer(n);
  }

  function countLabel(fmt, n, one, two, few) {
    if (n === 1) return one;
    if (n === 2) return two;
    var m = n % 100;
    if (m >= 3 && m <= 10) return fmt.integer(n) + ' ' + few;
    return fmt.integer(n) + ' ' + one;
  }

  /** "سؤال" / "سؤالين" / "٣ أسئلة" / "١١ سؤال". */
  function questionsLabel(fmt, n) {
    return countLabel(fmt, n, 'سؤال', 'سؤالين', 'أسئلة');
  }

  // ------------------------------------------------------------ words

  /** The app's words (lib/ui/strings_ar.dart), checked by the parity test. */
  var STRINGS = {
    doubleIt: 'دبل',
    doubleOn: 'مدبّلة!',
    noDoublesLeft: 'خلص الدبل',
    doubleLine: 'واثقين؟ دبّلوها: الصح ×2، والغلط ينقص نقطة',
    doubleOnLine: 'مدبّلة: الصح ×2، والغلط ينقص نقطة',
    removeTwo: 'حذف جوابين',
    removed: 'محذوف',
    selected: 'مختار',
    left: 'باقي',
    confirm: 'تأكيد',
    next: 'التالي',
    finalResult: 'النتيجة النهائية',
    answer: 'الجواب',
    correct: 'صح',
    wrong: 'غلط',
    funFact: 'تدرون؟'
  };

  /** The option letters, start to end (lib/ui/theme.dart kOptionLetters). */
  var LETTERS = ['أ', 'ب', 'ج', 'د'];

  /** The reveal's words for a confirmed answer: a headline, the points
   *  actually added (signed, "٠" for none) and one line that says why. */
  function verdict(fmt, result) {
    var line;
    if (result.correct) {
      line = pointsLabel(fmt, result.applied) + ' لكم';
      if (result.doubled) line += '، الدبل ضاعفها';
    } else if (result.doubled) {
      line = result.applied < 0
        ? 'والدبل نقّص نقطة'
        : 'والدبل ما نقّص شي: النقاط ما تنزل تحت الصفر';
    } else {
      line = 'ما فيه نقاط على هذا';
    }
    return {
      head: result.correct ? STRINGS.correct + '!' : STRINGS.wrong,
      points: signedPoints(fmt, result.applied),
      line: line
    };
  }

  /** The end screen's line for [right] answers of [count]. */
  function finalLine(right, count) {
    var share = count ? right / count : 0;
    if (share >= 0.9) return 'ما شاء الله! جاهزين للسهرة';
    if (share >= 0.6) return 'حلو! بس العائلة بتتحداكم';
    if (share >= 0.3) return 'مو بطال! الجولة الجاية أحسن';
    return 'تبون تعيدون؟ محد شافكم';
  }

  var api = {
    RULES: RULES,
    STRINGS: STRINGS,
    LETTERS: LETTERS,
    choiceScore: choiceScore,
    applyNeverBelowZero: applyNeverBelowZero,
    seeded: seeded,
    shuffle: shuffle,
    playOrder: playOrder,
    shuffledOptions: shuffledOptions,
    removeTwo: removeTwo,
    Sampler: Sampler,
    Formatter: Formatter,
    pointsLabel: pointsLabel,
    signedPoints: signedPoints,
    questionsLabel: questionsLabel,
    verdict: verdict,
    finalLine: finalLine
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.AlaqadCore = api;
  }
})(this);
