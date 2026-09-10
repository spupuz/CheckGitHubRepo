window.APP = window.APP || {};
APP.state = {
  repos:[], authorCounts:{}, labelCounts:{},
  sortKey:'openPRs', sortDir:-1,
  running:false, showAll:false, lastTs:null, lastDelta:null,
  usedMethod:'rest',
  SORTERS:null
};
APP.state.SORTERS = APP.ui.SORTERS;

APP.main = (function(){
  const { $, sleep, getUsernames, multiOwner, syncHash, esc, daysBetween, timeAgo, cssVar } = APP.utils;
  const { setStatus, showSkeleton, setRunning, render, renderAgg, updateSummary, updateMeta, populateFilters, updateSortHeaders, savePrefs, loadPrefs, loadTokenStorePref, loadCache, saveCache, saveSnapshot, loadSnapshot, computeDelta, bindEvents } = APP.ui;

  async function run(){
    if(APP.state.running) return;
    const users=getUsernames();
    if(!users.length){ setStatus('Enter at least one GitHub username.','error'); return; }
    for(const u of users){ if(!/^[A-Za-z0-9-]{1,39}$/.test(u)){ setStatus(`Invalid username: "${u}". Only letters, numbers, and hyphens are allowed.`,'error'); return; } }
    const hasToken=!!$('token').value.trim();
    const ext=$('extended').checked && hasToken;
    APP.state.usedMethod=hasToken?'graphql':'rest';
    if(hasToken) APP.api.checkToken();
    const prevSnap=loadSnapshot();
    savePrefs(); syncHash();
    APP.state.repos=[]; APP.state.authorCounts={}; APP.state.labelCounts={}; APP.state.showAll=false; APP.state.lastDelta=prevSnap;
    $('summary').classList.remove('on'); $('aggPanel').classList.remove('on'); $('chartsPanel').classList.remove('on'); $('deltaPanel').classList.remove('on');
    $('methodBadge').textContent=hasToken?(ext?'method: GraphQL + extended metrics':'method: GraphQL'):'method: REST'; $('methodBadge').classList.remove('hidden');
    if($('extended').checked && !hasToken) setStatus('Extended metrics ignored: they require a token. Using REST for PR counts only.','warn');
    APP.api.setController(new AbortController()); setRunning(true); $('progressBar').style.width='0%';
    $('resultsPanel').style.display='block'; showSkeleton(6);
    try{
      if(!hasToken && $('rateBadge')._remaining!=null && $('rateBadge')._remaining<5){ setStatus(APP.utils.rateLimitMsg({headers:{get:()=>null}}),'error'); setRunning(false); return; }
      for(const u of users){
        if(APP.api.getController().signal.aborted) throw new DOMException('Cancelled','AbortError');
        let part = hasToken ? await APP.api.scanGraphQL(u,ext) : await APP.api.listReposREST(u);
        APP.state.repos=APP.state.repos.concat(part);
      }
      if(!$('includeForks').checked) APP.state.repos=APP.state.repos.filter(r=>!r.fork);
      if(!$('includeArchived').checked) APP.state.repos=APP.state.repos.filter(r=>!r.archived);
      if(!APP.state.repos.length){ setStatus('No repositories found (or all filtered out).',''); $('tbody').innerHTML='<tr><td colspan="9" class="empty">No repositories.</td></tr>'; setRunning(false); return; }
      populateFilters(); render(); updateSummary(); renderAgg();
      if(!hasToken){
        if($('rateBadge')._remaining!=null && $('rateBadge')._remaining<APP.state.repos.length) setStatus(`Warning: ${APP.state.repos.length} repos to check but only ${$('rateBadge')._remaining} requests remaining. Some counts may fail — add a token.`,'warn');
        await APP.api.countREST(APP.state.repos);
      }
      render(); updateSummary(); renderAgg(); APP.charts.renderCharts();

      APP.db.saveToDB();
      APP.charts.renderHistoryCharts();

      computeDelta(prevSnap); saveSnapshot(); saveCache();
      if(APP.db.isDbReady()) APP.db.saveDBToFolder().then(ok=>{ APP.charts.renderHistoryCharts(); if(!ok&&window.showDirectoryPicker&&APP.db.getDbDirHandle()){ setStatus('Auto-save failed: folder permission expired. Grant access or try again.','warn'); } });
      APP.state.lastTs=Date.now(); updateMeta(); saveCache();
      const total=APP.state.repos.reduce((s,r)=>s+(r.openPRs||0),0);
      const fails=APP.state.repos.filter(r=>r.openPRs==null).length;
      const foundPrivate=APP.state.repos.some(r=>r.private);
      let doneMsg=`Completed: ${APP.state.repos.length} repositories, ${total} open PRs total.`+(fails?` ${fails} counts failed (use "Retry failed").`:'');
      if(hasToken && APP.api.getTokenLogin() && !foundPrivate){
        if(!getUsernames().includes(APP.api.getTokenLogin())) doneMsg+=` No private repos visible: the token of "${APP.api.getTokenLogin()}" cannot see private repos of other accounts. Use "Use my account".`;
        else if(!APP.api.getTokenScopes().includes('repo') && !APP.api.isTokenFine()) doneMsg+=' The token does not have the "repo" scope (or is a fine-grained PAT without the selected repositories): private repositories are not accessible.';
        else doneMsg+=' No private repositories found for this account.';
        setStatus(doneMsg,'warn');
      } else if(!hasToken){
        setStatus(doneMsg+ (doneMsg.indexOf('Limit')>=0?'':' To see private repositories you need a personal access token.'), 'warn');
      } else setStatus(doneMsg, fails?'warn':'');
    }catch(e){
      if(e.name==='AbortError') setStatus('Scan cancelled.','');
      else setStatus(e.message||'Unexpected error.','error');
    }finally{ setRunning(false); render(); }
  }

  async function retryFailed(){
    if(APP.state.running) return;
    const failed=APP.state.repos.filter(r=>r.openPRs==null);
    if(!failed.length) return;
    APP.api.setController(new AbortController());
    setRunning(true); setStatus(`Retrying ${failed.length} counts…`);
    try{ await APP.api.countREST(failed); render(); updateSummary(); APP.charts.renderCharts(); APP.charts.renderHistoryCharts(); APP.state.lastTs=Date.now(); updateMeta(); saveCache(); saveSnapshot(); setStatus('Retry completed.',''); }
    catch(e){ setStatus(e.message||'Error.','error'); }
    finally{ setRunning(false); }
  }

  async function init(){
    loadPrefs();
    loadTokenStorePref();
    await APP.db.initDB();
    APP.api.checkToken();
    const hash=APP.utils.applyHash();
    updateSortHeaders();
    if(hash&&hash.hasUser){ loadCache(hash.lang,hash.own); }
    bindEvents({ run, retryFailed });
  }

  init();

  return { run, retryFailed };
})();
