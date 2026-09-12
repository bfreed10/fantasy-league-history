function renderOdds(){
  setHeader('LFL Odds','Hypothetical fantasy football lines, futures and fun markets. No real money.');
  $('#content').innerHTML=`
    <div class="hero">
      <span class="section-eyebrow">LFL SPORTSBOOK</span>
      <h2>Who is actually going to win this thing?</h2>
      <p>Hypothetical odds based on current ESPN league data. <strong>No real money.</strong></p>
    </div>
    <div id="oddsStatus" class="card section-gap">Loading hypothetical odds…</div>
    <div id="oddsBoard" class="section-gap"></div>
  `;

  fetch('/api/odds')
    .then(r=>r.json())
    .then(d=>{
      if(d.error) throw new Error(d.error);
      const teams=d.teams||[];
      $('#oddsStatus').innerHTML=`<div class="card-heading-row"><div><span class="section-eyebrow">${d.season} FUTURES</span><h2>Championship &amp; Playoff Odds</h2></div><span class="muted">Model estimates</span></div>`;
      $('#oddsBoard').innerHTML=`
        <div class="card">
          <div class="table-wrap"><table>
            <thead><tr><th>Team</th><th>Record</th><th>Make Playoffs</th><th>Win Championship</th></tr></thead>
            <tbody>${teams.map(t=>`
              <tr>
                <td><strong>${esc(t.name)}</strong></td>
                <td>${t.wins}-${t.losses}</td>
                <td><strong>${Math.round(t.playoffProbability*100)}%</strong> <span class="muted">(${t.playoffOdds>0?'+':''}${t.playoffOdds})</span></td>
                <td><strong>${Math.round(t.championshipProbability*100)}%</strong> <span class="muted">(${t.championshipOdds>0?'+':''}${t.championshipOdds})</span></td>
              </tr>`).join('')}</tbody>
          </table></div>
        </div>
        <div class="card section-gap">
          <span class="section-eyebrow">COMING NEXT</span>
          <h2>Weekly Lines + Fun Futures</h2>
          <p class="muted">Weekly spreads, moneylines, over/unders, highest scorer, biggest blowout, last-place odds, first to clinch and more.</p>
        </div>
      `;
      setStatus('Hypothetical odds loaded','good');
    })
    .catch(err=>{
      $('#oddsStatus').innerHTML=`<strong>Could not load odds.</strong><p class="muted">${esc(err.message)}</p>`;
      setStatus('Odds unavailable','bad');
    });
}

pages.odds=renderOdds;
