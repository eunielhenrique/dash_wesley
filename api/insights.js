// Busca os dados reais do Meta Ads e devolve no mesmo formato que a página já usa.
// O token nunca sai daqui: a página estática só enxerga os números agregados.
//
// Variáveis de ambiente (Project Settings -> Environment Variables na Vercel):
//   META_ACCESS_TOKEN         token com permissão ads_read nas duas contas
//   META_AD_ACCOUNT_GOV360    act_XXXXXXXXXXXXXXX
//   META_AD_ACCOUNT_WESLEY    act_XXXXXXXXXXXXXXX

const API = 'https://graph.facebook.com/v20.0';

const ACCOUNTS = {
  gov360: { label: 'Gov360', env: 'META_AD_ACCOUNT_GOV360' },
  wesley: { label: 'Wesley', env: 'META_AD_ACCOUNT_WESLEY' },
};

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
function formatOf(position = '') {
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

export default async function handler(req, res) {
  const token = process.env.META_ACCESS_TOKEN;
  const key = String(req.query.account || 'gov360').toLowerCase();
  const account = ACCOUNTS[key];

  if (!account) {
    return res.status(400).json({ error: `Conta desconhecida: ${key}` });
  }
  if (!token) {
    return res.status(503).json({ error: 'META_ACCESS_TOKEN não configurado neste projeto.' });
  }
  const actId = process.env[account.env];
  if (!actId) {
    return res.status(503).json({ error: `${account.env} não configurado neste projeto.` });
  }

  const days = Math.min(Math.max(parseInt(req.query.days, 10) || 30, 1), 365);
  const range = lastNDays(days);
  const base = { time_range: range, level: 'ad', limit: '500' };
  const act = `/${actId}`;

  try {
    const [adRows, adsetRows, campRows, dailyRows, placementRows] = await Promise.all([
      graph(`${act}/insights`, {
        ...base,
        fields: 'ad_id,ad_name,adset_id,adset_name,campaign_id,campaign_name,spend,impressions,reach,clicks,inline_link_clicks,action_values',
      }, token),
      graph(`${act}/insights`, {
        ...base, level: 'adset',
        fields: 'adset_id,adset_name,campaign_id,spend,impressions,reach',
      }, token),
      graph(`${act}/insights`, {
        ...base, level: 'campaign',
        fields: 'campaign_id,campaign_name,objective,spend,impressions,reach',
      }, token),
      graph(`${act}/insights`, {
        ...base, level: 'account', time_increment: '1', fields: 'spend',
      }, token),
      graph(`${act}/insights`, {
        ...base, breakdowns: 'publisher_platform,platform_position', fields: 'ad_id,impressions',
      }, token),
    ]);

    // Um anúncio roda em vários posicionamentos; o trilho usa o de maior volume.
    const bestPlacement = {};
    for (const row of placementRows) {
      const imp = num(row.impressions);
      const cur = bestPlacement[row.ad_id];
      if (!cur || imp > cur.imp) bestPlacement[row.ad_id] = { imp, position: row.platform_position };
    }

    const ads = adRows
      .map((r) => ({
        id: r.ad_id,
        name: r.ad_name,
        campaign: r.campaign_name,
        adset: r.adset_name,
        format: formatOf(bestPlacement[r.ad_id]?.position),
        spend: num(r.spend),
        imp: num(r.impressions),
        reach: num(r.reach),
        clicks: num(r.clicks),
        linkClicks: num(r.inline_link_clicks),
        revenue: revenueOf(r),
      }))
      .sort((a, b) => b.spend - a.spend);

    // Alcance não é somável (uma pessoa alcançada por dois anúncios conta uma vez),
    // por isso campanha e conjunto vêm dos seus próprios níveis, não de uma soma.
    const adsByAdset = {};
    for (const r of adRows) {
      (adsByAdset[r.adset_id] ||= []).push({
        name: r.ad_name,
        imp: num(r.impressions),
        cpc: num(r.clicks) ? num(r.spend) / num(r.clicks) : 0,
      });
    }
    const adsetsByCampaign = {};
    for (const r of adsetRows) {
      (adsetsByCampaign[r.campaign_id] ||= []).push({
        name: r.adset_name,
        spend: num(r.spend),
        imp: num(r.impressions),
        reach: num(r.reach),
        creatives: (adsByAdset[r.adset_id] || []).sort((a, b) => b.imp - a.imp),
      });
    }
    const camps = campRows
      .map((r) => ({
        name: r.campaign_name,
        obj: OBJECTIVES[r.objective] || r.objective || '—',
        spend: num(r.spend),
        imp: num(r.impressions),
        reach: num(r.reach),
        adsets: (adsetsByCampaign[r.campaign_id] || []).sort((a, b) => b.spend - a.spend),
      }))
      .sort((a, b) => b.spend - a.spend);

    const daily = dailyRows
      .map((r) => ({ date: r.date_start, spend: num(r.spend) }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const clicks = ads.reduce((s, a) => s + a.clicks, 0);

    res.setHeader('Cache-Control', 'private, max-age=0, s-maxage=300, stale-while-revalidate=600');
    return res.status(200).json({
      account: account.label,
      period: range,
      clicks,
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
