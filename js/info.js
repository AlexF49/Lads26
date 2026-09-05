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
  transfersTabEl.innerHTML = card('Airport Transfers', ['Details to follow.']);
  restaurantsTabEl.innerHTML = card('Restaurants &amp; Bars', ['Details to follow.']);
  hotelTabEl.innerHTML = card('Hotel Info', ['Details to follow.']);
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
