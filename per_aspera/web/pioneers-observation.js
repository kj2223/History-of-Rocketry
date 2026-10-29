/* Ground observations only. No RNG, simulation stepping, or hidden flight parameters. */
window.PioneerObservation=(()=>{
 function surface(canvas){
  const w=canvas.clientWidth,h=canvas.clientHeight,d=devicePixelRatio||1;
  if(canvas.width!==Math.round(w*d)||canvas.height!==Math.round(h*d)){canvas.width=Math.round(w*d);canvas.height=Math.round(h*d)}
  const c=canvas.getContext('2d');c.setTransform(d,0,0,d,0,0);return {c,w,h};
 }
 function label(c,text,x,y,color='#d5ddda',size=12){c.fillStyle=color;c.font=size+'px Segoe UI, sans-serif';c.fillText(text,x,y)}
 function bunker(canvas,optical,vehicle,elapsed,zoom=2){
  const {c,w,h}=surface(canvas),left=22,right=w-22,top=42,bottom=h-48;
  c.fillStyle='#393a36';c.fillRect(0,0,w,h);
  const sky=c.createLinearGradient(0,top,0,bottom);sky.addColorStop(0,'#a4bdc6');sky.addColorStop(1,'#e3ddd0');
  c.save();c.beginPath();c.rect(left,top,right-left,bottom-top);c.clip();c.fillStyle=sky;c.fillRect(left,top,right-left,bottom-top);
  const scale=(bottom-top)/(40/zoom),horizon=bottom-22,padX=w*.45;
  c.fillStyle='#908a7c';c.beginPath();c.moveTo(left,horizon);for(let i=0;i<=12;i++)c.lineTo(left+(right-left)*i/12,horizon-9-Math.sin(i*2.7)*7);c.lineTo(right,bottom);c.lineTo(left,bottom);c.fill();
  c.fillStyle='#c2ad89';c.fillRect(left,horizon,right-left,bottom-horizon);
  const distance=optical?.observer_distance_m||152,tower=Math.atan2(31,distance)*180/Math.PI*scale,tw=Math.max(9,tower*.1);
  c.strokeStyle='#6b6a61';c.lineWidth=2;c.strokeRect(padX-tw-6,horizon-tower,tw,tower);
  for(let y=horizon-tower;y<horizon;y+=12){c.beginPath();c.moveTo(padX-tw-6,y);c.lineTo(padX-6,y+12);c.stroke()}
  const visible=optical?.visible??!!vehicle,elev=optical?.elevation_deg||0,y=horizon-elev*scale;
  if(elapsed>=5&&elapsed<70){
   for(let i=0;i<8;i++){const age=Math.max(0,elapsed-5-i),r=Math.min(22,3+age*.5);c.fillStyle='rgba(215,204,177,'+Math.max(0,.25-age*.003)+')';c.beginPath();c.ellipse(padX+age*.6-i*3,horizon-i*1.5,r*1.5,r,0,0,7);c.fill()}
  }
  if(visible){
   const size=optical?Math.max(1.5,optical.angular_size_deg*scale):Math.atan2(vehicle==='bumper'?18:vehicle==='booster'?3:5,distance)*180/Math.PI*scale;
   const width=Math.max(1,size*(vehicle==='bumper'&&!optical?.separated? .13:.09));
   c.fillStyle='#eae5d5';c.fillRect(padX-width/2,y-size,width,size);c.beginPath();c.moveTo(padX-width/2,y-size);c.lineTo(padX,y-size-width);c.lineTo(padX+width/2,y-size);c.fill();
   c.fillStyle='#373b3a';c.fillRect(padX-width/2,y-size*.4,width,Math.max(1,size*.13));
   if(optical?.burning){c.fillStyle='#ffe2a0';c.beginPath();c.moveTo(padX-width,y);c.lineTo(padX,y+Math.max(5,size*.8));c.lineTo(padX+width,y);c.fill()}
  }
  c.restore();c.strokeStyle='#161d1d';c.lineWidth=8;c.strokeRect(left,top,right-left,bottom-top);
  label(c,'LAUNCH BUNKER · '+distance+' m SIGHTLINE',18,24);
  const outside=visible&&(y<top||y>bottom);
  label(c,outside?'Rocket above the observation slit — follow the radar record':optical?.status||'Launcher awaiting a prepared vehicle',18,h-17,outside?'#efd49b':'#d5ddda');
 }
 function radar(canvas,radar,elapsed){
  const {c,w,h}=surface(canvas),x0=48,y0=h-36,pw=w-70,ph=h-80,coverage=radar?.coverage_km||80;
  c.fillStyle='#0a1916';c.fillRect(0,0,w,h);c.strokeStyle='#244337';c.lineWidth=1;
  for(let i=0;i<=4;i++){const x=x0+pw*i/4,y=y0-ph*i/4;c.beginPath();c.moveTo(x,y0);c.lineTo(x,y0-ph);c.moveTo(x0,y);c.lineTo(x0+pw,y);c.stroke();label(c,String(Math.round(coverage*i/4)),x-8,y0+18,'#a0b2a2',10);label(c,String(Math.round(90*i/4))+'°',8,y+3,'#a0b2a2',10)}
  label(c,'RANGE STATION · MEASURED FIXES',16,21,'#b9d6b8');
  label(c,'Slant range km →',x0+pw*.55,h-5,'#a0b2a2',10);
  const points=radar?.samples||[];c.strokeStyle='#95c892';c.lineWidth=1.5;c.beginPath();
  points.forEach((p,i)=>{const x=x0+p.range_km/coverage*pw,y=y0-p.elevation_deg/90*ph;i&&p.elapsed-points[i-1].elapsed<=radar.sample_interval?c.lineTo(x,y):c.moveTo(x,y)});c.stroke();
  const last=radar?.last_fix;
  if(last){const x=x0+last.range_km/coverage*pw,y=y0-last.elevation_deg/90*ph;c.strokeStyle=radar.locked?'#cce6a0':'#e1b86c';c.beginPath();c.arc(x,y,4,0,7);c.stroke();label(c,radar.locked?'LIVE TRACK':'LAST FIX · '+Math.floor(radar.age_seconds)+' s OLD',x0+4,47,radar.locked?'#cce6a0':'#e1b86c',11)}
  else label(c,'SEARCHING — NO VALID RETURN',x0+15,y0-ph*.45,'#a0b2a2',12);
 }
 return {bunker,radar};
})();
