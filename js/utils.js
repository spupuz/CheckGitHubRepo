window.APP = window.APP || {};
APP.utils = (function(){
  const $ = id => document.getElementById(id);
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function cssVar(n){ return getComputedStyle(document.documentElement).getPropertyValue(n).trim(); }
  function daysBetween(iso){ if(!iso) return null; return Math.floor((Date.now()-Date.parse(iso))/86400000); }
  function timeAgo(iso){ if(!iso) return '—'; const s=Math.floor((Date.now()-Date.parse(iso))/1000); for(const [lab,sec] of [['y',31536000],['mo',2592000],['d',86400],['h',3600],['m',60]]){ const v=Math.floor(s/sec); if(v>=1) return v+' '+lab+' ago'; } return 'now'; }
  function dayKey(d){ const y=d.getFullYear(); const m=('0'+(d.getMonth()+1)).slice(-2); const day=('0'+d.getDate()).slice(-2); return `${y}-${m}-${day}`; }
  function toRGBA(hex,a){ if(!hex) return 'rgba(31,111,235,'+a+')'; const m=hex.replace('#',''); if(m.length===3||m.length===6){ const full=m.length===3?m.split('').map(x=>x+x).join(''):m; const n=parseInt(full,16); return `rgba(${(n>>16)&255},${(n>>8)&255},${n&255},${a})`; } return hex; }
  function updateRate(res){ const rateBadge=$('rateBadge'); const rem=res.headers.get('x-ratelimit-remaining'), reset=res.headers.get('x-ratelimit-reset'); if(rem===null) return; let t=`${rem} requests remaining`; if(reset){ const d=new Date(parseInt(reset,10)*1000); t+=` · reset ${d.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'})}`; } rateBadge.textContent=t; rateBadge.classList.remove('hidden'); rateBadge._remaining=parseInt(rem,10); }
  function rateLimitMsg(res){ const reset=res.headers.get('x-ratelimit-reset'); let w=''; if(reset){ const d=new Date(parseInt(reset,10)*1000); w=` Try again after ${d.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'})}.`; } return 'GitHub rate limit reached.'+w+' Add a personal access token to increase to 5,000/hour.'; }
  function headers(extra){ const h=Object.assign({'Accept':'application/vnd.github+json'},extra||{}); const t=$('token').value.trim(); if(t) h['Authorization']='Bearer '+t; return h; }
  function affiliations(){ return $('includeCollab').checked ? 'OWNER,COLLABORATOR,ORGANIZATION_MEMBER' : 'OWNER'; }
  function getUsernames(){ return $('username').value.split(',').map(s=>s.trim()).filter(Boolean); }
  function signature(){ return getUsernames().join(',')+'|'+($('extended').checked?1:0)+($('includeForks').checked?1:0)+($('includeArchived').checked?1:0)+($('includeCollab').checked?1:0); }
  function multiOwner(){ const repos=APP.state.repos; return repos.length>1 && repos.some(r=>r.owner!==repos[0].owner); }
  function syncHash(){
    const p=new URLSearchParams();
    p.set('u',getUsernames().join(',')); p.set('ext',$('extended').checked?1:0);
    p.set('forks',$('includeForks').checked?1:0); p.set('arch',$('includeArchived').checked?1:0);
    p.set('collab',$('includeCollab').checked?1:0); p.set('only',$('onlyWithPRs').checked?1:0);
    if($('filter').value.trim()) p.set('q',$('filter').value.trim());
    if($('fLang').value) p.set('lang',$('fLang').value);
    if($('fOwner').value) p.set('own',$('fOwner').value);
    if($('fMin').value) p.set('min',$('fMin').value);
    p.set('sort',APP.state.sortKey); p.set('dir',APP.state.sortDir<0?'desc':'asc');
    history.replaceState(null,'','#'+p.toString());
  }
  function applyHash(){
    if(!location.hash||location.hash.length<2) return false;
    const p=new URLSearchParams(location.hash.slice(1));
    if(p.get('u')) $('username').value=p.get('u');
    if(p.has('ext')) $('extended').checked=p.get('ext')==='1';
    if(p.has('forks')) $('includeForks').checked=p.get('forks')==='1';
    if(p.has('arch')) $('includeArchived').checked=p.get('arch')==='1';
    if(p.has('collab')) $('includeCollab').checked=p.get('collab')==='1';
    if(p.has('only')) $('onlyWithPRs').checked=p.get('only')==='1';
    if(p.get('q')) $('filter').value=p.get('q');
    if(p.get('min')) $('fMin').value=p.get('min');
    const SORTERS=APP.state.SORTERS;
    if(p.get('sort')&&SORTERS[p.get('sort')]) APP.state.sortKey=p.get('sort');
    if(p.get('dir')) APP.state.sortDir=p.get('dir')==='asc'?1:-1;
    return { hasUser:!!p.get('u'), lang:p.get('lang')||'', own:p.get('own')||'' };
  }
  function tokenStorage(){ return $('tokenStore').value; }
  function downloadBlob(content,type,name){ const blob=new Blob([content],{type}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=name; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(a.href); }
  return { $, sleep, esc, cssVar, daysBetween, timeAgo, dayKey, toRGBA, updateRate, rateLimitMsg, headers, affiliations, getUsernames, signature, multiOwner, syncHash, applyHash, tokenStorage, downloadBlob };
})();
