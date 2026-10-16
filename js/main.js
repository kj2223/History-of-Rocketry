// Start-up: build the UI, then run the game clock once per second.
import { S, save } from './state.js';
import { tickSecond } from './game.js';
import { autoLaunch } from './auto.js';
import { initUI, render, refreshTimers, needsRender, markDirty, busy } from './ui.js';
initUI();
let n=0;
// Time controls: pause, 1x, 2x, 4x. The launch view always runs at 1x; headline events drop the speed back to 1x.
setInterval(()=>{const k=busy()?Math.min(1,S.speed??1):(S.speed??1);for(let i=0;i<k;i++)if(tickSecond()|autoLaunch())markDirty();if(needsRender())render();else refreshTimers();if(++n%10==0)save()},1000);
