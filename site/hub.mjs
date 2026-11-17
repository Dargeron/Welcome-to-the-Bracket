// The archive's front page (the hub). Themes may replace it entirely.
import { esc } from '../scripts/lib/util.mjs';

export function hub(ctx) {
  const s = ctx.site;
  const c = ctx.c;
  const latest = s.encounters.slice().reverse().slice(0, 8);
  const chars = [...s.characters.values()].sort((a, b) => a.name.localeCompare(b.name));
  return `<section class="hub-hero">
    <div class="kicker">${esc(s.config.tagline)}</div>
    <h1>${esc(s.config.siteName)}</h1>
    <p class="lede">Every character from every anime ever made, two to a room, until sixteen are left. This is the record of the rooms. Anyone may add one.</p>
    <p class="hub-actions"><a class="btn btn-primary" href="${ctx.href('introduction/')}">How the Bracket works</a> <a class="btn" href="${ctx.href('founding-text/')}">Read the founding text</a> <a class="btn" href="${ctx.gh.newEncounter()}" rel="noopener">Write a room</a></p>
  </section>
  ${c.stats(ctx)}
  <section class="hub-latest"><h2>Latest rooms</h2>${c.encounterCards(ctx, latest)}<p><a href="${ctx.href('encounters/')}">All encounters →</a></p></section>
  <div class="hub-cols">
    <section class="hub-sixteen"><h2>The Sixteen</h2>${c.sixteenRoster(ctx)}<p><a href="${ctx.href('sixteen/')}">About the Sixteen →</a></p></section>
    <section class="hub-rounds"><h2>Rounds</h2>${c.roundRail(ctx)}<p class="muted">Rounds with rooms on record are marked.</p>
      <h2>Characters</h2><ul class="char-cloud">${chars.map((ch) => `<li>${c.charLink(ctx, ch.slug)}</li>`).join('')}</ul>
      <h2>Wander</h2>${c.randomControls(ctx)}</section>
  </div>`;
}
