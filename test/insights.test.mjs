import handler from '../api/insights.js';

// Cenário: c1 pausada mas com entrega na janela; c2 ligada e ainda sem gastar.
// a3 é o caso que motivou a mudança — anúncio no ar que os insights não enxergam.
const CAMPAIGNS = [
  { id: 'c1', name: 'Campanha 1', objective: 'OUTCOME_SALES', effective_status: 'PAUSED' },
  { id: 'c2', name: 'Campanha 2', objective: 'OUTCOME_TRAFFIC', effective_status: 'ACTIVE' },
  { id: 'c3', name: 'Campanha 3', objective: 'OUTCOME_SALES', effective_status: 'PAUSED' },
];
const ADSETS = [
  { id: 's1', name: 'Conjunto 1', campaign_id: 'c1', effective_status: 'PAUSED' },
  { id: 's2', name: 'Conjunto 2', campaign_id: 'c2', effective_status: 'ACTIVE' },
  { id: 's3', name: 'Conjunto 3', campaign_id: 'c3', effective_status: 'PAUSED' },
];
const ADS = [
  { id: 'a1', name: 'Anúncio A', adset_id: 's1', campaign_id: 'c1', effective_status: 'PAUSED' },
  { id: 'a2', name: 'Anúncio B', adset_id: 's1', campaign_id: 'c1', effective_status: 'PAUSED' },
  { id: 'a3', name: 'Anúncio C', adset_id: 's2', campaign_id: 'c2', effective_status: 'ACTIVE' },
  { id: 'a4', name: 'Anúncio D', adset_id: 's3', campaign_id: 'c3', effective_status: 'PAUSED' },
];

const ok = (data) => ({ ok: true, status: 200, json: async () => ({ data }) });

globalThis.fetch = async (u) => {
  const url = new URL(u);
  const p = url.pathname;
  if (p.endsWith('/campaigns')) return ok(CAMPAIGNS);
  if (p.endsWith('/adsets')) return ok(ADSETS);
  if (p.endsWith('/ads')) return ok(ADS);

  const lvl = url.searchParams.get('level');
  const brk = url.searchParams.get('breakdowns');
  const inc = url.searchParams.get('time_increment');
  if (brk) return ok([
    { ad_id: 'a1', impressions: '800', platform_position: 'instagram_reels' },
    { ad_id: 'a1', impressions: '200', platform_position: 'feed' },
    { ad_id: 'a2', impressions: '500', platform_position: 'instagram_stories' },
  ]);
  if (inc) return ok([
    { date_start: '2026-07-01', spend: '100.50' },
    { date_start: '2026-07-02', spend: '250.25' },
  ]);
  if (lvl === 'ad') return ok([
    { ad_id: 'a1', spend: '300.00', impressions: '1000', reach: '800', clicks: '50',
      inline_link_clicks: '30', action_values: [{ action_type: 'omni_purchase', value: '1500.00' }] },
    { ad_id: 'a2', spend: '700.00', impressions: '500', reach: '450', clicks: '10', inline_link_clicks: '0' },
  ]);
  if (lvl === 'adset') return ok([{ adset_id: 's1', spend: '1000.00', impressions: '1500', reach: '1100' }]);
  if (lvl === 'campaign') return ok([{ campaign_id: 'c1', spend: '1000.00', impressions: '1500', reach: '1100' }]);
  return ok([]);
};

function mockRes() {
  const r = { code: 0, body: null };
  r.setHeader = () => {};
  r.status = (c) => { r.code = c; return r; };
  r.json = (b) => { r.body = b; return r; };
  return r;
}
const run = async (env, query) => {
  Object.assign(process.env, env);
  const res = mockRes();
  await handler({ query }, res);
  return res;
};

let fail = 0;
const check = (l, c, x = '') => { console.log((c ? '  ✓ ' : '  ✗ ') + l + (c ? '' : ' -> ' + x)); if (!c) fail++; };
const ENV = { META_ACCESS_TOKEN: 't', META_AD_ACCOUNT_ELVIS: 'act_111', META_AD_ACCOUNT_GOV360: '', META_AD_ACCOUNT_WESLEY: 'act_222' };

console.log('\n[1] configuração ausente');
let r = await run({ META_ACCESS_TOKEN: '', META_AD_ACCOUNT_ELVIS: '', META_AD_ACCOUNT_GOV360: '' }, { account: 'elvis' });
check('sem env var nenhuma ainda responde (token embutido)', r.code === 200, r.code);
r = await run(ENV, { account: 'joao' });
check('conta desconhecida responde 400', r.code === 400, r.code);
r = await run(ENV, { account: 'gov360' });
check('alias gov360 aponta para a conta do Elvis', r.code === 200 && r.body.account === 'Elvis', r.body?.account);

console.log('\n[2] hierarquia vem das entidades, não dos insights');
r = await run(ENV, { account: 'elvis' });
const b = r.body;
const ad = (n) => b.ads.find((x) => x.name === n);
const camp = (n) => b.camps.find((x) => x.name === n);
check('200', r.code === 200, r.code);
check('ANÚNCIO NO AR SEM ENTREGA APARECE', !!ad('Anúncio C'), b.ads.map((a) => a.name).join(','));
check('e aparece zerado, não com número inventado', ad('Anúncio C')?.spend === 0 && ad('Anúncio C')?.imp === 0, JSON.stringify(ad('Anúncio C')));
check('marcado como ativo', ad('Anúncio C')?.active === true, ad('Anúncio C')?.active);
check('sem entrega não tem posicionamento chutado', ad('Anúncio C')?.format === null, ad('Anúncio C')?.format);
check('CAMPANHA NO AR SEM ENTREGA APARECE', !!camp('Campanha 2'), b.camps.map((c) => c.name).join(','));
check('com o conjunto ativo dentro', camp('Campanha 2')?.adsets[0]?.name === 'Conjunto 2', JSON.stringify(camp('Campanha 2')?.adsets));
check('e o anúncio ativo dentro do conjunto', camp('Campanha 2')?.adsets[0]?.creatives[0]?.name === 'Anúncio C', JSON.stringify(camp('Campanha 2')?.adsets[0]?.creatives));
check('pausada COM entrega continua aparecendo', !!camp('Campanha 1'), 'sumiu');
check('pausada SEM entrega fica fora (ruído)', !camp('Campanha 3'), 'Campanha 3 apareceu');
check('anúncio de campanha pausada sem entrega fica fora', !ad('Anúncio D'), 'Anúncio D apareceu');

console.log('\n[3] métricas e rótulos');
check('spend convertido para número', ad('Anúncio B')?.spend === 700, ad('Anúncio B')?.spend);
check('receita lida de omni_purchase', ad('Anúncio A')?.revenue === 1500, ad('Anúncio A')?.revenue);
check('sem receita vira 0, não NaN', ad('Anúncio B')?.revenue === 0, ad('Anúncio B')?.revenue);
check('posicionamento = o de maior impressão (A -> REELS)', ad('Anúncio A')?.format === 'REELS', ad('Anúncio A')?.format);
check('stories mapeado (B -> STORIES)', ad('Anúncio B')?.format === 'STORIES', ad('Anúncio B')?.format);
check('nome do conjunto e da campanha resolvidos no anúncio', ad('Anúncio A')?.adset === 'Conjunto 1' && ad('Anúncio A')?.campaign === 'Campanha 1', `${ad('Anúncio A')?.adset}/${ad('Anúncio A')?.campaign}`);
check('objetivo traduzido', camp('Campanha 1')?.obj === 'Vendas', camp('Campanha 1')?.obj);
check('alcance da campanha vem do nível campanha (1100, não 800+450)', camp('Campanha 1')?.reach === 1100, camp('Campanha 1')?.reach);
check('cpc calculado', Math.abs(camp('Campanha 1').adsets[0].creatives[0].cpc - 6) < 0.001, camp('Campanha 1').adsets[0].creatives[0].cpc);
check('cliques totais somados', b.clicks === 60, b.clicks);
check('série diária ordenada', b.daily.length === 2 && b.daily[0].spend === 100.5, JSON.stringify(b.daily));
check('período devolvido', !!(b.period.since && b.period.until), JSON.stringify(b.period));

console.log('\n[4] contagens do que está no ar');
check('campanhas ativas', b.activeCount === 1, b.activeCount);
check('conjuntos ativos', b.activeAdsets === 1, b.activeAdsets);
check('anúncios ativos', b.activeAds === 1, b.activeAds);
check('ativos != listados (recortes diferentes)', b.activeAds !== b.ads.length, `${b.activeAds} vs ${b.ads.length}`);
check('token não vaza na resposta', !JSON.stringify(b).includes('access_token') && !JSON.stringify(b).includes('EAA'), 'vazou');

console.log('\n[4b] vídeos somados por cidade');
{
  const CITY_ADS = [
    { id: 'v1', name: '[W][Cidade A] Video X', adset_id: 'sA', campaign_id: 'cX', effective_status: 'ACTIVE' },
    { id: 'v2', name: '[W][Cidade B] Video X', adset_id: 'sB', campaign_id: 'cX', effective_status: 'ACTIVE' },
    { id: 'v3', name: '[W][Cidade C] Video X', adset_id: 'sC', campaign_id: 'cX', effective_status: 'ACTIVE' },
    { id: 'v4', name: '[W][Cidade A] Video Y', adset_id: 'sA', campaign_id: 'cX', effective_status: 'ACTIVE' },
    { id: 'v5', name: '[W][Cidade A] Video Y', adset_id: 'sA', campaign_id: 'cX', effective_status: 'ACTIVE' },
    { id: 'v6', name: 'Anúncio solto', adset_id: 'sA', campaign_id: 'cX', effective_status: 'ACTIVE' },
  ];
  globalThis.fetch = async (u) => {
    const url = new URL(u);
    const p = url.pathname;
    const fields = url.searchParams.get('fields') || '';
    if (p.endsWith('/me/accounts')) return ok([]);
    if (p.endsWith('/campaigns')) return ok([{ id: 'cX', name: 'Reconhecimento', objective: 'OUTCOME_AWARENESS', effective_status: 'ACTIVE' }]);
    if (p.endsWith('/adsets')) return ok([
      { id: 'sA', name: '[W][Cidade A]', campaign_id: 'cX', effective_status: 'ACTIVE' },
      { id: 'sB', name: '[W][Cidade B]', campaign_id: 'cX', effective_status: 'ACTIVE' },
      { id: 'sC', name: '[W][Cidade C]', campaign_id: 'cX', effective_status: 'ACTIVE' },
    ]);
    if (p.endsWith('/ads') && fields.includes('creative')) return ok(CITY_ADS.map((a) => ({
      id: a.id, creative: { body: 'Primeira frase da copy!\nSegunda linha.', thumbnail_url: 'https://cdn.example/' + a.id + '.jpg' },
    })));
    if (p.endsWith('/ads')) return ok(CITY_ADS);
    if (url.searchParams.get('level') === 'ad' && !url.searchParams.get('breakdowns')) return ok([
      { ad_id: 'v1', spend: '40.00', impressions: '10000', reach: '9000', clicks: '10' },
      { ad_id: 'v2', spend: '6.00', impressions: '1000', reach: '900', clicks: '5' },
      { ad_id: 'v3', spend: '3.00', impressions: '100', reach: '90', clicks: '3' },
      { ad_id: 'v4', spend: '10.00', impressions: '2000', reach: '1800', clicks: '2' },
      { ad_id: 'v5', spend: '10.00', impressions: '2000', reach: '1800', clicks: '2' },
      { ad_id: 'v6', spend: '5.00', impressions: '500', reach: '450', clicks: '1' },
    ]);
    return ok([]);
  };
  r = await run(ENV, { account: 'wesley2026' });
  check('conta Wesley 2026 existe e responde', r.code === 200 && r.body.account === 'Wesley 2026', r.code + ' ' + r.body?.account);
  const vs = r.body.videos;
  check('só agrupa nome repetido em cidades DISTINTAS', vs.length === 1 && vs[0].name === 'Video X', JSON.stringify(vs?.map((v) => v.name)));
  const v = vs[0];
  check('métricas somadas das cidades', v.spend === 49 && v.imp === 11100 && v.clicks === 18 && v.reach === 9990, JSON.stringify({ s: v.spend, i: v.imp, c: v.clicks, r: v.reach }));
  check('copy = primeira frase do creative.body', v.copy === 'Primeira frase da copy!', v.copy);
  check('thumb herdada do anúncio com mais impressões', v.thumb === 'https://cdn.example/v1.jpg', v.thumb);
  check('maior CTR ignora cidade com pouca impressão (C tem 3% em 100 imp)', v.bestCtr.city === 'Cidade B', JSON.stringify(v.bestCtr));
  check('menor CPM entre as elegíveis', v.lowCpm.city === 'Cidade A' && Math.abs(v.lowCpm.cpm - 4) < 0.001, JSON.stringify(v.lowCpm));
  check('cidades ordenadas por gasto, com ctr e cpm prontos', v.cities[0].city === 'Cidade A' && Math.abs(v.cities[1].cpm - 6) < 0.001, JSON.stringify(v.cities));
  check('anúncio fora do padrão [TAG][Cidade] fica fora do agrupamento', !JSON.stringify(vs).includes('Anúncio solto'), 'entrou');
}

console.log('\n[5] erro da Graph API');
globalThis.fetch = async () => ({ ok: false, status: 400, json: async () => ({ error: { message: 'Invalid OAuth access token' } }) });
r = await run({ ...ENV, META_ACCESS_TOKEN: 'ruim' }, { account: 'elvis' });
check('propaga erro sem inventar dado', r.code === 400 && /OAuth/.test(r.body.error), r.code + ' ' + JSON.stringify(r.body));

console.log(fail ? `\n${fail} FALHA(S)` : '\nTODOS OS TESTES PASSARAM');
process.exit(fail ? 1 : 0);
