// Apply saved theme before React loads to prevent FOUC
try {
  var s = JSON.parse(localStorage.getItem('relay.settings.v1') || '{}');
  if (s.theme === 'dark') document.documentElement.dataset.theme = 'dark';
} catch(e) {}
