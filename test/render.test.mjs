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
check('período real no cabeçalho mobile', d.getElementById('mPeriod').textContent==='06/07 – 04/08', d.getElementById('mPeriod').textContent);
check('período real no cabeçalho desktop', /06\/07 – 04\/08 de 2026/.test(d.getElementById('dPeriod').textContent), d.getElementById('dPeriod').textContent);
check('selo mostra veiculando agora, vindo do activeCount', d.getElementById('dActive').textContent==='Veiculando agora: 2', d.getElementById('dActive').textContent);
check('selo não repete a contagem de linhas da tabela', d.getElementById('dActive').textContent!=='Veiculando agora: 4', d.getElementById('dActive').textContent);
check('campanha pausada marcada na tabela', [...d.querySelectorAll('.trow .obj')].filter(e=>e.textContent==='Pausada').length===2, [...d.querySelectorAll('.trow .obj')].map(e=>e.textContent).join(','));
check('tabela avisa que o recorte é entrega no período', /Com entrega no período/.test(d.querySelector('.thead2 small').textContent), d.querySelector('.thead2 small').textContent);
check('rodapé diz dado real, não "dados de exemplo"', /Dados reais da conta Gov360/.test(d.getElementById('dNote').textContent), d.getElementById('dNote').textContent);
check('contas do menu = Gov360 e Wesley', [...d.querySelectorAll('.mi span')].map(e=>e.textContent).join('/')==='Gov360/Wesley', [...d.querySelectorAll('.mi span')].map(e=>e.textContent).join('/'));
check('nome da conta no cabeçalho', d.getElementById('acctName').textContent==='Gov360', d.getElementById('acctName').textContent);
check('nenhum "Elvis" sobrou', !/Elvis/.test(txt), 'achou Elvis');
check('nenhum NaN/Infinity/undefined na tela', !/NaN|Infinity|undefined/.test(txt), (txt.match(/NaN|Infinity|undefined/g)||[]).join(','));
check('CPC/CPM do desktop calculado dos cliques reais', /8\.942 cliques/.test(txt), 'cliques');
check('investimento somado das campanhas', /R\$ 16\.160,00/.test(txt) || /16\.160/.test(txt), (txt.match(/R\$ [\d.,]+/)||[])[0]);

console.log('\n[B] API indisponível (sem token)');
d = await boot({ apiOk:false });
check('não mostra card nenhum', d.querySelectorAll('.card').length===0, d.querySelectorAll('.card').length);
check('rodapé explica a falha', /Não foi possível carregar: META_ACCESS_TOKEN/.test(d.getElementById('dNote').textContent), d.getElementById('dNote').textContent);
check('trilho mostra estado honesto', /Não foi possível carregar/.test(d.getElementById('rail').textContent), d.getElementById('rail').textContent.slice(0,60));
check('período vira travessão, não data falsa', d.getElementById('mPeriod').textContent==='—', d.getElementById('mPeriod').textContent);
check('sem número inventado na tela', !/R\$ [1-9]/.test(d.body.textContent), (d.body.textContent.match(/R\$ [^\s]+/g)||[]).slice(0,3).join(','));

console.log(fail?`\n${fail} FALHA(S)`:'\nTODOS OS TESTES DE RENDER PASSARAM');
process.exit(fail?1:0);
