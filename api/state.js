const headers={'Cache-Control':'no-store, max-age=0','Content-Type':'application/json; charset=utf-8'};
async function get(url,key,token){const u=new URL('https://api.trello.com/1'+url);u.searchParams.set('key',key);u.searchParams.set('token',token);const response=await fetch(u,{signal:AbortSignal.timeout(12000)});if(!response.ok)throw Error(`Trello HTTP ${response.status}`);return response.json()}
export default async function handler(req,res){res.setHeader('Cache-Control','no-store');if(req.method!=='GET')return res.status(405).json({error:'Método não permitido'});
const key=process.env.TRELLO_KEY,token=process.env.TRELLO_TOKEN;if(!key||!token)return res.status(503).json({error:'Configure TRELLO_KEY e TRELLO_TOKEN nas variáveis de ambiente do Vercel.'});
try{const boards=await get('/members/me/boards?fields=name,closed,url&filter=all',key,token);const active=boards.filter(b=>!b.closed);const names=new Map(boards.map(b=>[b.id,b.name]));const limit=Math.min(100,Math.max(20,Number(process.env.ACTIONS_PER_BOARD)||100));const since=typeof req.query.since==='string'&&/^\d{4}-\d\d-\d\dT/.test(req.query.since)?req.query.since:null;
const results=await Promise.allSettled(active.map(async b=>{let p=`/boards/${b.id}/actions?limit=${limit}&filter=createCard,updateCard,deleteCard,commentCard,addMemberToCard,removeMemberFromCard`;if(since)p+='&since='+encodeURIComponent(since);return get(p,key,token)}));let failed=0;const raw=[];results.forEach(r=>{if(r.status==='fulfilled')raw.push(...r.value);else failed++});const byId=new Map(raw.map(a=>[a.id,a]));const events=[];
for(const a of byId.values()){const d=a.data||{},c=d.card||{},old=d.old||{};let type,detail,from='',to='';let boardId=d.board?.id||c.idBoard||'';
if(a.type==='createCard'){type='create';detail='criou o cartão'}
else if(a.type==='commentCard'){type='comment';detail='comentou no cartão'}
else if(a.type==='deleteCard'){type='delete';detail='excluiu o cartão'}
else if(a.type==='updateCard'){
if(old.idBoard&&c.idBoard&&old.idBoard!==c.idBoard){type='transfer';detail='transferiu o cartão';from=names.get(old.idBoard)||d.boardSource?.name||old.idBoard;to=names.get(c.idBoard)||d.board?.name||c.idBoard;boardId=c.idBoard}
else if(old.idList&&c.idList&&old.idList!==c.idList){type='move';detail='moveu o cartão de lista';from=d.listBefore?.name||old.idList;to=d.listAfter?.name||c.idList}
else if(old.closed===false&&c.closed===true){type='archive';detail='arquivou o cartão'}
else if(old.closed===true&&c.closed===false){type='restore';detail='restaurou o cartão'}else continue
}else continue;
const cardUrl=c.shortLink?'https://trello.com/c/'+encodeURIComponent(c.shortLink):c.id?'https://trello.com/c/'+encodeURIComponent(c.id):null;
events.push({id:a.id,date:a.date,type,detail,actor:a.memberCreator?.fullName||a.memberCreator?.username||'Usuário',card:c.name||'Cartão',cardUrl,board:names.get(boardId)||d.board?.name||'Quadro não identificado',boardId,boardUrl:boards.find(b=>b.id===boardId)?.url|| (boardId?'https://trello.com/b/'+encodeURIComponent(boardId):null),from,to,cardId:c.id||'',labels:[],comment:type==='comment'?d.text||'':''})}
const ids=[...new Set(events.map(e=>e.cardId).filter(Boolean))];
const resultsLabels=await Promise.allSettled(ids.map(async id=>{const card=await get('/cards/'+encodeURIComponent(id)+'?fields=labels',key,token);return [id,(card.labels||[]).map(l=>({name:l.name||'',color:l.color||''}))]}));
const labelsByCard=new Map(resultsLabels.filter(r=>r.status==='fulfilled').map(r=>r.value));
for(const e of events){e.labels=labelsByCard.get(e.cardId)||[];e.labelsLoaded=labelsByCard.has(e.cardId)}
events.sort((a,b)=>b.date.localeCompare(a.date));return res.status(200).json({events,boards:active.map(b=>({id:b.id,name:b.name,url:b.url})),lastSync:new Date().toISOString(),interval:30000,error:failed?`Não foi possível consultar ${failed} quadro(s).`:''})
}catch(e){return res.status(502).json({error:e.message||'Erro na consulta ao Trello'})}}
