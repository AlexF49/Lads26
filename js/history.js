const STORAGE_KEY = 'lads26_player_id';

const historyTabEl = document.getElementById('history-tab');
const resultsTabEl = document.getElementById('results-tab');

// Sourced from Lads 2026.xlsx, Information tab, B14:B18, plus History/2026.docx for the
// 2026 write-up appended at the end.
const PARAGRAPHS = [
  `A group of lads lived together. They would go out, they would drink and Kibbey would set all the Playstation records. Everything was perfect, until Alan spoiled it. He moved in with Christina and within a few short months, all of them were drawn into living with their better halves. Little by little they saw less of each other and lives moved on.`,
  `So it was decided that they should all get together and learn absolutely nothing about what was going on in each others lives over 48 hours. Whilst labelled as a golf weekend, that was being generous; they were somewhere near where Benni lived but no-one was quite sure. Short of Benni driving the green for the first and last ever driving the green bonus points, barely anything memorable happened, partly caused by the White wine and a Leaky meltdown. Alan won.`,
  `With Nikki returning from his ban a short trip to Croydon was maybe not the best set-up for golf. There was no theoretical way in which a 9 player team tournament could happen.....it would break the rules of...sorry a what...? An Alangorithm? Texas Scramble requiring honesty? Swapping every 9 holes? OK. Everyone went with it, mainly because no-one had a clue what was going on. Nikki won the scramble mysteriously. Alan mysteriously won overall again.`,
  `A few years via Hanbury Manor upgraded the feel, with a few tweaks to remove the controversial Alangorith and Scramble events. Better hotels, no improvement in the golf. Alan won again.`,
  `Covid hit hard. 2020 Tournament cancelled by Boris an underwhelming 2021 highlighted by a banning from a local pub because of Nikki's swearing, and the realisation that for the "Lads Lads Lads Tournament" to survive under economic pressures it would need to either invest or die. After a boardroom battle, the Cooperians came out on top, and there was going to be investment, and foreign shores. 2022 was set for Quinto do Lago and back to a 8 man tournament and Benni sitting out and finally Captain Kibbey breaking his duck. Everyone agreed the formula worked and Alan won again.`,
  `2023 brought yet more innovation; Benni back but J-Bone gone (we lost a lot of good men). No-one had a clue what was going on from #Hammers to #MeToo's, #Clutch Putts to Saturday Night Ballbag. Had the hot weather got to them? and Innovation gone mad or was this just the perfect priming to selling the commercial rights. The Sex Panthers came home with the win.`,
  `After the failure to sell the commerical rights as deemed too complicated, 2024 kept roughly the same format which needed to be explained 3 more times between the Airport and the first tee albeit some of the innovations dropped. The Tournament was settling into a steady pattern now. And Alan won again.`,
  `2025 bring the same people back but who knows on which teams and back to a tried and tested Europe vs USA. Will it be a Kibbey Four-peat or Nikki becoming the greatest captain to have ever LIVed.`,
  `2025 had a strong fashion showing. Team Europe in a completely voluntary no-obligatory fashion all decided to invest in some enormous trousers certainly. Dynamo kebabs came back into vogue and a whole new live scoring and information site..... still required explanation on what was going to happen on Hole 1.`,
  `Team USA went out strong in the Greensomes as the captain got used to some new tools in the toolbox with variable handicaps. A first "Drive the Green in 8 years meant Alan had to use his back-end (again). A dangerously high standard of golf by all players didn't auger well for the remaining days but Team USA coming through strong with an 11 point lead through Day 1. A beautiful meal (well done Paul) and strong leadership decision making to skip cheese and it was back to the hotel after an early start.`,
  `Day 2 at Espiche was there to filter out the wheat from the chaff. Once Kibbey had eased his pussy out the way and got warmed up Team Europe were still debating tactics. Turns out on a berzerka of a course - just rolling with the standard handicaps was the way to go. It wasn't just Leaky having problems with his balls - all players were navigating it. Team Europe came roaring back - Biggles incredibly chipping in from off the green to retain a hammer and a Cooper / Bourne 15 point knock-out 18th reversed the day 1 position. After roughly 80 lost balls across the teams, Team USA standing 10 points behind but still all to play for in the singles. Despite a variety of orders to the waitress, everyone had Chicken for lunch.`,
  `Pool time and then to drinks with Paul ever the hero, volunteered miss out on his Sangria (sadly not permanently) to go and delay the dinner and was back in time for Saturday Night Ball-Bag. Not just drinks on the line this year but golfing implications. Kibbey manned up, Alan checked the balcony before his whiskey and absolutely nothing remarkable happened at all with a black ball. Another dinner and with no Cheekeys on the menu "The committee" decided we should settle in for a couple of lads lads lads mint teas and save our strength.`,
  `It was all to play for on the Singles, especially given Ryanair had finally managed to re-arrange their flight scheduled to Pilling's needs. A fully loaded Alan is a dangerous thing and Skipper Kibbey duly obliged as USA tried to go out strong. Either it was the sunburn or the competition pressure, but Leaky decided to throw his club out of the pram and under the buggy. The tournament takes on-course behaviour extremely seriously so he was duly awarded the General Attitude Award for such behaviour.`,
  `For a period it looked on as Leaky dominated Habibi, Plinky was clinging onto Biggles, Alan was dominating Cooper and Kibbey started to turn the screw through the turn. Fair play to Team Europe though as they continued their Par 3 specialism. Nikki tried to make it interesting by losing his pink lady but Cooper came through with the happy ending and a strong final hole had Europe clinching it with a 14 point win in the end.`,
  `Once again, Paul was masterful in his organisation. Kibbey graceful in defeat showing that the trip isn't really about golf and the best player award went to a dry cleaners in West Sussex.`,
  `2026: Return Of The Bone. After two years off to work on the mental side of his game, 2026 saw the return to the fold of Champagne Jamie and with it the reintroduction of the 3 team format.`,
  `After some "experimenting" last year it also saw the Lads make a return to the Triple Crown course selection of Quinta North, South and Laranjal.`,
  `The 11th instalment of the franchise, now complete with its own fully functional AlanApp, got off to a shaky start as early as Thursday evening when Leakey arrived at Faro airport but BA decided that also delivering his bag and clubs would be an airbridge too far.`,
  `Further drama and confusion on Friday morning when Jamie had been bumped off his flight from City airport. Or had he? In the end BA squeezed him on after a late fitness test and we had a beaming Bone to accompany Pilling to welcome the Captains and tournament referee's Algarve arrivals.`,
  `The team draw, made on Thursday night live via video link, had thrown together some tasty combinations. Winviz controversially knocking the Australian side of Chief, Benni and Plinky down to 28% before a ball had been hit.`,
  `The story of Friday was all Bone. Kwizzey's sleepless Thursday night working out how to coach Jamie through 18 holes of Greensomes proved totally unfounded as Bone delivered right from the start, memorably dialling in a 6 iron to 6 feet on the par 3 second at Quinta North and USA using all 6 of his drives in the first six holes.`,
  `Combined with a strong Alan contribution playing his own ball in Match 3, USA took a lead into Day 2 with the European team of Nikki, Leakey and Biggles not far behind.`,
  `Saturday - moving day - saw Australia roar back into the picture. Captain Cooper leading from the front with a 24-14 win over the Europeans and, despite birdies on the first two holes USA skip Kwizz found it hard to hold back the tide of the little and large Aussie greenkeeper pairing of Pilling and Brown.`,
  `A refreshed format for Saturday Night BallBag ("Smaller Balls, Bigger Stakes") saw 16 balls drawn out with associated drinks for the evening and "boosts" to be used on Sunday's round.`,
  `The first of which saw Bone have to ask the Laranjal starter on the first tee what the course record was before teeing off without a practice swing. Predictable results ensued.`,
  `The new AlanApp meant that a worldwide audience could stay glued to the action as the ultimate fate of the cheeseboard was decided. Could USA hold on to their narrow lead and register their first win under the American flag? Or would Europe with the Bandit Biggles lurking in the third group be able to inflict one of his heavy defeats?`,
  `Winviz ebbed and flowed, a 1am Cheekys finish messing with some players' games on the front nine whilst somehow inspiring others. SNBB balls were being utilised in a mad scramble for every point on the course and, with double points available in all 3 matches on the 18th, anything was possible.`,
  `In truth, on the 18th tee it was Team USA's to lose and with Bourne and Cooper both finding water on 18 a big points swing in the Captain's match was averted as Kwizz kept his ball dry and more importantly his wedges in his bag. With both Bone and a surging Pilling able to keep a leash on Biggles in Tier 3, it meant that the Tier 2 match drama coming down the 18th last was a battle for second place between Europe and Australia. In a "you couldn't make this up" scenario the two teams ended up joint second. Discussions for an 18 hole playoff remain ongoing at time of going to press.`,
  `In terms of AOB, important to note that despite Nikki managing to get a buggy stuck in a sandpit in the trees looking for his ball that was in fact in the middle of the fairway, Pilling took home the GA award for a fart that cleared the decks of a significantly large OPEN AIR area on top of the Bold Octopus. Chicken Wings were blamed. Lessons were learned. We go again in 2027.`,
];

// Photo 1 opens the page; the rest are inserted above the paragraph they mark.
const TOP_PHOTO = 'img/history/photo1.jpg';
const PHOTOS = [
  { src: 'img/history/photo2.jpg', afterParagraph: 3 }, // above "A few years via Hanbury Manor"
  { src: 'img/history/photo3.jpg', afterParagraph: 7 }, // above "2025 bring the same people back"
  { src: 'img/history/photo4.jpg', afterParagraph: 15 }, // above "2026: Return Of The Bone"
];

// Sourced from History/Results.png.
const RESULTS = [
  { year: 2015, team: 'Europe', players: 'Forrest, Brown, Robinson, Pilling' },
  { year: 2016, team: 'Europe', players: 'Forrest, Brown, Robinson' },
  { year: 2017, team: 'Europe', players: 'Forrest, Brown, Robinson' },
  { year: 2018, team: 'Europe', players: 'Forrest, Brown, Robinson' },
  { year: 2019, team: 'Australia', players: 'Bourne, Cooper, March' },
  { year: 2021, team: 'Tigers', players: 'Bourne, Forrest, Robinson' },
  { year: 2022, team: 'PGA', players: 'Kibbey, Forrest, Conway, Pilling' },
  { year: 2023, team: 'Sex Panthers', players: 'Kibbey, Brown, Robinson' },
  { year: 2024, team: 'Swinging Seamen', players: 'Kibbey, Forrest, Brown, Conway', ga: 'Nick Bourne' },
  { year: 2025, team: 'Europe', players: 'Bourne, Cooper, Brown, Robinson', ga: 'Andrew Conway' },
];

function renderHistory() {
  const parts = [`<img class="history-text__photo" src="${TOP_PHOTO}" alt="Lads 2026 history photo" />`];
  PARAGRAPHS.forEach((text, i) => {
    parts.push(`<p class="history-text__para">${text}</p>`);
    const photo = PHOTOS.find((p) => p.afterParagraph === i + 1);
    if (photo) parts.push(`<img class="history-text__photo" src="${photo.src}" alt="Lads 2026 history photo" />`);
  });
  historyTabEl.innerHTML = `<div class="history-text">${parts.join('')}</div>`;
}

function renderResults() {
  resultsTabEl.innerHTML = `
    <table class="results-table">
      <thead>
        <tr><th>Year</th><th>Winning team</th><th>Players</th></tr>
      </thead>
      <tbody>
        ${RESULTS.map(
          (r) => `
          <tr>
            <td>${r.year}</td>
            <td>${r.team}</td>
            <td>
              ${r.players}
              ${r.ga ? `<div class="results-table__ga">GA · ${r.ga}</div>` : ''}
            </td>
          </tr>`
        ).join('')}
      </tbody>
    </table>
  `;
}

function wireTabs() {
  document.querySelectorAll('.lb-tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.lb-tab').forEach((b) => b.classList.remove('lb-tab--active'));
      btn.classList.add('lb-tab--active');
      const tab = btn.dataset.tab;
      historyTabEl.hidden = tab !== 'history';
      resultsTabEl.hidden = tab !== 'results';
    });
  });
}

function init() {
  if (!localStorage.getItem(STORAGE_KEY)) {
    window.location.href = 'index.html';
    return;
  }
  wireTabs();
  renderHistory();
  renderResults();
}

init();
