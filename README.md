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

Os números são os dados de exemplo do design, nos arrays `ads` e `camps` no
`<script>` no fim do `index.html`. Para valores reais, substitua os dois por um
export do Gerenciador de Anúncios.

## design-source/

Arquivos originais do projeto Claude Design
`d7e2d436-1cd4-411f-9a62-cea6cdcc4d31`: as duas telas em `.dc.html` mais o
runtime (`support.js`, `image-slot.js`). **Não são publicados** — estão no
`.vercelignore` e ficam aqui só como referência de origem. O `index.html` na raiz
é a versão achatada dessas duas telas, e é a única que vai pro ar.

## Deploy

Site estático, sem build. `vercel.json` fixa `framework: null` para a Vercel
servir os arquivos direto.
