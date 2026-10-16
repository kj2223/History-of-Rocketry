// The control-room picture on the Launch tab, drawn from the room level, staffed stations and console count.
import { ROOMS, STN } from './data.js';
const s=(f,x='')=>`style="fill:${f};${x}"`;
// A seated figure whose shoulders sit on top edge y.
const person=(x,y)=>`<circle cx="${x}" cy="${y-17}" r="4.5" ${s('var(--dim)')}/><rect x="${x-7}" y="${y-12}" width="14" height="13" rx="4" ${s('var(--dim)')}/>`;
function console_(x,y,lab,on,fly){let o=`<rect x="${x-28}" y="${y}" width="56" height="14" rx="2" ${s('var(--ln)')}/>`;
if(lab)o+=`<text x="${x-24}" y="${y+10}" ${s('var(--bg)','font-size:8px;font-weight:bold;font-family:inherit')}>${lab}</text>`;
if(on)for(let i=0;i<3;i++)o+=`<circle class="lt${fly?' bl':''}" cx="${x+8+i*7}" cy="${y+7}" r="2" ${s(i==2?'var(--wn)':'var(--ac)',`animation-delay:${i*.19}s`)}/>`;return o}
export function roomSVG(r,crew,slots,fly,bub={}){
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
o+=`<polyline class="cr-trace" data-b="${bd.join(',')}" points="" style="fill:none;stroke:var(--wn);stroke-width:2"/>`}
if(r==3||r==4)for(let i=0;i<3;i++){const x=450+i*45;o+=`<rect x="${x}" y="20" width="38" height="78" ${s('var(--ln)')}/><circle cx="${x+11}" cy="40" r="7" ${s('var(--bg)')}/><circle cx="${x+27}" cy="40" r="7" ${s('var(--bg)')}/><rect x="${x+6}" y="62" width="26" height="4" ${s('var(--bg)')}/>`}
if(r>=4){const x=r>=5?210:255,w=r>=5?180:180;o+=`<rect x="${x}" y="12" width="${w}" height="76" ${s('var(--bg)','stroke:var(--ln);stroke-width:2')}/><ellipse cx="${x+w*.28}" cy="42" rx="${w*.12}" ry="16" ${s('var(--ln)','opacity:.6')}/><ellipse cx="${x+w*.62}" cy="38" rx="${w*.16}" ry="13" ${s('var(--ln)','opacity:.6')}/><ellipse cx="${x+w*.55}" cy="66" rx="${w*.07}" ry="10" ${s('var(--ln)','opacity:.6')}/><path d="M${x} 50 ${Array.from({length:13},(_,i)=>`L${x+i*w/12} ${50+Math.sin(i/12*6.28)*18}`).join(' ')}" style="fill:none;stroke:var(--ac);stroke-width:1.5"/>`}
if(r>=5){o+=`<rect x="410" y="10" width="170" height="80" ${s('var(--bg)','stroke:var(--ln);stroke-width:2')}/>`;for(let i=0;i<6;i++)o+=`<rect x="420" y="${20+i*11}" width="${60+((i*37)%90)}" height="4" ${s('var(--ac)','opacity:.55')}/>`}
const rows=r<2?[[118,[210,255,300,345,390]]]:r<4?[[128,[60,130,200,270,340,410,480,550]]]:r<5?[[118,[110,180,250,320,390,460]],[156,[75,145,215,285,355,425,495]]]:[[118,[120,190,260,330,400,470]],[154,[90,160,230,300,370,440,510]],[190,[60,130,200,270,340,410,480,550]]];
const seats=[];for(const[y,xs]of rows.slice().reverse())for(const x of xs)seats.push([x,y]); // front row fills first
const drawn=seats.slice(0,Math.min(seats.length,slots)).map((p,i)=>[...p,crew[i]]).sort((a,b)=>a[1]-b[1]); // draw back rows first
const bubbles=[];for(const[x,y,id]of drawn){if(id&&bub[id])bubbles.push([x,y,bub[id]]);if(id)o+=person(x,y);if(r>=2)o+=console_(x,y,id?STN[id].s:'',!!id,fly);else if(id)o+=`<text x="${x}" y="${y+22}" text-anchor="middle" ${s('var(--ink)','font-size:8px;font-family:inherit')}>${STN[id].s}</text>`}
if(r<2)o+=`<rect x="185" y="118" width="230" height="8" ${s('var(--ln)')}/>`;
for(const[x,y,b]of bubbles){const w=Math.max(30,b.t.length*6.2+12),c=b.c=='go'?'var(--ac)':b.c=='no'?'var(--bd)':'var(--wn)';o+=`<g class="bub"><rect x="${x-w/2}" y="${y-44}" width="${w}" height="15" rx="4" ${s(c)}/><path d="M${x-4} ${y-29.5} l4 5 l4 -5 z" ${s(c)}/><text x="${x}" y="${y-33}" text-anchor="middle" ${s('var(--bg)','font-size:9px;font-weight:bold;font-family:inherit')}>${b.t}</text></g>`}
return o+'</svg>'}
// Draw the flight's altitude trace on the plotting board (or big board), if the room has one.
export function updateTrace(tr){for(const pl of document.querySelectorAll('.cr-trace'))traceOne(pl,tr)}
function traceOne(pl,tr){if(!tr.length){pl.setAttribute('points','');return}const[x,y,w,h]=pl.dataset.b.split(',').map(Number),mx=Math.max(1,...tr),n=Math.max(40,tr.length);
pl.setAttribute('points',tr.map((v,i)=>`${(x+4+i/n*(w-8)).toFixed(1)},${(y+h-4-v/mx*(h-10)).toFixed(1)}`).join(' '))}

// FLIGHT INSTRUMENTS, drawn in the room's own hardware. ch: [{lab, v, max, txt, lost, none}]
// Blockhouse: one or two rugged dials. Range control: a row of dials. Mercury/Apollo: digital readouts with status lamps.
const fmtTick=v=>v>=1e6?(v/1e6).toFixed(0)+'M':v>=1000?(v/1000).toFixed(v>=1e4?0:1)+'k':String(Math.round(v));
function dial(x,c,r,fly){const R=r<2?46:52,cy=70,a0=-135,a1=135,fr=c.v==null?0:Math.max(0,Math.min(1.04,c.v/c.max)),jit=c.jit||0,ang=(a0+(a1-a0)*fr+jit)*Math.PI/180;
let o=`<circle cx="${x}" cy="${cy}" r="${R+6}" ${s('var(--ln)')}/><circle cx="${x}" cy="${cy}" r="${R}" ${s('var(--bg)',r<2?'stroke:var(--ink);stroke-width:1;opacity:.95':'')}/>`;
for(let i=0;i<=10;i++){const t=(a0+(a1-a0)*i/10)*Math.PI/180,l=i%5?6:11;o+=`<line x1="${x+Math.sin(t)*(R-2)}" y1="${cy-Math.cos(t)*(R-2)}" x2="${x+Math.sin(t)*(R-2-l)}" y2="${cy-Math.cos(t)*(R-2-l)}" style="stroke:var(--ink);stroke-width:${i%5?1:2}"/>`;
if(i%5==0&&r>=2)o+=`<text x="${x+Math.sin(t)*(R-22)}" y="${cy-Math.cos(t)*(R-22)+3}" text-anchor="middle" ${s('var(--dim)','font-size:8px;font-family:inherit')}>${fmtTick(c.max*i/10)}</text>`}
if(c.none)return o+`<rect x="${x-34}" y="${cy-9}" width="68" height="16" ${s('var(--pn)','stroke:var(--ln)')}/><text x="${x}" y="${cy+3}" text-anchor="middle" ${s('var(--dim)','font-size:8px;font-family:inherit')}>NO CHANNEL</text><text x="${x}" y="${cy+R+20}" text-anchor="middle" ${s('var(--dim)','font-size:9px;font-family:inherit;letter-spacing:.08em')}>${c.lab}</text>`;
o+=`<line x1="${x}" y1="${cy}" x2="${x+Math.sin(ang)*(R-8)}" y2="${cy-Math.cos(ang)*(R-8)}" style="stroke:var(--wn);stroke-width:2.5;stroke-linecap:round"/><circle cx="${x}" cy="${cy}" r="4" ${s('var(--ink)')}/>`;
if(c.lost)o+=`<rect x="${x-30}" y="${cy+12}" width="60" height="13" ${s('var(--bd)')} class="${fly?'bl':''}"/><text x="${x}" y="${cy+22}" text-anchor="middle" ${s('var(--bg)','font-size:8px;font-weight:bold;font-family:inherit')}>NO TRACK</text>`;
return o+`<text x="${x}" y="${cy+R+20}" text-anchor="middle" ${s('var(--dim)','font-size:9px;font-family:inherit;letter-spacing:.08em')}>${c.lab}</text><text x="${x}" y="${cy+R+33}" text-anchor="middle" ${s('var(--ink)','font-size:11px;font-weight:bold;font-family:inherit')}>${c.txt}</text>`}
function readout(x,c,fly){const w=134;let o=`<rect x="${x-w/2}" y="10" width="${w}" height="74" rx="3" ${s('var(--ln)')}/><rect x="${x-w/2+6}" y="26" width="${w-12}" height="34" ${s('var(--bg)')}/><text x="${x}" y="21" text-anchor="middle" ${s('var(--pn)','font-size:8px;font-weight:bold;letter-spacing:.12em;font-family:inherit')}>${c.lab}</text>`;
const d=c.none?'N/A':c.lost?'----':c.txt;o+=`<text x="${x+w/2-12}" y="51" text-anchor="end" ${s(c.none?'var(--dim)':c.lost?'var(--bd)':'var(--ac)',"font-size:17px;font-family:'Courier New',monospace;font-weight:bold")} class="${c.lost&&fly?'bl':''}">${d}</text>`;
o+=`<circle cx="${x-w/2+12}" cy="73" r="3.5" ${s(c.none?'var(--pn)':c.lost?'var(--bd)':'var(--ac)')}/><text x="${x-w/2+20}" y="76" ${s('var(--pn)','font-size:7px;font-family:inherit')}>${c.none?'NOT FITTED':c.lost?'SIGNAL LOST':'SIGNAL'}</text>`;return o}
export function gaugesSVG(r,ch,fly){if(r<2)ch=ch.filter(c=>!c.none);const n=ch.length,W=600,dig=r>=4,H=dig?94:170,xs=ch.map((_,i)=>W*(i+.5)/n);
let o=`<svg viewBox="0 0 ${W} ${H}" class="room gauges" role="img" aria-label="Flight instruments"><rect width="${W}" height="${H}" ${s(dig?'var(--pn)':'var(--bg)')}/>`;
if(r<2)o+=`<rect x="20" y="8" width="${W-40}" height="${H-16}" rx="2" ${s('var(--pn)','stroke:var(--ln);stroke-width:4')}/>`;
ch.forEach((c,i)=>o+=dig?readout(xs[i],c,fly):dial(xs[i],c,r,fly));return o+'</svg>'}
