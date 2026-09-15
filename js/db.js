window.APP = window.APP || {};
APP.db = (function(){
  const { $, daysBetween } = APP.utils;
  const cfg = APP.config;
  let db=null, dbReady=false, dbDirHandle=null;
  let dbReadyPromise=null, dbReadyResolve=null;

  function idbOpen(){
    return new Promise((resolve,reject)=>{
      const req=indexedDB.open(cfg.IDB_NAME,1);
      req.onupgradeneeded=()=>{ if(!req.result.objectStoreNames.contains('kv')) req.result.createObjectStore('kv'); };
      req.onsuccess=()=>resolve(req.result);
      req.onerror=()=>reject(req.error);
    });
  }
  async function idbGet(key){
    try{ const d=await idbOpen();
      return await new Promise((resolve,reject)=>{ const r=d.transaction('kv','readonly').objectStore('kv').get(key); r.onsuccess=()=>resolve(r.result); r.onerror=()=>reject(r.error); });
    }catch(e){ return null; }
  }
  async function idbSet(key,val){
    try{ const d=await idbOpen();
      await new Promise((resolve,reject)=>{ const r=d.transaction('kv','readwrite').objectStore('kv').put(val,key); r.onsuccess=()=>resolve(); r.onerror=()=>reject(r.error); });
    }catch(e){}
  }
  function getDb(){ return db; }
  function isDbReady(){ return dbReady; }
  function getDbDirHandle(){ return dbDirHandle; }

  function loadDBFromBytes(bytes){
    if(bytes.length<100) return false;
    const oldDb=db;
    db=new SQL.Database(bytes);
    try{oldDb.close();}catch(e){}
    db.run(`CREATE TABLE IF NOT EXISTS scans(id INTEGER PRIMARY KEY AUTOINCREMENT,timestamp TEXT NOT NULL,accounts TEXT,method TEXT,total_repos INTEGER,total_prs INTEGER);
      CREATE TABLE IF NOT EXISTS repos(id INTEGER PRIMARY KEY AUTOINCREMENT,scan_id INTEGER,owner TEXT,name TEXT,full_name TEXT,url TEXT,stars INTEGER,language TEXT,is_fork INTEGER,is_archived INTEGER,is_private INTEGER,open_prs INTEGER,draft_prs INTEGER,no_reviewer INTEGER,stale_prs INTEGER,oldest_pr_days INTEGER,open_issues INTEGER,updated_at TEXT);
      CREATE TABLE IF NOT EXISTS authors(id INTEGER PRIMARY KEY AUTOINCREMENT,scan_id INTEGER,author TEXT,pr_count INTEGER);
      CREATE TABLE IF NOT EXISTS labels(id INTEGER PRIMARY KEY AUTOINCREMENT,scan_id INTEGER,label TEXT,pr_count INTEGER);
      CREATE INDEX IF NOT EXISTS idx_repos_scan ON repos(scan_id);
      CREATE INDEX IF NOT EXISTS idx_authors_scan ON authors(scan_id);
      CREATE INDEX IF NOT EXISTS idx_repos_full_name ON repos(full_name);
      CREATE INDEX IF NOT EXISTS idx_scans_timestamp ON scans(timestamp);`);
    return true;
  }

  function initDB(){
    if(typeof initSqlJs==='undefined'){ $('pickFolder').disabled=true; return Promise.resolve(); }
    dbReadyPromise = new Promise((resolve) => { dbReadyResolve = resolve; });
    initSqlJs({locateFile:file=>cfg.DB_LIB+file}).then(SQL=>{
      db=new SQL.Database();
      db.run(`
        CREATE TABLE IF NOT EXISTS scans(
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          timestamp TEXT NOT NULL,
          accounts TEXT, method TEXT,
          total_repos INTEGER, total_prs INTEGER
        );
        CREATE TABLE IF NOT EXISTS repos(
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          scan_id INTEGER, owner TEXT, name TEXT, full_name TEXT, url TEXT,
          stars INTEGER, language TEXT, is_fork INTEGER, is_archived INTEGER, is_private INTEGER,
          open_prs INTEGER, draft_prs INTEGER, no_reviewer INTEGER, stale_prs INTEGER,
          oldest_pr_days INTEGER, open_issues INTEGER, updated_at TEXT
        );
        CREATE TABLE IF NOT EXISTS authors(
          id INTEGER PRIMARY KEY AUTOINCREMENT, scan_id INTEGER, author TEXT, pr_count INTEGER
        );
        CREATE TABLE IF NOT EXISTS labels(
          id INTEGER PRIMARY KEY AUTOINCREMENT, scan_id INTEGER, label TEXT, pr_count INTEGER
        );
        CREATE INDEX IF NOT EXISTS idx_repos_scan ON repos(scan_id);
        CREATE INDEX IF NOT EXISTS idx_authors_scan ON authors(scan_id);
        CREATE INDEX IF NOT EXISTS idx_repos_full_name ON repos(full_name);
        CREATE INDEX IF NOT EXISTS idx_scans_timestamp ON scans(timestamp);
      `);
      const finish=()=>{
        dbReady=true;
        if(dbReadyResolve) dbReadyResolve();
      };
      Promise.all([idbGet('dbData'), idbGet('dirHandle')]).then(async ([blob,h])=>{
        if(h) dbDirHandle=h;
        bindAutoSave();
        let loaded=false;
        if(blob){
          try{ loaded=loadDBFromBytes(new Uint8Array(blob)); }catch(e){}
        }
        if(!loaded&&dbDirHandle){
          try{
            const fh=await dbDirHandle.getFileHandle(cfg.DB_FILE);
            const file=await fh.getFile();
            const buf=await file.arrayBuffer();
            if(buf.byteLength>=100) loaded=loadDBFromBytes(new Uint8Array(buf));
          }catch(e){}
        }
        if(loaded){
          renderDBStats();
          APP.charts.renderHistoryCharts();
        }
        finish();
      });
    }).catch(()=>{ $('pickFolder').disabled=true; if(dbReadyResolve) dbReadyResolve(); });
    return dbReadyPromise;
  }

  function dbSet(){
    const sc=db.exec('SELECT last_insert_rowid()')[0];
    return sc&&sc.values.length?sc.values[0][0]:null;
  }

  function saveToDB(){
    const state=APP.state;
    if(!dbReady||!db) return;
    try{
      const accounts=APP.utils.getUsernames().join(',');
      const totalRepos=state.repos.length;
      const totalPRs=state.repos.reduce((s,r)=>s+(r.openPRs||0),0);
      db.run('INSERT INTO scans(timestamp,accounts,method,total_repos,total_prs) VALUES(?,?,?,?,?)',[new Date().toISOString(),accounts,state.usedMethod,totalRepos,totalPRs]);
      const scanId=dbSet();
      const stmt=db.prepare('INSERT INTO repos(scan_id,owner,name,full_name,url,stars,language,is_fork,is_archived,is_private,open_prs,draft_prs,no_reviewer,stale_prs,oldest_pr_days,open_issues,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
      state.repos.forEach(r=>{
        const old=daysBetween(r.oldestPRDate);
        stmt.run([scanId,r.owner,r.name,r.fullName,r.url,r.stars||0,r.language||null,r.fork?1:0,r.archived?1:0,r.private?1:0,
          r.openPRs,r.draftPRs,r.noReviewer,r.stalePRs,old==null?null:old,r.openIssues,r.updatedRaw||null]);
      });
      stmt.free();
      const sa=db.prepare('INSERT INTO authors(scan_id,author,pr_count) VALUES(?,?,?)');
      Object.entries(state.authorCounts).forEach(([a,c])=>sa.run([scanId,a,c])); sa.free();
      const sl=db.prepare('INSERT INTO labels(scan_id,label,pr_count) VALUES(?,?,?)');
      Object.entries(state.labelCounts).forEach(([l,c])=>sl.run([scanId,l,c])); sl.free();
      $('dbPanel').style.display='block';
      renderDBStats();
      persistToIDB();
    }catch(e){}
  }
  function persistToIDB(){
    if(!db) return;
    try{ idbSet('dbData',db.export()); }catch(e){}
  }

  async function ensureDirPermission(){
    if(!dbDirHandle) return false;
    let perm;
    try{ perm=await dbDirHandle.queryPermission({mode:'readwrite'}); }
    catch(e){ return false; }
    if(perm==='prompt'){ try{ perm=await dbDirHandle.requestPermission({mode:'readwrite'}); }catch(e){ return false; } }
    return perm==='granted';
  }
  async function saveDBToFolder(){
    if(!dbReady||!db||!dbDirHandle) return false;
    if(!await ensureDirPermission()){ bindAutoSave(); return false; }
    try{
      const fh=await dbDirHandle.getFileHandle(cfg.DB_FILE,{create:true});
      const w=await fh.createWritable();
      await w.write(db.export());
      await w.close();
      return true;
    }catch(e){ return false; }
  }
  async function pickDBFolder(){
    if(!window.showDirectoryPicker){ APP.ui.setStatus('Your browser does not support the File System Access API. Data is still saved in the browser (IndexedDB).','warn'); return; }
    try{
      const handle=await window.showDirectoryPicker({id:'ghprdb',mode:'readwrite'});
      dbDirHandle=handle;
      await idbSet('dirHandle',dbDirHandle);
      bindAutoSave();
      let loaded=false;
      try{
        const fh=await dbDirHandle.getFileHandle(cfg.DB_FILE);
        const file=await fh.getFile();
        const buf=await file.arrayBuffer();
        const bytes=new Uint8Array(buf);
        if(loadDBFromBytes(bytes)){
          loaded=true;
          persistToIDB();
          $('dbPanel').style.display='block';
          renderDBStats();
          APP.charts.renderHistoryCharts();
        }
      }catch(e){}
      if(!loaded){
        const ok=await saveDBToFolder();
        APP.ui.setStatus(ok?`Database saved to "${dbDirHandle.name}".`:'Folder selected — the database will be saved on the next scan.', ok?'':'');
      } else {
        const n=db.exec('SELECT COUNT(*) FROM scans');
        const count=n&&n.length&&n[0].values.length?n[0].values[0][0]:0;
        APP.ui.setStatus(`Database loaded from "${dbDirHandle.name}" (${count} scan${count===1?'':'s'} found).`);
      }
    }catch(e){}
  }
  function bindAutoSave(){
    $('pickFolder').textContent=(dbDirHandle?'Change folder':'DB folder');
    if(dbDirHandle) $('pickFolder').classList.add('bound');
    else $('pickFolder').classList.remove('bound');
    updateDbBanner();
  }
  function updateDbBanner(){
    const b=$('dbBanner');
    if(!b) return;
    const show=!dbDirHandle;
    const ov=$('dbModalOverlay');
    b.style.display=show?'block':'none';
    if(ov) ov.style.display=show?'flex':'none';
    if(show){
      const n=db?(function(){ try{ const r=db.exec('SELECT COUNT(*) FROM scans'); return r&&r.length&&r[0].values.length?r[0].values[0][0]:0; }catch(e){ return 0; } })():0;
      const txt=(n?('The database contains '+n+' scan'+(n===1?'':'s')+' — stored only in this browser. '):'')+'Choose a folder (for example, the one containing this file) so the SQLite database is created and kept on disk automatically after each scan.';
      $('dbBannerText').textContent=txt;
      if($('dbModalText')) $('dbModalText').textContent=txt;
    }
  }
  function renderDBStats(){
    if(!db) return;
    try{
      const r1=db.exec('SELECT COUNT(*) FROM scans');
      const n= r1&&r1.length&&r1[0].values.length?r1[0].values[0][0]:0;
      const r2=db.exec('SELECT total_prs,total_repos,timestamp FROM scans ORDER BY id DESC LIMIT 1');
      const latest=r2&&r2.length&&r2[0].values.length?r2[0].values[0]:null;
      const r3=db.exec('SELECT AVG(total_prs) FROM scans');
      const avg=r3&&r3.length&&r3[0].values.length?Math.round(r3[0].values[0][0]*10)/10:null;
      let delta='—';
      if(n>=2){
        const r4=db.exec('SELECT total_prs FROM scans ORDER BY id DESC LIMIT 1 OFFSET 1');
        const prev=r4&&r4.length&&r4[0].values.length?r4[0].values[0][0]:null;
        if(prev!=null&&latest!=null){ const d=latest[0]-prev; delta=(d>0?'+':'')+d; }
      }
      $('dbScans').textContent=n;
      $('dbLatestPRs').textContent=latest!=null?latest[0]:'—';
      $('dbAvgPRs').textContent=avg!=null?avg:'—';
      $('dbDelta').textContent=delta;
      $('dbInfo').textContent=(n?('Last scan: '+new Date(latest?latest[2]:null).toLocaleString('en-US')+' · '):'')+
        'DB auto-persisted in browser (IndexedDB).'+(dbDirHandle?' Folder auto-save active.':' Click "DB folder" to also save as a .sqlite file.');
      if($('dbLocation')) $('dbLocation').textContent = dbDirHandle ? 'DB file: '+dbDirHandle.name+'/'+cfg.DB_FILE : 'DB stored in: browser (IndexedDB — no folder selected yet).';
    }catch(e){}
  }

  return { initDB, getDb, isDbReady, getDbDirHandle, saveToDB, saveDBToFolder, pickDBFolder, renderDBStats, idbGet, idbSet };
})();
