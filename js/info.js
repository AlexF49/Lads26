const STORAGE_KEY = 'lads26_player_id';

const transfersTabEl = document.getElementById('transfers-tab');
const restaurantsTabEl = document.getElementById('restaurants-tab');
const hotelTabEl = document.getElementById('hotel-tab');

function card(title, items) {
  return `
    <div class="rules-card">
      <h2 class="rules-card__title">${title}</h2>
      <ul class="rules-list">${items.map((i) => `<li>${i}</li>`).join('')}</ul>
    </div>`;
}

function render() {
  transfersTabEl.innerHTML = card('Airport Transfers', [
    '10 Sep 2026 &middot; 2 people &middot; Flight BA512 &middot; 14:25 &middot; transfer to the Magnolia Hotel',
    '11 Sep 2026 &middot; 7 people &middot; Flights BA8481 &amp; BA2660 &middot; 11:10am &middot; transfer to Quinta do Lago North',
    '13 Sep 2026 &middot; 9 people &middot; Flight BA2663 &middot; 16:15 pickup at Laranjal for the 18:55pm flight',
  ]);

  restaurantsTabEl.innerHTML = card('Restaurants &amp; Bars', [
    '11 Sep &middot; 8:00pm &mdash; Transfer from Quinta Golf back to the hotel',
    '11 Sep &middot; 8:30pm &mdash; Dinner at <a href="https://www.cabanasass.com/" target="_blank" rel="noopener">Cabana Sass</a>',
    '12 Sep &middot; 2:50pm &mdash; Transfer from Quinta Golf back to the hotel, pool time',
    '12 Sep &middot; 5:30pm &mdash; Saturday Night Ballbag, Praia do Ancao, 2 Passos Bar Area',
    '12 Sep &middot; 7:30pm &mdash; Dinner at 2 Passos',
  ]);

  hotelTabEl.innerHTML = `
    <div class="rules-card">
      <h2 class="rules-card__title">The Magnolia Hotel &ndash; Quinta do Lago</h2>
      <ul class="rules-list">
        <li>Estr. da Quinta do Lago, 8135-106 Almancil, Portugal</li>
        <li><a href="tel:+351289005300">+351 289 005 300</a></li>
      </ul>
      <h3 class="rules-card__subtitle">Room Listing</h3>
      <ul class="rules-list">
        <li>Alex Forrest &amp; Alex Robinson</li>
        <li>James Kibbey &amp; Nick Bourne</li>
        <li>Andrew Conway &amp; Ben Brown</li>
        <li>Jamie March &amp; James Pilling</li>
        <li>Paul Cooper</li>
      </ul>
    </div>`;
}

function init() {
  if (!localStorage.getItem(STORAGE_KEY)) {
    window.location.href = 'index.html';
    return;
  }

  render();

  document.querySelectorAll('.lb-tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.lb-tab').forEach((b) => b.classList.remove('lb-tab--active'));
      btn.classList.add('lb-tab--active');
      const tab = btn.dataset.tab;
      transfersTabEl.hidden = tab !== 'transfers';
      restaurantsTabEl.hidden = tab !== 'restaurants';
      hotelTabEl.hidden = tab !== 'hotel';
    });
  });
}

init();
