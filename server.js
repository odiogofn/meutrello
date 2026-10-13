import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const PORT=Number(process.env.PORT||3000), KEY=process.env.TRELLO_KEY, TOKEN=process.env.TRELLO_TOKEN;
const interval=Math.max(5000,Number(process.env.POLL_MS||10000));
const file=path.resolve('data/events.json');
fs.mkdirSync('data',{recursive:true});
let events=[];try{events=JSON.parse(fs.readFileSync(file,'utf8'))}catch{}
let boards=[],clients=new Set(),error='',lastSync=null,ready=false,known=new Set(events.map(x=>x.id));
async function trello(p){const u=new URL('https://api.trello.com/1'+p);u.searchParams.set('key',KEY);u.searchParams.set('token',TOKEN);const r=await fetch(u);if(!r.ok)throw Error('Trello HTTP '+r.status);return r.json()}
function emit(obj){const msg=`data: ${JSON.stringify(obj)}\n\n`;for(const c of clients)try{c.write(msg)}catch{clients.delete(c)}}
function boardName(id){return boards.find(b=>b.id===id)?.name||'Quadro não identificado'}
function format(a){const d=a.data||{},c=d.card||{},old=d.old||{};let type='',detail='',from='',to='';const b=d.board||{};let boardId=b.id||c.idBoard||'';
if(a.type==='createCard'){type='create';detail='criou o cartão'}
else if(a.type==='commentCard'){type='comment';detail='comentou';}
else if(a.type==='deleteCard'){type='delete';detail='excluiu o cartão'}
else if(a.type==='updateCard'){
 if(old.idBoard&&c.idBoard&&old.idBoard!==c.idBoard){type='transfer';detail='transferiu o cartão';from=boardName(old.idBoard);to=boardName(c.idBoard);boardId=c.idBoard}
 else if(old.idList&&c.idList&&old.idList!==c.idList){type='move';detail='moveu o cartão de lista';from=d.listBefore?.name||old.idList;to=d.listAfter?.name||c.idList}
 else if(old.closed===false&&c.closed===true){type='archive';detail='arquivou o cartão'}
 else if(old.closed===true&&c.closed===false){type='restore';detail='restaurou o cartão'}
 else return null;
}else if(/reaction/i.test(a.type)){type='reaction';detail='reagiu ao cartão'}else return null;
return {id:a.id,date:a.date,type,detail,actor:a.memberCreator?.fullName||a.memberCreator?.username||'Usuário',card:c.name||'Cartão',cardUrl:c.shortLink?'https://trello.com/c/'+c.shortLink:(c.id?'https://trello.com/c/'+c.id:null),board:boardName(boardId),boardId,boardUrl:boardId?'https://trello.com/b/'+boardId:null,from,to,comment:type==='comment'?(d.text||''):''};}
async function sync(){if(!KEY||!TOKEN){error='Configure TRELLO_KEY e TRELLO_TOKEN no servidor.';emit({kind:'status',error});return}
try{boards=await trello('/members/me/boards?fields=name,closed,url&filter=open');let all=[];
for(const b of boards){try{const actions=await trello(`/boards/${b.id}/actions?limit=100&filter=createCard,updateCard,deleteCard,commentCard`);all.push(...actions)}catch(e){console.error('Quadro',b.name,e.message)}}
const byId=new Map(all.map(a=>[a.id,a]));const fresh=[];
for(const a of byId.values()){if(known.has(a.id))continue;const e=format(a);known.add(a.id);if(e)fresh.push(e)}
fresh.sort((a,b)=>a.date.localeCompare(b.date));if(!ready){ready=true;if(events.length===0){for(const e of fresh)events.unshift(e)}else{for(const e of fresh){events.unshift(e);emit({kind:'event',event:e})}}}else for(const e of fresh){events.unshift(e);emit({kind:'event',event:e})}
if(events.length>1500)events.length=1500;
fs.writeFileSync(file,JSON.stringify(events));lastSync=new Date().toISOString();error='';emit({kind:'status',lastSync,error,boards:boards.map(b=>({id:b.id,name:b.name,url:b.url}))});
}catch(e){error=e.message;emit({kind:'status',error});console.error(e.message)}}
const mime={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'application/javascript'};
const server=http.createServer((req,res)=>{const url=new URL(req.url,'http://localhost');if(url.pathname==='/api/state'){res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify({events,boards:boards.map(b=>({id:b.id,name:b.name,url:b.url})),lastSync,error,interval}));return}
if(url.pathname==='/api/stream'){res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache','Connection':'keep-alive'});res.write(': connected\n\n');clients.add(res);req.on('close',()=>clients.delete(res));return}
let p=path.resolve('public',url.pathname==='/'?'index.html':'.'+url.pathname);if(!p.startsWith(path.resolve('public')+path.sep)){res.writeHead(403);res.end();return}fs.readFile(p,(err,buf)=>{if(err){res.writeHead(404);res.end('Not found');return}res.writeHead(200,{'Content-Type':mime[path.extname(p)]||'text/plain'});res.end(buf)})});
server.listen(PORT,()=>console.log('MeuTrello Monitor http://localhost:'+PORT));sync();setInterval(sync,interval);
