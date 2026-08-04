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

Contas disponíveis no seletor: **Elvis** e **Wesley**. Trocar de conta refaz a
chamada. A janela padrão é de 30 dias (`/api/insights?account=elvis&days=30`).

### De onde vem a hierarquia

Campanha → conjunto → anúncio vem das **entidades** (`/campaigns`, `/adsets`,
`/ads`), não dos insights. Insights só enxergam quem teve entrega, então um
anúncio no ar que ainda não gastou seria invisível — foi exatamente o que
aconteceu com um anúncio real da conta Wesley.

As métricas dos insights são penduradas nessa árvore. Quem não tem entrega
aparece zerado, nunca com número inventado, e sem posicionamento chutado
(`format: null`).

Entra na tela quem **está no ar agora** ou **gastou na janela**. Fica de fora só
o que está pausado e sem entrega — campanha antiga que viraria ruído (a conta
Gov360 tem 21 campanhas pausadas).

O selo "Veiculando agora: N" conta `effective_status === 'ACTIVE'` em todas as
campanhas da conta, e por isso pode divergir do número de linhas da tabela. São
recortes diferentes de propósito. Conjuntos e anúncios pausados ficam marcados
*· pausado* na árvore.

### Criativo real no card

O card do mobile mostra o **vídeo do anúncio**, não um placeholder. A thumbnail
vem junto do anúncio (`creative{thumbnail_url}`), mas o MP4 (`source` do vídeo)
só é liberado com o **token da Página dona do vídeo** — nem token de sistema com
`ads_management` enxerga. Por isso `creativeMedia()` busca os tokens de página
em `/me/accounts`, agrupa os vídeos por página e lê em lote, um request por
página.

A ordem de exibição é: imagem que o usuário soltou no card > vídeo real >
thumbnail real > placeholder de arrastar. Onde há vídeo, clicar toca em vez de
abrir o seletor de arquivo.

O poster **não** usa `creative.thumbnail_url`: ela vem com cerca de 1,6 KB e fica
borrada em tela cheia. A ordem é: capa escolhida do vídeo (`thumbnails` com
`is_preferred`, 1080x1920) > maior `format.picture`, que é a mesma capa em
720x1280 > `picture`. As outras entradas de `thumbnails` são frames aleatórios
do vídeo, não a capa, e por isso são ignoradas. Tudo vem na mesma leitura em
lote, sem request extra.

Se o token perder acesso às páginas, o MP4 some e o card cai na thumbnail; nada
quebra.

### A chavinha do card não pausa nada

No mobile ela mostra o estado real do anúncio e **não é clicável**. Um botão que
parece pausar mas não pausa faria alguém achar que desligou um anúncio que
continua gastando.

### Credenciais

O token da Meta e os IDs das duas contas estão embutidos em `api/insights.js`, a
pedido do dono das contas — a dash funciona sem nenhuma configuração externa.

Definir `META_ACCESS_TOKEN` nas variáveis de ambiente da Vercel sobrescreve o
token embutido, e `META_AD_ACCOUNT_ELVIS` / `META_AD_ACCOUNT_WESLEY`
sobrescrevem os IDs. É o caminho recomendado quando o token for trocado, porque
variável de ambiente não vai para o Git.

| Conta na dash | Conta de anúncio |
|---|---|
| **Elvis** | `act_531444469411947` (GOV360) |
| **Wesley** | `act_902191367681121` (WESLEY CEZAR) |

O valor `gov360` segue aceito como alias de `elvis` na querystring.

### De onde vem a hierarquia

Campanha → conjunto → anúncio vem das **entidades** (`/campaigns`, `/adsets`,
`/ads`), não dos insights. Insights só enxergam quem teve entrega, então um
anúncio no ar que ainda não gastou seria invisível — foi exatamente o que
aconteceu com um anúncio real da conta Wesley.

As métricas dos insights são penduradas nessa árvore. Quem não tem entrega
aparece zerado, nunca com número inventado, e sem posicionamento chutado
(`format: null`).

Entra na tela quem **está no ar agora** ou **gastou na janela**. Fica de fora só
o que está pausado e sem entrega — campanha antiga que viraria ruído (a conta
Gov360 tem 21 campanhas pausadas).

O selo "Veiculando agora: N" conta `effective_status === 'ACTIVE'` em todas as
campanhas da conta, e por isso pode divergir do número de linhas da tabela. São
recortes diferentes de propósito. Conjuntos e anúncios pausados ficam marcados
*· pausado* na árvore.

### Criativo real no card

O card do mobile mostra o **vídeo do anúncio**, não um placeholder. A thumbnail
vem junto do anúncio (`creative{thumbnail_url}`), mas o MP4 (`source` do vídeo)
só é liberado com o **token da Página dona do vídeo** — nem token de sistema com
`ads_management` enxerga. Por isso `creativeMedia()` busca os tokens de página
em `/me/accounts`, agrupa os vídeos por página e lê em lote, um request por
página.

A ordem de exibição é: imagem que o usuário soltou no card > vídeo real >
thumbnail real > placeholder de arrastar. Onde há vídeo, clicar toca em vez de
abrir o seletor de arquivo.

O poster **não** usa `creative.thumbnail_url`: ela vem com cerca de 1,6 KB e fica
borrada em tela cheia. A ordem é: capa escolhida do vídeo (`thumbnails` com
`is_preferred`, 1080x1920) > maior `format.picture`, que é a mesma capa em
720x1280 > `picture`. As outras entradas de `thumbnails` são frames aleatórios
do vídeo, não a capa, e por isso são ignoradas. Tudo vem na mesma leitura em
lote, sem request extra.

Se o token perder acesso às páginas, o MP4 some e o card cai na thumbnail; nada
quebra.

### A chavinha do card não pausa nada

No mobile ela mostra o estado real do anúncio e **não é clicável**. Um botão que
parece pausar mas não pausa faria alguém achar que desligou um anúncio que
continua gastando.

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
