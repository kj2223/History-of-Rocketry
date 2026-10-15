// Start-up: build the UI, then run the game clock once per second.
import { S, save } from './state.js';
import { tickSecond } from './game.js';
import { autoLaunch } from './auto.js';
import { initUI, render, refreshTimers, needsRender, markDirty } from './ui.js';
initUI();
let n=0;
setInterval(()=>{if(tickSecond()|autoLaunch())markDirty();if(needsRender())render();else refreshTimers();if(++n%10==0)save()},1000);
