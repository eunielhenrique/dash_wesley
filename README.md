# Dashboard Meta Ads

Relatório estático de Meta Ads, exportado do projeto Claude Design
`d7e2d436-1cd4-411f-9a62-cea6cdcc4d31`.

## Páginas

| Arquivo | Tela |
|---|---|
| `index.html` | Relatório desktop — KPIs, investimento diário, investimento por campanha e tabela de campanhas expansível (campanha → conjunto → anúncio). |
| `mobile.html` | Tela mobile — anúncios patrocinados em cards deslizáveis, com filtro por posicionamento (Todos/Reels/Feed/Stories). |

As duas telas são relatórios distintos (contas e dados diferentes), não versões
responsivas da mesma página — por isso não há redirect automático entre elas.

## Runtime

`support.js` é o runtime do Claude Design (`<x-dc>`, `{{ }}`, `sc-for`, `sc-if` e a
classe `DCLogic` no `<script type="text/x-dc">`). `image-slot.js` fornece o
`<image-slot>` usado pelos cards de criativo do mobile. Ambos os HTML os
referenciam por caminho relativo, então os 4 arquivos precisam ficar na mesma pasta.

React 18 e Babel standalone são carregados do unpkg em runtime — a página precisa
de internet para renderizar.

`.image-slots.state.json` (404 no console do mobile) é um sidecar opcional do
`image-slot.js`: só existe dentro do editor do Claude Design, onde as imagens
arrastadas para os cards são persistidas. Fora dele os slots são somente leitura e
mostram o placeholder — comportamento esperado.

## Dados

Os números são os dados de exemplo do design. Para valores reais, substitua o array
`data` dentro do `<script type="text/x-dc">` no fim de cada HTML por um export do
Gerenciador de Anúncios.

## Deploy

Site estático, sem build. `vercel.json` fixa `framework: null` para a Vercel servir
os arquivos direto.
