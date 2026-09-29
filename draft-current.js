// Completed-week draft performance, using league-scored ESPN roster history.
(function () {
  const num = v => v == null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v);
  const safe = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function summarize(live, boxes) {
    const weeks = [...new Set((live.completedMatchups || []).map(g => Number(g.week)))].sort((a,b)=>a-b);
    const history = new Map();
    for (const box of boxes) {
      if (!weeks.includes(Number(box.selectedWeek))) continue;
      for (const game of box.matchups || []) for (const side of [game.boxscore?.home, game.boxscore?.away]) {
        for (const p of side?.players || []) {
          if (p.playerId == null) continue;
          const id = String(p.playerId);
          if (!history.has(id)) history.set(id, new Map());
          const prior=history.get(id).get(Number(box.selectedWeek));
          history.get(id).set(Number(box.selectedWeek), {...prior,...p,
            projectedPoints:num(p.projectedPoints) ?? num(prior?.projectedPoints)});
        }
      }
    }
    const current = new Map((live.rosters || []).flatMap(t => (t.players || []).map(p => [String(p.playerId),p])));
    return (live.draftPicks || []).map(pick => {
      const rows = [...(history.get(String(pick.playerId)) || new Map()).values()];
      const actualRows = rows.filter(p=>num(p.points)!=null);
      const paired = actualRows.filter(p=>num(p.projectedPoints)!=null);
      const actual = actualRows.length ? actualRows.reduce((s,p)=>s+num(p.points),0) : null;
      const expected = paired.length ? paired.reduce((s,p)=>s+num(p.projectedPoints),0) : null;
      const pairedActual = paired.length ? paired.reduce((s,p)=>s+num(p.points),0) : null;
      const now = current.get(String(pick.playerId));
      const status = now?.injuryStatus || 'Unavailable';
      // Zero-output weeks may reflect injury or a bye. Do not call them healthy busts.
      const verifiedOpportunity = weeks.length >= 4 && paired.length === weeks.length &&
        paired.every(p=>num(p.projectedPoints)>0 && num(p.points)>0) && now && now.slot !== 'IR' &&
        ['ACTIVE','NORMAL','HEALTHY'].includes(String(status).toUpperCase());
      const delta = expected == null ? null : pairedActual - expected;
      const bust = verifiedOpportunity && expected > 0 && delta <= -35 && pairedActual <= expected*.75;
      return {...pick,position:now?.position || rows[0]?.position || '',status,actual,expected,pairedActual,delta,
        observed:actualRows.length,paired:paired.length,totalWeeks:weeks.length,bust,
        steal:weeks.length>0 && paired.length===weeks.length && expected>0 && delta>=35 && pairedActual>=expected*1.25};
    });
  }
  async function json(url) {
    const response = await fetch(url,{cache:'no-store'});
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
    return data;
  }
  window.LFLCurrentDraft = {summarize};
  window.renderCurrentDraft = async function () {
    const content = document.querySelector('#content');
    if (!content || document.querySelector('#currentDraftPerformance')) return;
    const root = document.createElement('section');
    root.id = 'currentDraftPerformance';root.className = 'card section-gap';
    root.innerHTML = '<h2>Current-Season Draft Performance</h2><p class="muted">Loading completed-week ESPN results…</p>';
    content.prepend(root);
    try {
      const live = await json('/api/draft-performance').catch(()=>json('/api/live'));
      const weeks = [...new Set((live.completedMatchups || []).map(g=>Number(g.week)))].sort((a,b)=>a-b);
      const boxes = [], failed = [];
      // Limit concurrent ESPN requests and retain coverage when one week fails.
      for (let start=0;start<weeks.length;start+=3) {
        const group = weeks.slice(start,start+3);
        const results = await Promise.allSettled(group.map(week=>json(`/api/boxscore?season=${live.season}&week=${week}`)));
        results.forEach((r,i)=>r.status==='fulfilled'?boxes.push(r.value):failed.push(group[i]));
      }
      if (!root.isConnected) return;
      boxes.push(...(live.playerHistoryBoxes || []));
      const rows = summarize(live,boxes);
      const fmt = v => num(v)==null?'—':Number(v).toFixed(1);
      const cells = list => list.map(p=>`<tr><td>#${safe(p.overallPick)}</td><td>${safe(p.player)}<br><small>${safe(p.position)}</small></td><td>${safe(p.team)}</td><td>${fmt(p.actual)}</td><td>${fmt(p.expected)}</td><td>${fmt(p.pairedActual)}</td><td class="${p.delta<0?'bad':'good'}">${p.delta>0?'+':''}${fmt(p.delta)}</td><td>${p.observed}/${p.totalWeeks} actual • ${p.paired}/${p.totalWeeks} paired</td><td>${safe(p.status)}</td></tr>`).join('');
      const headings=['Pick','Player','Drafted By','Observed Points','Weekly Expected','Matched Actual','Difference','Week Coverage','Current Injury Status'];
      const grid = list => `<div style="overflow-x:auto"><table><thead><tr>${headings.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${cells(list)}</tbody></table></div>`;
      root.innerHTML=`<span class="section-eyebrow">LIVE ESPN • ${safe(live.season)}</span><h2>Current-Season Draft Performance</h2>
        <p class="muted">Completed weeks: ${weeks.length?weeks.map(w=>`W${w}`).join(', '):'none yet'}. Updated ${safe(live.updatedAt)}. Reload this page for the latest results.</p>
        <p>Difference compares actual points with ESPN weekly projections for the same completed weeks. Includes bench points and points after trades. These are season-to-date results, not full-season grades.</p>
        <p class="muted">ESPN player-history stats fill gaps after players leave league rosters; roster box scores provide fallback coverage. Any remaining missing weeks are never scored as zero. Injury status is current, not a historical injury report.</p>
        ${(live.historyWarnings||[]).length?`<p class="warn">${safe(live.historyWarnings.join(" "))}</p>`:""}
        ${failed.length?`<p class="bad">Could not load W${failed.join(', W')}. Results below are partial.</p>`:''}
        <label>Drafting team <select id="currentDraftTeam"><option value="">All teams</option>${[...new Map(rows.map(p=>[p.teamId,p.team])).entries()].map(([id,name])=>`<option value="${safe(id)}">${safe(name)}</option>`).join('')}</select></label>
        <div id="currentDraftRows">${grid(rows)}</div>
        <h3>Biggest Steals So Far</h3><p class="muted">Any round or position; at least 35 points and 25% above weekly ESPN projections across all completed weeks, with complete paired coverage. Early-season results are provisional; this is not a preseason full-season comparison.</p>
        ${rows.some(p=>p.steal)?grid(rows.filter(p=>p.steal).sort((a,b)=>b.delta-a.delta)):'<p>No players currently clear the completed-week projection and coverage checks.</p>'}
        <h3>Biggest Performance Busts So Far</h3><p class="muted">Requires at least four completed weeks, complete paired coverage, positive output each week, a currently healthy player outside IR, and a shortfall of at least 35 points and 25%. Zero-output weeks and uncertain availability are excluded to avoid labeling injury losses as busts.</p>
        ${rows.some(p=>p.bust)?grid(rows.filter(p=>p.bust).sort((a,b)=>a.delta-b.delta)):'<p>No players currently clear the performance and availability checks.</p>'}`;
      root.querySelector('#currentDraftTeam').addEventListener('change',e=>{
        root.querySelector('#currentDraftRows').innerHTML=grid(rows.filter(p=>!e.target.value||String(p.teamId)===e.target.value));
      });
    } catch(error) {
      if(root.isConnected)root.innerHTML=`<h2>Current-Season Draft Performance</h2><p class="bad">Unable to load current ESPN data: ${safe(error.message)}. Reload to retry.</p>`;
    }
  };
})();
