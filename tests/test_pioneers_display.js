/* Canvas contract check without a browser or third-party dependencies. */
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const context={window:{},devicePixelRatio:1};
vm.runInNewContext(fs.readFileSync('per_aspera/web/pioneers-observation.js','utf8'),context);
function canvas(){
 const calls=[];const c=new Proxy({calls},{get(target,key){return key in target?target[key]:(...args)=>{calls.push([key,...args]);if(key==='createLinearGradient')return {addColorStop(){}}}}});
 return {clientWidth:800,clientHeight:300,width:800,height:300,getContext(){return c},calls};
}
const radar={coverage_km:80,sample_interval:5,samples:[{elapsed:10,range_km:5,elevation_deg:5},{elapsed:15,range_km:6,elevation_deg:8},{elapsed:100,range_km:30,elevation_deg:35}],last_fix:null};
const before=JSON.stringify(radar),plot=canvas();context.window.PioneerObservation.radar(plot,radar,100);
assert.equal(plot.calls.filter(x=>x[0]==='lineTo').length,11,'10 grid lines and one measured segment; no line across lost contact');
assert.equal(JSON.stringify(radar),before,'Rendering cannot modify sensor observations');
const empty=canvas();context.window.PioneerObservation.radar(empty,null,0);
assert.equal(empty.calls.filter(x=>x[0]==='arc').length,0,'Searching must not invent a radar target');
context.window.PioneerObservation.bunker(canvas(),null,null,0,2);
console.log('PASS: radar dropout gaps, no invented target, immutable observations and standby bunker rendering');
