# Análise do arquivo `ATT LOJINHA.xlsx`

Análise realizada sem expor dados pessoais completos.

## Estrutura encontrada

### Guia `BANCO DE DADOS`

- 32.758 linhas de dados e 19 colunas.
- Período coberto: 01/07/2026 a 12/07/2026.
- 1.471 identificadores únicos de entregadores e 1.471 nomes únicos.
- O identificador da coluna F (`id_da_pessoa_entregadora`) é um UUID de 36 caracteres, não um CPF.
- A coluna R é `numero_de_pedidos_aceitos_e_concluidos`.
- Todos os valores lidos na coluna R são inteiros e não negativos.
- Soma bruta da coluna R no arquivo: 107.378 pontos.
- 1.301 entregadores possuem pontos positivos e 170 possuem zero; a mediana agregada é 49, o percentil 90 é 182 e o maior total individual é 446.
- Existem três linhas totalmente duplicadas, mas todas possuem zero pontos e não alteram o total.
- Como um entregador aparece em várias linhas/dias/praças, a importação deve agrupar por `id_da_pessoa_entregadora` e somar a coluna escolhida.

### Guia `DADOS CNPJ`

- 3.141 linhas, com as colunas `ENTREGADOR` e `CNPJ`.
- Todos os documentos possuem 14 dígitos; a guia não contém CPF.
- 3.139 CNPJs passam na validação dos dígitos verificadores e 2 são inválidos.
- Existem 2.941 CNPJs únicos; 36 nomes apontam para dois CNPJs e 193 CNPJs aparecem associados a dois nomes.
- Existem nomes e documentos repetidos, portanto uma correspondência não pode ser aceita automaticamente apenas por haver uma sugestão.

## Correspondência inicial por nome

- 1.356 dos 1.471 nomes da guia principal (92,18%) possuem correspondência após normalização de acentos, espaços e pontuação.
- 1.338 apontam para um único CNPJ e podem ser pré-vinculados; 18 apontam para dois CNPJs e exigem decisão do administrador.
- 115 nomes não possuem correspondência normalizada. A comparação aproximada encontrou somente 3 sugestões fortes e 16 razoáveis; até as fortes devem ser confirmadas manualmente.
- Por volume de linhas, 96,46% possuem vínculo único, 0,96% são ambíguas e 2,58% estão sem vínculo.

## Implicação para o cadastro por CPF

O arquivo fornecido não contém CPF. Um CPF não pode ser derivado de um CNPJ ou do UUID do entregador. Por isso:

1. a importação cria/atualiza o entregador pelo UUID externo;
2. o sistema tenta vincular o CNPJ pelo nome;
3. o painel administrativo apresenta pendências de CNPJ e de CPF;
4. o administrador informa o CPF correto manualmente ou por uma futura planilha que contenha esse campo;
5. somente depois disso o entregador consegue criar sua conta usando o CPF.

Essa regra evita vincular uma conta ao entregador errado.

## Estratégia de importação

- A competência é escolhida no envio e validada contra as datas do arquivo.
- O administrador escolhe a coluna de pontos; a coluna R vem pré-selecionada.
- A configuração é salva pelo nome canônico do cabeçalho, usando a letra apenas como metadado, para continuar correta se a ordem das colunas mudar.
- Linhas são agrupadas pelo UUID do entregador.
- O arquivo e as opções geram uma assinatura (`hash`) para detectar repetição.
- Uma reimportação substitui o crédito-base daquela competência e lança apenas a diferença, sem duplicar saldo.
- Créditos, ajustes, resgates e expirações são mantidos em lançamentos separados e auditáveis.
- Valores inválidos, negativos, nomes conflitantes ou documentos ambíguos entram no relatório do lote.
