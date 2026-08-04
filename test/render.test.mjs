import { JSDOM } from 'jsdom';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const HERE = path.dirname(fileURLToPath(import.meta.url));

const html = fs.readFileSync(path.join(HERE,'..','index.html'),'utf8');
const stub = JSON.parse(fs.readFileSync(path.join(HERE,'fixture.json'),'utf8'));

let fail=0;
const check=(l,c,x='')=>{console.log((c?'  ✓ ':'  ✗ ')+l+(c?'':' -> '+x)); if(!c)fail++;};

async function boot({ apiOk=true, error='META_ACCESS_TOKEN não configurado neste projeto.' }={}) {
  const dom = new JSDOM(html, { runScripts:'dangerously', url:'http://localhost/', pretendToBeVisual:true,
    beforeParse(w){
      w.fetch = async () => apiOk
        ? { ok:true, status:200, json: async()=>stub }
        : { ok:false, status:503, json: async()=>({error}) };
      w.localStorage.clear();
    }});
  await new Promise(r=>setTimeout(r,300));   // deixa o load() assíncrono terminar
  return dom.window.document;
}

console.log('\n[A] com dado da API');
let d = await boot();
const txt = d.body.textContent;
check('KPIs do desktop renderizados', d.querySelectorAll('.dkpi').length===4, d.querySelectorAll('.dkpi').length);
check('cards do mobile renderizados', d.querySelectorAll('.card').length===6, d.querySelectorAll('.card').length);
check('linhas de campanha', d.querySelectorAll('.trow:not(.hd)').length===4, d.querySelectorAll('.trow:not(.hd)').length);
check('barras do gráfico = dias da série', d.querySelectorAll('#chart rect').length===stub.daily.length, d.querySelectorAll('#chart rect').length);
check('cabeçalho mobile não tem mais pílula de data', !d.getElementById('mPeriod'), 'ainda existe');
check('no lugar dela há botão de atualizar', !!d.getElementById('mRefresh'), 'sem botão');
check('cabeçalho desktop não tem mais data', !d.getElementById('dPeriod'), 'ainda existe');
check('no lugar dela há botão de atualizar', !!d.getElementById('dRefresh'), 'sem botão');
check('botão desktop é rotulado', /Atualizar/.test(d.getElementById('dRefresh').textContent), d.getElementById('dRefresh').textContent);
check('botão liberado quando o dado já chegou', d.getElementById('dRefresh').disabled === false, d.getElementById('dRefresh').disabled);
check('selo mostra veiculando agora, vindo do activeCount', d.getElementById('dActive').textContent==='Veiculando agora: 2', d.getElementById('dActive').textContent);
check('selo não repete a contagem de linhas da tabela', d.getElementById('dActive').textContent!=='Veiculando agora: 4', d.getElementById('dActive').textContent);
check('campanha pausada marcada na tabela', [...d.querySelectorAll('.trow .obj')].filter(e=>e.textContent==='Pausada').length===2, [...d.querySelectorAll('.trow .obj')].map(e=>e.textContent).join(','));
check('tabela avisa que o recorte é entrega no período', /Com entrega no período/.test(d.querySelector('.thead2 small').textContent), d.querySelector('.thead2 small').textContent);
check('rodapé diz dado real, não "dados de exemplo"', /Dados reais da conta Elvis/.test(d.getElementById('dNote').textContent), d.getElementById('dNote').textContent);
check('contas do menu = Elvis e Wesley', [...d.querySelectorAll('.mi span')].map(e=>e.textContent).join('/')==='Elvis/Wesley', [...d.querySelectorAll('.mi span')].map(e=>e.textContent).join('/'));
check('nome da conta no cabeçalho', d.getElementById('acctName').textContent==='Elvis', d.getElementById('acctName').textContent);
check('rodapé nomeia a conta certa', /Dados reais da conta Elvis/.test(d.getElementById('dNote').textContent), d.getElementById('dNote').textContent);
check('vídeo real renderizado nos cards que têm MP4', d.querySelectorAll('.media video.vid').length===4, d.querySelectorAll('.media video.vid').length);
check('vídeo usa a thumbnail real como poster', d.querySelector('.media video.vid')?.getAttribute('poster')==='https://cdn.example/t0.jpg', d.querySelector('.media video.vid')?.getAttribute('poster'));
check('sem MP4 mas com thumb, cai na imagem real', d.querySelectorAll('.media img').length===1, d.querySelectorAll('.media img').length);
check('sem criativo nenhum, mantém o placeholder de arrastar', d.querySelectorAll('.media .ph').length===1, d.querySelectorAll('.media .ph').length);
check('card com vídeo não abre seletor de arquivo ao clicar', d.querySelectorAll('.media[data-video][data-pick]').length===0, 'ainda abre');
check('overlay de play some onde há vídeo de verdade', d.querySelectorAll('.play').length===2, d.querySelectorAll('.play').length);
check('card não tem mais chavinha', d.querySelectorAll('.sw').length===0, d.querySelectorAll('.sw').length);
check('card não tem mais bloco de CPR', d.querySelectorAll('.hero').length===0, d.querySelectorAll('.hero').length);
check('card mostra só o nome do criativo, sem a nomenclatura', d.querySelector('.names .n').textContent==='Anúncio 1 — criativo de vídeo', d.querySelector('.names .n').textContent);
check('card não repete campanha e conjunto', d.querySelectorAll('.names .c').length===0, d.querySelectorAll('.names .c').length);
// a árvore (conjuntos/anúncios) só existe com a campanha expandida
{
  const row = d.querySelector('.trow[data-c="2"]');   // camps[2] está pausada na fixture
  row.dispatchEvent(new row.ownerDocument.defaultView.MouseEvent('click', { bubbles: true }));
  const tree = d.getElementById('tbody').innerHTML;
  check('expandir campanha revela conjuntos e anúncios', /Conjunto A2/.test(tree) && /Vídeo 15s/.test(tree), tree.slice(0, 80));
  check('conjunto e anúncio pausados marcados na árvore', (tree.match(/· pausado/g) || []).length >= 2, (tree.match(/· pausado/g) || []).length);
  check('árvore do desktop mostra a imagem real do criativo', d.querySelectorAll('.cr img.thumb').length === 1, d.querySelectorAll('.cr img.thumb').length);
  check('criativo sem imagem mantém o quadro cinza', d.querySelectorAll('.cr div.thumb').length === 1, d.querySelectorAll('.cr div.thumb').length);
  check('nomes da árvore sem a nomenclatura', !/\[GOV360\]|\[WESLEY\]/.test(tree), (tree.match(/\[[A-Z0-9]+\]/g)||[]).slice(0,3).join(','));
}
check('nenhum NaN/Infinity/undefined na tela', !/NaN|Infinity|undefined/.test(txt), (txt.match(/NaN|Infinity|undefined/g)||[]).join(','));
check('CPC/CPM do desktop calculado dos cliques reais', /8\.942 cliques/.test(txt), 'cliques');
check('investimento somado das campanhas', /R\$ 16\.160,00/.test(txt) || /16\.160/.test(txt), (txt.match(/R\$ [\d.,]+/)||[])[0]);

console.log('\n[A2] atualização automática');
{
  const w = d.defaultView;
  let calls = 0;
  const realFetch = w.fetch;
  w.fetch = (...a) => { calls++; return realFetch(...a); };

  w.document.dispatchEvent(new w.Event('visibilitychange'));
  await new Promise(r => setTimeout(r, 120));
  check('voltar para a aba refaz a busca', calls === 1, calls);

  const btn = d.getElementById('mRefresh');
  btn.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  check('clicar em atualizar trava o botão e gira o ícone', btn.disabled && btn.classList.contains('busy'), `${btn.disabled}/${btn.className}`);
  await new Promise(r => setTimeout(r, 120));
  check('botão dispara nova busca', calls === 2, calls);
  check('botão volta a ficar clicável ao terminar', !btn.disabled && !btn.classList.contains('busy'), `${btn.disabled}/${btn.className}`);

  // com vídeo tocando, a atualização não pode cortar o play
  const vid = d.querySelector('video.vid');
  Object.defineProperty(vid, 'paused', { value: false, configurable: true });
  Object.defineProperty(vid, 'ended', { value: false, configurable: true });
  const antes = calls;
  w.document.dispatchEvent(new w.Event('visibilitychange'));
  await new Promise(r => setTimeout(r, 120));
  check('não recarrega com vídeo em reprodução', calls === antes, `${calls} vs ${antes}`);
  w.fetch = realFetch;
}

console.log('\n[B] API indisponível (sem token)');
d = await boot({ apiOk:false });
check('não mostra card nenhum', d.querySelectorAll('.card').length===0, d.querySelectorAll('.card').length);
check('rodapé explica a falha', /Não foi possível carregar: META_ACCESS_TOKEN/.test(d.getElementById('dNote').textContent), d.getElementById('dNote').textContent);
check('trilho mostra estado honesto', /Não foi possível carregar/.test(d.getElementById('rail').textContent), d.getElementById('rail').textContent.slice(0,60));
check('sem dado, rodapé desktop explica em vez de mostrar data', /Não foi possível carregar/.test(d.getElementById('dNote').textContent), d.getElementById('dNote').textContent);
check('sem número inventado na tela', !/R\$ [1-9]/.test(d.body.textContent), (d.body.textContent.match(/R\$ [^\s]+/g)||[]).slice(0,3).join(','));

console.log(fail?`\n${fail} FALHA(S)`:'\nTODOS OS TESTES DE RENDER PASSARAM');
process.exit(fail?1:0);
