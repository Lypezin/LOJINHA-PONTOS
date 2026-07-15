# PRODUCT.md — Lojinha EntreGô

## Visão Geral do Produto
A **Lojinha EntreGô** é uma plataforma interna de engajamento e fidelidade para a rede de entregadores parceiros da EntreGô. O sistema permite que entregadores acumulem pontos com base em seu desempenho mensal (competências) e os troquem por produtos físicos ou prêmios no catálogo da loja virtual.

## Público-Alvo
*   **Entregadores**: Usuários finais que acessam a loja virtual para resgatar produtos usando seu saldo acumulado de pontos.
*   **Administradores**: Gestores internos que controlam o catálogo de produtos, gerenciam a fila de pedidos/resgates, conciliam cadastros de CNPJ e importam planilhas mensais de desempenho de pontos.

## Fluxos Principais
1.  **Loja Virtual & Resgate**:
    *   Entregadores navegam pelos produtos do catálogo.
    *   Fazem resgate de produtos limitados pelo estoque disponível e pelo saldo de pontos da competência atual.
    *   Cada resgate gera um histórico e é auditado para garantir a consistência do saldo.
2.  **Importação de Desempenho (Painel Admin)**:
    *   Os administradores sobem planilhas Excel contendo o UUID dos entregadores, praças e pontos ganhos na competência.
    *   A plataforma valida a planilha, realiza o matching aproximado de CNPJs e atualiza as contas em lote.
3.  **Conciliação de Cadastro**:
    *   Identificação de divergências cadastrais e associação manual de CNPJ para assegurar a conformidade fiscal dos entregadores.

## Regras de Negócio Críticas
*   **Saldo Não-Negativo**: Sob nenhuma hipótese o saldo de pontos de um entregador pode ficar negativo.
*   **Concorrência Otimista**: Alterações de saldo de pontos e estoque de produtos devem ser protegidas contra disputas concorrentes (race conditions) usando controle de versão (`version`).
*   **Consistência de Ledger**: Qualquer entrada ou saída de pontos da conta do entregador deve gerar um registro correspondente na tabela `PointLedgerEntry` (auditoria).
