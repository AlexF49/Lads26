// Saturday Night Ballbag — house rules + ball list per year, transcribed from the
// documents in the SNBB/ folder (2025.pdf, 2026.msg). Static content, no Supabase.
const STORAGE_KEY = 'lads26_player_id';

const tab2025El = document.getElementById('2025-tab');
const tab2026El = document.getElementById('2026-tab');
const tab2027El = document.getElementById('2027-tab');

function rulesCard(title, subtitle, rules, footnote) {
  return `
    <div class="rules-card">
      <h2 class="rules-card__title">${title}</h2>
      ${subtitle ? `<h3 class="rules-card__subtitle">${subtitle}</h3>` : ''}
      <ul class="rules-list">${rules.map((r) => `<li>${r}</li>`).join('')}</ul>
      ${footnote ? `<p class="snbb-footnote">${footnote}</p>` : ''}
    </div>`;
}

function ballsCard(title, balls) {
  return `
    <div class="rules-card">
      <h2 class="rules-card__title">${title}</h2>
      <div class="snbb-balls">
        ${balls
          .map(
            (b) => `
          <div class="snbb-ball">
            <div class="snbb-ball__header">
              ${b.era ? `<span class="snbb-ball__era">${b.era}</span>` : ''}
              <span class="snbb-ball__name">${b.name}</span>
            </div>
            <p class="snbb-ball__desc">${b.desc}</p>
            <div class="snbb-ball__tags">
              ${b.drink ? `<span class="snbb-ball__tag">🍹 ${b.drink}</span>` : ''}
              ${b.owner ? `<span class="snbb-ball__tag">👤 ${b.owner}</span>` : ''}
            </div>
          </div>`
          )
          .join('')}
      </div>
    </div>`;
}

function render2025() {
  tab2025El.innerHTML =
    rulesCard(
      'Saturday Night Ballbag 2025',
      'The Eras Tour · House Rules',
      [
        'Takes place on Saturday night. 9 balls in a bag.',
        'First nomination at discretion of committee. From then on, you nominate the next ballbagger from the opposing team. Everyone draws one ball. But &mdash; with 9 balls &mdash; one player will draw twice.',
        'As usual, there is a drink* attached to each ball. This year, each ball also comes with a &ldquo;flex&rdquo; which you can use to help you on the course during Sunday&rsquo;s play.',
        'Each flex may only be deployed on a single hole so choose carefully.',
        'If you are on the team currently losing on Saturday night, you have the option to put your ball back in and redraw. May only be used once per losing team player.',
      ],
      '*if unavailable, drinks may be substituted at the discretion of the SNB committee.'
    ) +
    ballsCard('The Balls', [
      {
        era: '60s',
        name: 'Swinging Six-Tees',
        desc: 'Six tees, all marked with the name of a club. On the nominated hole, opponent must select a tee for each of their first 6 shots and use that club for that shot.',
        drink: 'Martini',
      },
      {
        era: '70s',
        name: 'Fleetwood Hack',
        desc: 'When deployed, opponent must play that hole in a Tommy Fleetwood wig. Automatic loss of the hole if the wig comes off between teeing off and sinking the putt (without interference).',
        drink: 'Piña Colada',
      },
      {
        era: '80s',
        name: 'Which-Tee Houston?',
        desc: 'Player can choose which tee box they play from and which tee their opponent plays from.',
        drink: 'Long Island Iced Tea',
      },
      {
        era: '90s',
        name: 'Wonderball',
        desc: 'And after all, it&rsquo;s your wonderball. Player may choose to play a mulligan on any ONE shot before they reach the green.',
        drink: 'Vodka Redbull',
      },
      {
        era: '00s',
        name: 'No-Tees Noughties',
        desc: 'Opponent is not allowed to use a tee on this hole.',
        drink: 'Mojito',
      },
      {
        era: 'Pink',
        name: 'Pink In The Drink?',
        desc: 'To be used on a water hole. Opponent must use the pink ball and finish the hole with it. If they fail you get 3 bonus points.',
        drink: 'Biggest, Pinkest, Gayest Drink In The House',
      },
      {
        era: 'HG',
        name: 'Happy Gilmore',
        desc: 'Opponent must tee off with a Happy Gilmore swing. First shot they make any contact with the ball is the one that counts.',
        drink: 'Boilermaker (bottle of beer, shot of whiskey)',
      },
      {
        era: 'Pint',
        name: 'Sink It',
        desc: 'Nominate opponent to sink any putt that lies on the green. If they fail you get 3 bonus points.',
        drink: 'Pint of Lager',
      },
      {
        era: 'Yellow',
        name: 'Goldplay',
        desc: 'It was all yellow. Play with the Yellow ball on a hole &mdash; and win it &mdash; and you get an extra 3 bonus points.',
        drink: 'Jaegerbomb',
      },
    ]) +
    `<p class="snbb-footnote"><a href="SNBB/2025.pdf" target="_blank" rel="noopener">View the original flyer (PDF)</a></p>`;
}

function render2026() {
  tab2026El.innerHTML =
    rulesCard('Saturday Night Ballbag 2026', 'House Rules', [
      'Everyone draws one ball. Then nominate until everyone has been once. The ball you draw has a punishment you can inflict on Sunday&rsquo;s round, but a drink you must drink to unlock that punishment.',
      'Once everyone has drawn a ball, it starts going round again for 7 more balls.',
      'On the second round you can choose whether you want to do the drink. But you only unlock the punishment if you do the drink.',
      'Punishments cannot be used on the 18th.',
      'You can choose which opponent to use it on. But can only target a player once.',
      'You must wear the official SNB glasses to draw the ball and keep them on until you have completed your drink.',
    ]) +
    ballsCard('The Balls', [
      {
        name: '1st Tee Nerves',
        desc: 'Your opponent has to ask the starter what the course record is and then tee off on the 1st without a practice swing.',
        drink: 'Sambuca',
        owner: 'Pilling',
      },
      {
        name: 'Double Trouble',
        desc: 'Both opponents in group have to avoid trouble in the form of sand or water. If one goes in, you get 2 bonus points.',
        drink: 'Two Different Shots of Choice',
        owner: 'Kibbey',
      },
      {
        name: 'Dude Where&rsquo;s My Club?',
        desc: 'You can take one club out of opponent&rsquo;s bag for a hole.',
        drink: 'Jaegermeister',
        owner: 'Benni',
      },
      {
        name: 'Happy GilFour',
        desc: 'Nominate opponent to do a Happy Gilmore tee off on any hole.',
        drink: 'Pint',
        owner: 'Jamie',
      },
      {
        name: 'Which-Tee Houston',
        desc: 'You choose which tee you tee off from and which tee your opponent.',
        drink: 'Gayest Cocktail On Menu',
        owner: 'Nick Bourne',
      },
      {
        name: 'Swinging Sixties',
        desc: 'Six tee selection. Opponent has to select a tee with a club name on it for every shot on a hole.',
        drink: 'Baileys',
        owner: 'Leakey',
      },
      {
        name: 'Seven Heaven? Seven Hell More Like',
        desc: 'Opponent has to play the hole with a 7 iron. Can only be used on a par 4.',
        drink: 'Malibu Shot',
        owner: 'Angry',
      },
      {
        name: 'BlackBall',
        desc: 'Opponent has to hit two drives, and has to play the worst ball.',
        drink: 'Carbomb',
        owner: 'Alan',
      },
      {
        name: 'Wonderball',
        desc: 'You can have a mulligan on any one shot on a hole. Have to announce before tee shot. And have to play using Alan&rsquo;s golden ball.',
        drink: 'Mojito',
        owner: 'Alan',
      },
      {
        name: 'In Da Club',
        desc: 'You choose your opponent to use one club for one shot on a hole. Excluding putter.',
        drink: 'Vodka, Lime & Club Soda',
        owner: 'Boner',
      },
      {
        name: '1 Hand Wanker',
        desc: 'Opponent must take their first putt one handed.',
        drink: 'Piña Colada',
        owner: 'Nick',
      },
      {
        name: 'Dirty Dozen',
        desc: 'You can play dirty and shout &ldquo;Cunt&rdquo; on one backswing of your choice in the round.',
        drink: 'Dirty Pint',
        owner: 'Benni',
      },
      {
        name: 'Thirsteen',
        desc: 'Opponent has to neck a beer before teeing off. Back 9 use only (excludes 18th).',
        drink: 'Pint, Chugged',
        owner: 'Kwizz',
      },
      {
        name: 'Naughty NoTee',
        desc: 'Nominate opponent to take one tee shot without a tee.',
        drink: 'Aperol Spritz',
        owner: 'Paul',
      },
      {
        name: 'Wedgie Perrin',
        desc: 'Opponent has to tee off on nominated hole with a wedge.',
        drink: 'Tequila',
        owner: 'Biggles',
      },
      {
        name: 'Cue Ball',
        desc: 'Nominate opponent to take first putt like a pool shot.',
        drink: 'White Russian',
        owner: 'Pilling',
      },
    ]);
}

function render2027() {
  tab2027El.innerHTML = `
    <div class="snbb-coming-soon">
      <div class="snbb-coming-soon__emoji">🍿</div>
      <p class="snbb-coming-soon__text">Coming Soon</p>
    </div>`;
}

function init() {
  if (!localStorage.getItem(STORAGE_KEY)) {
    window.location.href = 'index.html';
    return;
  }

  render2025();
  render2026();
  render2027();

  document.querySelectorAll('.lb-tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.lb-tab').forEach((b) => b.classList.remove('lb-tab--active'));
      btn.classList.add('lb-tab--active');
      const tab = btn.dataset.tab;
      tab2025El.hidden = tab !== '2025';
      tab2026El.hidden = tab !== '2026';
      tab2027El.hidden = tab !== '2027';
    });
  });
}

init();
