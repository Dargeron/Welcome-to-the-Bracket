// Landing page #1: the trailer. A sequence of timed "shots" played by
// site/shared/trailer.js. Text is taken from the founding text.

import { esc, fmtInt } from '../scripts/lib/util.mjs';

export function trailerMarkup(ctx) {
  const { config } = ctx.site;
  // The first five are on record; the rest are the kind of names most entrants had.
  const fallen = ['Female Student 2', 'Soldier B', 'Anpanman', 'Third-String Catcher', 'Orange', 'Crowd Member 4,112', 'Classmate (Glasses)', 'Shopkeeper', 'Villager B', 'Waiter', 'Bystander', 'Student Council Member 3'];
  const shot = (dur, inner, cls = '') => `<section class="shot ${cls}" data-dur="${dur}">${inner}</section>`;
  const line = (t, cls = '') => `<p class="tl ${cls}">${t}</p>`;
  const address = (t) => shot(3800, `<p class="tl tl-address">${t}</p>`, 'shot-address');
  const shots = [
    shot(3200, line('The Architect was bored,'), 'shot-open'),
    shot(4200, line('so She spoke, and from her voice came <span class="tl-em">the Bracket</span>.')),
    shot(3600, line('Every character from every anime ever made.')),
    shot(4600, line('It did not come to a number that halves cleanly, so She took faces from the crowd scenes until it did.', 'tl-small')),
    shot(4400, `<div class="big-num" aria-label="${fmtInt(config.entrants)}">${fmtInt(config.entrants)}</div>${line('Most of them had never been given a name.', 'tl-small')}`, 'shot-num'),
    shot(3600, line('Each was told the same thing, in a form they could take in.', 'tl-small')),
    address('You are not real. Somebody drew you.'),
    address('You are going to a room. Somebody else will be there, and you will understand each other, whatever they are.'),
    address('For one hour you will talk, and listen, and reply meaningfully. Nobody’s powers will work, and you won’t be able to hurt each other.'),
    address('After the hour, they will, and you can.'),
    address('The room lasts until one of you is dead. Then the other one goes to a new room, with somebody new.'),
    address('The last one left of everybody can have anything, even being real.'),
    shot(3400, `<p class="tl tl-address tl-stop">Everybody else stops.</p>`, 'shot-address shot-stop'),
    `<section class="shot shot-count" data-dur="9000" data-count data-entrants="${config.entrants}" data-final="${config.finalRound}">
      <div class="count-round" data-count-round>Round 1</div>
      <div class="big-num" data-count-num>${fmtInt(config.entrants)}</div>
      <ul class="fallen" aria-hidden="true">${fallen.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>
    </section>`,
    shot(4200, line('Sixteen are left.', 'tl-huge'), 'shot-sixteen'),
    `<section class="shot shot-title" data-final-shot>
      <div class="title-kicker">An open archive of the rooms</div>
      <h1 class="title-main">${esc(config.siteName)}</h1>
      <div class="title-sub">${esc(config.tagline)}</div>
      <p class="title-blurb">Anyone may write a room. Anyone may vote. Nobody may bring back the dead.</p>
      <nav class="title-actions">
        <a class="btn btn-primary" href="${ctx.href('introduction/')}">Read the Introduction</a>
        <a class="btn" href="${ctx.href('archive/')}">Enter the Archive</a>
        <a class="btn" href="${ctx.href('random/')}">A random room</a>
      </nav>
      <button class="replay" type="button" data-replay>Replay</button>
    </section>`,
  ];
  return `<div class="trailer" data-trailer>
    <div class="tr-grain" aria-hidden="true"></div>
    <div class="tr-stage">${shots.join('\n')}</div>
    <div class="tr-controls">
      <button type="button" data-pause aria-label="Pause">❚❚</button>
      <div class="tr-progress" aria-hidden="true"><span data-progress></span></div>
      <button type="button" data-skip>Skip ▸▸</button>
    </div>
    <a class="tr-corner" href="${ctx.href('introduction/')}">New here? Read the Introduction</a>
  </div>`;
}
