window.APP = window.APP || {};
APP.api = (function(){
  const { $, sleep, headers, updateRate, rateLimitMsg, timeAgo, daysBetween, getUsernames } = APP.utils;
  const cfg = APP.config;
  const etagCache = new Map();
  let controller = null;
  function setController(c){ controller = c; }
  function getController(){ return controller; }

  async function ghFetch(url,opts,tries){
    tries=tries||3;
    for(let i=0;i<tries;i++){
      if(controller && controller.signal.aborted) throw new DOMException('Cancelled','AbortError');
      let res;
      try{ res=await fetch(url,Object.assign({signal:controller?controller.signal:undefined},opts)); }
      catch(e){ if(e.name==='AbortError') throw e; if(i===tries-1) throw new Error('Network error while calling GitHub.'); await sleep(Math.pow(2,i)*600); continue; }
      updateRate(res);
      if(res.status===403||res.status===429){
        const rem=res.headers.get('x-ratelimit-remaining');
        if(rem==='0') throw new Error(rateLimitMsg(res));
        const ra=parseInt(res.headers.get('retry-after')||'0',10);
        if(i<tries-1){ await sleep((ra||Math.pow(2,i))*1000); continue; }
        throw new Error('GitHub secondary rate limit reached, please try again shortly.');
      }
      return res;
    }
  }

  async function getJSON(url){
    const c=etagCache.get(url);
    const res=await ghFetch(url,{headers:headers(c?{'If-None-Match':c.etag}:undefined)});
    if(res.status===304 && c) return {ok:true,status:304,link:c.link,data:c.body};
    if(!res.ok) return {ok:false,status:res.status};
    const et=res.headers.get('ETag'), link=res.headers.get('Link'), data=await res.json();
    if(et) etagCache.set(url,{etag:et,body:data,link:link});
    return {ok:true,status:res.status,link:link,data:data};
  }

  async function scanGraphQL(login,ext){
    const state=APP.state;
    const includeCollab=$('includeCollab').checked;
    const prPart=ext
      ? `pullRequests(states:OPEN,first:50,orderBy:{field:CREATED_AT,direction:ASC}){totalCount nodes{isDraft createdAt author{login} reviewRequests{totalCount} labels(first:3){nodes{name}}}}`
      : `pullRequests(states:OPEN){totalCount}`;
    const issuePart=ext?`issues(states:OPEN){totalCount}`:``;
    const perPage=ext?50:100;
    const query=`query($login:String!,$cursor:String){repositoryOwner(login:$login){__typename repositories(first:${perPage},after:$cursor,orderBy:{field:NAME,direction:ASC}){pageInfo{hasNextPage endCursor} totalCount nodes{name nameWithOwner url stargazerCount isFork isArchived isPrivate primaryLanguage{name} owner{login} updatedAt ${prPart} ${issuePart}}}}}`;
    let cursor=null,out=[],total=null;
    while(true){
      const res=await ghFetch('https://api.github.com/graphql',{method:'POST',headers:headers({'Content-Type':'application/json'}),body:JSON.stringify({query,variables:{login,cursor}})});
      if(res.status===401) throw new Error('Invalid token (401). Check your personal access token.');
      const json=await res.json();
      if(json.errors&&json.errors.length) throw new Error('GraphQL: '+json.errors[0].message);
      const owner=json.data&&json.data.repositoryOwner;
      if(!owner) throw new Error(`Account "${login}" not found.`);
      const conn=owner.repositories; total=conn.totalCount;
      conn.nodes.forEach(n=>{
        const repoOwner=n.owner?n.owner.login:login;
        if(!includeCollab && owner.__typename==='User' && repoOwner!==login) return;
        const r={owner:repoOwner,name:n.name,fullName:n.nameWithOwner,url:n.url,stars:n.stargazerCount||0,
          language:n.primaryLanguage?n.primaryLanguage.name:null,fork:n.isFork,archived:n.isArchived,private:n.isPrivate,
          updated:timeAgo(n.updatedAt),updatedRaw:n.updatedAt,openPRs:n.pullRequests.totalCount,
          draftPRs:null,noReviewer:null,stalePRs:null,oldestPRDate:null,openIssues:ext&&n.issues?n.issues.totalCount:null};
        if(ext&&n.pullRequests.nodes){
          const nodes=n.pullRequests.nodes;
          r.draftPRs=nodes.filter(p=>p.isDraft).length;
          r.noReviewer=nodes.filter(p=>!p.isDraft && p.reviewRequests && p.reviewRequests.totalCount===0).length;
          r.stalePRs=nodes.filter(p=>daysBetween(p.createdAt)>=cfg.STALE_DAYS).length;
          r.oldestPRDate=nodes.length?nodes[0].createdAt:null;
          nodes.forEach(p=>{ const a=p.author&&p.author.login; if(a) state.authorCounts[a]=(state.authorCounts[a]||0)+1; if(p.labels&&p.labels.nodes) p.labels.nodes.forEach(l=>{ state.labelCounts[l.name]=(state.labelCounts[l.name]||0)+1; }); });
        }
        out.push(r);
      });
      APP.ui.setStatus(`Fetching via GraphQL (${login})… ${out.length}/${total}`);
      $('progressBar').style.width=Math.round(out.length/Math.max(total,1)*100)+'%';
      if(!conn.pageInfo.hasNextPage) break;
      cursor=conn.pageInfo.endCursor;
    }
    return out;
  }

  async function listReposREST(login){
    async function page(kind,p){ return getJSON(`https://api.github.com/${kind}/${encodeURIComponent(login)}/repos?per_page=100&page=${p}&sort=full_name&type=owner`); }
    let kind='users', first=await page('users',1);
    if(!first.ok&&first.status===404){ kind='orgs'; first=await page('orgs',1); }
    if(!first.ok&&first.status===404) throw new Error(`Account "${login}" not found.`);
    if(!first.ok) throw new Error(`GitHub error (${first.status}) while fetching repositories for ${login}.`);
    let all=first.data.slice(), p=2;
    while(all.length%100===0 && all.length>0 && p<=cfg.MAX_PAGES){
      const res=await page(kind,p); if(!res.ok||!res.data.length) break;
      all=all.concat(res.data); p++; APP.ui.setStatus(`Fetching repositories (${login})… ${all.length}`);
    }
    return all.map(r=>({owner:login,name:r.name,fullName:r.full_name,url:r.html_url,stars:r.stargazers_count||0,
      language:r.language,fork:r.fork,archived:r.archived,private:r.private,updated:timeAgo(r.updated_at),
      updatedRaw:r.updated_at,openPRs:null,draftPRs:null,noReviewer:null,stalePRs:null,oldestPRDate:null,openIssues:null}));
  }

  async function countOpenPRsREST(fullName){
    const res=await getJSON(`https://api.github.com/repos/${fullName}/pulls?state=open&per_page=1`);
    if(!res.ok) return null;
    if(res.link){ const m=res.link.match(/[?&]page=(\d+)[^>]*>;\s*rel="last"/); if(m) return parseInt(m[1],10); }
    return Array.isArray(res.data)?res.data.length:0;
  }

  async function countREST(list){
    const state=APP.state;
    const concurrency=8; let done=0, idx=0; const total=list.length;
    async function worker(){
      while(idx<list.length){
        if(controller.signal.aborted) return;
        const r=list[idx++];
        try{ r.openPRs=await countOpenPRsREST(r.fullName); }
        catch(e){ if(e.name==='AbortError') return; r.openPRs=null; }
        done++; $('progressBar').style.width=Math.round(done/total*100)+'%';
        APP.ui.setStatus(`Counting open PRs… ${done}/${total}`);
        if(done%5===0||done===total){ APP.ui.render(); APP.ui.updateSummary(); }
      }
    }
    await Promise.all(Array.from({length:Math.min(concurrency,list.length)},worker));
  }

  let tokenLogin=null, tokenScopes=null, tokenFine=false;
  function getTokenLogin(){ return tokenLogin; }
  function getTokenScopes(){ return tokenScopes; }
  function isTokenFine(){ return tokenFine; }

  function renderTokenBadge(){
    const el=$('tokenBadge');
    if(!tokenLogin){ el.classList.add('hidden'); syncUseTokenLogin(); return; }
    const hasRepo=tokenScopes.includes('repo');
    let scopeTxt;
    if(hasRepo) scopeTxt='repo ✓';
    else if(tokenFine) scopeTxt='fine-grained';
    else scopeTxt=(tokenScopes.length?tokenScopes.join('+'):'?');
    el.textContent=`token: ${tokenLogin} · scope: ${scopeTxt}`;
    el.title=tokenScopes.length?('Scope: '+tokenScopes.join('+')):'';
    el.classList.remove('hidden');
    el.style.color=hasRepo||tokenFine?'':'var(--artifact-warn)';
    syncUseTokenLogin();
  }
  function syncUseTokenLogin(){
    const hb=$('useTokenLogin');
    const hasTok=$('token').value.trim();
    const usr=getUsernames();
    if(hasTok && tokenLogin && !usr.includes(tokenLogin)){
      hb.style.display='inline-block';
      hb.onclick=()=>{ $('username').value=tokenLogin; hb.style.display='none'; };
    } else hb.style.display='none';
  }
  async function checkToken(){
    tokenLogin=null; tokenScopes=null; tokenFine=false;
    if(!$('token').value.trim()){ renderTokenBadge(); return; }
    try{
      const res=await ghFetch('https://api.github.com/user',{headers:headers()},1);
      if(!res.ok){ renderTokenBadge(); return; }
      const sc=res.headers.get('x-oauth-scopes')||'';
      tokenScopes=sc.split(',').map(s=>s.trim()).filter(Boolean);
      tokenFine=!!res.headers.get('x-accepted-github-permissions') && !tokenScopes.length;
      const j=await res.json();
      tokenLogin=j&&j.login?j.login:null;
      renderTokenBadge();
    }catch(e){ renderTokenBadge(); }
  }

  return { setController, getController, ghFetch, getJSON, scanGraphQL, listReposREST, countOpenPRsREST, countREST, checkToken, getTokenLogin, getTokenScopes, isTokenFine, renderTokenBadge, syncUseTokenLogin };
})();
