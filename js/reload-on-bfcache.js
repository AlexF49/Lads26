// Mobile Safari/Chrome restore a page from the back/forward cache (bfcache) instead of
// re-fetching it when you navigate back to a tab that's still open — so a page left open
// across a deploy keeps showing whatever CSS/JS was live when it was first loaded (e.g.
// sponsor logos at their old larger size) until the tab is fully closed and reopened.
// Forcing a reload whenever a page is restored this way keeps it in sync with the latest deploy.
window.addEventListener('pageshow', (event) => {
  if (event.persisted) {
    window.location.reload();
  }
});
