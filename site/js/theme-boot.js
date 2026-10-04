// Applies the saved color theme before the page is painted (a classic,
// blocking script in <head>), so a prerendered page does not flash in the
// other theme until app.js runs. theme.js does the rest.
(function () {
  try {
    var theme = localStorage.getItem('termoak.theme');
    if (theme === 'dark' || theme === 'light') document.documentElement.setAttribute('data-theme', theme);
  } catch (e) {
    /* no storage: the system theme */
  }
}());
