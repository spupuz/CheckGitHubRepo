(function(){ var vt=document.getElementById('versionTag'); var fallback=window.APP.config.VERSION;
  if(location.protocol==='file:'){ vt.textContent=fallback; return; }
  fetch('VERSION').then(function(r){ return r.ok?r.text():''; }).then(function(v){ vt.textContent=((v||'').trim())||fallback; }).catch(function(){ vt.textContent=fallback; });
})();

window.GleanBridge && window.GleanBridge.postMessage({ actionId:'export-pdf', type:'glean-add-menu', metadata:{ label:'Export as PDF', icon:'export' }});
window.GleanBridge && window.GleanBridge.onMessage('action', function(data){ if(data.actionId==='export-pdf') window.print(); });
function prepareChartsForPrint(){ try{ document.querySelectorAll('[_echarts_instance_]').forEach(function(el){ var c=echarts.getInstanceByDom(el); if(!c) return; var img=new Image(); img.src=c.getDataURL({type:'png',pixelRatio:2}); img.className='print-chart-img'; img.style.cssText='width:100%;height:100%;object-fit:contain;position:absolute;top:0;left:0;z-index:10;'; el.dataset.prevPosition=el.style.position; el.style.position='relative'; el.appendChild(img); }); }catch(e){} }
function cleanUpAfterPrint(){ document.querySelectorAll('[_echarts_instance_]').forEach(function(el){ var img=el.querySelector('.print-chart-img'); if(!img) return; img.remove(); el.style.position=el.dataset.prevPosition||''; delete el.dataset.prevPosition; }); }
window.addEventListener('beforeprint', prepareChartsForPrint);
window.addEventListener('afterprint', cleanUpAfterPrint);
