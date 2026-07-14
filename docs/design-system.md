# Design system — Lojinha EntreGô

Este documento traduz a linguagem visual pública da EntreGô para uma interface original de loja de pontos. Ele orienta a área do entregador e o painel administrativo sem copiar logotipo, fotografias, ilustrações ou outros ativos protegidos.

## Princípios

1. **Azul e branco predominantes:** o produto deve parecer parte do universo EntreGô sem reproduzir o site institucional.
2. **Pontos sempre claros:** saldo, competência, validade e custo de resgate devem ser entendidos de imediato.
3. **Humano e ágil:** formas amigáveis, linguagem direta e referências discretas a rotas, localização e movimento.
4. **Mobile primeiro:** a rotina do entregador deve funcionar com uma mão e em telas pequenas.
5. **Admin funcional:** a identidade permanece presente, mas não reduz a densidade nem a legibilidade dos dados.
6. **Acessível por padrão:** cor, foco, texto e estados devem atender WCAG 2.2 AA.

## Origem e limites de uso

A pesquisa foi conferida em 14 de julho de 2026 nestas fontes oficiais:

- [Site institucional da EntreGô](https://www.entregolog.com/)
- [Página oficial para entregadores](https://www.entregolog.com/entregadores/)
- [Folha de estilos pública da página inicial](https://www.entregolog.com/wp-content/uploads/elementor/css/post-22.css)

As fontes mostram azul elétrico, azul-marinho, branco e menta; Plus Jakarta Sans; títulos pesados; chamadas em cápsula; fotografias de pessoas e entregas; recortes diagonais; e elementos de rota e localização.

Essas referências podem mudar. Não baixar nem incorporar imagens, SVGs, logotipo ou outros arquivos do site. O produto deve usar:

- marca enviada ou autorizada pelo proprietário;
- fotos próprias, licenciadas ou de banco com licença compatível;
- ícones de biblioteca licenciada;
- formas geométricas e ilustrações criadas especificamente para a lojinha.

Enquanto não houver um arquivo de marca autorizado, usar “Lojinha EntreGô” como texto, sem tentar redesenhar o símbolo oficial.

## Cores

### Tokens de marca

| Token | Valor | Uso principal |
| --- | --- | --- |
| `brand.blue.500` | `#2C67EA` | Ações primárias, links, foco e áreas de marca |
| `brand.blue.700` | `#1B3FAC` | Seções escuras, navegação e estados pressionados |
| `brand.navy` | `#0F1849` | Títulos, texto principal e ícones |
| `brand.mint` | `#2CEABC` | Pontos, destaque positivo e uma ação promocional por contexto |
| `brand.mintInk` | `#0F4938` | Texto e ícones sobre menta |
| `surface.default` | `#FFFFFF` | Fundo e cartões |
| `surface.soft` | `#EFF2F6` | Fundo secundário e agrupamento de conteúdo |
| `border.strong` | `#BCC1CB` | Divisores e controles com maior contraste |

### Tokens funcionais

Os estados funcionais não precisam pertencer à paleta institucional. Eles devem ser inequívocos e acessíveis.

| Token | Fundo | Conteúdo | Uso |
| --- | --- | --- | --- |
| `status.info` | `#EEF3FF` | `#1B3FAC` | Informação e processamento |
| `status.success` | `#E9FBF6` | `#0F4938` | Concluído, ativo e conciliado |
| `status.warning` | `#FFF6E5` | `#7A4A00` | Pontos próximos de expirar e estoque baixo |
| `status.danger` | `#FFF0F0` | `#A61620` | Erro, cancelamento e ação destrutiva |
| `border.default` | `#DCE3EC` | — | Bordas usuais |
| `text.muted` | transparente | `#52617A` | Metadados e ajuda |

### Variáveis recomendadas

```css
:root {
  --brand-blue: #2c67ea;
  --brand-blue-strong: #1b3fac;
  --brand-navy: #0f1849;
  --brand-mint: #2ceabc;
  --brand-mint-ink: #0f4938;

  --surface: #ffffff;
  --surface-soft: #eff2f6;
  --border: #dce3ec;
  --border-strong: #bcc1cb;
  --text: #0f1849;
  --text-muted: #52617a;

  --radius-control: 12px;
  --radius-card: 20px;
  --radius-feature: 28px;
  --radius-pill: 999px;

  --shadow-card: 0 10px 30px rgb(15 24 73 / 8%);
  --shadow-raised: 0 18px 45px rgb(15 24 73 / 14%);

  --motion-fast: 150ms;
  --motion-normal: 220ms;
}
```

## Tipografia

Usar **Plus Jakarta Sans** como família principal. Em Next.js, preferir `next/font/google` para evitar mudança de layout durante o carregamento.

```css
font-family: "Plus Jakarta Sans", Inter, ui-sans-serif, system-ui, sans-serif;
```

| Estilo | Desktop | Mobile | Peso |
| --- | --- | --- | --- |
| Display | 48/56 px | 36/42 px | 800 |
| H1 | 40/48 px | 32/38 px | 800 |
| H2 | 32/40 px | 26/32 px | 800 |
| H3 | 24/32 px | 22/28 px | 700 |
| Corpo grande | 18/28 px | 17/26 px | 400 |
| Corpo | 16/24 px | 16/24 px | 400 |
| Rótulo | 14/20 px | 14/20 px | 500 |
| Legenda | 12/16 px | 12/16 px | 500 |

Regras:

- limitar texto corrido a aproximadamente 70 caracteres por linha;
- usar `font-variant-numeric: tabular-nums` em pontos, estoque, valores, datas e tabelas;
- não usar caixa alta em frases; reservar para siglas;
- manter títulos curtos e em sentence case.

## Espaçamento, grade e forma

- Escala base: 4, 8, 12, 16, 24, 32, 48, 64 e 96 px.
- Largura máxima da área do entregador: 1200 px.
- Margens laterais: 16 px no mobile, 24 px no tablet e 32 px no desktop.
- Controles: raio de 12 px e altura mínima de 44 px.
- Cartões: raio de 20 px.
- Áreas de destaque e mídia: raio de 28 px.
- Botões em cápsula: raio total, preservando altura mínima de 44 px.
- Usar sombra leve somente para separar camadas. Bordas são preferíveis em listas e tabelas.
- Recortes diagonais e motivos de rota podem aparecer em banners e estados vazios, nunca atrás de dados ou textos longos.

## Iconografia e fotografia

- Usar ícones simples, sólidos ou de traço consistente, com 20 ou 24 px.
- Preferir metáforas de pacote, presente, rota, localização, histórico, calendário e carteira de pontos.
- Não criar um ícone que imite o símbolo do logotipo oficial.
- Fotografias devem mostrar entregadores e situações reais de trabalho com luz natural e presença de azul quando possível.
- Não depender de imagem para explicar saldo, estoque, validade ou status.
- Imagens de produto devem ter fundo limpo e proporção recomendada de 4:3.

## Componentes da área do entregador

### Cabeçalho

- Desktop: marca autorizada ou nome textual à esquerda; saldo e perfil à direita.
- Mobile: cabeçalho compacto e navegação inferior.
- O saldo deve abrir o extrato, não funcionar apenas como decoração.

### Cartão de saldo

Conteúdo obrigatório:

- “Saldo de julho” ou competência equivalente;
- total de pontos disponível;
- data de expiração;
- link “Ver extrato”;
- aviso em âmbar quando faltarem sete dias ou menos para expirar.

Usar fundo azul, número branco e menta apenas como acento. Não esconder a validade em tooltip.

### Cartão de produto

Ordem visual:

1. foto;
2. categoria ou estado;
3. nome;
4. custo em pontos;
5. estoque ou indisponibilidade;
6. ação.

Usar cartão branco, foto 4:3 e custo em chip menta com texto marinho. Manter a altura das ações alinhada na grade. Estados:

- disponível;
- estoque baixo;
- sem estoque;
- saldo insuficiente;
- inativo, visível apenas para administrador.

### Detalhe e confirmação de resgate

- Repetir custo, saldo atual e saldo após o resgate.
- Exibir quantidade e regra de limite quando houver.
- Manter “Confirmar resgate” como ação explícita.
- Usar botão fixo na base em telas pequenas, sem cobrir conteúdo.
- Depois da confirmação, mostrar código, item, pontos debitados e link para “Ver meus resgates”.

### Botões

| Variante | Aparência | Uso |
| --- | --- | --- |
| Primário | azul com texto branco | Ação principal do fluxo |
| Destaque | menta com texto `#0F4938` | Uma chamada promocional ou de pontos por contexto |
| Secundário | branco, borda azul e texto azul | Alternativa segura |
| Fantasma | transparente e texto azul-marinho | Ação de baixa prioridade |
| Destrutivo | vermelho escuro com texto branco | Cancelar ou excluir |

Estados de hover, foco, pressionado, carregando e desabilitado são obrigatórios. Durante envio, manter o texto da ação e acrescentar indicador de progresso para evitar mudança de largura.

### Formulários

- Rótulo sempre visível acima do campo.
- Ajuda abaixo do campo quando necessária.
- Erro junto ao campo e resumo no topo quando houver vários erros.
- Máscaras de CPF e CNPJ não podem bloquear colagem, leitor de tela ou valor normalizado.
- Mostrar e ocultar senha com botão nomeado.
- Não usar placeholder como rótulo.

### Status, alertas e feedback

- Combinar cor, ícone e texto.
- Toasts servem para confirmações leves; falhas importantes permanecem na tela.
- Progresso de importação ou resgate deve informar a etapa atual.
- Estados vazios explicam o que aparecerá ali e oferecem uma ação relevante.

## Mobile

- Priorizar saldo, validade e atalhos no primeiro viewport.
- Navegação inferior recomendada: “Início”, “Loja”, “Resgates” e “Perfil”.
- Área de toque mínima de 44 × 44 px e distância mínima de 8 px entre ações.
- Grade de produtos com duas colunas a partir de 360 px; usar uma coluna abaixo disso.
- Categorias podem rolar horizontalmente, com indicação visual de continuidade.
- Evitar qualquer outra rolagem horizontal.
- Detalhes e confirmação usam CTA fixo na base com respeito à safe area.
- Teclado virtual não pode esconder o campo ativo nem a ação principal.
- Tabelas administrativas viram listas ou cartões com ações agrupadas; não reduzir texto até ficar ilegível.

## Painel administrativo

O admin usa a mesma família, paleta e escala, mas com menos elementos promocionais.

- Fundo geral `surface.soft` e superfícies de trabalho brancas.
- Navegação lateral branca ou azul-marinho; item ativo em azul elétrico.
- Cabeçalhos e barras de ação podem permanecer fixos.
- Densidade padrão: texto de 14 px em tabelas e 16 px em formulários.
- Filtros importantes ficam visíveis; filtros avançados podem ser recolhidos.
- Tabelas usam cabeçalhos claros, números tabulares, ordenação nomeada e paginação previsível.
- Ações por linha ficam em menu; ação principal da página permanece visível.
- Operações em lote devem informar quantos registros serão afetados.

Padrões específicos:

- **Importação:** fluxo em etapas — arquivo, competência e coluna, prévia, validação e resultado.
- **Conciliação:** comparação lado a lado, nível de confiança em texto e decisão manual explícita.
- **Produtos:** prévia da foto, pontos, estoque, status e histórico de alterações.
- **Resgates:** código, entregador, item, pontos, competência, data e status.
- **Ajuste de pontos:** exigir motivo e mostrar saldo antes/depois.
- **Auditoria:** registrar ator, ação, entidade, data e valores alterados.

Nunca usar menta para indicar apenas que uma linha está selecionada; menta representa destaque positivo. Seleção usa azul claro.

## Linguagem da interface

Usar português direto, voz ativa e verbos específicos.

| Contexto | Preferir |
| --- | --- |
| Login | “Entrar” |
| Resgate | “Resgatar item” |
| Confirmação | “Confirmar resgate” |
| Produto | “Salvar produto” |
| Importação | “Importar planilha” |
| Conciliação | “Confirmar vínculo” |
| Falha | “Não foi possível concluir o resgate. Atualize a página e tente novamente.” |

Evitar “OK”, “Clique aqui”, “Sucesso!”, mensagens genéricas e linguagem promocional dentro do admin. A mensagem de erro deve dizer o que aconteceu e qual é o próximo passo.

## Movimento

- Transições de cor e elevação: 150 ms.
- Entrada de modal e painel: até 220 ms.
- Usar apenas `opacity` e `transform` quando possível.
- Não usar parallax, partículas, vídeo de fundo ou desfoques pesados.
- Respeitar `prefers-reduced-motion`.
- Nunca atrasar feedback de resgate, estoque ou importação para completar uma animação.

## Acessibilidade

Meta: WCAG 2.2 nível AA.

- `#0F1849` sobre branco: contraste aproximado de 16,9:1.
- Branco sobre `#2C67EA`: contraste aproximado de 5,0:1.
- `#0F4938` sobre `#2CEABC`: contraste aproximado de 6,7:1.
- Menta sobre branco: aproximadamente 1,5:1; não usar para texto, borda isolada ou ícone essencial.
- Foco visível de pelo menos 3 px, sem depender apenas de mudança de cor.
- Ordem de foco deve seguir a ordem visual.
- Todos os fluxos precisam funcionar por teclado.
- Modal deve prender foco, ter título anunciado e devolver foco ao acionador.
- Atualizações de saldo, resgate e importação devem ser anunciadas por região ao vivo apropriada, sem repetir mensagens.
- Imagens de produto precisam de texto alternativo útil; formas decorativas usam texto alternativo vazio.
- Ícones sem texto precisam de nome acessível.
- Tabelas precisam de cabeçalhos associados, legenda quando necessária e ação acessível por teclado.
- Não comunicar expiração, estoque ou erro apenas pela cor.
- Suportar zoom de 200%, texto ampliado e orientação retrato/paisagem.
- Validar contraste novamente após qualquer mudança de token.

## Checklist de aceite visual

- Azul e branco dominam a interface; menta é acento.
- Saldo, competência e expiração aparecem sem navegação extra.
- O custo em pontos é mais importante que o valor monetário de referência.
- Nenhum ativo oficial foi copiado sem autorização.
- Loja funciona entre 320 px e desktop sem rolagem horizontal.
- Admin mantém legibilidade em tabelas e formulários.
- Todos os componentes possuem estados de foco, carregamento, vazio, erro e desabilitado.
- Contraste, teclado, leitor de tela e movimento reduzido foram verificados.
