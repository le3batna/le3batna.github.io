/* على قد ثقتك: the web sampler page (play/).
 *
 * The 10 sampler questions as one game for one team, like the app's choice
 * screens: pick one of 4 shuffled options (أ ب ج د), turn on دبل if you are
 * sure, use حذف جوابين once, تأكيد, then the reveal with the points and the
 * fun fact, and at the end the score and the App Store link. Rules, words and
 * number formatting come from sampler-core.js. Nothing is sent or stored.
 */
(function () {
  'use strict';

  var C = window.AlaqadCore;
  var dataEl = document.getElementById('sampler-data');
  var play = document.getElementById('play');
  var end = document.getElementById('end');
  if (!C || !dataEl || !play || !end) return;

  var data = JSON.parse(dataEl.textContent);
  var fmt = new C.Formatter(true);
  var S = C.STRINGS;
  var reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  function $(id) { return document.getElementById(id); }
  var el = {
    progressLabel: $('progress-label'),
    score: $('score'),
    progress: $('progress'),
    packTag: $('pack-tag'),
    qText: $('q-text'),
    answerTools: $('answer-tools'),
    help: $('help'),
    helpLeft: $('help-left'),
    dbl: $('double'),
    dblLabel: $('double-label'),
    dblLeft: $('double-left'),
    guide: $('guide'),
    confirm: $('confirm'),
    hint: $('hint'),
    reveal: $('reveal'),
    verdict: $('verdict'),
    verdictHead: $('verdict-head'),
    verdictPoints: $('verdict-points'),
    verdictLine: $('verdict-line'),
    factCard: $('fact-card'),
    fact: $('fact'),
    next: $('next'),
    live: $('live'),
    endTitle: $('end-title'),
    endPoints: $('end-points'),
    endPointsLabel: $('end-points-label'),
    endRight: $('end-right'),
    endLine: $('end-line'),
    endDots: $('end-dots'),
    endKey: $('end-key'),
    again: $('again')
  };
  var options = Array.prototype.slice.call(play.querySelectorAll('.opt'));
  var segments = Array.prototype.slice.call(el.progress.children);
  var HINT = 'اختاروا جواب، وبعدين تأكيد';

  var SVG_NS = 'http://www.w3.org/2000/svg';
  var TICK = 'M5 12.5l4.5 4.5L19 7.5';
  var CROSS = 'M7 7l10 10M17 7 7 17';

  function icon(d) {
    var svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    var path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', d);
    svg.appendChild(path);
    return svg;
  }

  function setLetter(button, i, d) {
    var letter = button.querySelector('.opt-letter');
    letter.textContent = '';
    if (d) letter.appendChild(icon(d));
    else letter.textContent = C.LETTERS[i];
  }

  function restart(node, cls) {
    if (reduceMotion) return;
    node.classList.remove(cls);
    void node.offsetWidth; // let the animation run again
    node.classList.add(cls);
  }

  var game = null;

  // ------------------------------------------------------------ answering

  function renderQuestion(focus) {
    var t = game.turn;
    el.progressLabel.textContent = 'سؤال ' + fmt.integer(game.index + 1) + ' من ' + fmt.integer(game.count());
    el.score.textContent = fmt.integer(game.total);
    segments.forEach(function (li, i) {
      var r = game.history[i];
      li.className = r ? (r.correct ? 'is-right' : 'is-wrong') : (i === game.index ? 'is-now' : '');
    });
    el.packTag.className = 'pack-tag pk-' + t.q.pack;
    el.packTag.textContent = data.packs[t.q.pack] || '';
    el.qText.textContent = fmt.digits(t.q.q);
    options.forEach(function (button, i) {
      button.querySelector('.opt-text').textContent = fmt.digits(t.options[i]);
      setLetter(button, i, null);
    });
    el.answerTools.hidden = false;
    el.reveal.hidden = true;
    updateAnswer();
    if (focus) {
      window.scrollTo(0, 0);
      el.qText.focus({ preventScroll: true });
    }
  }

  function updateAnswer() {
    var t = game.turn;
    options.forEach(function (button, i) {
      var removed = t.removed.indexOf(i) >= 0;
      var picked = t.picked === i;
      button.className = 'opt' + (picked ? ' is-picked' : '') + (removed ? ' is-removed' : '');
      button.disabled = removed;
      button.setAttribute('aria-pressed', picked ? 'true' : 'false');
      button.querySelector('.opt-state').textContent = removed ? S.removed : (picked ? S.selected : '');
    });

    el.help.disabled = !game.canUseHelp();
    el.help.classList.toggle('is-used', t.removed.length > 0);
    el.helpLeft.textContent = fmt.integer(game.helpsLeft);
    el.helpLeft.hidden = game.helpsLeft === 0; // an Arabic ٠ reads as a stray dot
    el.help.setAttribute('aria-label', S.removeTwo + '، ' + S.left + ' ' + fmt.integer(game.helpsLeft));

    var left = game.doublesLeft;
    el.dbl.setAttribute('aria-pressed', t.doubled ? 'true' : 'false');
    el.dbl.disabled = !game.canToggleDouble();
    el.dblLabel.textContent = t.doubled ? S.doubleOn : (left > 0 ? S.doubleIt + ' ×' + fmt.integer(2) : S.noDoublesLeft);
    el.dblLeft.textContent = fmt.integer(left);
    el.dblLeft.hidden = left === 0;
    el.dbl.setAttribute('aria-label', S.doubleIt + '، ' + S.left + ' ' + fmt.integer(left));

    el.guide.textContent = t.doubled ? fmt.digits(S.doubleOnLine) : (left > 0 ? fmt.digits(S.doubleLine) : '');
    el.guide.classList.toggle('is-on', t.doubled);
    el.confirm.disabled = !game.canConfirm();
    el.hint.textContent = game.history.length === 0 && t.picked === null ? HINT : '';
  }

  // ------------------------------------------------------------ reveal

  function showReveal(r) {
    var t = game.turn;
    options.forEach(function (button, i) {
      var state = '';
      button.disabled = true;
      button.setAttribute('aria-pressed', t.picked === i ? 'true' : 'false');
      if (i === t.correct) {
        button.className = 'opt is-correct';
        setLetter(button, i, TICK);
        state = S.correct + (t.picked === i ? '، اختياركم' : '');
        restart(button, 'pop');
      } else if (i === t.picked) {
        button.className = 'opt is-missed';
        setLetter(button, i, CROSS);
        state = 'اختياركم';
      } else if (t.removed.indexOf(i) >= 0) {
        button.className = 'opt is-removed';
        state = S.removed;
      } else {
        button.className = 'opt is-dim';
      }
      button.querySelector('.opt-state').textContent = state;
    });

    var v = C.verdict(fmt, r);
    el.verdict.className = 'verdict ' + (r.correct ? 'is-right' : 'is-wrong');
    el.verdictHead.textContent = v.head;
    el.verdictPoints.textContent = v.points;
    el.verdictPoints.className = 'points-pop' + (r.applied > 0 ? ' is-up' : (r.applied < 0 ? ' is-down' : ''));
    el.verdictPoints.hidden = r.applied === 0; // the line says why nothing changed
    el.verdictLine.textContent = v.line;

    if (t.q.fact) {
      el.fact.textContent = fmt.digits(t.q.fact);
      el.factCard.hidden = false;
    } else {
      el.fact.textContent = '';
      el.factCard.hidden = true;
    }
    el.next.textContent = game.isLast() ? S.finalResult : S.next;

    el.score.textContent = fmt.integer(game.total);
    if (r.applied !== 0) restart(el.score, 'bump');
    segments[game.index].className = r.correct ? 'is-right' : 'is-wrong';

    el.answerTools.hidden = true;
    el.reveal.hidden = false;
    var correctText = fmt.digits(t.options[t.correct]);
    el.live.textContent = v.head + ' ' + S.answer + ': ' + correctText + '. ' + v.line + '. '
      + 'النقاط ' + fmt.integer(game.total) + '.';
    el.next.focus({ preventScroll: true });
    el.reveal.scrollIntoView({ block: 'nearest', behavior: reduceMotion ? 'auto' : 'smooth' });
  }

  // ------------------------------------------------------------ end

  function showEnd() {
    var n = game.count();
    var right = game.rightCount();
    var total = game.total;
    var m = total % 100;
    el.endPoints.textContent = fmt.integer(total);
    el.endPointsLabel.textContent = total === 0 || (m >= 3 && m <= 10) ? 'نقاط' : 'نقطة';
    el.endRight.textContent = 'جاوبتوا ' + fmt.integer(right) + ' من ' + fmt.integer(n) + ' صح';
    el.endLine.textContent = C.finalLine(right, n);

    el.endDots.textContent = '';
    var anyDoubled = false;
    game.history.forEach(function (r, i) {
      var li = document.createElement('li');
      li.className = (r.correct ? 'is-right' : 'is-wrong') + (r.doubled ? ' is-doubled' : '');
      li.appendChild(icon(r.correct ? TICK : CROSS));
      var label = document.createElement('span');
      label.className = 'sr-only';
      label.textContent = 'سؤال ' + fmt.integer(i + 1) + ': ' + (r.correct ? S.correct : S.wrong) + (r.doubled ? '، مدبّل' : '');
      li.appendChild(label);
      el.endDots.appendChild(li);
      if (r.doubled) anyDoubled = true;
    });
    el.endKey.hidden = !anyDoubled;

    play.hidden = true;
    end.hidden = false;
    el.live.textContent = '';
    window.scrollTo(0, 0);
    el.endTitle.focus({ preventScroll: true });
  }

  // ------------------------------------------------------------ wiring

  options.forEach(function (button, i) {
    button.addEventListener('click', function () {
      if (game.pick(i)) updateAnswer();
    });
  });
  el.help.addEventListener('click', function () {
    if (game.useHelp()) {
      updateAnswer();
      var first = options.filter(function (b) { return !b.disabled; })[0];
      if (document.activeElement === el.help && el.help.disabled && first) first.focus();
    }
  });
  el.dbl.addEventListener('click', function () {
    if (game.toggleDouble()) updateAnswer();
  });
  el.confirm.addEventListener('click', function () {
    var r = game.confirm();
    if (r) showReveal(r);
  });
  el.next.addEventListener('click', function () {
    if (!game.next()) return;
    if (game.phase === 'done') showEnd();
    else renderQuestion(true);
  });
  el.again.addEventListener('click', function () {
    start();
    el.qText.focus({ preventScroll: true });
  });

  function start() {
    game = new C.Sampler(data.questions);
    end.hidden = true;
    play.hidden = false;
    window.scrollTo(0, 0);
    renderQuestion(false);
  }

  start();
})();
