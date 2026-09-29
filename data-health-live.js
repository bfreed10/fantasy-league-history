(function(){
  const base=pages.data;
  async function read(url){const r=await fetch(url,{cache:'no-store'});const d=await r.json();if(!r.ok)throw Error(d.error||`HTTP ${r.status}`);return d;}
  pages.data=function(){
    base();
    const root=document.createElement('section');root.className='card section-gap';
    const audited=window.LFLInjuryAudit?.rows()||[];
    root.innerHTML=`<h2>Freshness & Coverage</h2><p class="muted">Injury archive: ${audited.length} player-seasons • ${audited.filter(r=>r.TailExtended).length} reserve tails repaired • ${audited.filter(r=>r.UnverifiedTail).length} truncated windows still unverified. Reconstructed absences remain labeled; unavailable evidence is not treated as healthy.</p><div id="liveHealthStatus">Checking live sources…</div>`;
    document.querySelector('#content').prepend(root);
    Promise.allSettled([read('/api/draft-performance'),read('/api/trade-values')]).then(([draft,trade])=>{
      if(!root.isConnected)return;
      root.querySelector('#liveHealthStatus').innerHTML=`${draft.status==='fulfilled'?`<h3>Current Draft History</h3><p>Updated ${esc(draft.value.updatedAt)} • ${draft.value.historyCoverage?.completedWeeks||0} completed weeks • ${draft.value.historyCoverage?.playerWeeks||0}/${draft.value.historyCoverage?.possiblePlayerWeeks||0} player-weeks recovered directly from ESPN player history.</p><p class="muted">Box-score fallback can add coverage. ${esc((draft.value.historyWarnings||[]).join(' '))}</p>`:`<p class="warn">Draft history unavailable: ${esc(draft.reason.message)}</p>`}
      ${trade.status==='fulfilled'?`<h3>Trade Valuation Sources</h3><p class="muted">Updated ${esc(trade.value.updatedAt)}</p>${table(['Source','Projection status','Metadata','Players'],trade.value.sourceStatus.map(s=>`<tr><td>${esc(s.source)}</td><td>${esc(s.status)}</td><td>${esc(s.metadata||'—')}</td><td>${s.players}</td></tr>`))}`:`<p class="warn">Trade sources unavailable: ${esc(trade.reason.message)}</p>`}`;
    });
  };
})();
