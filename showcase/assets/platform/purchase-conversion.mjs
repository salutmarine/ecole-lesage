// The mobile purchase action appears only after the main action has left the viewport.
export function setupProductPurchaseBar(root){
  const bar=root.querySelector('[data-purchase-bar]'),main=root.querySelector('[data-purchase-main]');
  const win=root.ownerDocument?.defaultView||globalThis.window;
  if(!bar||!main||!win)return()=>{};
  const media=win.matchMedia?.('(max-width: 800px)');
  let frame=null,disposed=false;
  const update=()=>{
    frame=null;if(disposed)return;
    const rect=main.getBoundingClientRect(),footer=root.ownerDocument.querySelector('.lesage-footer')?.getBoundingClientRect();
    const footerVisible=footer&&footer.top<win.innerHeight&&footer.bottom>0;
    const show=!!media?.matches&&rect.bottom<0&&!footerVisible;
    bar.hidden=!show;root.classList.toggle('has-purchase-bar',show);
  };
  const schedule=()=>{if(frame===null)frame=win.requestAnimationFrame(update);};
  win.addEventListener('scroll',schedule,{passive:true});win.addEventListener('resize',schedule,{passive:true});media?.addEventListener?.('change',schedule);update();
  return()=>{disposed=true;if(frame!==null)win.cancelAnimationFrame(frame);win.removeEventListener('scroll',schedule);win.removeEventListener('resize',schedule);media?.removeEventListener?.('change',schedule);bar.hidden=true;root.classList.remove('has-purchase-bar');};
}
