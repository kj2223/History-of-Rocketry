// Small shared helpers (no game or DOM knowledge).
export const K=n=>'$'+Math.round(n).toLocaleString();
export const gauss=()=>{let u=0,v=0;while(!u)u=Math.random();while(!v)v=Math.random();return Math.sqrt(-2*Math.log(u))*Math.cos(6.2832*v)};
