// The control-room picture on the Launch tab, drawn from the room level, staffed stations and console count.
import { ROOMS, STN } from './data.js';
const s=(f,x='')=>`style="fill:${f};${x}"`;
// A seated figure whose shoulders sit on top edge y.
const person=(x,y)=>`<circle cx="${x}" cy="${y-17}" r="4.5" ${s('var(--dim)')}/><rect x="${x-7}" y="${y-12}" width="14" height="13" rx="4" ${s('var(--dim)')}/>`;
function console_(x,y,lab,on,fly){let o=`<rect x="${x-28}" y="${y}" width="56" height="14" rx="2" ${s('var(--ln)')}/>`;
if(lab)o+=`<text x="${x-24}" y="${y+10}" ${s('var(--bg)','font-size:8px;font-weight:bold;font-family:inherit')}>${lab}</text>`;
if(on)for(let i=0;i<3;i++)o+=`<circle class="lt${fly?' bl':''}" cx="${x+8+i*7}" cy="${y+7}" r="2" ${s(i==2?'var(--wn)':'var(--ac)',`animation-delay:${i*.19}s`)}/>`;return o}
export function roomSVG(r,crew,slots,fly){
const H=r>=5?212:r==4?182:175;let o=`<svg viewBox="0 0 600 ${H}" class="room" role="img" aria-label="${ROOMS[r][0]}"><rect width="600" height="100" ${s('var(--pn)')}/><rect y="100" width="600" height="${H-100}" ${s('var(--bg)')}/><line x1="0" y1="100" x2="600" y2="100" style="stroke:var(--ln)"/>`;
if(r<2){ // concrete blockhouse: block courses, slit windows onto the pad, a periscope
for(let y=14;y<100;y+=14){o+=`<line x1="0" y1="${y}" x2="600" y2="${y}" style="stroke:var(--ln);opacity:.35"/>`;for(let x=(y/14%2)*30;x<600;x+=60)o+=`<line x1="${x}" y1="${y-14}" x2="${x}" y2="${y}" style="stroke:var(--ln);opacity:.35"/>`}
for(const w of [110,410])o+=`<rect x="${w}" y="34" width="80" height="18" ${s('var(--bg)','stroke:var(--ln);stroke-width:4')}/><line x1="${w+4}" y1="48" x2="${w+76}" y2="48" style="stroke:var(--dim)"/><path d="M${w+40} 36 l3 6 v6 h-6 v-6 z" ${s('var(--ink)')}/>`;
o+=`<rect x="296" y="0" width="8" height="58" ${s('var(--ln)')}/><rect x="284" y="58" width="32" height="9" rx="2" ${s('var(--ln)')}/>`;
if(r>=1)o+=`<rect x="500" y="80" width="60" height="38" ${s('var(--ln)')}/><rect x="510" y="62" width="40" height="20" ${s('var(--ink)','opacity:.6')}/><text x="530" y="112" text-anchor="middle" ${s('var(--bg)','font-size:7px;font-family:inherit')}>TTY</text>`}
let bd=null;
if(r>=2)bd=r>=5?[20,10,170,80]:r>=4?[20,12,220,76]:[30,12,250,76];
if(bd){const[x,y,w,h]=bd;o+=`<rect x="${x}" y="${y}" width="${w}" height="${h}" ${s('var(--bg)','stroke:var(--ln);stroke-width:2')}/>`;
for(let i=1;i<6;i++)o+=`<line x1="${x+w*i/6}" y1="${y}" x2="${x+w*i/6}" y2="${y+h}" style="stroke:var(--ln);opacity:.5"/>`;
for(let i=1;i<4;i++)o+=`<line x1="${x}" y1="${y+h*i/4}" x2="${x+w}" y2="${y+h*i/4}" style="stroke:var(--ln);opacity:.5"/>`;
o+=`<polyline id="cr-trace" data-b="${bd.join(',')}" points="" style="fill:none;stroke:var(--wn);stroke-width:2"/>`}
if(r==3||r==4)for(let i=0;i<3;i++){const x=450+i*45;o+=`<rect x="${x}" y="20" width="38" height="78" ${s('var(--ln)')}/><circle cx="${x+11}" cy="40" r="7" ${s('var(--bg)')}/><circle cx="${x+27}" cy="40" r="7" ${s('var(--bg)')}/><rect x="${x+6}" y="62" width="26" height="4" ${s('var(--bg)')}/>`}
if(r>=4){const x=r>=5?210:255,w=r>=5?180:180;o+=`<rect x="${x}" y="12" width="${w}" height="76" ${s('var(--bg)','stroke:var(--ln);stroke-width:2')}/><ellipse cx="${x+w*.28}" cy="42" rx="${w*.12}" ry="16" ${s('var(--ln)','opacity:.6')}/><ellipse cx="${x+w*.62}" cy="38" rx="${w*.16}" ry="13" ${s('var(--ln)','opacity:.6')}/><ellipse cx="${x+w*.55}" cy="66" rx="${w*.07}" ry="10" ${s('var(--ln)','opacity:.6')}/><path d="M${x} 50 ${Array.from({length:13},(_,i)=>`L${x+i*w/12} ${50+Math.sin(i/12*6.28)*18}`).join(' ')}" style="fill:none;stroke:var(--ac);stroke-width:1.5"/>`}
if(r>=5){o+=`<rect x="410" y="10" width="170" height="80" ${s('var(--bg)','stroke:var(--ln);stroke-width:2')}/>`;for(let i=0;i<6;i++)o+=`<rect x="420" y="${20+i*11}" width="${60+((i*37)%90)}" height="4" ${s('var(--ac)','opacity:.55')}/>`}
const rows=r<2?[[118,[210,255,300,345,390]]]:r<4?[[128,[60,130,200,270,340,410,480,550]]]:r<5?[[118,[110,180,250,320,390,460]],[156,[75,145,215,285,355,425,495]]]:[[118,[120,190,260,330,400,470]],[154,[90,160,230,300,370,440,510]],[190,[60,130,200,270,340,410,480,550]]];
const seats=[];for(const[y,xs]of rows.slice().reverse())for(const x of xs)seats.push([x,y]); // front row fills first
const drawn=seats.slice(0,Math.min(seats.length,slots)).map((p,i)=>[...p,crew[i]]).sort((a,b)=>a[1]-b[1]); // draw back rows first
for(const[x,y,id]of drawn){if(id)o+=person(x,y);if(r>=2)o+=console_(x,y,id?STN[id].s:'',!!id,fly);else if(id)o+=`<text x="${x}" y="${y+22}" text-anchor="middle" ${s('var(--ink)','font-size:8px;font-family:inherit')}>${STN[id].s}</text>`}
if(r<2)o+=`<rect x="185" y="118" width="230" height="8" ${s('var(--ln)')}/>`;
return o+'</svg>'}
// Draw the flight's altitude trace on the plotting board (or big board), if the room has one.
export function updateTrace(tr){const pl=document.getElementById('cr-trace');if(!pl||!tr.length)return;const[x,y,w,h]=pl.dataset.b.split(',').map(Number),mx=Math.max(1,...tr),n=Math.max(40,tr.length);
pl.setAttribute('points',tr.map((v,i)=>`${(x+4+i/n*(w-8)).toFixed(1)},${(y+h-4-v/mx*(h-10)).toFixed(1)}`).join(' '))}
