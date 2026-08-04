import handler from '../api/insights.js';

// Respostas falsas da Graph API, no formato real (números vêm como string).
const GRAPH = {
  'level=%22ad%22&': null, // marcador, resolvido abaixo por heurística
};
globalThis.fetch = async (u) => {
  const url = new URL(u);
  const lvl = url.searchParams.get('level');
  const brk = url.searchParams.get('breakdowns');
  const inc = url.searchParams.get('time_increment');
  let data = [];
  if (brk) data = [
    {ad_id:'a1',impressions:'800',platform_position:'instagram_reels'},
    {ad_id:'a1',impressions:'200',platform_position:'feed'},
    {ad_id:'a2',impressions:'500',platform_position:'instagram_stories'},
  ];
  else if (inc) data = [{date_start:'2026-07-01',spend:'100.50'},{date_start:'2026-07-02',spend:'250.25'}];
  else if (lvl === 'ad') data = [
    {ad_id:'a1',ad_name:'Anúncio A',adset_id:'s1',adset_name:'Conjunto 1',campaign_id:'c1',campaign_name:'Campanha 1',
     spend:'300.00',impressions:'1000',reach:'800',clicks:'50',inline_link_clicks:'30',
     action_values:[{action_type:'omni_purchase',value:'1500.00'}]},
    {ad_id:'a2',ad_name:'Anúncio B',adset_id:'s1',adset_name:'Conjunto 1',campaign_id:'c1',campaign_name:'Campanha 1',
     spend:'700.00',impressions:'500',reach:'450',clicks:'10',inline_link_clicks:'0'},
  ];
  else if (lvl === 'adset') data = [{adset_id:'s1',adset_name:'Conjunto 1',campaign_id:'c1',spend:'1000.00',impressions:'1500',reach:'1100'}];
  else if (lvl === 'campaign') data = [{campaign_id:'c1',campaign_name:'Campanha 1',objective:'OUTCOME_SALES',spend:'1000.00',impressions:'1500',reach:'1100'}];
  return { ok:true, status:200, json: async () => ({ data }) };
};

function mockRes() {
  const r = { code:0, body:null, headers:{} };
  r.setHeader = (k,v)=>{r.headers[k]=v};
  r.status = (c)=>{r.code=c; return r};
  r.json = (b)=>{r.body=b; return r};
  return r;
}
const run = async (env, query) => {
  Object.assign(process.env, env);
  const res = mockRes();
  await handler({ query }, res);
  return res;
};

let fail = 0;
const check = (label, cond, extra='') => { console.log((cond?'  ✓ ':'  ✗ ')+label+(cond?'':' -> '+extra)); if(!cond) fail++; };

console.log('\n[1] sem token configurado');
let r = await run({ META_ACCESS_TOKEN:'', META_AD_ACCOUNT_GOV360:'' }, {account:'gov360'});
check('responde 503 em vez de fingir dado', r.code===503, r.code);
check('mensagem aponta a variável que falta', /META_ACCESS_TOKEN/.test(r.body.error), r.body.error);

console.log('\n[2] conta inexistente');
r = await run({ META_ACCESS_TOKEN:'t' }, {account:'elvis'});
check('responde 400', r.code===400, r.code);

console.log('\n[3] Gov360 com dado');
r = await run({ META_ACCESS_TOKEN:'t', META_AD_ACCOUNT_GOV360:'act_111', META_AD_ACCOUNT_WESLEY:'act_222' }, {account:'gov360'});
const b = r.body;
check('200', r.code===200, r.code);
check('rótulo da conta', b.account==='Gov360', b.account);
check('ads ordenados por gasto (maior primeiro)', b.ads[0].name==='Anúncio B', b.ads.map(a=>a.name).join(','));
check('spend convertido para número', b.ads[0].spend===700 && typeof b.ads[0].spend==='number', b.ads[0].spend);
check('receita lida de omni_purchase', b.ads[1].revenue===1500, b.ads[1].revenue);
check('sem receita vira 0, não NaN', b.ads[0].revenue===0, b.ads[0].revenue);
check('formato = posicionamento de maior impressão (a1 -> REELS)', b.ads[1].format==='REELS', b.ads[1].format);
check('stories mapeado (a2 -> STORIES)', b.ads[0].format==='STORIES', b.ads[0].format);
check('objetivo traduzido', b.camps[0].obj==='Vendas', b.camps[0].obj);
check('alcance da campanha vem do nível campanha (1100, não 800+450)', b.camps[0].reach===1100, b.camps[0].reach);
check('conjuntos aninhados', b.camps[0].adsets.length===1, b.camps[0].adsets.length);
check('criativos aninhados no conjunto', b.camps[0].adsets[0].creatives.length===2, b.camps[0].adsets[0].creatives.length);
check('cpc calculado', Math.abs(b.camps[0].adsets[0].creatives[0].cpc-6)<0.001, b.camps[0].adsets[0].creatives[0].cpc);
check('cliques totais somados', b.clicks===60, b.clicks);
check('série diária ordenada', b.daily.length===2 && b.daily[0].spend===100.5, JSON.stringify(b.daily));
check('período devolvido', !!(b.period.since && b.period.until), JSON.stringify(b.period));
check('token não vaza na resposta', !JSON.stringify(b).includes('access_token'), 'vazou');

console.log('\n[4] erro da Graph API');
globalThis.fetch = async () => ({ ok:false, status:400, json: async () => ({ error:{ message:'Invalid OAuth access token' } }) });
r = await run({ META_ACCESS_TOKEN:'ruim', META_AD_ACCOUNT_GOV360:'act_111' }, {account:'gov360'});
check('propaga erro sem inventar dado', r.code===400 && /OAuth/.test(r.body.error), r.code+' '+JSON.stringify(r.body));

console.log(fail ? `\n${fail} FALHA(S)` : '\nTODOS OS TESTES PASSARAM');
process.exit(fail?1:0);
