(function(){
  function addOddsNav(){
    const nav=document.querySelector('#nav');
    if(!nav || typeof pages==='undefined' || !pages.odds) return;
    if(nav.querySelector('[data-page="odds"]')) return;

    const sections=nav.querySelectorAll('.lfl-nav-section');
    const home=[...sections].find(s=>s.querySelector('.lfl-nav-label')?.textContent.trim()==='HOME');
    const target=home?.querySelector('.lfl-nav-items') || nav;

    const button=document.createElement('button');
    button.type='button';
    button.dataset.page='odds';
    button.innerHTML='<span class="lfl-nav-icon">$</span><span>LFL Odds</span>';
    button.addEventListener('click',()=>navigate('odds'));
    target.appendChild(button);
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',addOddsNav);
  else addOddsNav();
  setTimeout(addOddsNav,300);
})();
