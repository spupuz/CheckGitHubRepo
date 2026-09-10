window.APP = window.APP || {};
APP.ui = (function(){
  const { $, esc, cssVar, daysBetween, timeAgo, getUsernames, signature, syncHash, applyHash, tokenStorage, downloadBlob, multiOwner } = APP.utils;
  const cfg = APP.config;
  const SORTERS={
    name:r=>r.name.toLowerCase(), openPRs:r=>r.openPRs==null?-1:r.openPRs,
    draftPRs:r=>r.draftPRs==null?-1:r.draftPRs, noReviewer:r=>r.noReviewer==null?-1:r.noReviewer,
    stalePRs:r=>r.stalePRs==null?-1:r.stalePRs, oldest:r=>r.oldestPRDate?Date.parse(r.oldestPRDate):Infinity,
    openIssues:r=>r.openIssues==null?-1:r.openIssues, stars:r=>r.stars, updated:r=>r.updatedRaw?Date.parse(r.updatedRaw):0
  };

  const statusEl=$('status');
  function setStatus(m,cls){ statusEl.textContent=m||''; statusEl.className=cls||''; }
  function showSkeleton(n){ const tb=$('tbody'); let h=''; for(let i=0;i<n;i++) h+=`<tr><td colspan="9"><div class="skel" style="width:${60+Math.random()*35}%"></div></td></tr>`; tb.innerHTML=h; }
  function setRunning(on){ const state=APP.state; state.running=on; $('run').disabled=on; $('refreshBtn').disabled=on; $('cancel').style.display=on?'inline-block':'none'; $('progressWrap').classList.toggle('on',on); }

  function applyFilters(list){
    const onlyWithPRs=$('onlyWithPRs').checked;
    const f=$('filter').value.trim().toLowerCase();
    const lang=$('fLang').value;
    const own=$('fOwner').value;
    const min=parseInt($('fMin').value,10);
    const checkMin=!isNaN(min);
    return list.filter(r=>{
      if(onlyWithPRs && !(r.openPRs>0)) return false;
      if(f && !r.name.toLowerCase().includes(f) && !r.fullName.toLowerCase().includes(f)) return false;
      if(lang && (r.language||'—')!==lang) return false;
      if(own && r.owner!==own) return false;
      if(checkMin && !((r.openPRs||0)>=min)) return false;
      return true;
    });
  }

  function render(){
    const state=APP.state;
    let rows=applyFilters(state.repos);
    rows.sort((a,b)=>{ const va=SORTERS[state.sortKey](a), vb=SORTERS[state.sortKey](b); if(typeof va==='string') return va<vb?-state.sortDir:va>vb?state.sortDir:0; return (va-vb)*state.sortDir; });
    const tb=$('tbody'); const totalRows=rows.length;
    if(!totalRows){
      const isFiltered = $('onlyWithPRs').checked || $('filter').value.trim() || $('fLang').value || $('fOwner').value || $('fMin').value;
      tb.innerHTML=`<tr><td colspan="9" class="empty">No repositories match the filters.${isFiltered ? '<br><button class="btn secondary small" id="clearFiltersBtn" style="margin-top: 12px;">Clear filters</button>' : ''}</td></tr>`;
      $('showAllWrap').style.display='none';
      return;
    }
    const capped=!state.showAll&&totalRows>cfg.RENDER_CAP; const view=capped?rows.slice(0,cfg.RENDER_CAP):rows;
    const mo=multiOwner(); const prev=state.lastDelta&&state.lastDelta.map?state.lastDelta.map:null;
    tb.innerHTML=view.map(r=>{
      const prClass=r.openPRs>0?'some':(r.openPRs==null?'fail':'zero');
      const prTxt=r.openPRs==null?'⟳':r.openPRs;
      let deltaB='';
      if(prev && r.openPRs!=null && (r.fullName in prev)){ const d=r.openPRs-prev[r.fullName]; if(d!==0) deltaB=`<span class="delta-badge ${d>0?'up':'down'}">${d>0?'+':''}${d}</span>`; }
      else if(prev && r.openPRs!=null){ deltaB='<span class="delta-badge down" title="new repo">new</span>'; }
      const prCell=r.openPRs==null
        ? `<span class="pill fail" data-retry="${esc(r.fullName)}" title="Count failed — click to retry">${prTxt}</span>`
        : `<a href="https://github.com/${esc(r.fullName)}/pulls" target="_blank" rel="noopener" style="text-decoration:none;"><span class="pill ${prClass}">${prTxt}</span></a>${deltaB}`;
      const draft=r.draftPRs==null?'—':r.draftPRs;
      const norev=r.noReviewer==null?'—':(r.noReviewer>0?`<span class="stale">${r.noReviewer}</span>`:'0');
      const stale=r.stalePRs==null?'—':(r.stalePRs>0?`<span class="stale">${r.stalePRs}</span>`:'0');
      const days=daysBetween(r.oldestPRDate);
      const oldest=days==null?'—':`<span class="${days>=60?'stale':''}">${days} g</span>`;
      const issues=r.openIssues==null?'—':r.openIssues;
      const langDot=r.language?`<span class="lang-dot"></span>${esc(r.language)}`:'';
      const ownerTag=mo?`<span>${esc(r.owner)}</span>`:'';
      return `<tr data-glean-id="repo-row-${esc(r.fullName)}">
        <td class="repo-name"><a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(mo?r.fullName:r.name)}</a>${r.private?'<span class="pill zero" style="margin-left:6px;font-size:10px;">private</span>':''}<div class="repo-meta">${langDot}${ownerTag}${r.fork?'<span>fork</span>':''}${r.archived?'<span>archived</span>':''}</div></td>
        <td class="num">${prCell}</td>
        <td class="num">${draft}</td>
        <td class="num">${norev}</td>
        <td class="num">${stale}</td>
        <td class="num" title="${esc(r.oldestPRDate||'')}">${oldest}</td>
        <td class="num">${issues}</td>
        <td class="num">${r.stars.toLocaleString('en-US')}</td>
        <td class="num" title="${esc(r.updatedRaw||'')}">${esc(r.updated)}</td>
      </tr>`;
    }).join('');
    const wrap=$('showAllWrap');
    if(capped){ wrap.style.display='block'; $('showAllBtn').textContent=`Show all ${totalRows} rows (${cfg.RENDER_CAP} displayed)`; }
    else wrap.style.display='none';
    $('retryFailed').style.display=(APP.state.usedMethod==='rest'&&!state.running&&state.repos.some(r=>r.openPRs==null))?'inline-block':'none';
  }

  function renderAgg(){
    const state=APP.state;
    const has=Object.keys(state.authorCounts).length||Object.keys(state.labelCounts).length;
    if(!has){ $('aggPanel').classList.remove('on'); return; }
    function chips(map){ const arr=Object.entries(map).sort((a,b)=>b[1]-a[1]).slice(0,6); const max=arr.length?arr[0][1]:1; return arr.map(([k,v])=>`<div class="chip"><span class="k">${esc(k)}</span><span class="bar"><i style="width:${Math.round(v/max*100)}%"></i></span><span class="n">${v}</span></div>`).join('')||'<span class="n">—</span>'; }
    $('aggAuthors').innerHTML=chips(state.authorCounts); $('aggLabels').innerHTML=chips(state.labelCounts);
    $('aggPanel').classList.add('on');
  }

  function updateSummary(){
    const repos=APP.state.repos;
    const counted=repos.filter(r=>r.openPRs!=null);
    const total=counted.reduce((s,r)=>s+r.openPRs,0);
    const withPRs=counted.filter(r=>r.openPRs>0).length;
    const top=counted.reduce((m,r)=>Math.max(m,r.openPRs),0);
    function sumOf(k){ const a=repos.filter(r=>r[k]!=null); return a.length?a.reduce((s,r)=>s+r[k],0):null; }
    const draft=sumOf('draftPRs'), norev=sumOf('noReviewer'), stale=sumOf('stalePRs'), iss=sumOf('openIssues');
    $('statRepos').textContent=repos.length; $('statPRs').textContent=total; $('statWithPRs').textContent=withPRs;
    $('statTop').textContent=top; $('statDraft').textContent=draft==null?'—':draft;
    $('statNoRev').textContent=norev==null?'—':norev; $('statStale').textContent=stale==null?'—':stale;
    $('statIssues').textContent=iss==null?'—':iss;
    $('summary').classList.add('on');
  }

  function updateMeta(){ if(APP.state.lastTs){ $('resultsMeta').textContent=`Latest update: ${new Date(APP.state.lastTs).toLocaleString('en-US')}`; } }

  function populateFilters(){
    const repos=APP.state.repos;
    const langs=[...new Set(repos.map(r=>r.language||'—'))].sort();
    const cur=$('fLang').value;
    $('fLang').innerHTML='<option value="">All languages</option>'+langs.map(l=>`<option value="${esc(l)}">${esc(l)}</option>`).join('');
    if(langs.includes(cur)) $('fLang').value=cur;
    const owners=[...new Set(repos.map(r=>r.owner))];
    if(owners.length>1){ const co=$('fOwner').value; $('fOwner').style.display=''; $('fOwner').innerHTML='<option value="">All owners</option>'+owners.map(o=>`<option value="${esc(o)}">${esc(o)}</option>`).join(''); if(owners.includes(co)) $('fOwner').value=co; }
    else $('fOwner').style.display='none';
  }

  function updateSortHeaders(){ document.querySelectorAll('thead th[data-sort]').forEach(th=>{ const active=th.dataset.sort===APP.state.sortKey; th.querySelector('.arrow').textContent=active?(APP.state.sortDir<0?'▼':'▲'):''; th.setAttribute('aria-sort',active?(APP.state.sortDir<0?'descending':'ascending'):'none'); }); }

  function exportCSV(){
    const repos=APP.state.repos;
    if(!repos.length) return;
    const rows=applyFilters(repos);
    const head=['owner','repository','full_name','open_prs','draft_prs','no_reviewer','stale_prs_30d','oldest_pr_days','open_issues','stars','language','private','fork','archived','updated_at','url'];
    const line=arr=>arr.map(v=>{ let s=String(v==null?'':v); if(/^[=+\-@]/.test(s)) s="'"+s; return /[",\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s; }).join(',');
    const out=[line(head)].concat(rows.map(r=>line([r.owner,r.name,r.fullName,r.openPRs==null?'':r.openPRs,r.draftPRs==null?'':r.draftPRs,r.noReviewer==null?'':r.noReviewer,r.stalePRs==null?'':r.stalePRs,daysBetween(r.oldestPRDate)==null?'':daysBetween(r.oldestPRDate),r.openIssues==null?'':r.openIssues,r.stars,r.language||'',r.private,r.fork,r.archived,r.updatedRaw||'',r.url])));
    downloadBlob(out.join('\n'),'text/csv;charset=utf-8;',`github_open_prs_${getUsernames().join('_')||'export'}.csv`);
  }
  function exportJSON(){
    const repos=APP.state.repos;
    if(!repos.length) return;
    const payload={ generatedAt:new Date().toISOString(), accounts:getUsernames(), method:APP.state.usedMethod, totalOpenPRs:repos.reduce((s,r)=>s+(r.openPRs||0),0), repositories:applyFilters(repos) };
    downloadBlob(JSON.stringify(payload,null,2),'application/json',`github_open_prs_${getUsernames().join('_')||'export'}.json`);
  }
  function copyLink(){ syncHash(); const url=location.href; if(navigator.clipboard&&navigator.clipboard.writeText){ navigator.clipboard.writeText(url).then(()=>setStatus('Link copied to clipboard.',''),()=>setStatus('Unable to copy link.','warn')); } else setStatus('Copy manually: '+url,''); }

  function savePrefs(){
    saveToken();
    try{
      if(!$('rememberUser').checked){ localStorage.removeItem(cfg.PREF_KEY); }
      else localStorage.setItem(cfg.PREF_KEY,JSON.stringify({username:$('username').value.trim(),extended:$('extended').checked,forks:$('includeForks').checked,archived:$('includeArchived').checked,collab:$('includeCollab').checked,tokenStore:tokenStorage(),sortKey:APP.state.sortKey,sortDir:APP.state.sortDir,onlyWithPRs:$('onlyWithPRs').checked}));
    }catch(e){}
  }
  function loadPrefs(){
    try{
      let tok=''; try{ tok=localStorage.getItem('ghPrChecker.token')||sessionStorage.getItem('ghPrChecker.token')||''; }catch(e){}
      if(tok){ $('token').value=tok; $('forgetToken').style.display='inline-block'; }
      const raw=localStorage.getItem(cfg.PREF_KEY); if(raw){ const p=JSON.parse(raw);
        $('rememberUser').checked=true; if(p.username) $('username').value=p.username;
        if('extended' in p) $('extended').checked=p.extended;
        $('includeForks').checked=!!p.forks; $('includeArchived').checked=!!p.archived; $('includeCollab').checked=!!p.collab;
        if(p.tokenStore) $('tokenStore').value=p.tokenStore;
        if(p.sortKey&&SORTERS[p.sortKey]){ APP.state.sortKey=p.sortKey; APP.state.sortDir=p.sortDir||-1; }
        if('onlyWithPRs' in p) $('onlyWithPRs').checked=p.onlyWithPRs;
      }
    }catch(e){}
  }
  function loadTokenStorePref(){
    try{
      const v=localStorage.getItem('ghPrChecker.tokenStorePref');
      $('tokenStore').value=(v==='session'||v==='none'||v==='local')?v:'local';
    }catch(e){ $('tokenStore').value='local'; }
  }
  function saveToken(){
    const mode=tokenStorage(), t=$('token').value.trim();
    try{ localStorage.setItem('ghPrChecker.tokenStorePref',mode);
      localStorage.removeItem('ghPrChecker.token'); sessionStorage.removeItem('ghPrChecker.token');
      if(t&&mode==='local') localStorage.setItem('ghPrChecker.token',t);
      else if(t&&mode==='session') sessionStorage.setItem('ghPrChecker.token',t);
    }catch(e){}
    $('forgetToken').style.display=t?'inline-block':'none';
  }
  let tokenDbgTimer=null;
  function tokenInputChanged(){ clearTimeout(tokenDbgTimer); tokenDbgTimer=setTimeout(saveToken,600); }

  function cacheKey(){ return 'ghPrChecker.cache.'+signature(); }
  function saveCache(){ const state=APP.state; try{ localStorage.setItem(cacheKey(),JSON.stringify({ts:state.lastTs,repos:state.repos,authorCounts:state.authorCounts,labelCounts:state.labelCounts,method:state.usedMethod})); }catch(e){} }
  function loadCache(pendingLang,pendingOwn){
    try{ const raw=localStorage.getItem(cacheKey()); if(!raw) return false; const c=JSON.parse(raw);
      const state=APP.state;
      state.repos=c.repos||[]; state.authorCounts=c.authorCounts||{}; state.labelCounts=c.labelCounts||{}; state.usedMethod=c.method||'rest'; state.lastTs=c.ts||null;
      if(!state.repos.length) return false;
      state.lastDelta=loadSnapshot();
      $('resultsPanel').style.display='block'; populateFilters();
      if(pendingLang){ $('fLang').value=pendingLang; } if(pendingOwn){ $('fOwner').value=pendingOwn; }
      render(); updateSummary(); renderAgg(); APP.charts.renderCharts();
      APP.charts.renderHistoryCharts();
      if(state.lastDelta&&state.lastDelta.map){
        computeDelta(state.lastDelta);
      }
      updateMeta();
      const total=state.repos.reduce((s,r)=>s+(r.openPRs||0),0);
      setStatus(`Cached data (${state.repos.length} repos, ${total} open PRs). Press "Refresh" to reload.`,'');
      return true;
    }catch(e){ return false; }
  }

  function loadSnapshot(){ try{ const raw=localStorage.getItem('ghPrChecker.snap.'+signature()); return raw?JSON.parse(raw):null; }catch(e){ return null; } }
  function saveSnapshot(){ const state=APP.state; try{ const map={}; state.repos.forEach(r=>{ if(r.openPRs!=null) map[r.fullName]=r.openPRs; }); localStorage.setItem('ghPrChecker.snap.'+signature(),JSON.stringify({ts:Date.now(),total:state.repos.reduce((s,r)=>s+(r.openPRs||0),0),map})); }catch(e){} }
  function computeDelta(prev){
    const state=APP.state;
    if(!prev||!prev.map){ $('deltaPanel').classList.remove('on'); state.lastDelta=null; return; }
    state.lastDelta=prev;
    const nowTotal=state.repos.reduce((s,r)=>s+(r.openPRs||0),0);
    const diff=nowTotal-(prev.total||0);
    const nowNames=new Set(state.repos.map(r=>r.fullName)), prevNames=new Set(Object.keys(prev.map));
    const added=[...nowNames].filter(n=>!prevNames.has(n)).length;
    const removed=[...prevNames].filter(n=>!nowNames.has(n)).length;
    const cls=diff>0?'up':diff<0?'down':'flat';
    $('deltaRow').innerHTML=
      `<span class="delta-chip">Total open PRs: <span class="n ${cls}">${diff>0?'+':''}${diff}</span> (now ${nowTotal})</span>`+
      `<span class="delta-chip">Repos added: <span class="n">${added}</span></span>`+
      `<span class="delta-chip">Repos removed: <span class="n">${removed}</span></span>`+
      `<span class="delta-chip flat">vs ${new Date(prev.ts).toLocaleString('en-US')}</span>`;
    const changes=[];
    state.repos.forEach(r=>{ if(r.openPRs!=null && (r.fullName in prev.map)){ const d=r.openPRs-prev.map[r.fullName]; if(d!==0) changes.push([r.fullName,d]); } });
    changes.sort((a,b)=>Math.abs(b[1])-Math.abs(a[1]));
    $('deltaList').innerHTML=changes.slice(0,6).map(([n,d])=>`<li>${esc(n)}: <span class="${d>0?'up':'down'}">${d>0?'+':''}${d} PR</span></li>`).join('');
    $('deltaPanel').classList.add('on');
  }

  function bindEvents(handlers){
    $('tbody').addEventListener('click', e=>{
      if(e.target.id === 'clearFiltersBtn') {
        $('filter').value = '';
        $('fLang').value = '';
        $('fOwner').value = '';
        $('fMin').value = '';
        $('onlyWithPRs').checked = false;
        render();
        syncHash();
        savePrefs();
        return;
      }
      const el=e.target.closest('[data-retry]');
      if(!el||APP.state.running) return;
      const fn=el.getAttribute('data-retry');
      const r=APP.state.repos.find(x=>x.fullName===fn);
      if(!r) return;
      APP.api.setController(new AbortController());
      (async()=>{ el.textContent='…'; try{ r.openPRs=await APP.api.countOpenPRsREST(fn); }catch(_){ } render(); updateSummary(); APP.charts.renderCharts(); APP.charts.renderHistoryCharts(); saveCache(); })();
    });
    $('run').addEventListener('click', handlers.run);
    $('refreshBtn').addEventListener('click', handlers.run);
    $('cancel').addEventListener('click', ()=>{ if(APP.api.getController()) APP.api.getController().abort(); });
    $('csv').addEventListener('click', exportCSV);
    $('json').addEventListener('click', exportJSON);
    $('downloadDB').addEventListener('click', APP.db.downloadDB);
    $('pickFolder').addEventListener('click', APP.db.pickDBFolder);
    $('loadDB').addEventListener('change', e=>{ if(e.target.files&&e.target.files[0]) APP.db.loadDB(e.target.files[0]); e.target.value=''; });
    $('copyLink').addEventListener('click', copyLink);
    $('retryFailed').addEventListener('click', handlers.retryFailed);
    $('showAllBtn').addEventListener('click', ()=>{ APP.state.showAll=true; render(); });
    $('forgetToken').addEventListener('click', ()=>{ $('token').value=''; try{ localStorage.removeItem('ghPrChecker.token'); sessionStorage.removeItem('ghPrChecker.token'); }catch(e){} $('forgetToken').style.display='none'; });
    ['username','token'].forEach(id=>$(id).addEventListener('keydown',e=>{ if(e.key==='Enter'){ e.preventDefault(); handlers.run(); }}));
    $('token').addEventListener('input', ()=>{ APP.api.syncUseTokenLogin(); tokenInputChanged(); });
    $('filter').addEventListener('input', ()=>{ render(); syncHash(); });
    ['fLang','fOwner'].forEach(id=>$(id).addEventListener('change', ()=>{ render(); syncHash(); }));
    $('fMin').addEventListener('input', ()=>{ render(); syncHash(); });
    $('onlyWithPRs').addEventListener('change', ()=>{ render(); savePrefs(); syncHash(); });
    ['extended','includeForks','includeArchived','includeCollab','rememberUser'].forEach(id=>$(id).addEventListener('change', savePrefs));
    $('tokenStore').addEventListener('change', saveToken);
    document.querySelectorAll('thead th[data-sort]').forEach(th=>{ th.addEventListener('click',()=>{ const k=th.dataset.sort; if(APP.state.sortKey===k) APP.state.sortDir*=-1; else { APP.state.sortKey=k; APP.state.sortDir=(k==='name'||k==='oldest')?1:-1; } updateSortHeaders(); render(); savePrefs(); syncHash(); }); th.addEventListener('keydown',e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); th.click(); } }); });
    window.addEventListener('resize', APP.charts.resizeAll);
  }

  return { setStatus, showSkeleton, setRunning, render, renderAgg, updateSummary, updateMeta, populateFilters, updateSortHeaders, exportCSV, exportJSON, copyLink, savePrefs, loadPrefs, loadTokenStorePref, saveToken, tokenInputChanged, cacheKey, saveCache, loadCache, signature, loadSnapshot, saveSnapshot, computeDelta, bindEvents, SORTERS };
})();
