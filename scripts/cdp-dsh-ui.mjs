import WebSocket from "ws";
import { writeFileSync } from "node:fs";
const TARGET = "http://127.0.0.1:9222/json/list";
const OUT = "/workspace/agent-deck-dsh-ok.png";
const PROMPT = "用一句话介绍你自己";
const TITLE = "dsh 会话";
function redact(s){return String(s).replace(/sk-[A-Za-z0-9_-]+/g,"[REDACTED]");}
async function main(){
  const list = await fetch(TARGET).then(r=>r.json());
  const page = list.find(p=>p.type==="page")||list[0];
  if(!page||!page.webSocketDebuggerUrl) throw new Error("no CDP page");
  console.log("[cdp] page", page.url);
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id=0; const pending=new Map();
  const send=(method,params={})=>new Promise((resolve,reject)=>{const msgId=++id;pending.set(msgId,{resolve,reject});ws.send(JSON.stringify({id:msgId,method,params}));});
  ws.on("message", raw=>{const msg=JSON.parse(String(raw)); if(msg.id&&pending.has(msg.id)){const {resolve,reject}=pending.get(msg.id);pending.delete(msg.id); if(msg.error) reject(new Error(redact(JSON.stringify(msg.error)))); else resolve(msg.result);} });
  await new Promise((resolve,reject)=>{ws.once("open",resolve);ws.once("error",reject);});
  await send("Runtime.enable"); await send("Page.enable");
  async function ev(expression, awaitPromise=true){
    const res=await send("Runtime.evaluate",{expression,awaitPromise,returnByValue:true,userGesture:true});
    if(res.exceptionDetails){const d=res.exceptionDetails; throw new Error(redact((d.text||"")+" "+((d.exception&&d.exception.description)||"")+" @"+d.columnNumber));}
    return res.result && res.result.value;
  }
  const boot=await ev("(async()=>{const b=await window.agentDeck.getBootstrap();return{selectedBackendId:b.selectedBackendId,sessionBackend:b.session&&b.session.backendId,secrets:b.secrets,msgCount:b.messages.length,messages:b.messages.map(m=>({role:m.role,streaming:!!m.streaming,len:(m.content||\"\").length,preview:(m.content||\"\").slice(0,160)}))};})()");
  console.log("[cdp] bootstrap", JSON.stringify(boot));
  let needPrompt=true;
  const doneAsst=boot.messages && boot.messages.find(m=>m.role==="assistant"&&!m.streaming&&m.len>5);
  if(doneAsst && boot.sessionBackend==="dsh"){ console.log("[cdp] reuse existing reply"); needPrompt=false; }
  if(needPrompt){
    const created=await ev("(async()=>{const r=await window.agentDeck.createSession({backendId:\"dsh\",title:"+JSON.stringify(TITLE)+"});return{sessionId:r.session.id,backendId:r.session.backendId};})()");
    console.log("[cdp] created", JSON.stringify(created));
    await ev("(async()=>{await window.agentDeck.sendPrompt("+JSON.stringify(PROMPT)+");return true;})()");
    console.log("[cdp] prompt sent");
  }
  let last=null; let ok=false;
  for(let i=0;i<90;i++){
    await new Promise(r=>setTimeout(r,1000));
    last=await ev("(()=>{const err=(document.querySelector(\".error-banner\")||{}).textContent||\"\"; const nodes=[...document.querySelectorAll(\".messages .bubble\")]; const bubbles=nodes.map(el=>{const meta=((el.querySelector(\".meta\")||{}).textContent||\"\").trim(); const parts=(el.innerText||\"\").split(String.fromCharCode(10)); const text=parts.slice(1).join(String.fromCharCode(10)).trim()||parts.join(String.fromCharCode(10)).trim(); const role=el.className.includes(\"user\")?\"user\":el.className.includes(\"assistant\")?\"assistant\":\"other\"; return {role,meta,text,streaming:meta.includes(String.fromCharCode(0x2026))};}); const asst=[...bubbles].reverse().find(b=>b.role===\"assistant\" && b.text && b.text.length>5 && !b.text.includes(\"\u9009\u62e9\u540e\u7aef\")); return {err:String(err).trim(), asst: asst?{text:asst.text.slice(0,500),streaming:asst.streaming,meta:asst.meta}:null, bubbleCount:bubbles.length};})()", false);
    if(last && last.err) console.log("[cdp] ui-error", redact(last.err));
    if(last && last.asst && !last.asst.streaming && last.asst.text.length>5){ console.log("[cdp] assistant", last.asst.text.slice(0,200)); ok=true; break; }
    if(i%5===0) console.log("[cdp] waiting", i, last&&last.asst?"partial":"none", "bubbles", last&&last.bubbleCount);
  }
  const shot=await send("Page.captureScreenshot",{format:"png",fromSurface:true});
  writeFileSync(OUT, Buffer.from(shot.data,"base64"));
  console.log("[cdp] screenshot", OUT);
  console.log("[cdp] RESULT", ok?"OK":"FAIL");
  if(!ok){ console.log("[cdp] last", redact(JSON.stringify(last))); process.exitCode=2; }
  ws.close();
}
main().catch(e=>{console.error("[cdp] FATAL", redact(e.stack||e.message||e)); process.exit(1);});
