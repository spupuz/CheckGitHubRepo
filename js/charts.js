window.APP = window.APP || {};
APP.charts = (function(){
  const { $, cssVar, dayKey, toRGBA } = APP.utils;
  let chartTop=null, chartDist=null, chartHistTotal=null, chartHistRepos=null;

  function resizeAll(){
    if(chartTop) chartTop.resize();
    if(chartDist) chartDist.resize();
    if(chartHistTotal) chartHistTotal.resize();
    if(chartHistRepos) chartHistRepos.resize();
  }

  function renderCharts(){
    if(typeof echarts==='undefined') return;
    const repos=APP.state.repos;
    const counted=repos.filter(r=>r.openPRs>0);
    if(!counted.length){ $('chartsPanel').classList.remove('on'); return; }
    $('chartsPanel').classList.add('on');
    const accent=cssVar('--artifact-accent')||'#1f6feb';
    const muted=cssVar('--artifact-text-muted')||'#5b6470';
    const axis={ axisLabel:{color:muted,fontSize:11}, axisLine:{lineStyle:{color:muted}} };
    if(!chartTop) chartTop=echarts.init($('chartTop'),null,{renderer:'svg'});
    if(!chartDist) chartDist=echarts.init($('chartDist'),null,{renderer:'svg'});
    const multiOwner=APP.utils.multiOwner;
    const top=counted.slice().sort((a,b)=>b.openPRs-a.openPRs).slice(0,10).reverse();
    chartTop.setOption({
      grid:{left:8,right:24,top:10,bottom:10,containLabel:true},
      tooltip:{trigger:'axis',axisPointer:{type:'shadow'}},
      xAxis:Object.assign({type:'value'},axis),
      yAxis:Object.assign({type:'category',data:top.map(r=>multiOwner()?r.fullName:r.name)},axis),
      series:[{type:'bar',data:top.map(r=>r.openPRs),itemStyle:{color:accent,borderRadius:[0,4,4,0]},barMaxWidth:18,label:{show:true,position:'right',color:muted,fontSize:11}}]
    });
    const buckets={'0':0,'1-2':0,'3-5':0,'6-10':0,'10+':0};
    repos.filter(r=>r.openPRs!=null).forEach(r=>{ const n=r.openPRs; if(n===0)buckets['0']++; else if(n<=2)buckets['1-2']++; else if(n<=5)buckets['3-5']++; else if(n<=10)buckets['6-10']++; else buckets['10+']++; });
    chartDist.setOption({
      grid:{left:8,right:16,top:10,bottom:10,containLabel:true},
      tooltip:{trigger:'axis',axisPointer:{type:'shadow'}},
      xAxis:Object.assign({type:'category',data:Object.keys(buckets)},axis),
      yAxis:Object.assign({type:'value'},axis),
      series:[{type:'bar',data:Object.values(buckets),itemStyle:{color:accent,borderRadius:[4,4,0,0]},barMaxWidth:36,label:{show:true,position:'top',color:muted,fontSize:11}}]
    });
  }

  function renderHistoryCharts(){
    const db=APP.db.getDb();
    if(typeof echarts==='undefined'||!db) return;
    try{
      const r1=db.exec('SELECT COUNT(*) FROM scans');
      const scanCount=r1&&r1.length&&r1[0].values.length?r1[0].values[0][0]:0;
      if(scanCount<1){ $('historyChartsPanel').classList.remove('on'); return; }
      $('historyChartsPanel').classList.add('on');
      const accent=cssVar('--artifact-accent')||'#1f6feb';
      const muted=cssVar('--artifact-text-muted')||'#5b6470';
      const warn=cssVar('--artifact-warn')||'#9a6700';
      const danger=cssVar('--artifact-danger')||'#cf222e';
      const axis={ axisLabel:{color:muted,fontSize:10}, axisLine:{lineStyle:{color:muted}} };
      const now=new Date();
      const days=[];
      for(let i=29;i>=0;i--){ const d=new Date(now); d.setDate(now.getDate()-i); days.push({key:dayKey(d),label:d.toLocaleDateString('en-US',{day:'2-digit',month:'2-digit'})}); }
      const r2=db.exec('SELECT timestamp, total_prs FROM scans ORDER BY id ASC');
      if(!r2||!r2.length||!r2[0].values.length){ $('historyChartsPanel').classList.remove('on'); return; }
      const scans=r2[0].values.map(v=>({ts:v[0],total:v[1]}));
      const totalByDay={};
      scans.forEach(s=>{ const k=dayKey(new Date(s.ts)); totalByDay[k]=s.total; });
      const totalSeries=days.map(d=>totalByDay[d.key]!=null?totalByDay[d.key]:null);
      const hasData=totalSeries.some(v=>v!=null);
      if(!hasData){ $('historyChartsPanel').classList.remove('on'); return; }
      const labels=days.map(d=>d.label);

      requestAnimationFrame(()=>{
        if(!chartHistTotal) chartHistTotal=echarts.init($('chartHistoryTotal'),null,{renderer:'svg'});
        chartHistTotal.setOption({
          grid:{left:8,right:24,top:20,bottom:24,containLabel:true},
          tooltip:{trigger:'axis',axisPointer:{type:'cross'}},
          xAxis:Object.assign({type:'category',data:labels,boundaryGap:false},axis),
          yAxis:Object.assign({type:'value',minInterval:1},axis),
          series:[{type:'line',data:totalSeries,smooth:false,connectNulls:true,symbol:'circle',symbolSize:6,lineStyle:{color:accent,width:2.5},itemStyle:{color:accent},areaStyle:{color:{type:'linear',x:0,y:0,x2:0,y2:1,colorStops:[{offset:0,color:toRGBA(accent,0.25)},{offset:1,color:toRGBA(accent,0.02)}]}},label:{show:true,position:'top',color:muted,fontSize:10}}]
        });
      });

      const r3=db.exec('SELECT r.full_name, SUM(r.open_prs) as total_prs FROM repos r JOIN scans s ON r.scan_id=s.id WHERE s.timestamp >= ? GROUP BY r.full_name ORDER BY total_prs DESC LIMIT 5',[dayKey(new Date(now.getTime()-29*86400000))]);
      const topRepoNames=r3&&r3.length?r3[0].values.map(v=>v[0]):[];
      const repoColors=[accent,warn,danger,'#8b5cf6','#06b6d4'];
      const repoSeries=topRepoNames.map((repoName,idx)=>{
        const r4=db.exec('SELECT s.timestamp, r.open_prs FROM repos r JOIN scans s ON r.scan_id=s.id WHERE r.full_name=? ORDER BY s.id ASC',[repoName]);
        const repoByDay={};
        r4[0].values.forEach(v=>{ repoByDay[dayKey(new Date(v[0]))]=v[1]; });
        const data=days.map(d=>repoByDay[d.key]!=null?repoByDay[d.key]:null);
        return {name:repoName,type:'line',smooth:false,connectNulls:true,symbol:'circle',symbolSize:5,lineStyle:{color:repoColors[idx%repoColors.length],width:2},itemStyle:{color:repoColors[idx%repoColors.length]},data};
      });

      requestAnimationFrame(()=>{
        if(!chartHistRepos) chartHistRepos=echarts.init($('chartHistoryRepos'),null,{renderer:'svg'});
        chartHistRepos.setOption({
          grid:{left:8,right:24,top:26,bottom:24,containLabel:true},
          tooltip:{trigger:'axis',axisPointer:{type:'cross'}},
          legend:{textStyle:{color:muted,fontSize:11},top:0,itemWidth:14,itemHeight:8,type:'scroll'},
          xAxis:Object.assign({type:'category',data:labels,boundaryGap:false},axis),
          yAxis:Object.assign({type:'value',minInterval:1},axis),
          series:repoSeries
        });
      });
    }catch(e){ $('historyChartsPanel').classList.remove('on'); }
  }

  return { renderCharts, renderHistoryCharts, resizeAll };
})();
