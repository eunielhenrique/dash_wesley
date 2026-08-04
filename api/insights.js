// Busca os dados reais do Meta Ads e devolve no mesmo formato que a página já usa.
// O token nunca sai daqui: a página estática só enxerga os números agregados.
//
// Variáveis de ambiente (Project Settings -> Environment Variables na Vercel):
//   META_ACCESS_TOKEN         token com permissão ads_read nas duas contas
//   META_AD_ACCOUNT_GOV360    act_XXXXXXXXXXXXXXX
//   META_AD_ACCOUNT_WESLEY    act_XXXXXXXXXXXXXXX

const API = 'https://graph.facebook.com/v20.0';

// ID de conta de anúncio não é credencial — sozinho não dá acesso a nada. Fica
// aqui como padrão para que só o token precise ser configurado; a env var, se
// existir, tem prioridade (troca de conta sem mexer no código).
const ACCOUNTS = {
  elvis: { label: 'Elvis', env: ['META_AD_ACCOUNT_ELVIS', 'META_AD_ACCOUNT_GOV360'], id: 'act_531444469411947' },
  wesley: { label: 'Wesley', env: ['META_AD_ACCOUNT_WESLEY'], id: 'act_902191367681121' },
};
ACCOUNTS.gov360 = ACCOUNTS.elvis;   // a conta Gov360 é a do Elvis; alias mantido

// Token embutido a pedido do dono das contas. META_ACCESS_TOKEN, se definida na
// Vercel, tem prioridade e é o lugar certo para ele.
const FALLBACK_TOKEN = 'EAANtVkCtsPsBQ3WwgZC8hBk4edb5mcaWRdYCEgwVebPC7iZCmZBSe7axnW82XZAf8xGwH7WruwkDhVeZCCwupjlA6z87Frwo6Er965qe3IvLibOEsMVwRHREG4ZBq1iOPQvBN9eVs9KIyPZAZCZCXpYJGbpaMoZCMWgBU1xZB0zcUt2IjTbuBwhYvsZBTC3TkTZBAUAZDZD';

// Objetivos da Meta -> rótulo curto que a tabela do desktop mostra.
const OBJECTIVES = {
  OUTCOME_SALES: 'Vendas',
  OUTCOME_TRAFFIC: 'Tráfego',
  OUTCOME_AWARENESS: 'Alcance',
  OUTCOME_ENGAGEMENT: 'Engajamento',
  OUTCOME_LEADS: 'Cadastros',
  OUTCOME_APP_PROMOTION: 'App',
  CONVERSIONS: 'Vendas',
  LINK_CLICKS: 'Tráfego',
  REACH: 'Alcance',
  BRAND_AWARENESS: 'Alcance',
  POST_ENGAGEMENT: 'Engajamento',
  LEAD_GENERATION: 'Cadastros',
  VIDEO_VIEWS: 'Vídeo',
};

const num = (v) => (v == null ? 0 : Number(v) || 0);

// action_values traz uma linha por tipo de conversão; a receita é a de compra.
const revenueOf = (row) =>
  num((row.action_values || []).find((a) => a.action_type === 'omni_purchase')?.value) ||
  num((row.action_values || []).find((a) => a.action_type === 'purchase')?.value);

// platform_position tem dezenas de valores; a página só separa em três trilhos.
function formatOf(position) {
  if (!position) return null;          // anúncio no ar sem entrega ainda não tem posicionamento
  const p = position.toLowerCase();
  if (p.includes('reel')) return 'REELS';
  if (p.includes('stor')) return 'STORIES';
  return 'FEED';
}

function lastNDays(n) {
  const until = new Date();
  const since = new Date(until.getTime() - (n - 1) * 86400000);
  const iso = (d) => d.toISOString().slice(0, 10);
  return { since: iso(since), until: iso(until) };
}

async function graph(path, params, token) {
  const url = new URL(API + path);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, typeof v === 'string' ? v : JSON.stringify(v));
  }
  url.searchParams.set('access_token', token);

  const rows = [];
  let next = url.toString();
  // A Graph pagina insights; sem seguir o cursor a conta vem cortada pela metade.
  while (next) {
    const res = await fetch(next);
    const body = await res.json();
    if (body.error) {
      const e = new Error(body.error.message || 'Erro na Graph API');
      e.status = res.status;
      throw e;
    }
    rows.push(...(body.data || []));
    next = body.paging?.next || null;
  }
  return rows;
}

// O criativo real: thumbnail vem no próprio anúncio, mas o MP4 (campo `source`)
// só é liberado com o token da PÁGINA dona do vídeo — nem o token de sistema com
// ads_management enxerga. Por isso: pega os tokens de página, agrupa os vídeos por
// página e faz uma leitura em lote por token.
async function creativeMedia(actId, token) {
  const media = {};
  let rows;
  try {
    rows = await graph(`/${actId}/ads`, {
      fields: 'id,creative{thumbnail_url,image_url,video_id,effective_object_story_id}',
      limit: '500',
    }, token);
  } catch {
    return media;                     // sem criativo a tela cai no placeholder
  }

  const videos = [];
  for (const r of rows) {
    const c = r.creative || {};
    media[r.id] = { thumb: c.thumbnail_url || c.image_url || null, video: null };
    if (c.video_id) {
      videos.push({ adId: r.id, videoId: c.video_id, pageId: String(c.effective_object_story_id || '').split('_')[0] });
    }
  }
  if (!videos.length) return media;

  let pages;
  try {
    pages = await graph('/me/accounts', { fields: 'id,access_token', limit: '200' }, token);
  } catch {
    return media;
  }
  const pageToken = Object.fromEntries(pages.map((p) => [p.id, p.access_token]));

  const byPage = {};
  for (const v of videos) {
    if (pageToken[v.pageId]) (byPage[v.pageId] ||= []).push(v);
  }

  // A Graph limita quantos ids cabem numa leitura em lote; uma conta com 145
  // anúncios estoura e o lote inteiro volta vazio. Daí os blocos de 50.
  const CHUNK = 50;
  const jobs = [];
  for (const [pageId, list] of Object.entries(byPage)) {
    for (let i = 0; i < list.length; i += CHUNK) jobs.push([pageId, list.slice(i, i + CHUNK)]);
  }

  await Promise.all(jobs.map(async ([pageId, list]) => {
    try {
      const url = new URL(`${API}/`);
      url.searchParams.set('ids', list.map((v) => v.videoId).join(','));
      url.searchParams.set('fields', 'source,picture');
      url.searchParams.set('access_token', pageToken[pageId]);
      const body = await (await fetch(url)).json();
      if (body.error) return;
      for (const v of list) {
        const found = body[v.videoId];
        if (!found) continue;
        if (found.source) media[v.adId].video = found.source;
        if (found.picture && !media[v.adId].thumb) media[v.adId].thumb = found.picture;
      }
    } catch { /* um bloco sem MP4 não pode derrubar a tela toda */ }
  }));

  return media;
}

export default async function handler(req, res) {
  const token = process.env.META_ACCESS_TOKEN || FALLBACK_TOKEN;
  const key = String(req.query.account || 'gov360').toLowerCase();
  const account = ACCOUNTS[key];

  if (!account) {
    return res.status(400).json({ error: `Conta desconhecida: ${key}` });
  }
  if (!token) {
    return res.status(503).json({ error: 'META_ACCESS_TOKEN não configurado neste projeto.' });
  }
  const actId = account.env.map((e) => process.env[e]).find(Boolean) || account.id;
  if (!actId) {
    return res.status(503).json({ error: `${account.env[0]} não configurado neste projeto.` });
  }

  const days = Math.min(Math.max(parseInt(req.query.days, 10) || 30, 1), 365);
  const range = lastNDays(days);
  const base = { time_range: range, level: 'ad', limit: '500' };
  const act = `/${actId}`;

  try {
    const [adRows, adsetRows, campRows, dailyRows, placementRows, campEnt, setEnt, adEnt, media] = await Promise.all([
      graph(`${act}/insights`, {
        ...base,
        fields: 'ad_id,spend,impressions,reach,clicks,inline_link_clicks,action_values',
      }, token),
      graph(`${act}/insights`, {
        ...base, level: 'adset', fields: 'adset_id,spend,impressions,reach',
      }, token),
      graph(`${act}/insights`, {
        ...base, level: 'campaign', fields: 'campaign_id,spend,impressions,reach',
      }, token),
      graph(`${act}/insights`, {
        ...base, level: 'account', time_increment: '1', fields: 'spend',
      }, token),
      graph(`${act}/insights`, {
        ...base, breakdowns: 'publisher_platform,platform_position', fields: 'ad_id,impressions',
      }, token),
      // A hierarquia vem das entidades, não dos insights: insights só enxergam quem
      // teve entrega, então anúncio no ar que ainda não gastou sumiria da tela.
      graph(`${act}/campaigns`, { fields: 'id,name,objective,effective_status', limit: '500' }, token),
      graph(`${act}/adsets`, { fields: 'id,name,campaign_id,effective_status', limit: '500' }, token),
      graph(`${act}/ads`, { fields: 'id,name,adset_id,campaign_id,effective_status', limit: '500' }, token),
      creativeMedia(actId, token),
    ]);

    const byId = (rows, key) => Object.fromEntries(rows.map((r) => [r[key], r]));
    const adIns = byId(adRows, 'ad_id');
    const setIns = byId(adsetRows, 'adset_id');
    const campIns = byId(campRows, 'campaign_id');

    // Um anúncio roda em vários posicionamentos; o trilho usa o de maior volume.
    const bestPlacement = {};
    for (const row of placementRows) {
      const imp = num(row.impressions);
      const cur = bestPlacement[row.ad_id];
      if (!cur || imp > cur.imp) bestPlacement[row.ad_id] = { imp, position: row.platform_position };
    }

    const isOn = (e) => e.effective_status === 'ACTIVE';
    // Entra na tela quem está no ar agora OU gastou na janela. Fica de fora só o
    // que está pausado e sem entrega — ruído de campanha antiga.
    const relevant = (e, ins) => isOn(e) || !!ins[e.id];

    const setById = byId(setEnt, 'id');
    const campById = byId(campEnt, 'id');

    const ads = adEnt
      .filter((a) => relevant(a, adIns))
      .map((a) => {
        const m = adIns[a.id] || {};
        return {
          id: a.id,
          name: a.name,
          active: isOn(a),
          campaign: campById[a.campaign_id]?.name || '—',
          adset: setById[a.adset_id]?.name || '—',
          format: formatOf(bestPlacement[a.id]?.position),
          video: media[a.id]?.video || null,
          thumb: media[a.id]?.thumb || null,
          spend: num(m.spend),
          imp: num(m.impressions),
          reach: num(m.reach),
          clicks: num(m.clicks),
          linkClicks: num(m.inline_link_clicks),
          revenue: revenueOf(m),
        };
      })
      .sort((a, b) => b.spend - a.spend || Number(b.active) - Number(a.active));

    // Alcance não é somável (uma pessoa alcançada por dois anúncios conta uma vez),
    // por isso campanha e conjunto vêm dos seus próprios níveis, não de uma soma.
    const camps = campEnt
      .filter((c) => relevant(c, campIns))
      .map((c) => {
        const m = campIns[c.id] || {};
        return {
          name: c.name,
          status: c.effective_status,
          active: isOn(c),
          obj: OBJECTIVES[c.objective] || c.objective || '—',
          spend: num(m.spend),
          imp: num(m.impressions),
          reach: num(m.reach),
          adsets: setEnt
            .filter((s) => s.campaign_id === c.id && relevant(s, setIns))
            .map((s) => {
              const sm = setIns[s.id] || {};
              return {
                name: s.name,
                active: isOn(s),
                spend: num(sm.spend),
                imp: num(sm.impressions),
                reach: num(sm.reach),
                creatives: adEnt
                  .filter((a) => a.adset_id === s.id && relevant(a, adIns))
                  .map((a) => {
                    const am = adIns[a.id] || {};
                    return {
                      name: a.name,
                      active: isOn(a),
                      imp: num(am.impressions),
                      cpc: num(am.clicks) ? num(am.spend) / num(am.clicks) : 0,
                    };
                  })
                  .sort((x, y) => y.imp - x.imp),
              };
            })
            .sort((x, y) => y.spend - x.spend),
        };
      })
      .sort((a, b) => b.spend - a.spend || Number(b.active) - Number(a.active));

    const daily = dailyRows
      .map((r) => ({ date: r.date_start, spend: num(r.spend) }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const clicks = ads.reduce((s, a) => s + a.clicks, 0);
    const activeCount = campEnt.filter(isOn).length;
    const activeAdsets = setEnt.filter(isOn).length;
    const activeAds = adEnt.filter(isOn).length;

    // 60s: a dash é usada para conferir mudança recém-feita no Gerenciador;
    // cache longo faria a ativação de uma campanha demorar a aparecer.
    res.setHeader('Cache-Control', 'private, max-age=0, s-maxage=60, stale-while-revalidate=120');
    return res.status(200).json({
      account: account.label,
      period: range,
      clicks,
      activeCount,
      activeAdsets,
      activeAds,
      ads,
      camps,
      daily,
    });
  } catch (err) {
    // Sem inventar número: a página mostra o erro em vez de cair para dado falso.
    return res.status(err.status && err.status < 500 ? err.status : 502).json({
      error: err.message || 'Falha ao consultar a Graph API',
    });
  }
}
