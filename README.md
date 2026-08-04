# Dashboard Meta Ads

Relatório de Meta Ads publicado na Vercel
(`dashboard-meta-ads-beige.vercel.app`).

## O site

`index.html` é a página inteira: HTML, CSS e JS num arquivo só, sem build e sem
dependência de JS externo. Ela troca de layout por largura de tela —
abaixo de 1024px mostra a versão mobile (`.app`), acima mostra a versão
desktop (`.desk`):

- **Mobile** — anúncios patrocinados em cards deslizáveis, filtro por
  posicionamento (Todos/Reels/Feed/Stories), troca de conta (Elvis/Wesley) e
  upload do criativo por clique ou arrastar. Conta e imagens ficam no
  `localStorage` do navegador.
- **Desktop** — KPIs, investimento diário, investimento por campanha e tabela de
  campanhas expansível (campanha → conjunto → anúncio).

A única requisição externa é a fonte no Google Fonts; sem ela a página cai no
sans-serif do sistema e continua funcionando.

## Dados

Os números vêm do Meta Ads em tempo real. A página chama `/api/insights`, uma
Vercel Function que consulta a Graph API v20 e devolve os dados já no formato
que a tela usa. **O token nunca chega ao navegador** — a página estática só
enxerga os números agregados.

Contas disponíveis no seletor: **Gov360** e **Wesley**. Trocar de conta refaz a
chamada. A janela padrão é de 30 dias (`/api/insights?account=gov360&days=30`).

### Veiculando agora ≠ entrega no período

São recortes diferentes e a tela mostra os dois separados:

- **"Veiculando agora: N"** (selo do cabeçalho) vem do `effective_status` da edge
  `/campaigns` — campanhas ligadas neste momento, inclusive as que ainda não
  gastaram nada.
- **Tabela de campanhas** lista quem teve entrega na janela, que é o que os
  insights enxergam. Campanha pausada depois de rodar aparece aqui, marcada
  com o selo *Pausada*.

Usar a contagem de linhas da tabela como "campanhas ativas" seria errado nos dois
sentidos: conta pausadas e ignora ativas sem gasto.

### Variável de ambiente

Só uma, em Project Settings → Environment Variables na Vercel:

| Variável | Valor |
|---|---|
| `META_ACCESS_TOKEN` | token de Usuário do Sistema com `ads_read` nas duas contas |

Os IDs das contas já são padrão no código (`api/insights.js`), porque ID de conta
de anúncio não é credencial — sozinho não dá acesso a nada. Para apontar para
outras contas sem mexer no código, defina `META_AD_ACCOUNT_GOV360` e/ou
`META_AD_ACCOUNT_WESLEY`; a env var tem prioridade sobre o padrão.

Sem o token a API responde 503 e a página mostra o motivo — nunca cai para
número inventado.

## Testes

```bash
npm install
npm test
```

`test/insights.test.mjs` cobre a transformação da Graph API com `fetch` stubado
(conversão de tipos, receita, posicionamento, alcance por nível, erros).
`test/render.test.mjs` monta a página em jsdom e confere o que aparece na tela,
inclusive o estado de falha. Rodam sem rede e sem credencial.

## design-source/

Arquivos originais do projeto Claude Design
`d7e2d436-1cd4-411f-9a62-cea6cdcc4d31`: as duas telas em `.dc.html` mais o
runtime (`support.js`, `image-slot.js`). **Não são publicados** — estão no
`.vercelignore` e ficam aqui só como referência de origem. O `index.html` na raiz
é a versão achatada dessas duas telas, e é a única que vai pro ar.

## Deploy

Site estático, sem build. `vercel.json` fixa `framework: null` para a Vercel
servir os arquivos direto.
