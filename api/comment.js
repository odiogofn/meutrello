import {timingSafeEqual} from 'node:crypto';
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='POST')return res.status(405).json({error:'Método não permitido'});
 const password=process.env.MONITOR_WRITE_PASSWORD||'';
 if(!password)return res.status(503).json({error:'Configure MONITOR_WRITE_PASSWORD no Vercel para permitir respostas.'});
 const given=req.headers['x-monitor-password']||'';
 const a=Buffer.from(password),b=Buffer.from(String(given));
 if(a.length!==b.length||!timingSafeEqual(a,b))return res.status(401).json({error:'Senha de publicação incorreta.'});
 const key=process.env.TRELLO_KEY,token=process.env.TRELLO_TOKEN;
 if(!key||!token)return res.status(503).json({error:'Credenciais Trello ausentes.'});
 const {cardId,text}=req.body||{};
 if(typeof cardId!=='string'||!/^[a-f\d]{24}$/i.test(cardId)||typeof text!=='string'||!text.trim()||text.length>12000)return res.status(400).json({error:'Dados inválidos.'});
 try{
  const url=new URL('https://api.trello.com/1/cards/'+cardId+'/actions/comments');
  url.searchParams.set('key',key);url.searchParams.set('token',token);
  const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({text:text.trim()}),signal:AbortSignal.timeout(12000)});
  const data=await r.json().catch(()=>({}));
  if(!r.ok)return res.status(r.status).json({error:data.message||'Falha ao comentar no Trello.'});
  return res.status(201).json({ok:true,id:data.id});
 }catch{return res.status(502).json({error:'Erro ao comunicar com Trello.'})}
}
