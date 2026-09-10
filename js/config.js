window.APP = window.APP || {};
APP.config = {
  VERSION: 'v0.3.1',
  RENDER_CAP: 400,
  STALE_DAYS: 30,
  MAX_PAGES: 50,
  PREF_KEY: 'ghPrChecker.prefs',
  DB_LIB: 'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/',
  DB_FILE: 'github_pr_stats.sqlite',
  IDB_NAME: 'ghPrChecker.dbstore'
};
