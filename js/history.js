const STORAGE_KEY = 'lads26_player_id';

const historyTabEl = document.getElementById('history-tab');
const resultsTabEl = document.getElementById('results-tab');

// Sourced from Lads 2026.xlsx, Information tab, B14:B18.
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
];

// Photo 1 opens the page; the rest are inserted above the paragraph they mark.
const TOP_PHOTO = 'img/history/photo1.jpg';
const PHOTOS = [
  { src: 'img/history/photo2.jpg', afterParagraph: 3 }, // above "A few years via Hanbury Manor"
  { src: 'img/history/photo3.jpg', afterParagraph: 7 }, // above "2025 bring the same people back"
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
